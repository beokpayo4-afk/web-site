from django.conf import settings
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.orders.checkout import hydrate_cart, hydrate_explicit_items, prepare_checkout, resolve_coupon, serialize_quote
from apps.orders.models import Coupon, Order, Payment
from apps.orders.payment_service import process_provider_event
from apps.orders.payments import MockPaymentGateway, get_payment_gateway
from apps.orders.pricing import PricingService
from apps.orders.serializers import (
    CheckoutSerializer,
    CouponSerializer,
    MockPaymentCompleteSerializer,
    OrderSerializer,
    PaymentVerifySerializer,
    QuoteSerializer,
)
from apps.orders.services import cancel_order, create_order, snapshot_address


class QuoteView(APIView):
    """Legacy quote by shipping state. Prefer POST /checkout/preview/ which binds a saved address."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = QuoteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload_items = serializer.validated_data.get("items")
        if payload_items:
            items = hydrate_explicit_items(payload_items)
        else:
            _, items = hydrate_cart(user=request.user)
        coupon = resolve_coupon(serializer.validated_data.get("coupon_code"), request.user)
        quote = PricingService().quote(
            items,
            serializer.validated_data["shipping_state"],
            coupon=coupon,
            user=request.user,
        )
        body = serialize_quote(quote)
        return Response(body)


class CheckoutPreviewView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = CheckoutSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        prepared = prepare_checkout(
            user=request.user,
            shipping_address=serializer.validated_data["shipping_address"],
            billing_address=serializer.validated_data["billing_address"],
            coupon_code=serializer.validated_data.get("coupon_code") or None,
        )
        body = serialize_quote(prepared["quote"])
        body["coupon_code"] = prepared["coupon"].code if prepared["coupon"] else None
        body["shipping_state"] = serializer.validated_data["shipping_address"].state
        body["shipping_address"] = snapshot_address(serializer.validated_data["shipping_address"])
        body["billing_address"] = snapshot_address(serializer.validated_data["billing_address"])
        return Response(body)


class OrderListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        orders = Order.objects.filter(user=request.user).prefetch_related("items", "payments", "shipment")
        page = self.paginate(request, orders)
        return page

    def paginate(self, request, qs):
        from apps.common.pagination import StandardPagination

        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs, request)
        serializer = OrderSerializer(page, many=True, context={"request": request})
        return paginator.get_paginated_response(serializer.data)

    def post(self, request):
        serializer = CheckoutSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        order, payment = create_order(
            user=request.user,
            shipping_address=serializer.validated_data["shipping_address"],
            billing_address=serializer.validated_data["billing_address"],
            coupon_code=serializer.validated_data.get("coupon_code") or None,
            customer_notes=serializer.validated_data.get("customer_notes", ""),
        )
        payload = OrderSerializer(order).data
        payload["payment"] = {
            "provider_payment_id": payment.provider_payment_id,
            "amount": str(payment.amount),
            "provider": payment.provider,
            "status": payment.status,
        }
        return Response(payload, status=status.HTTP_201_CREATED)


class OrderDetailView(generics.RetrieveAPIView):
    serializer_class = OrderSerializer
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ["get", "head", "options"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Order.objects.none()
        return Order.objects.filter(user=self.request.user).prefetch_related("items", "payments", "shipment")


class OrderCancelView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        order = generics.get_object_or_404(Order, pk=pk, user=request.user)
        updated = cancel_order(order)
        return Response(OrderSerializer(updated).data)


class PaymentWebhookView(APIView):
    """Provider callback. Signature is verified before any status change."""

    authentication_classes = []
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        gateway = get_payment_gateway()
        signature = request.headers.get("X-Nexora-Signature") or request.headers.get("X-Razorpay-Signature") or ""
        event = gateway.parse_webhook(request.body, signature)
        result = process_provider_event(event, provider=gateway.provider)
        return Response({"ok": True, "already_processed": result["already_processed"], "event_id": result["event_id"]})


class MockPaymentCompleteView(APIView):
    """Local-only stand-in for a customer finishing checkout at the provider."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if (settings.PAYMENT_PROVIDER or "").strip().lower() != "mock":
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        gateway = get_payment_gateway()
        if not isinstance(gateway, MockPaymentGateway):
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        serializer = MockPaymentCompleteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payment = generics.get_object_or_404(
            Payment,
            provider_payment_id=serializer.validated_data["provider_payment_id"],
            order__user=request.user,
        )
        event = gateway.build_mock_event(payment, serializer.validated_data["outcome"])
        process_provider_event(event, provider=gateway.provider)
        order = Order.objects.prefetch_related("items", "payments", "shipment").get(pk=payment.order_id)
        return Response(OrderSerializer(order).data)


class PaymentVerifyView(APIView):
    """Re-read provider status. Does not accept a client success flag."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = PaymentVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payment = generics.get_object_or_404(
            Payment,
            provider_payment_id=serializer.validated_data["provider_payment_id"],
            order__user=request.user,
        )
        gateway = get_payment_gateway()
        gateway.fetch_status(payment)
        order = Order.objects.prefetch_related("items", "payments", "shipment").get(pk=payment.order_id)
        return Response(OrderSerializer(order).data)


class CouponValidateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        code = request.data.get("code", "")
        coupon = Coupon.objects.filter(code__iexact=str(code).strip(), is_active=True).first()
        if not coupon:
            return Response({"success": False, "error": {"message": "Invalid coupon."}}, status=404)
        return Response(CouponSerializer(coupon).data)
