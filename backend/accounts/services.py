"""
Google ID-token verification + user upsert + JWT issuing.

Kept out of views.py so the logic is unit-testable and the view stays a thin
HTTP wrapper.
"""

from django.conf import settings
from django.db import IntegrityError, transaction
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from rest_framework_simplejwt.tokens import RefreshToken

from .models import User

GOOGLE_ISSUERS = {"accounts.google.com", "https://accounts.google.com"}


class GoogleAuthError(Exception):
    """Google ID token missing, malformed, expired, or untrusted."""


def verify_google_id_token(raw_token: str) -> dict:
    """Return the verified token claims, or raise GoogleAuthError."""
    if not raw_token:
        raise GoogleAuthError("Missing id_token.")
    if not settings.GOOGLE_OAUTH_CLIENT_ID:
        raise GoogleAuthError("Google login is not configured on the server.")

    try:
        # verify_oauth2_token checks: RS256 signature against Google's published
        # public keys (JWKS, cached), `aud` == our client id, and `exp`.
        payload = google_id_token.verify_oauth2_token(
            raw_token,
            google_requests.Request(),
            settings.GOOGLE_OAUTH_CLIENT_ID,
        )
    except ValueError as exc:
        raise GoogleAuthError("Invalid or expired Google token.") from exc

    # Belt-and-braces checks on top of the library's.
    if payload.get("iss") not in GOOGLE_ISSUERS:
        raise GoogleAuthError("Untrusted token issuer.")
    if not payload.get("email"):
        raise GoogleAuthError("Google account has no email address.")
    if payload.get("email_verified") not in (True, "true"):
        raise GoogleAuthError("Google email address is not verified.")

    return payload


def upsert_user_from_google(payload: dict) -> User:
    """Find or create the User for these Google claims. Identity key = `sub`."""
    sub = payload["sub"]
    email = payload["email"].strip().lower()
    name = payload.get("name", "")
    picture = payload.get("picture", "")

    try:
        with transaction.atomic():
            user, created = User.objects.get_or_create(
                google_sub=sub,
                defaults={
                    "username": _unique_username(email),
                    "email": email,
                    "full_name": name,
                    "avatar_url": picture,
                },
            )
    except IntegrityError:
        # Email already belongs to an account created another way (e.g. in the
        # Django admin). Link this Google identity to that existing account.
        user = User.objects.get(email=email)
        user.google_sub = sub
        created = False

    if not created:
        # Refresh name/photo from Google; never overwrite a user-edited bio.
        user.full_name = name or user.full_name
        user.avatar_url = picture or user.avatar_url
        user.save(update_fields=["google_sub", "full_name", "avatar_url"])

    return user


def issue_tokens(user: User) -> dict:
    refresh = RefreshToken.for_user(user)
    return {"access": str(refresh.access_token), "refresh": str(refresh)}


def _unique_username(email: str) -> str:
    base = email.split("@")[0][:140] or "user"
    candidate, i = base, 1
    while User.objects.filter(username=candidate).exists():
        i += 1
        candidate = f"{base}{i}"
    return candidate
