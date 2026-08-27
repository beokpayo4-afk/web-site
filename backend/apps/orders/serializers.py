from rest_framework import serializers

from apps.accounts.models import Address
from apps.accounts.serializers import user_display_name
from apps.orders.models import Coupon, Order, OrderItem, Payment, Shipment
from apps.orders.services import ALLOWED_TRANSITIONS, can_cancel


class OrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderItem
        fields = (
            "id",
            "product",
            "product_name",
            "sku",
            "quantity",
            "unit_price",
            "mrp",
            "tax_rate",
            "tax_amount",
            "line_total",
        )


class PaymentPublicSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = ("id", "provider", "method", "currency", "amount", "status", "provider_payment_id", "failure_reason", "paid_at")


class ShipmentSerializer(serializers.ModelSerializer):
    order_number = serializers.CharField(source="order.order_number", read_only=True)

    class Meta:
        model = Shipment
        fields = (
            "id",
            "order",
            "order_number",
            "carrier",
            "tracking_number",
            "status",
            "estimated_delivery",
            "shipped_at",
            "delivered_at",
            "tracking_events",
        )
        read_only_fields = ("order", "order_number")


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    payments = PaymentPublicSerializer(many=True, read_only=True)
    shipment = ShipmentSerializer(read_only=True)
    cancellable = serializers.SerializerMethodField()
    next_statuses = serializers.SerializerMethodField()
    customer_id = serializers.IntegerField(source="user_id", read_only=True)
    customer_email = serializers.EmailField(source="user.email", read_only=True)
    customer_phone = serializers.CharField(source="user.phone", read_only=True)
    customer_name = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = (
            "id",
            "order_number",
            "status",
            "payment_status",
            "cancellable",
            "next_statuses",
            "customer_id",
            "customer_email",
            "customer_phone",
            "customer_name",
            "shipping_address",
            "billing_address",
            "subtotal",
            "discount_amount",
            "tax_amount",
            "shipping_amount",
            "grand_total",
            "customer_notes",
            "items",
            "payments",
            "shipment",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields

    def get_cancellable(self, obj):
        return can_cancel(obj)

    def get_next_statuses(self, obj):
        return sorted(ALLOWED_TRANSITIONS.get(obj.status, set()))

    def get_customer_name(self, obj):
        return user_display_name(obj.user) or obj.user.email


class CheckoutSerializer(serializers.Serializer):
    shipping_address_id = serializers.IntegerField()
    billing_address_id = serializers.IntegerField(required=False)
    coupon_code = serializers.CharField(required=False, allow_blank=True)
    customer_notes = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        from apps.orders.checkout import reject_client_totals

        reject_client_totals(getattr(self, "initial_data", {}) or {})
        user = self.context["request"].user
        try:
            attrs["shipping_address"] = Address.objects.get(pk=attrs["shipping_address_id"], user=user)
        except Address.DoesNotExist as exc:
            raise serializers.ValidationError({"shipping_address_id": "Address not found."}) from exc
        billing_id = attrs.get("billing_address_id") or attrs["shipping_address_id"]
        try:
            attrs["billing_address"] = Address.objects.get(pk=billing_id, user=user)
        except Address.DoesNotExist as exc:
            raise serializers.ValidationError({"billing_address_id": "Address not found."}) from exc
        return attrs


class QuoteSerializer(serializers.Serializer):
    shipping_state = serializers.CharField()
    coupon_code = serializers.CharField(required=False, allow_blank=True)
    items = serializers.ListField(child=serializers.DictField(), required=False)

    def validate(self, attrs):
        from apps.orders.checkout import CLIENT_PRICE_FIELDS

        payload = getattr(self, "initial_data", {}) or {}
        extra = (CLIENT_PRICE_FIELDS - {"items"}).intersection(payload.keys())
        if extra:
            raise serializers.ValidationError(
                {field: "Prices and totals are calculated on the server." for field in extra}
            )
        return attrs


class CouponSerializer(serializers.ModelSerializer):
    class Meta:
        model = Coupon
        fields = (
            "id",
            "code",
            "description",
            "discount_type",
            "value",
            "min_order_amount",
            "max_discount_amount",
            "usage_limit",
            "usage_limit_per_user",
            "starts_at",
            "ends_at",
            "is_active",
        )


class MockPaymentCompleteSerializer(serializers.Serializer):
    provider_payment_id = serializers.CharField()
    outcome = serializers.ChoiceField(choices=("success", "failed", "cancelled"))


class PaymentVerifySerializer(serializers.Serializer):
    provider_payment_id = serializers.CharField()


class OrderStatusSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=Order.Status.choices)
