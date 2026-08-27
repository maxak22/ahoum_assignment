"""
Reproducible race demo against the REAL database (not the test DB).

    docker compose exec backend python manage.py demo_race
    docker compose exec backend python manage.py demo_race --concurrency 20 --capacity 3

Creates a throwaway session + N users, fires N booking requests from N threads
released simultaneously by a barrier, and reports the outcome. Cleans up after
itself. This is the same scenario as bookings/tests/test_concurrency.py, in a
form you can run in front of someone.
"""

import threading
from collections import Counter
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db import connections, transaction
from django.utils import timezone

from accounts.models import User
from bookings.models import Booking
from bookings.services import BookingError, book_session
from catalog.models import Session


class Command(BaseCommand):
    help = "Fire N concurrent bookings at one session and report whether it oversells."

    def add_arguments(self, parser):
        parser.add_argument("--concurrency", type=int, default=2)
        parser.add_argument("--capacity", type=int, default=1)

    def handle(self, *args, **opts):
        n = opts["concurrency"]
        capacity = opts["capacity"]

        creator = User.objects.create(
            username="_demo_race_creator",
            email="_demo_race_creator@example.com",
            is_creator=True,
            google_sub="_demo-race-creator",
        )
        session = Session.objects.create(
            title="_demo_race",
            creator=creator,
            start_at=timezone.now() + timedelta(days=1),
            duration_minutes=60,
            capacity=capacity,
        )
        users = [
            User.objects.create(
                username=f"_demo_racer{i}",
                email=f"_demo_racer{i}@example.com",
                google_sub=f"_demo-racer-{i}",
            )
            for i in range(n)
        ]

        barrier = threading.Barrier(n)
        outcomes = [None] * n

        def worker(i):
            try:
                barrier.wait(timeout=10)
                book_session(users[i], session.id)
                outcomes[i] = "OK"
            except BookingError as exc:
                outcomes[i] = f"rejected: {exc.detail}"
            except Exception as exc:  # noqa: BLE001 - surface anything unexpected
                outcomes[i] = f"ERROR: {exc!r}"
            finally:
                connections.close_all()

        threads = [threading.Thread(target=worker, args=(i,)) for i in range(n)]
        for t in threads:
            t.start()
        for t in threads:
            t.join(timeout=15)

        session.refresh_from_db()
        active = Booking.objects.filter(session=session, status="active").count()

        self.stdout.write("")
        self.stdout.write(f"  concurrency        : {n}")
        self.stdout.write(f"  capacity           : {capacity}")
        for reason, count in Counter(outcomes).items():
            self.stdout.write(f"  {reason:<40}: {count}")
        self.stdout.write(f"  active bookings now : {active}")
        self.stdout.write(f"  seats_taken         : {session.seats_taken}")

        oversold = active > capacity or session.seats_taken > capacity
        verdict = self.style.ERROR("OVERSOLD ✗") if oversold else self.style.SUCCESS("safe ✓")
        self.stdout.write(f"  verdict             : {verdict}")

        # cleanup
        with transaction.atomic():
            Booking.objects.filter(session=session).delete()
            session.delete()
            User.objects.filter(username__startswith="_demo_rac").delete()
            User.objects.filter(username="_demo_race_creator").delete()
