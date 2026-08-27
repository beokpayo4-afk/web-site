import secrets
from datetime import timedelta

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.engagement.models import Notification
from apps.orders.models import Order, OrderItem, Payment, Shipment
from apps.orders.payments import get_payment_gateway
from apps.orders.pricing import InventoryService


def generate_order_number() -> str:
    return timezone.now().strftime("NX%y%m%d") + secrets.token_hex(3).upper()


def snapshot_address(address) -> dict:
    return {
        "full_name": address.full_name,
        "phone": address.phone,
        "line1": address.line1,
        "line2": address.line2,
        "city": address.city,
        "state": address.state,
        "postal_code": address.postal_code,
        "country": address.country,
    }


@transaction.atomic
def create_order(*, user, shipping_address, billing_address, coupon_code=None, customer_notes=""):
    from apps.orders.checkout import prepare_checkout

    prepared = prepare_checkout(
        user=user,
        shipping_address=shipping_address,
        billing_address=billing_address,
        coupon_code=coupon_code,
        lock=True,
    )
    quote = prepared["quote"]
    coupon = prepared["coupon"]
    cart = prepared["cart"]

    order = Order.objects.create(
        order_number=generate_order_number(),
        user=user,
        status=Order.Status.PENDING,
        payment_status=Order.PaymentStatus.PENDING,
        shipping_address=snapshot_address(shipping_address),
        billing_address=snapshot_address(billing_address),
        subtotal=quote["subtotal"],
        discount_amount=quote["discount_amount"],
        tax_amount=quote["tax_amount"],
        shipping_amount=quote["shipping_amount"],
        grand_total=quote["grand_total"],
        coupon=coupon,
        customer_notes=customer_notes,
    )

    for line in quote["lines"]:
        product = line["product"]
        OrderItem.objects.create(
            order=order,
            product=product,
            product_name=product.name,
            sku=product.sku,
            quantity=line["quantity"],
            unit_price=line["unit_price"],
            mrp=line["mrp"],
            tax_rate=line["tax_rate"],
            tax_amount=line["tax_amount"],
            line_total=line["line_total"],
        )
        InventoryService.reserve(product, line["quantity"])

    cart.items.all().delete()
    tracking = "NXSHIP" + secrets.token_hex(5).upper()
    Shipment.objects.create(order=order, tracking_number=tracking)
    gateway = get_payment_gateway()
    payment = gateway.create_session(order)
    Notification.objects.create(
        user=user,
        title="Order created",
        message=f"Order {order.order_number} is awaiting payment.",
        link=f"/account/orders/{order.id}",
    )
    return order, payment


@transaction.atomic
def mark_order_paid(order):
    from apps.orders.models import CouponUsage

    if order.payment_status == Order.PaymentStatus.PAID:
        return order
    order.payment_status = Order.PaymentStatus.PAID
    order.status = Order.Status.CONFIRMED
    order.save(update_fields=["payment_status", "status", "updated_at"])
    for item in order.items.select_related("product"):
        InventoryService.commit(item.product, item.quantity)
    if order.coupon_id:
        CouponUsage.objects.get_or_create(coupon=order.coupon, user=order.user, order=order)
    Notification.objects.create(
        user=order.user,
        title="Payment received",
        message=f"Payment for {order.order_number} was confirmed.",
        link=f"/account/orders/{order.id}",
    )
    return order


ALLOWED_TRANSITIONS = {
    Order.Status.PENDING: {Order.Status.CONFIRMED, Order.Status.CANCELLED},
    Order.Status.CONFIRMED: {Order.Status.PROCESSING, Order.Status.CANCELLED},
    Order.Status.PROCESSING: {Order.Status.PACKED, Order.Status.CANCELLED},
    Order.Status.PACKED: {Order.Status.SHIPPED, Order.Status.CANCELLED},
    Order.Status.SHIPPED: {Order.Status.OUT_FOR_DELIVERY},
    Order.Status.OUT_FOR_DELIVERY: {Order.Status.DELIVERED},
    Order.Status.DELIVERED: {Order.Status.RETURN_REQUESTED},
    Order.Status.RETURN_REQUESTED: {Order.Status.RETURNED, Order.Status.DELIVERED},
    Order.Status.RETURNED: {Order.Status.REFUND_PENDING},
    Order.Status.REFUND_PENDING: {Order.Status.REFUNDED},
    Order.Status.CANCELLED: {Order.Status.REFUND_PENDING},
    Order.Status.REFUNDED: set(),
}

CUSTOMER_CANCELLABLE = {
    Order.Status.PENDING,
    Order.Status.CONFIRMED,
    Order.Status.PROCESSING,
    Order.Status.PACKED,
}

PAID_PAYMENT_STATUSES = {
    Order.PaymentStatus.PAID,
    Order.PaymentStatus.AUTHORIZED,
    Order.PaymentStatus.REFUNDED,
    Order.PaymentStatus.PARTIALLY_REFUNDED,
}


def can_cancel(order) -> bool:
    return order.status in CUSTOMER_CANCELLABLE


def _append_tracking(shipment, status: str, note: str, *, extra=None):
    now = timezone.now()
    payload = {"at": now.isoformat(), "status": status, "note": note}
    if extra:
        payload.update(extra)
    shipment.tracking_events = list(shipment.tracking_events) + [payload]
    return now


def _apply_cancellation_inventory(order, previous_status: str):
    items = order.items.select_related("product")
    if previous_status == Order.Status.PENDING:
        for item in items:
            InventoryService.release(item.product, item.quantity)
    elif previous_status in {Order.Status.CONFIRMED, Order.Status.PROCESSING, Order.Status.PACKED}:
        for item in items:
            InventoryService.restock(item.product, item.quantity)


@transaction.atomic
def cancel_order(order, *, by_admin=False):
    locked = Order.objects.select_for_update().select_related("shipment").prefetch_related("items").get(pk=order.pk)
    if not can_cancel(locked):
        raise ValidationError({"status": "This order can no longer be cancelled."})
    return transition_order(locked, Order.Status.CANCELLED, by_admin=by_admin)


@transaction.atomic
def transition_order(order, new_status: str, *, by_admin=False):
    locked = Order.objects.select_for_update().select_related("shipment").get(pk=order.pk)
    if new_status not in Order.Status.values:
        raise ValidationError({"status": "Unknown order status."})
    allowed = ALLOWED_TRANSITIONS.get(locked.status, set())
    if new_status not in allowed:
        raise ValidationError({"status": f"Cannot move from {locked.status} to {new_status}."})

    previous_status = locked.status
    shipment = getattr(locked, "shipment", None)

    if new_status == Order.Status.CANCELLED:
        _apply_cancellation_inventory(locked, previous_status)
        if locked.payment_status not in PAID_PAYMENT_STATUSES:
            locked.payment_status = Order.PaymentStatus.FAILED
            Payment.objects.filter(order=locked, status=Payment.Status.PENDING).update(status=Payment.Status.FAILED)

    if new_status == Order.Status.RETURNED:
        for item in locked.items.select_related("product"):
            InventoryService.restock(item.product, item.quantity)

    if new_status == Order.Status.REFUNDED:
        locked.payment_status = Order.PaymentStatus.REFUNDED
        Payment.objects.filter(order=locked, status=Payment.Status.SUCCESS).update(status=Payment.Status.REFUNDED)

    if shipment:
        if new_status == Order.Status.PACKED:
            shipment.status = Shipment.Status.PACKED
            _append_tracking(shipment, "PACKED", "Packed at the warehouse")
            shipment.save()
        if new_status == Order.Status.SHIPPED:
            now = _append_tracking(shipment, "SHIPPED", "Handed to carrier")
            shipment.status = Shipment.Status.SHIPPED
            shipment.shipped_at = now
            shipment.estimated_delivery = (now + timedelta(days=4)).date()
            shipment.save()
        if new_status == Order.Status.OUT_FOR_DELIVERY:
            shipment.status = Shipment.Status.OUT_FOR_DELIVERY
            _append_tracking(shipment, "OUT_FOR_DELIVERY", "Out for delivery")
            shipment.save()
        if new_status == Order.Status.DELIVERED:
            now = _append_tracking(shipment, "DELIVERED", "Delivered to customer")
            shipment.status = Shipment.Status.DELIVERED
            shipment.delivered_at = now
            shipment.save()
        if new_status == Order.Status.CANCELLED:
            _append_tracking(shipment, "CANCELLED", "Order cancelled")
            shipment.save(update_fields=["tracking_events", "updated_at"])

    cancelled = new_status == Order.Status.CANCELLED
    locked.status = new_status
    locked.save(update_fields=["status", "payment_status", "updated_at"])
    if cancelled and by_admin:
        title = "Order cancelled by support"
        message = f"Order {locked.order_number} was cancelled."
    elif cancelled:
        title = "Order cancelled"
        message = f"Order {locked.order_number} was cancelled."
    else:
        title = "Order update"
        message = f"Order {locked.order_number} is now {new_status.replace('_', ' ').title()}."
    Notification.objects.create(
        user=locked.user,
        title=title,
        message=message,
        link=f"/account/orders/{locked.id}",
    )
    return locked
