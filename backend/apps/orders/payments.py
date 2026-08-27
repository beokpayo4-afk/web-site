"""Payment provider adapters.

Business logic (order paid / failed / cancelled) lives in payment_service.
Adapters only talk to a provider and verify that a signal is authentic.

Credentials come from environment variables. Never hard-code keys.
Never send secrets to the frontend.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from decimal import Decimal
import hashlib
import hmac
import json
import secrets

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from rest_framework.exceptions import ValidationError

from apps.orders.models import Payment
from apps.orders.pricing import money


class InvalidPaymentSignature(ValidationError):
    default_detail = {"payment": "Invalid payment signature."}


class PaymentAmountMismatch(ValidationError):
    default_detail = {"payment": "Payment amount does not match the order total."}


@dataclass(frozen=True)
class ProviderEvent:
    event_id: str
    event_type: str
    provider_payment_id: str
    amount: Decimal
    currency: str
    payload: dict


class PaymentGateway(ABC):
    """Contract for a payment service provider (mock, Razorpay, Stripe, …)."""

    provider: str

    @abstractmethod
    def create_session(self, order) -> Payment:
        """Create a pending provider payment. Amount must be order.grand_total."""

    @abstractmethod
    def parse_webhook(self, raw_body: bytes, signature: str) -> ProviderEvent:
        """Verify the provider signature and return a normalised event."""

    @abstractmethod
    def fetch_status(self, payment: Payment) -> str:
        """Ask the provider for the current status. Never trust the browser."""

    def build_mock_event(self, payment: Payment, outcome: str) -> ProviderEvent:
        raise ValidationError({"payment": "This provider does not support mock completion."})


class MockPaymentGateway(PaymentGateway):
    """Local development provider. Completes via signed webhooks, not client status flags."""

    provider = "mock"
    CAPTURED = "payment.captured"
    FAILED = "payment.failed"
    CANCELLED = "payment.cancelled"

    def create_session(self, order) -> Payment:
        return Payment.objects.create(
            order=order,
            provider=self.provider,
            method="mock",
            currency=getattr(settings, "PAYMENT_CURRENCY", "INR"),
            amount=order.grand_total,
            status=Payment.Status.PENDING,
            provider_payment_id=f"pay_{secrets.token_hex(8)}",
        )

    def parse_webhook(self, raw_body: bytes, signature: str) -> ProviderEvent:
        expected = _sign(raw_body, self._secret())
        if not signature or not hmac.compare_digest(expected, signature):
            raise InvalidPaymentSignature()
        try:
            payload = json.loads(raw_body.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise ValidationError({"payment": "Webhook payload is not valid JSON."}) from exc
        return self._event_from_payload(payload)

    def fetch_status(self, payment: Payment) -> str:
        return payment.status

    def build_mock_event(self, payment: Payment, outcome: str) -> ProviderEvent:
        mapping = {
            "success": self.CAPTURED,
            "failed": self.FAILED,
            "cancelled": self.CANCELLED,
        }
        event_type = mapping.get(outcome)
        if not event_type:
            raise ValidationError({"outcome": "Use success, failed, or cancelled."})
        payload = {
            "event_id": f"evt_{secrets.token_hex(12)}",
            "event_type": event_type,
            "provider_payment_id": payment.provider_payment_id,
            "amount": str(money(payment.amount)),
            "currency": payment.currency or "INR",
        }
        return self._event_from_payload(payload)

    def signed_webhook(self, event: ProviderEvent) -> tuple[bytes, str]:
        payload = {
            "event_id": event.event_id,
            "event_type": event.event_type,
            "provider_payment_id": event.provider_payment_id,
            "amount": str(money(event.amount)),
            "currency": event.currency,
        }
        raw = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
        return raw, _sign(raw, self._secret())

    def _event_from_payload(self, payload: dict) -> ProviderEvent:
        try:
            return ProviderEvent(
                event_id=str(payload["event_id"]),
                event_type=str(payload["event_type"]),
                provider_payment_id=str(payload["provider_payment_id"]),
                amount=money(payload["amount"]),
                currency=str(payload.get("currency") or "INR"),
                payload=_public_payload(payload),
            )
        except (KeyError, ArithmeticError, ValueError, TypeError) as exc:
            raise ValidationError({"payment": "Webhook is missing required payment fields."}) from exc

    def _secret(self) -> str:
        secret = getattr(settings, "PAYMENT_WEBHOOK_SECRET", "") or ""
        if not secret:
            raise ImproperlyConfigured("PAYMENT_WEBHOOK_SECRET must be set for the mock payment provider.")
        return secret


class RazorpayGateway(PaymentGateway):
    """Production adapter skeleton. Credentials must come from the environment."""

    provider = "razorpay"

    def __init__(self):
        self.key_id = getattr(settings, "RAZORPAY_KEY_ID", "") or ""
        self.key_secret = getattr(settings, "RAZORPAY_KEY_SECRET", "") or ""
        self.webhook_secret = getattr(settings, "RAZORPAY_WEBHOOK_SECRET", "") or ""
        if not (self.key_id and self.key_secret and self.webhook_secret):
            raise ImproperlyConfigured(
                "Razorpay is selected but RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, "
                "and RAZORPAY_WEBHOOK_SECRET are not set."
            )

    def create_session(self, order) -> Payment:
        raise ValidationError(
            {
                "payment": (
                    "Live Razorpay capture is not enabled in this environment. "
                    "Set PAYMENT_PROVIDER=mock for local development."
                )
            }
        )

    def parse_webhook(self, raw_body: bytes, signature: str) -> ProviderEvent:
        expected = hmac.new(self.webhook_secret.encode(), raw_body, hashlib.sha256).hexdigest()
        if not signature or not hmac.compare_digest(expected, signature):
            raise InvalidPaymentSignature()
        raise ValidationError({"payment": "Razorpay webhook mapping is not enabled yet."})

    def fetch_status(self, payment: Payment) -> str:
        raise ValidationError({"payment": "Live Razorpay status fetch is not enabled yet."})


PROVIDERS: dict[str, type[PaymentGateway]] = {
    "mock": MockPaymentGateway,
    "razorpay": RazorpayGateway,
}


def get_payment_gateway() -> PaymentGateway:
    name = (settings.PAYMENT_PROVIDER or "mock").strip().lower()
    gateway_cls = PROVIDERS.get(name)
    if gateway_cls is None:
        raise ImproperlyConfigured(
            f"Unknown PAYMENT_PROVIDER '{name}'. Registered adapters: {', '.join(sorted(PROVIDERS))}."
        )
    return gateway_cls()


def _sign(raw_body: bytes, secret: str) -> str:
    return hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()


def _public_payload(payload: dict) -> dict:
    blocked = ("secret", "token", "password", "key", "signature")
    return {key: value for key, value in payload.items() if not any(part in key.lower() for part in blocked)}
