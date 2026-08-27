from django.urls import path

from apps.orders.views import (
    CheckoutPreviewView,
    CouponValidateView,
    MockPaymentCompleteView,
    OrderCancelView,
    OrderDetailView,
    OrderListCreateView,
    PaymentVerifyView,
    PaymentWebhookView,
    QuoteView,
)

urlpatterns = [
    path("checkout/preview/", CheckoutPreviewView.as_view(), name="checkout_preview"),
    path("checkout/quote/", QuoteView.as_view(), name="checkout_quote"),
    path("checkout/verify-payment/", PaymentVerifyView.as_view(), name="verify_payment"),
    path("payments/webhook/", PaymentWebhookView.as_view(), name="payment_webhook"),
    path("payments/mock/complete/", MockPaymentCompleteView.as_view(), name="mock_payment_complete"),
    path("orders/", OrderListCreateView.as_view(), name="orders"),
    path("orders/<int:pk>/", OrderDetailView.as_view(), name="order_detail"),
    path("orders/<int:pk>/cancel/", OrderCancelView.as_view(), name="order_cancel"),
    path("coupons/validate/", CouponValidateView.as_view(), name="coupon_validate"),
]
