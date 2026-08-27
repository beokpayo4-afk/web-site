from django.core.validators import MinValueValidator
from django.db import models

from apps.accounts.models import User
from apps.catalog.models import Product


class Coupon(models.Model):
    class DiscountType(models.TextChoices):
        PERCENT = "PERCENT", "Percent"
        FLAT = "FLAT", "Flat"

    code = models.CharField(max_length=32, unique=True)
    description = models.CharField(max_length=160, blank=True)
    discount_type = models.CharField(max_length=12, choices=DiscountType.choices)
    value = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(0)])
    min_order_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    max_discount_amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    usage_limit = models.PositiveIntegerField(null=True, blank=True)
    usage_limit_per_user = models.PositiveIntegerField(default=1)
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField()
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["code"]),
            models.Index(fields=["is_active", "starts_at", "ends_at"]),
        ]

    def __str__(self):
        return self.code


class CouponUsage(models.Model):
    coupon = models.ForeignKey(Coupon, on_delete=models.CASCADE, related_name="usages")
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="coupon_usages")
    order = models.ForeignKey("Order", on_delete=models.CASCADE, related_name="coupon_usages")
    used_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["coupon", "user"])]


class Order(models.Model):
    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        CONFIRMED = "CONFIRMED", "Confirmed"
        PROCESSING = "PROCESSING", "Processing"
        PACKED = "PACKED", "Packed"
        SHIPPED = "SHIPPED", "Shipped"
        OUT_FOR_DELIVERY = "OUT_FOR_DELIVERY", "Out for delivery"
        DELIVERED = "DELIVERED", "Delivered"
        CANCELLED = "CANCELLED", "Cancelled"
        RETURN_REQUESTED = "RETURN_REQUESTED", "Return requested"
        RETURNED = "RETURNED", "Returned"
        REFUND_PENDING = "REFUND_PENDING", "Refund pending"
        REFUNDED = "REFUNDED", "Refunded"

    class PaymentStatus(models.TextChoices):
        PENDING = "PENDING", "Pending"
        AUTHORIZED = "AUTHORIZED", "Authorized"
        PAID = "PAID", "Paid"
        FAILED = "FAILED", "Failed"
        REFUNDED = "REFUNDED", "Refunded"
        PARTIALLY_REFUNDED = "PARTIALLY_REFUNDED", "Partially refunded"

    order_number = models.CharField(max_length=24, unique=True)
    user = models.ForeignKey(User, on_delete=models.PROTECT, related_name="orders")
    status = models.CharField(max_length=24, choices=Status.choices, default=Status.PENDING, db_index=True)
    payment_status = models.CharField(
        max_length=24, choices=PaymentStatus.choices, default=PaymentStatus.PENDING, db_index=True
    )
    shipping_address = models.JSONField()
    billing_address = models.JSONField()
    origin_state = models.CharField(max_length=80, default="Chhattisgarh")
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    discount_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    tax_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    shipping_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    grand_total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    coupon = models.ForeignKey(Coupon, null=True, blank=True, on_delete=models.SET_NULL)
    customer_notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["order_number"]),
            models.Index(fields=["user", "status"]),
            models.Index(fields=["status", "created_at"]),
            models.Index(fields=["payment_status"]),
        ]

    def __str__(self):
        return self.order_number


class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name="order_items")
    product_name = models.CharField(max_length=180)
    sku = models.CharField(max_length=40)
    quantity = models.PositiveIntegerField()
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    mrp = models.DecimalField(max_digits=10, decimal_places=2)
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2)
    tax_amount = models.DecimalField(max_digits=10, decimal_places=2)
    line_total = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        indexes = [
            models.Index(fields=["order", "product"]),
            models.Index(fields=["product"], name="orders_item_product_idx"),
        ]


class Payment(models.Model):
    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        SUCCESS = "SUCCESS", "Success"
        FAILED = "FAILED", "Failed"
        CANCELLED = "CANCELLED", "Cancelled"
        REFUNDED = "REFUNDED", "Refunded"

    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="payments")
    provider = models.CharField(max_length=32, default="mock")
    method = models.CharField(max_length=32, default="mock")
    currency = models.CharField(max_length=8, default="INR")
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING, db_index=True)
    provider_payment_id = models.CharField(max_length=80, unique=True)
    verification_token = models.CharField(max_length=128, blank=True, default="")
    failure_reason = models.CharField(max_length=240, blank=True, default="")
    metadata = models.JSONField(default=dict, blank=True)
    verified_at = models.DateTimeField(null=True, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["provider_payment_id"]),
            models.Index(fields=["status"]),
        ]

    def __str__(self):
        return self.provider_payment_id


class PaymentWebhookEvent(models.Model):
    class Status(models.TextChoices):
        PROCESSED = "PROCESSED", "Processed"
        REJECTED = "REJECTED", "Rejected"
        DUPLICATE = "DUPLICATE", "Duplicate"

    event_id = models.CharField(max_length=120, unique=True)
    provider = models.CharField(max_length=32)
    event_type = models.CharField(max_length=64)
    payment = models.ForeignKey(Payment, null=True, blank=True, on_delete=models.SET_NULL, related_name="webhook_events")
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PROCESSED)
    rejection_reason = models.CharField(max_length=240, blank=True, default="")
    payload = models.JSONField(default=dict, blank=True)
    processed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["event_id"]),
            models.Index(fields=["provider", "event_type"]),
        ]

    def __str__(self):
        return self.event_id


class Shipment(models.Model):
    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        PACKED = "PACKED", "Packed"
        SHIPPED = "SHIPPED", "Shipped"
        IN_TRANSIT = "IN_TRANSIT", "In transit"
        OUT_FOR_DELIVERY = "OUT_FOR_DELIVERY", "Out for delivery"
        DELIVERED = "DELIVERED", "Delivered"
        RETURNED = "RETURNED", "Returned"

    order = models.OneToOneField(Order, on_delete=models.CASCADE, related_name="shipment")
    carrier = models.CharField(max_length=80, default="Nexora Logistics")
    tracking_number = models.CharField(max_length=64, unique=True)
    status = models.CharField(max_length=24, choices=Status.choices, default=Status.PENDING)
    estimated_delivery = models.DateField(null=True, blank=True)
    shipped_at = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    tracking_events = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [models.Index(fields=["tracking_number"])]


class StoreSetting(models.Model):
    key = models.CharField(max_length=64, unique=True)
    value = models.JSONField()
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.key
