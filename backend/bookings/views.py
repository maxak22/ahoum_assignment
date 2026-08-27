from django.utils import timezone
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Booking
from .serializers import BookingSerializer
from .services import BookingError, book_session, cancel_booking


def _error_response(exc: BookingError) -> Response:
    return Response({"detail": exc.detail}, status=exc.status_code)


class BookSessionView(APIView):
    """POST /api/sessions/{id}/book/  -> 201 with the new booking, or 4xx."""

    permission_classes = [IsAuthenticated]

    def post(self, request, session_id: int):
        try:
            booking = book_session(request.user, session_id)
        except BookingError as exc:
            return _error_response(exc)
        return Response(BookingSerializer(booking).data, status=201)


class BookingViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """
    GET /api/bookings/              -> the caller's bookings
    GET /api/bookings/?status=active -> active only (status active & session not started)
    GET /api/bookings/?status=past   -> everything else
    POST /api/bookings/{id}/cancel/  -> cancel one of the caller's bookings
    """

    serializer_class = BookingSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = (
            Booking.objects
            .select_related("session", "session__creator")
            .filter(user=self.request.user)
        )
        bucket = self.request.query_params.get("status")
        now = timezone.now()
        active = {"status": Booking.Status.ACTIVE, "session__start_at__gt": now}
        if bucket == "active":
            return qs.filter(**active)
        if bucket == "past":
            return qs.exclude(**active)
        return qs

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk: int):
        try:
            booking = cancel_booking(request.user, pk)
        except BookingError as exc:
            return _error_response(exc)
        return Response(BookingSerializer(booking).data, status=200)
