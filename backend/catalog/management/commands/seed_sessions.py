"""
Populate the catalog with a spread of demo sessions across different topics, so
the app looks like a real marketplace and not a tech-only demo.

    docker compose exec backend python manage.py seed_sessions
    docker compose exec backend python manage.py seed_sessions --reset
"""

from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from accounts.models import User
from bookings.models import Booking
from catalog.models import Session

HOSTS = [
    ("elena.ruiz", "Elena Ruiz", "elena@example.com"),
    ("marcus.bell", "Marcus Bell", "marcus@example.com"),
    ("aditi.sharma", "Aditi Sharma", "aditi@example.com"),
    ("theo.lindqvist", "Theo Lindqvist", "theo@example.com"),
]

# (title, description, days_from_now, hour_of_day, duration_min, capacity)
SESSIONS = [
    ("Conversational Spanish · 1-on-1", "Relaxed 45-minute conversation practice, pitched to your level. Leave with three phrases you'll actually use.", 2, 18, 45, 1),
    ("Vinyasa Flow", "A steady all-levels flow to wake the body up. Bring a mat; modifications offered throughout.", 3, 8, 60, 14),
    ("Portfolio review for junior designers", "Bring 2-3 pieces. We'll go through story, craft and what to cut, with written notes after.", 5, 17, 45, 4),
    ("Intro to fingerstyle guitar", "Thumb independence, a simple travis-picking pattern, and one full song by the end.", 4, 19, 60, 6),
    ("Mock product-manager interview", "A realistic 45-minute loop — product sense plus execution — followed by candid feedback.", 6, 12, 45, 3),
    ("Sourdough, start to finish", "Build a starter, shape a boule, and understand the timings so you can repeat it at home.", 7, 10, 120, 8),
    ("Career check-in for switchers", "Thirty focused minutes on your next move: framing the story, targets, and a two-week plan.", 8, 16, 30, 1),
    ("Watercolour: loose florals", "Wet-on-wet washes, letting the water do the work. Materials list sent on booking.", 10, 11, 90, 10),
]


class Command(BaseCommand):
    help = "Create demo sessions across a range of topics."

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Delete existing demo sessions/bookings first.",
        )

    def handle(self, *args, **opts):
        hosts = []
        for username, name, email in HOSTS:
            user, _ = User.objects.update_or_create(
                username=username,
                defaults={
                    "email": email,
                    "full_name": name,
                    "is_creator": True,
                    "google_sub": f"seed-{username}",
                },
            )
            hosts.append(user)

        if opts["reset"]:
            qs = Session.objects.filter(creator__in=hosts)
            Booking.objects.filter(session__in=qs).delete()
            deleted, _ = qs.delete()
            self.stdout.write(f"removed {deleted} existing demo rows")

        base = timezone.now().replace(minute=0, second=0, microsecond=0)
        created = 0
        for i, (title, desc, days, hour, minutes, capacity) in enumerate(SESSIONS):
            host = hosts[i % len(hosts)]
            start = (base + timedelta(days=days)).replace(hour=hour)
            _, made = Session.objects.get_or_create(
                title=title,
                creator=host,
                defaults={
                    "description": desc,
                    "start_at": start,
                    "duration_minutes": minutes,
                    "capacity": capacity,
                    "is_public": True,
                },
            )
            created += int(made)

        self.stdout.write(self.style.SUCCESS(f"{created} sessions created "
                                             f"({len(SESSIONS) - created} already existed)"))
