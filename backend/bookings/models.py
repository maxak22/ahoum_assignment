from django.conf import settings
from django.db import models


class Booking(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        CANCELLED = "cancelled", "Cancelled"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="bookings"
    )
    session = models.ForeignKey(
        "catalog.Session", on_delete=models.CASCADE, related_name="bookings"
    )
    status = models.CharField(
        max_length=16, choices=Status.choices, default=Status.ACTIVE
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            # Partial unique index: at most one ACTIVE booking per (user, session).
            # Cancelled rows don't count, so a user can cancel and rebook.
            # This is what makes "can't book the same session twice" race-safe —
            # it's enforced by Postgres, not by an application check.
            models.UniqueConstraint(
                fields=["user", "session"],
                condition=models.Q(status="active"),
                name="uniq_active_booking_per_user_session",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.user} -> {self.session} ({self.status})"

    @property
    def is_past(self) -> bool:
        """A booking is 'past' once it's cancelled or its session has started."""
        return self.status == self.Status.CANCELLED or self.session.has_started
