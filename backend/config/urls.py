from django.contrib import admin
from django.http import JsonResponse
from django.urls import path


def health(_request):
    """Liveness probe used by docker-compose / nginx. No DB access on purpose."""
    return JsonResponse({"status": "ok"})


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", health, name="health"),
]
