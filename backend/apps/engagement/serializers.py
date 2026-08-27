from rest_framework import serializers

from apps.engagement.models import ContactMessage, Notification, Review


class ReviewSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()
    product_name = serializers.CharField(source="product.name", read_only=True)
    product_slug = serializers.CharField(source="product.slug", read_only=True)
    is_verified_purchase = serializers.BooleanField(read_only=True)
    is_mine = serializers.SerializerMethodField()

    class Meta:
        model = Review
        fields = (
            "id",
            "product",
            "product_name",
            "product_slug",
            "user_name",
            "rating",
            "title",
            "body",
            "status",
            "is_approved",
            "is_verified_purchase",
            "is_mine",
            "moderation_note",
            "created_at",
        )
        read_only_fields = (
            "product",
            "status",
            "is_approved",
            "is_verified_purchase",
            "is_mine",
            "moderation_note",
            "created_at",
            "user_name",
            "product_name",
            "product_slug",
        )

    def get_user_name(self, obj):
        profile = getattr(obj.user, "profile", None)
        name = getattr(profile, "full_name", "") if profile else ""
        return name or obj.user.email.split("@")[0]

    def get_is_mine(self, obj):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        return bool(user and user.is_authenticated and user.id == obj.user_id)

    def validate_title(self, value):
        title = (value or "").strip()
        if len(title) < 4:
            raise serializers.ValidationError("Enter a short title.")
        return title

    def validate_body(self, value):
        body = (value or "").strip()
        if len(body) < 8:
            raise serializers.ValidationError("Write a little more about the product.")
        return body

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get("request")
        user = getattr(request, "user", None)
        is_owner = bool(user and user.is_authenticated and user.id == instance.user_id)
        is_staff = bool(user and user.is_authenticated and getattr(user, "is_staff_role", False))
        if not (is_owner or is_staff):
            data.pop("moderation_note", None)
        return data


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ("id", "title", "message", "channel", "link", "is_read", "created_at")
        read_only_fields = fields


class ContactMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContactMessage
        fields = ("id", "name", "email", "subject", "message", "is_resolved", "created_at")
        read_only_fields = ("id", "created_at", "is_resolved")
