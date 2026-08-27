from django.db.models import Q
from rest_framework import viewsets

from accounts.permissions import IsCreatorOrReadOnly, IsOwnerOrReadOnly

from .models import Session
from .serializers import SessionSerializer


class SessionViewSet(viewsets.ModelViewSet):
    """
    /api/sessions/           GET  list   (public sessions; + your own if authed)
    /api/sessions/?mine=1    GET  list   (your own sessions, incl. private)
    /api/sessions/{id}/      GET  detail
    /api/sessions/           POST create   (creators only -> 403 otherwise)
    /api/sessions/{id}/      PATCH/PUT/DELETE   (owning creator only -> 403 otherwise)

    Authorization is enforced here on the backend. The React app hides buttons
    for UX only.
    """

    serializer_class = SessionSerializer
    permission_classes = [IsCreatorOrReadOnly, IsOwnerOrReadOnly]

    def get_queryset(self):
        qs = Session.objects.select_related("creator")
        user = self.request.user

        if self.request.query_params.get("mine") in ("1", "true"):
            if not user.is_authenticated:
                return qs.none()
            return qs.filter(creator=user)

        if user.is_authenticated:
            # everyone sees public sessions; a creator also sees their own private ones
            return qs.filter(Q(is_public=True) | Q(creator=user))
        return qs.filter(is_public=True)

    def perform_create(self, serializer):
        serializer.save(creator=self.request.user)
