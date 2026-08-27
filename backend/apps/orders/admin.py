from django.contrib import admin

from apps.orders.models import Coupon, CouponUsage, Order, OrderItem, Payment, Shipment, StoreSetting


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    readonly_fields = ("product_name", "sku", "quantity", "unit_price", "line_total")


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ("order_number", "user", "status", "payment_status", "grand_total", "created_at")
    list_filter = ("status", "payment_status")
    search_fields = ("order_number", "user__email")
    inlines = [OrderItemInline]
    readonly_fields = (
        "order_number",
        "payment_status",
        "subtotal",
        "discount_amount",
        "tax_amount",
        "shipping_amount",
        "grand_total",
    )


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ("provider_payment_id", "order", "amount", "status", "created_at")
    list_filter = ("status", "provider")
    search_fields = ("provider_payment_id", "order__order_number")
    readonly_fields = (
        "status",
        "verified_at",
        "paid_at",
        "verification_token",
        "amount",
        "provider_payment_id",
        "failure_reason",
        "metadata",
    )


admin.site.register(Coupon)
admin.site.register(CouponUsage)
admin.site.register(Shipment)
admin.site.register(StoreSetting)
