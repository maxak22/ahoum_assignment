from django.conf import settings
from django.http import Http404
from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import User
from .serializers import GoogleLoginSerializer, UserSerializer
from .services import (
    GoogleAuthError,
    issue_tokens,
    upsert_user_from_google,
    verify_google_id_token,
)


class GoogleLoginView(APIView):
    """
    POST { id_token } -> { access, refresh, user }

    Exchanges a Google ID token for our own JWT pair. This is the only place
    Google is involved; every other endpoint trusts our access token.
    """

    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = GoogleLoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            claims = verify_google_id_token(serializer.validated_data["id_token"])
        except GoogleAuthError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        user = upsert_user_from_google(claims)
        if not user.is_active:
            return Response(
                {"detail": "This account has been disabled."},
                status=status.HTTP_403_FORBIDDEN,
            )

        return Response({**issue_tokens(user), "user": UserSerializer(user).data})


class DevLoginView(APIView):
    """
    POST { email, is_creator } -> { access, refresh, user }

    Passwordless email sign-in so a reviewer can click through the UI without a
    Google account. Gated by settings.ALLOW_EMAIL_LOGIN (defaults to DEBUG) so
    it's off unless explicitly turned on; returns 404 when disabled.
    """

    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        if not settings.ALLOW_EMAIL_LOGIN:
            raise Http404()

        email = (request.data.get("email") or "").strip().lower()
        if not email:
            return Response({"detail": "email is required."}, status=400)

        is_creator = bool(request.data.get("is_creator", False))
        user, _ = User.objects.get_or_create(
            email=email,
            defaults={
                "username": email.split("@")[0],
                "google_sub": f"dev-{email}",
                "full_name": email.split("@")[0].replace(".", " ").title(),
                "is_creator": is_creator,
            },
        )
        return Response({**issue_tokens(user), "user": UserSerializer(user).data})


class MeView(generics.RetrieveUpdateAPIView):
    """
    GET   /api/auth/me/  -> current user
    PATCH /api/auth/me/  -> update full_name / bio / is_creator (the self-serve
                            "become a creator" toggle)
    """

    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user
