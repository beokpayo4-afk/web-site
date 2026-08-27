from django.db import IntegrityError
from django.db.models import Q
from rest_framework import generics, permissions, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.exceptions import ConflictError
from apps.engagement.models import Notification, Review
from apps.engagement.serializers import ContactMessageSerializer, NotificationSerializer, ReviewSerializer
from apps.engagement.services import eligible_order_for_review


class ProductReviewListCreateView(generics.ListCreateAPIView):
    serializer_class = ReviewSerializer

    def get_permissions(self):
        if self.request.method == "POST":
            return [permissions.IsAuthenticated()]
        return [permissions.AllowAny()]

    def get_queryset(self):
        qs = Review.objects.filter(product_id=self.kwargs["product_id"]).select_related(
            "user", "user__profile", "product"
        )
        user = self.request.user
        if user.is_authenticated and getattr(user, "is_staff_role", False):
            return qs
        if user.is_authenticated:
            return qs.filter(Q(status=Review.Status.APPROVED) | Q(user=user)).distinct()
        return qs.filter(status=Review.Status.APPROVED)

    def create(self, request, *args, **kwargs):
        product_id = self.kwargs["product_id"]
        if Review.objects.filter(user=request.user, product_id=product_id).exists():
            raise ConflictError("You have already reviewed this product.")
        order = eligible_order_for_review(request.user, product_id)
        if order is None:
            raise PermissionDenied("You can review this product after a delivered purchase.")
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            serializer.save(
                user=request.user,
                product_id=product_id,
                order=order,
                status=Review.Status.PENDING,
            )
        except IntegrityError:
            raise ConflictError("You have already reviewed this product.")
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class ReviewEligibilityView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, product_id):
        user = request.user
        if not user.is_authenticated:
            return Response({"can_review": False, "reason": "unauthenticated", "review": None})
        existing = Review.objects.filter(user=user, product_id=product_id).select_related("user", "user__profile", "product").first()
        if existing:
            return Response(
                {
                    "can_review": False,
                    "reason": "already_reviewed",
                    "review": ReviewSerializer(existing, context={"request": request}).data,
                }
            )
        if eligible_order_for_review(user, product_id) is None:
            return Response({"can_review": False, "reason": "not_purchased", "review": None})
        return Response({"can_review": True, "reason": "eligible", "review": None})


class MyReviewListView(generics.ListAPIView):
    serializer_class = ReviewSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Review.objects.filter(user=self.request.user).select_related("product", "user", "user__profile")


class NotificationListView(generics.ListAPIView):
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user)


class NotificationReadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        notification = generics.get_object_or_404(Notification, pk=pk, user=request.user)
        notification.is_read = True
        notification.save(update_fields=["is_read"])
        return Response(NotificationSerializer(notification).data)


class ContactCreateView(generics.CreateAPIView):
    serializer_class = ContactMessageSerializer
    permission_classes = [permissions.AllowAny]
