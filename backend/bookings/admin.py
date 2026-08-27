from django.contrib import admin

from .models import Booking


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "session", "status", "created_at")
    list_filter = ("status",)
    search_fields = ("user__email", "session__title")
    readonly_fields = ("created_at", "updated_at")
