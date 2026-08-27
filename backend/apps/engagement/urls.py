from django.urls import path

from apps.engagement.views import (
    ContactCreateView,
    MyReviewListView,
    NotificationListView,
    NotificationReadView,
    ProductReviewListCreateView,
    ReviewEligibilityView,
)

urlpatterns = [
    path("products/<int:product_id>/reviews/", ProductReviewListCreateView.as_view(), name="product_reviews"),
    path(
        "products/<int:product_id>/review-eligibility/",
        ReviewEligibilityView.as_view(),
        name="review_eligibility",
    ),
    path("reviews/me/", MyReviewListView.as_view(), name="my_reviews"),
    path("notifications/", NotificationListView.as_view(), name="notifications"),
    path("notifications/<int:pk>/read/", NotificationReadView.as_view(), name="notification_read"),
    path("contact/", ContactCreateView.as_view(), name="contact"),
]
