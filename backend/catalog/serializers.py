from django.utils import timezone
from rest_framework import serializers

from accounts.models import User

from .models import Session


class CreatorMiniSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "full_name", "email"]


class SessionSerializer(serializers.ModelSerializer):
    """
    Read + write. `creator`, `seats_taken` and the timestamps are server-owned.
    `remaining_seats` / `has_started` / `end_at` are derived and read-only —
    the frontend uses them for display only.
    """

    creator = CreatorMiniSerializer(read_only=True)
    end_at = serializers.DateTimeField(read_only=True)
    remaining_seats = serializers.IntegerField(read_only=True)
    has_started = serializers.BooleanField(read_only=True)

    class Meta:
        model = Session
        fields = [
            "id", "title", "description", "creator",
            "start_at", "duration_minutes", "end_at",
            "capacity", "seats_taken", "remaining_seats",
            "is_public", "has_started",
            "created_at", "updated_at",
        ]
        read_only_fields = [
            "id", "creator", "seats_taken", "created_at", "updated_at",
        ]

    def validate_start_at(self, value):
        # Enforce "in the future" only when creating. Editing other fields on a
        # session that has already started stays allowed.
        if self.instance is None and value <= timezone.now():
            raise serializers.ValidationError("start_at must be in the future.")
        return value

    def validate_duration_minutes(self, value):
        if value <= 0:
            raise serializers.ValidationError("duration_minutes must be at least 1.")
        return value

    def validate_capacity(self, value):
        if value <= 0:
            raise serializers.ValidationError("capacity must be at least 1.")
        if self.instance and value < self.instance.seats_taken:
            raise serializers.ValidationError(
                f"capacity cannot be lower than seats already booked "
                f"({self.instance.seats_taken})."
            )
        return value
