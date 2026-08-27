from rest_framework import serializers

from .models import User


class UserSerializer(serializers.ModelSerializer):
    """Public shape of a user. `role` is derived and read-only."""

    role = serializers.CharField(read_only=True)

    class Meta:
        model = User
        fields = ["id", "email", "full_name", "bio", "avatar_url", "is_creator", "role"]
        # email/avatar come from Google; role is derived; id is the PK.
        read_only_fields = ["id", "email", "avatar_url", "role"]


class GoogleLoginSerializer(serializers.Serializer):
    id_token = serializers.CharField()
