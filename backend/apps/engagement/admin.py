from django.contrib import admin

from apps.engagement.models import ContactMessage, Notification, Review


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ("product", "user", "rating", "status", "is_approved", "created_at")
    list_filter = ("status", "is_approved", "rating")
    search_fields = ("title", "body", "user__email", "product__sku")


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ("user", "title", "is_read", "created_at")
    list_filter = ("is_read", "channel")
    search_fields = ("title", "user__email")


@admin.register(ContactMessage)
class ContactMessageAdmin(admin.ModelAdmin):
    list_display = ("name", "email", "subject", "is_resolved", "created_at")
    list_filter = ("is_resolved",)
    search_fields = ("name", "email", "subject")
