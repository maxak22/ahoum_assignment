from datetime import timedelta

from django.conf import settings
from django.db import models
from django.utils import timezone


class Session(models.Model):
    """
    A bookable session published by a Creator.

    We store `duration_minutes`, not `end_at`: one source of truth, and it's
    impossible to represent "ends before it starts". `end_at` is derived.

    `seats_taken` is a denormalised counter kept in sync by the booking service
    under a row lock (see bookings/services.py). The CHECK constraint
    `seats_taken <= capacity` is the database-level guarantee that capacity can
    never be exceeded, independent of application code.
    """

    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    creator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="sessions",
    )

    start_at = models.DateTimeField()
    duration_minutes = models.PositiveIntegerField()
    capacity = models.PositiveIntegerField()
    seats_taken = models.PositiveIntegerField(default=0)

    is_public = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["start_at"]
        indexes = [
            # the catalog query: public sessions ordered by start time
            models.Index(fields=["is_public", "start_at"], name="session_public_start_idx"),
        ]
        constraints = [
            # PositiveIntegerField already gives us `>= 0` at the DB level; these
            # add the domain rules on top.
            models.CheckConstraint(
                check=models.Q(capacity__gt=0),
                name="session_capacity_positive",
            ),
            models.CheckConstraint(
                check=models.Q(duration_minutes__gt=0),
                name="session_duration_positive",
            ),
            models.CheckConstraint(
                check=models.Q(seats_taken__lte=models.F("capacity")),
                name="session_seats_within_capacity",
            ),
        ]

    def __str__(self) -> str:
        return self.title

    @property
    def end_at(self):
        return self.start_at + timedelta(minutes=self.duration_minutes)

    @property
    def remaining_seats(self) -> int:
        """Informational only. The backend never trusts a client-supplied value;
        booking correctness is enforced in bookings/services.py."""
        return max(self.capacity - self.seats_taken, 0)

    @property
    def has_started(self) -> bool:
        return self.start_at <= timezone.now()
