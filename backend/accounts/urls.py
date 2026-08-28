from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .views import DevLoginView, GoogleLoginView, MeView

urlpatterns = [
    path("auth/google/", GoogleLoginView.as_view(), name="auth-google"),
    path("auth/dev-login/", DevLoginView.as_view(), name="auth-dev-login"),
    path("auth/refresh/", TokenRefreshView.as_view(), name="auth-refresh"),
    path("auth/me/", MeView.as_view(), name="auth-me"),
]
