from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import BookingViewSet, BookSessionView

router = DefaultRouter()
router.register("bookings", BookingViewSet, basename="booking")

urlpatterns = [
    path("sessions/<int:session_id>/book/", BookSessionView.as_view(), name="session-book"),
    *router.urls,
]
