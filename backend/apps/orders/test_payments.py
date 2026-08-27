from django.test import override_settings
from rest_framework.test import APIClient

from apps.orders.models import Order, Payment, PaymentWebhookEvent
from apps.orders.payments import MockPaymentGateway, PaymentGateway, get_payment_gateway
from apps.orders.tests import CheckoutAPITestCase


@override_settings(PAYMENT_PROVIDER="mock", PAYMENT_WEBHOOK_SECRET="test-webhook-secret")
class PaymentArchitectureTests(CheckoutAPITestCase):
    def setUp(self):
        super().setUp()
        self.gateway = MockPaymentGateway()

    def place_order(self):
        self.auth()
        address = self.add_address()
        self.add_to_cart(quantity=1)
        order = self.client.post("/api/v1/orders/", {"shipping_address_id": address["id"]}, format="json")
        self.assertEqual(order.status_code, 201, order.data)
        return order.data

    def post_webhook(self, event, signature=None):
        raw, signed = self.gateway.signed_webhook(event)
        client = APIClient()
        return client.post(
            "/api/v1/payments/webhook/",
            data=raw,
            content_type="application/json",
            HTTP_X_NEXORA_SIGNATURE=signed if signature is None else signature,
        )

    def event_for(self, order_payload, outcome="success", amount=None):
        payment = Payment.objects.get(provider_payment_id=order_payload["payment"]["provider_payment_id"])
        event = self.gateway.build_mock_event(payment, outcome)
        if amount is not None:
            payload = dict(event.payload)
            payload["amount"] = str(amount)
            event = self.gateway._event_from_payload(payload)
        return event

    def test_gateway_is_a_provider_abstraction(self):
        gateway = get_payment_gateway()
        self.assertIsInstance(gateway, PaymentGateway)
        self.assertIsInstance(gateway, MockPaymentGateway)

    def test_webhook_success_marks_payment_and_order(self):
        order_payload = self.place_order()
        event = self.event_for(order_payload, "success")
        response = self.post_webhook(event)
        self.assertEqual(response.status_code, 200, response.data)
        self.assertFalse(response.data["already_processed"])

        order = Order.objects.get(pk=order_payload["id"])
        payment = order.payments.get()
        self.assertEqual(order.payment_status, Order.PaymentStatus.PAID)
        self.assertEqual(order.status, Order.Status.CONFIRMED)
        self.assertEqual(payment.status, Payment.Status.SUCCESS)
        self.product.inventory.refresh_from_db()
        self.assertEqual(self.product.inventory.quantity, 9)
        self.assertEqual(self.product.inventory.reserved_quantity, 0)

    def test_webhook_failure(self):
        order_payload = self.place_order()
        response = self.post_webhook(self.event_for(order_payload, "failed"))
        self.assertEqual(response.status_code, 200, response.data)
        order = Order.objects.get(pk=order_payload["id"])
        payment = order.payments.get()
        self.assertEqual(payment.status, Payment.Status.FAILED)
        self.assertEqual(order.payment_status, Order.PaymentStatus.FAILED)
        self.assertEqual(order.status, Order.Status.PENDING)
        self.product.inventory.refresh_from_db()
        self.assertEqual(self.product.inventory.quantity, 10)
        self.assertEqual(self.product.inventory.reserved_quantity, 1)

    def test_cancelled_payment(self):
        order_payload = self.place_order()
        response = self.post_webhook(self.event_for(order_payload, "cancelled"))
        self.assertEqual(response.status_code, 200, response.data)
        order = Order.objects.get(pk=order_payload["id"])
        payment = order.payments.get()
        self.assertEqual(payment.status, Payment.Status.CANCELLED)
        self.assertEqual(order.payment_status, Order.PaymentStatus.FAILED)
        self.assertEqual(order.status, Order.Status.PENDING)

    def test_duplicate_webhook_is_idempotent(self):
        order_payload = self.place_order()
        event = self.event_for(order_payload, "success")
        first = self.post_webhook(event)
        second = self.post_webhook(event)
        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        self.assertTrue(second.data["already_processed"])
        self.assertEqual(PaymentWebhookEvent.objects.filter(event_id=event.event_id).count(), 1)
        self.product.inventory.refresh_from_db()
        self.assertEqual(self.product.inventory.quantity, 9)
        self.assertEqual(self.product.inventory.reserved_quantity, 0)

    def test_invalid_signature_is_rejected(self):
        order_payload = self.place_order()
        event = self.event_for(order_payload, "success")
        response = self.post_webhook(event, signature="deadbeef")
        self.assertEqual(response.status_code, 400)
        order = Order.objects.get(pk=order_payload["id"])
        self.assertEqual(order.payment_status, Order.PaymentStatus.PENDING)
        self.assertEqual(order.payments.get().status, Payment.Status.PENDING)
        self.assertFalse(PaymentWebhookEvent.objects.exists())

    def test_mismatched_amount_is_rejected(self):
        order_payload = self.place_order()
        event = self.event_for(order_payload, "success", amount="1.00")
        response = self.post_webhook(event)
        self.assertEqual(response.status_code, 400)
        order = Order.objects.get(pk=order_payload["id"])
        self.assertEqual(order.payment_status, Order.PaymentStatus.PENDING)
        self.assertEqual(order.payments.get().status, Payment.Status.PENDING)
        rejected = PaymentWebhookEvent.objects.get(event_id=event.event_id)
        self.assertEqual(rejected.status, PaymentWebhookEvent.Status.REJECTED)

    def test_mock_complete_success_uses_same_pipeline(self):
        order_payload = self.place_order()
        paid = self.client.post(
            "/api/v1/payments/mock/complete/",
            {"provider_payment_id": order_payload["payment"]["provider_payment_id"], "outcome": "success"},
            format="json",
        )
        self.assertEqual(paid.status_code, 200, paid.data)
        self.assertEqual(paid.data["payment_status"], "PAID")
        self.assertNotIn("confirm_token", order_payload["payment"])

    def test_verify_does_not_mark_paid_from_the_client(self):
        order_payload = self.place_order()
        verify = self.client.post(
            "/api/v1/checkout/verify-payment/",
            {"provider_payment_id": order_payload["payment"]["provider_payment_id"], "status": "SUCCESS"},
            format="json",
        )
        self.assertEqual(verify.status_code, 200)
        self.assertEqual(verify.data["payment_status"], "PENDING")
        self.assertEqual(Order.objects.get(pk=order_payload["id"]).payment_status, Order.PaymentStatus.PENDING)

    def test_client_cannot_write_payment_status_on_the_order(self):
        order_payload = self.place_order()
        forbidden = self.client.patch(
            f"/api/v1/orders/{order_payload['id']}/",
            {"payment_status": "PAID", "status": "CONFIRMED"},
            format="json",
        )
        self.assertEqual(forbidden.status_code, 405)
        self.assertEqual(Order.objects.get(pk=order_payload["id"]).payment_status, Order.PaymentStatus.PENDING)
