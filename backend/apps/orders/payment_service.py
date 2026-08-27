"""Apply verified provider events to Payment and Order records.

The frontend never sets payment or order status. Only a verified provider
event (webhook) or a server-side fetch_status that already reflects capture
may mark a payment successful.
"""

from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.orders.models import Order, Payment, PaymentWebhookEvent
from apps.orders.payments import PaymentAmountMismatch, ProviderEvent
from apps.orders.pricing import money
from apps.orders.services import mark_order_paid


TERMINAL_SUCCESS = {Payment.Status.SUCCESS, Payment.Status.REFUNDED}


def process_provider_event(event: ProviderEvent, *, provider: str) -> dict:
    existing = PaymentWebhookEvent.objects.filter(event_id=event.event_id).first()
    if existing:
        return _result(existing, already=True)

    try:
        with transaction.atomic():
            try:
                payment = (
                    Payment.objects.select_for_update()
                    .select_related("order")
                    .get(provider_payment_id=event.provider_payment_id)
                )
            except Payment.DoesNotExist as exc:
                raise ValidationError({"payment": "Unknown payment."}) from exc
            _assert_amount_matches(payment, event.amount)
            _apply_event(payment, event)
            record = _record_event(
                event,
                provider,
                payment=payment,
                status=PaymentWebhookEvent.Status.PROCESSED,
            )
            payment.refresh_from_db()
            return {
                "already_processed": False,
                "event_id": record.event_id,
                "payment_status": payment.status,
                "order_id": payment.order_id,
            }
    except IntegrityError:
        duplicate = PaymentWebhookEvent.objects.get(event_id=event.event_id)
        return _result(duplicate, already=True)
    except PaymentAmountMismatch:
        _record_event(
            event,
            provider,
            payment=Payment.objects.filter(provider_payment_id=event.provider_payment_id).first(),
            status=PaymentWebhookEvent.Status.REJECTED,
            reason="Amount mismatch",
        )
        raise
    except ValidationError as exc:
        if "Unknown payment" in str(exc.detail):
            _record_event(
                event,
                provider,
                status=PaymentWebhookEvent.Status.REJECTED,
                reason="Unknown payment id",
            )
        raise


def _result(record: PaymentWebhookEvent, *, already: bool) -> dict:
    return {
        "already_processed": already,
        "event_id": record.event_id,
        "payment_status": record.payment.status if record.payment_id else None,
        "order_id": record.payment.order_id if record.payment_id else None,
    }


def _assert_amount_matches(payment: Payment, event_amount):
    expected = money(payment.amount)
    order_total = money(payment.order.grand_total)
    incoming = money(event_amount)
    if incoming != expected or expected != order_total:
        raise PaymentAmountMismatch()


def _apply_event(payment: Payment, event: ProviderEvent):
    order = payment.order
    now = timezone.now()
    event_type = event.event_type.lower()

    if event_type in {"payment.captured", "payment.success", "payment.paid"}:
        if payment.status in TERMINAL_SUCCESS:
            return
        if order.status == Order.Status.CANCELLED:
            raise ValidationError({"payment": "This order was cancelled."})
        payment.status = Payment.Status.SUCCESS
        payment.failure_reason = ""
        payment.verified_at = now
        payment.paid_at = now
        payment.save(update_fields=["status", "failure_reason", "verified_at", "paid_at", "updated_at"])
        mark_order_paid(order)
        return

    if event_type in {"payment.failed"}:
        if payment.status in TERMINAL_SUCCESS:
            return
        payment.status = Payment.Status.FAILED
        payment.failure_reason = "Provider reported failure"
        payment.verified_at = now
        payment.save(update_fields=["status", "failure_reason", "verified_at", "updated_at"])
        _mark_order_payment_failed(order)
        return

    if event_type in {"payment.cancelled", "payment.canceled"}:
        if payment.status in TERMINAL_SUCCESS:
            return
        payment.status = Payment.Status.CANCELLED
        payment.failure_reason = "Payment cancelled"
        payment.verified_at = now
        payment.save(update_fields=["status", "failure_reason", "verified_at", "updated_at"])
        _mark_order_payment_failed(order)
        return

    raise ValidationError({"payment": f"Unsupported payment event '{event.event_type}'."})


def _mark_order_payment_failed(order: Order):
    if order.payment_status == Order.PaymentStatus.PAID:
        return
    order.payment_status = Order.PaymentStatus.FAILED
    order.save(update_fields=["payment_status", "updated_at"])


def _record_event(event: ProviderEvent, provider: str, *, payment=None, status, reason=""):
    return PaymentWebhookEvent.objects.create(
        event_id=event.event_id,
        provider=provider,
        event_type=event.event_type,
        payment=payment,
        status=status,
        rejection_reason=reason,
        payload=event.payload,
    )
