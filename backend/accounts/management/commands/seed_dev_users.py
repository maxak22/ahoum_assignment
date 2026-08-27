"""
Create predictable dev users and print fresh JWTs, so we can exercise the API
(and the concurrency script) without a real Google login.

    docker compose exec backend python manage.py seed_dev_users
"""

from django.core.management.base import BaseCommand

from accounts.models import User
from accounts.services import issue_tokens

DEV_USERS = [
    {"username": "dev_user", "email": "user@example.com", "is_creator": False},
    {"username": "dev_creator", "email": "creator@example.com", "is_creator": True},
    {"username": "dev_user2", "email": "user2@example.com", "is_creator": False},
]


class Command(BaseCommand):
    help = "Create/refresh dev users and print JWT access + refresh tokens."

    def handle(self, *args, **options):
        for spec in DEV_USERS:
            user, created = User.objects.update_or_create(
                username=spec["username"],
                defaults={
                    "email": spec["email"],
                    "is_creator": spec["is_creator"],
                    "google_sub": f"dev-{spec['username']}",
                    "full_name": spec["username"].replace("_", " ").title(),
                },
            )
            tokens = issue_tokens(user)
            label = "creator" if spec["is_creator"] else "user"
            verb = "created" if created else "updated"
            self.stdout.write(
                self.style.SUCCESS(f"\n{spec['username']} ({label}) — {verb}")
            )
            self.stdout.write(f"  access:  {tokens['access']}")
            self.stdout.write(f"  refresh: {tokens['refresh']}")
