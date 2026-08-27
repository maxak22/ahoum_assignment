from rest_framework import serializers

from catalog.serializers import SessionSerializer

from .models import Booking


class BookingSerializer(serializers.ModelSerializer):
    session = SessionSerializer(read_only=True)
    is_past = serializers.BooleanField(read_only=True)

    class Meta:
        model = Booking
        fields = ["id", "session", "status", "is_past", "created_at", "updated_at"]
        read_only_fields = fields
