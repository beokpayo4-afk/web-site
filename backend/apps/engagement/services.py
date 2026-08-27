from apps.orders.models import Order


def eligible_order_for_review(user, product_id):
    """A delivered, paid order that included this product."""
    return (
        Order.objects.filter(
            user=user,
            status=Order.Status.DELIVERED,
            payment_status=Order.PaymentStatus.PAID,
            items__product_id=product_id,
        )
        .order_by("-created_at")
        .first()
    )
