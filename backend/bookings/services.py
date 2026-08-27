"""
The booking rules live here, not in the view, so they run in one place and are
easy to test. Correctness explanation: DECISIONS.md #2.
"""

from django.db import IntegrityError, transaction
from django.db.models import F

from catalog.models import Session

from .models import Booking


class BookingError(Exception):
    """Base class for booking rule violations. `status_code` -> HTTP response."""

    status_code = 409
    default_detail = "Booking could not be completed."

    def __init__(self, detail: str | None = None):
        self.detail = detail or self.default_detail
        super().__init__(self.detail)


class SessionNotFound(BookingError):
    status_code = 404
    default_detail = "Session not found."


class BookingNotFound(BookingError):
    status_code = 404
    default_detail = "Booking not found."


class SessionAlreadyStarted(BookingError):
    default_detail = "This session has already started."


class SessionFull(BookingError):
    default_detail = "This session is fully booked."


class AlreadyBooked(BookingError):
    default_detail = "You already have an active booking for this session."


class CannotBookOwnSession(BookingError):
    status_code = 400
    default_detail = "You cannot book your own session."


@transaction.atomic
def book_session(user, session_id: int) -> Booking:
    """
    Concurrency-safe booking.

    `select_for_update()` locks the session row for the rest of this
    transaction. A second concurrent booking for the same session blocks on
    that SELECT until we commit, then re-reads the updated seats_taken. So the
    check-then-insert-then-increment below runs serially per session and can
    never oversell.
    """
    try:
        session = Session.objects.select_for_update().get(pk=session_id)
    except Session.DoesNotExist:
        raise SessionNotFound()

    if session.creator_id == user.id:
        raise CannotBookOwnSession()

    if session.has_started:
        raise SessionAlreadyStarted()

    # Friendly early check for a nicer message. The partial unique index below
    # is still the real, race-safe guard against double booking.
    already = Booking.objects.filter(
        user=user, session=session, status=Booking.Status.ACTIVE
    ).exists()
    if already:
        raise AlreadyBooked()

    if session.seats_taken >= session.capacity:
        raise SessionFull()

    try:
        booking = Booking.objects.create(
            user=user, session=session, status=Booking.Status.ACTIVE
        )
    except IntegrityError:
        # Lost the race between the check above and here -> unique index caught it.
        raise AlreadyBooked()

    # Keep the denormalised counter in step. CHECK (seats_taken <= capacity) is
    # the last-resort guard if the lock above were ever removed.
    Session.objects.filter(pk=session.pk).update(seats_taken=F("seats_taken") + 1)

    return booking


@transaction.atomic
def cancel_booking(user, booking_id: int) -> Booking:
    """Cancel one of the caller's own bookings and free the seat."""
    try:
        booking = Booking.objects.select_for_update().get(pk=booking_id, user=user)
    except Booking.DoesNotExist:
        raise BookingNotFound()

    if booking.status == Booking.Status.CANCELLED:
        return booking  # idempotent

    # Lock the session row too, so the counter decrement can't race a booking.
    session = Session.objects.select_for_update().get(pk=booking.session_id)
    if session.has_started:
        raise SessionAlreadyStarted(
            "Cannot cancel a booking for a session that has already started."
        )

    booking.status = Booking.Status.CANCELLED
    booking.save(update_fields=["status", "updated_at"])

    Session.objects.filter(pk=session.pk).update(seats_taken=F("seats_taken") - 1)

    return booking
