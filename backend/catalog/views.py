from django.db.models import Q
from rest_framework import permissions, viewsets

from .models import Session
from .serializers import SessionSerializer


class SessionViewSet(viewsets.ModelViewSet):
    """
    /api/sessions/           GET  list   (public sessions; + your own if authed)
    /api/sessions/?mine=1    GET  list   (your own sessions, incl. private)
    /api/sessions/{id}/      GET  detail
    /api/sessions/           POST create
    /api/sessions/{id}/      PATCH/PUT/DELETE

    NOTE: permissions here are still coarse (`IsAuthenticatedOrReadOnly`).
    Phase 5 replaces this with IsCreator + object-level ownership so a normal
    User gets 403 on create and a Creator gets 403 editing someone else's session.
    """

    serializer_class = SessionSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

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
