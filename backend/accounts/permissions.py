from rest_framework.permissions import SAFE_METHODS, BasePermission


class IsCreatorOrReadOnly(BasePermission):
    """
    Safe methods (GET/HEAD/OPTIONS): allowed for anyone.
    Write methods: only authenticated users with `is_creator=True`.

    An anonymous write request falls through to DRF's 401 (NotAuthenticated);
    an authenticated non-creator gets 403 (PermissionDenied). DRF decides which
    based on whether authentication succeeded.
    """

    message = (
        "Only creators can perform this action. "
        "Turn on creator mode from your profile first."
    )

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.is_creator
        )


class IsOwnerOrReadOnly(BasePermission):
    """
    Object-level check: a creator may only modify or delete their *own* session.
    Runs after IsCreatorOrReadOnly, so by the time we get here the caller is a
    creator; this just stops creator A touching creator B's session.
    """

    message = "You can only modify your own sessions."

    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True
        return obj.creator_id == request.user.id
