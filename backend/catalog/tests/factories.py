"""Small helpers shared by catalog + bookings tests."""

from datetime import timedelta

from django.utils import timezone

from accounts.models import User
from catalog.models import Session


def make_user(email, is_creator=False, **extra):
    return User.objects.create(
        username=email.split("@")[0],
        email=email,
        is_creator=is_creator,
        google_sub=f"test-{email}",
        **extra,
    )


def make_session(creator, *, capacity=10, starts_in=timedelta(days=1),
                 duration_minutes=60, is_public=True, title="Test session"):
    return Session.objects.create(
        title=title,
        description="",
        creator=creator,
        start_at=timezone.now() + starts_in,
        duration_minutes=duration_minutes,
        capacity=capacity,
        is_public=is_public,
    )
