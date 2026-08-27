from django.contrib.auth.models import AbstractUser


class User(AbstractUser):
    """
    Custom user model.

    Deliberately empty for now. It exists from the very first migration only
    because AUTH_USER_MODEL cannot be swapped later without a painful manual
    migration. The auth phase adds the real fields:
    google_sub, is_creator, full_name, avatar_url, bio.
    """

    pass
