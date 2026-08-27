from django.contrib import admin

from .models import Session


@admin.register(Session)
class SessionAdmin(admin.ModelAdmin):
    list_display = ("title", "creator", "start_at", "capacity", "seats_taken", "is_public")
    list_filter = ("is_public",)
    search_fields = ("title", "creator__email")
    readonly_fields = ("seats_taken", "created_at", "updated_at")
