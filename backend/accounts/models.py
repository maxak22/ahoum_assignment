from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """
    Custom user model. One account type; "Creator" is an additive capability
    flag, not a separate model (see DECISIONS.md #4).

    Identity is keyed on `google_sub` (Google's stable subject id), NOT email:
    a Google account's email can change, `sub` never does. `google_sub` is
    nullable so admin/superuser accounts created without Google are still valid
    (Postgres allows many NULLs under a UNIQUE constraint).
    """

    google_sub = models.CharField(
        max_length=255, unique=True, null=True, blank=True,
        help_text="Google 'sub' claim. Null for non-Google (admin) accounts.",
    )
    # Django's AbstractUser does NOT make email unique. We do, because it's a
    # real-world identifier and we use it for account linking.
    email = models.EmailField(unique=True)

    is_creator = models.BooleanField(
        default=False,
        help_text="Self-serve flag. A creator keeps all normal user abilities.",
    )

    full_name = models.CharField(max_length=255, blank=True)
    avatar_url = models.URLField(blank=True)
    bio = models.TextField(blank=True)

    REQUIRED_FIELDS = ["email"]  # prompted by createsuperuser (username is USERNAME_FIELD)

    @property
    def role(self) -> str:
        """Convenience for the frontend. Authorization never reads this string;
        it checks `is_creator` / object ownership directly."""
        return "creator" if self.is_creator else "user"

    def __str__(self) -> str:
        return self.email or self.username
