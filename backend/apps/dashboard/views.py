from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db.models import Count, F, Sum
from django.db.models.functions import TruncDate
from django.utils import timezone
from django_filters import rest_framework as filters
from rest_framework import generics, status
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.serializers import AdminCustomerSerializer, user_display_name
from apps.catalog.models import Brand, Category, Inventory, Product, ProductImage, TaxClass
from apps.catalog.serializers import (
    AdminProductSerializer,
    BrandSerializer,
    CategorySerializer,
    InventorySerializer,
    ProductImageSerializer,
    TaxClassSerializer,
)
from apps.common.permissions import HasAdminPermission, IsStaffRole
from apps.engagement.models import ContactMessage, Notification, Review
from apps.engagement.serializers import ContactMessageSerializer, ReviewSerializer
from apps.orders.models import Coupon, Order, OrderItem, Shipment, StoreSetting
from apps.orders.serializers import CouponSerializer, OrderSerializer, OrderStatusSerializer, ShipmentSerializer
from apps.orders.services import transition_order

User = get_user_model()


class AdminPermissionMixin:
    permission_classes = [IsStaffRole, HasAdminPermission]


def _staff_orders():
    return Order.objects.select_related("user", "user__profile").prefetch_related("items", "payments", "shipment")


class InventoryFilter(filters.FilterSet):
    low_stock = filters.BooleanFilter(method="filter_low_stock")

    class Meta:
        model = Inventory
        fields = ["warehouse_code"]

    def filter_low_stock(self, queryset, name, value):
        if value:
            return queryset.filter(quantity__lte=F("low_stock_threshold"))
        return queryset


class DashboardHomeView(AdminPermissionMixin, APIView):
    permission_area = "dashboard"

    def get(self, request):
        paid_orders = Order.objects.filter(payment_status=Order.PaymentStatus.PAID)
        today = timezone.localdate()
        revenue = paid_orders.aggregate(total=Sum("grand_total"))["total"] or 0
        today_revenue = paid_orders.filter(created_at__date=today).aggregate(total=Sum("grand_total"))["total"] or 0

        recent_orders = [
            {
                "id": order.id,
                "order_number": order.order_number,
                "status": order.status,
                "payment_status": order.payment_status,
                "grand_total": str(order.grand_total),
                "customer_email": order.user.email,
                "created_at": order.created_at,
            }
            for order in Order.objects.select_related("user").order_by("-created_at")[:8]
        ]

        best_selling = list(
            OrderItem.objects.filter(order__payment_status=Order.PaymentStatus.PAID)
            .values("product_id", "product_name", "sku")
            .annotate(units=Sum("quantity"), revenue=Sum("line_total"))
            .order_by("-units")[:6]
        )
        for row in best_selling:
            row["revenue"] = str(row["revenue"] or 0)

        low_stock_products = [
            {
                "id": row.id,
                "product_id": row.product_id,
                "sku": row.product.sku,
                "name": row.product.name,
                "quantity": row.quantity,
                "available_quantity": row.available_quantity,
                "low_stock_threshold": row.low_stock_threshold,
            }
            for row in Inventory.objects.filter(quantity__lte=F("low_stock_threshold"))
            .select_related("product")
            .order_by("quantity")[:8]
        ]

        start = today - timedelta(days=13)
        by_day = {
            row["day"]: row
            for row in paid_orders.filter(created_at__date__gte=start)
            .annotate(day=TruncDate("created_at"))
            .values("day")
            .annotate(orders=Count("id"), revenue=Sum("grand_total"))
        }
        sales_overview = []
        for offset in range(13, -1, -1):
            day = today - timedelta(days=offset)
            row = by_day.get(day)
            sales_overview.append(
                {
                    "day": str(day),
                    "orders": row["orders"] if row else 0,
                    "revenue": str(row["revenue"] if row and row["revenue"] is not None else 0),
                }
            )

        recent_customers = [
            {
                "id": user.id,
                "email": user.email,
                "full_name": user_display_name(user),
                "date_joined": user.date_joined,
                "is_active": user.is_active,
            }
            for user in User.objects.filter(role=User.Role.CUSTOMER).select_related("profile").order_by("-date_joined")[:8]
        ]

        return Response(
            {
                "orders": Order.objects.count(),
                "paid_orders": paid_orders.count(),
                "pending_orders": Order.objects.filter(status=Order.Status.PENDING).count(),
                "delivered_orders": Order.objects.filter(status=Order.Status.DELIVERED).count(),
                "customers": User.objects.filter(role=User.Role.CUSTOMER).count(),
                "products": Product.objects.filter(is_active=True).count(),
                "low_stock": Inventory.objects.filter(quantity__lte=F("low_stock_threshold")).count(),
                "pending_reviews": Review.objects.filter(status=Review.Status.PENDING).count(),
                "open_tickets": ContactMessage.objects.filter(is_resolved=False).count(),
                "revenue": str(revenue),
                "today_revenue": str(today_revenue),
                "recent_orders": recent_orders,
                "best_selling_products": best_selling,
                "low_stock_products": low_stock_products,
                "sales_overview": sales_overview,
                "recent_customers": recent_customers,
            }
        )


class ProductFilter(filters.FilterSet):
    stock = filters.CharFilter(method="filter_stock")
    status = filters.CharFilter(field_name="status")
    is_featured = filters.BooleanFilter()
    is_bestseller = filters.BooleanFilter()
    is_active = filters.BooleanFilter()
    category = filters.NumberFilter(field_name="category_id")
    brand = filters.NumberFilter(field_name="brand_id")

    class Meta:
        model = Product
        fields = ["status", "is_active", "is_featured", "is_bestseller", "category", "brand"]

    def filter_stock(self, queryset, name, value):
        value = (value or "").strip().lower()
        if value == "in_stock":
            return queryset.filter(stock_quantity__gt=F("inventory__low_stock_threshold"))
        if value == "low_stock":
            return queryset.filter(stock_quantity__gt=0, stock_quantity__lte=F("inventory__low_stock_threshold"))
        if value in {"out_of_stock", "out"}:
            return queryset.filter(stock_quantity=0)
        return queryset


class AdminProductListCreateView(AdminPermissionMixin, generics.ListCreateAPIView):
    permission_area = "products"
    serializer_class = AdminProductSerializer
    queryset = Product.objects.all().select_related("category", "brand", "tax_class", "inventory").prefetch_related("images")
    search_fields = ["name", "sku", "slug", "brand__name", "category__name", "search_document"]
    filterset_class = ProductFilter
    ordering_fields = ["created_at", "selling_price", "name", "stock_quantity", "mrp"]
    ordering = ["-created_at"]


class AdminProductDetailView(AdminPermissionMixin, generics.RetrieveUpdateDestroyAPIView):
    permission_area = "products"
    serializer_class = AdminProductSerializer
    queryset = Product.objects.all().select_related("category", "brand", "tax_class", "inventory").prefetch_related("images")

    def perform_destroy(self, instance):
        from apps.catalog.services import deactivate_product

        deactivate_product(instance)


class AdminProductStatusView(AdminPermissionMixin, APIView):
    permission_area = "products"

    def post(self, request, pk):
        from apps.catalog.services import publish_product, unpublish_product

        product = generics.get_object_or_404(Product, pk=pk)
        action = str(request.data.get("action") or request.data.get("status") or "").strip().upper()
        if action in {"PUBLISH", "PUBLISHED"}:
            publish_product(product)
        elif action in {"UNPUBLISH", "UNPUBLISHED"}:
            unpublish_product(product)
        elif action == "DRAFT":
            product.status = Product.Status.DRAFT
            product.save(update_fields=["status", "is_active", "updated_at"])
        else:
            raise ValidationError({"action": "Use publish, unpublish, or draft."})
        return Response(AdminProductSerializer(product, context={"request": request}).data)


class AdminProductImageListCreateView(AdminPermissionMixin, generics.ListCreateAPIView):
    permission_area = "products"
    serializer_class = ProductImageSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    pagination_class = None

    def get_queryset(self):
        return ProductImage.objects.filter(product_id=self.kwargs["pk"])

    def perform_create(self, serializer):
        product = generics.get_object_or_404(Product, pk=self.kwargs["pk"])
        image = serializer.save(product=product)
        if image.is_primary:
            ProductImage.objects.filter(product=product).exclude(pk=image.pk).update(is_primary=False)


class AdminProductImageDetailView(AdminPermissionMixin, generics.RetrieveUpdateDestroyAPIView):
    permission_area = "products"
    serializer_class = ProductImageSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    lookup_url_kwarg = "image_pk"
    http_method_names = ["get", "patch", "delete", "head", "options"]

    def get_queryset(self):
        return ProductImage.objects.filter(product_id=self.kwargs["pk"])

    def perform_update(self, serializer):
        image = serializer.save()
        if image.is_primary:
            ProductImage.objects.filter(product_id=self.kwargs["pk"]).exclude(pk=image.pk).update(is_primary=False)


class AdminProductImageDeleteView(AdminProductImageDetailView):
    """Backward-compatible alias for DELETE-only clients. """


class AdminCategoryView(AdminPermissionMixin, generics.ListCreateAPIView):
    permission_area = "categories"
    serializer_class = CategorySerializer
    queryset = Category.objects.all()
    search_fields = ["name", "slug"]
    filterset_fields = ["is_active"]


class AdminCategoryDetailView(AdminPermissionMixin, generics.RetrieveUpdateDestroyAPIView):
    permission_area = "categories"
    serializer_class = CategorySerializer
    queryset = Category.objects.all()


class AdminBrandView(AdminPermissionMixin, generics.ListCreateAPIView):
    permission_area = "brands"
    serializer_class = BrandSerializer
    queryset = Brand.objects.all()
    search_fields = ["name", "slug"]
    filterset_fields = ["is_active"]


class AdminBrandDetailView(AdminPermissionMixin, generics.RetrieveUpdateDestroyAPIView):
    permission_area = "brands"
    serializer_class = BrandSerializer
    queryset = Brand.objects.all()


class AdminTaxClassView(AdminPermissionMixin, generics.ListCreateAPIView):
    permission_area = "products"
    serializer_class = TaxClassSerializer
    queryset = TaxClass.objects.all()
    pagination_class = None


class AdminInventoryView(AdminPermissionMixin, generics.ListAPIView):
    permission_area = "inventory"
    serializer_class = InventorySerializer
    queryset = Inventory.objects.select_related("product").order_by("product__name")
    search_fields = ["product__name", "product__sku"]
    filterset_class = InventoryFilter


class AdminInventoryDetailView(AdminPermissionMixin, generics.RetrieveUpdateAPIView):
    permission_area = "inventory"
    serializer_class = InventorySerializer
    queryset = Inventory.objects.select_related("product")
    http_method_names = ["get", "patch", "head", "options"]


class AdminOrderListView(AdminPermissionMixin, generics.ListAPIView):
    permission_area = "orders"
    serializer_class = OrderSerializer
    queryset = _staff_orders()
    search_fields = ["order_number", "user__email", "user__phone"]
    filterset_fields = ["status", "payment_status"]
    ordering_fields = ["created_at", "grand_total"]


class AdminOrderDetailView(AdminPermissionMixin, generics.RetrieveAPIView):
    permission_area = "orders"
    serializer_class = OrderSerializer
    queryset = _staff_orders()


class AdminOrderStatusView(AdminPermissionMixin, APIView):
    permission_area = "orders"

    def post(self, request, pk):
        if "payment_status" in request.data:
            raise ValidationError({"payment_status": "Payment status is controlled separately from order status."})
        serializer = OrderStatusSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        order = generics.get_object_or_404(Order, pk=pk)
        updated = transition_order(order, serializer.validated_data["status"], by_admin=True)
        return Response(OrderSerializer(updated).data)


class AdminCustomerListView(AdminPermissionMixin, generics.ListAPIView):
    permission_area = "customers"
    serializer_class = AdminCustomerSerializer
    queryset = (
        User.objects.filter(role=User.Role.CUSTOMER)
        .select_related("profile")
        .annotate(order_count=Count("orders"))
        .order_by("-date_joined")
    )
    search_fields = ["email", "phone", "profile__full_name"]
    filterset_fields = ["is_active"]


class AdminCustomerDetailView(AdminPermissionMixin, generics.RetrieveUpdateAPIView):
    permission_area = "customers"
    serializer_class = AdminCustomerSerializer
    http_method_names = ["get", "patch", "head", "options"]
    queryset = (
        User.objects.filter(role=User.Role.CUSTOMER)
        .select_related("profile")
        .annotate(order_count=Count("orders"))
    )


class AdminCustomerOrdersView(AdminPermissionMixin, generics.ListAPIView):
    permission_area = "customers"
    serializer_class = OrderSerializer

    def get_queryset(self):
        customer = generics.get_object_or_404(User, pk=self.kwargs["pk"], role=User.Role.CUSTOMER)
        return _staff_orders().filter(user=customer)


class AdminReviewListView(AdminPermissionMixin, generics.ListAPIView):
    permission_area = "reviews"
    serializer_class = ReviewSerializer
    queryset = Review.objects.select_related("user", "user__profile", "product")
    filterset_fields = ["is_approved", "rating", "status"]
    search_fields = ["title", "body", "product__name"]


class AdminReviewModerateView(AdminPermissionMixin, APIView):
    permission_area = "reviews"

    def post(self, request, pk):
        review = generics.get_object_or_404(Review, pk=pk)
        requested = request.data.get("status")
        if requested in Review.Status.values:
            review.status = requested
        elif "is_approved" in request.data:
            review.status = Review.Status.APPROVED if request.data.get("is_approved") else Review.Status.PENDING
        else:
            return Response({"detail": "Provide status or is_approved."}, status=status.HTTP_400_BAD_REQUEST)
        note = request.data.get("moderation_note")
        if note is not None:
            review.moderation_note = str(note)[:240]
        review.save(update_fields=["status", "is_approved", "moderation_note", "updated_at"])
        return Response(ReviewSerializer(review, context={"request": request}).data)


class AdminCouponView(AdminPermissionMixin, generics.ListCreateAPIView):
    permission_area = "coupons"
    serializer_class = CouponSerializer
    queryset = Coupon.objects.all()
    search_fields = ["code", "description"]
    filterset_fields = ["is_active", "discount_type"]


class AdminCouponDetailView(AdminPermissionMixin, generics.RetrieveUpdateDestroyAPIView):
    permission_area = "coupons"
    serializer_class = CouponSerializer
    queryset = Coupon.objects.all()


class AdminShipmentListView(AdminPermissionMixin, generics.ListAPIView):
    permission_area = "shipping"
    serializer_class = ShipmentSerializer
    queryset = Shipment.objects.select_related("order").order_by("-created_at")
    search_fields = ["tracking_number", "order__order_number", "carrier"]
    filterset_fields = ["status"]


class AdminShipmentDetailView(AdminPermissionMixin, generics.RetrieveUpdateAPIView):
    permission_area = "shipping"
    serializer_class = ShipmentSerializer
    queryset = Shipment.objects.select_related("order")
    http_method_names = ["get", "patch", "head", "options"]


class AdminNotificationBroadcastView(AdminPermissionMixin, APIView):
    permission_area = "notifications"

    def post(self, request):
        title = request.data.get("title")
        message = request.data.get("message")
        if not title or not message:
            return Response({"success": False, "error": {"message": "Title and message are required."}}, status=400)
        users = User.objects.filter(role=User.Role.CUSTOMER, is_active=True)
        Notification.objects.bulk_create([Notification(user=user, title=title, message=message) for user in users])
        return Response({"detail": f"Sent to {users.count()} customers."}, status=status.HTTP_201_CREATED)


class AdminContactListView(AdminPermissionMixin, generics.ListAPIView):
    permission_area = "notifications"
    serializer_class = ContactMessageSerializer
    queryset = ContactMessage.objects.all()
    filterset_fields = ["is_resolved"]
    search_fields = ["name", "email", "subject"]


class AdminContactResolveView(AdminPermissionMixin, APIView):
    permission_area = "notifications"

    def post(self, request, pk):
        ticket = generics.get_object_or_404(ContactMessage, pk=pk)
        ticket.is_resolved = bool(request.data.get("is_resolved", True))
        ticket.save(update_fields=["is_resolved", "updated_at"])
        return Response(ContactMessageSerializer(ticket).data)


class AdminReportsView(AdminPermissionMixin, APIView):
    permission_area = "reports"

    def get(self, request):
        paid = Order.objects.filter(payment_status=Order.PaymentStatus.PAID)
        by_day = (
            paid.annotate(day=TruncDate("created_at"))
            .values("day")
            .annotate(orders=Count("id"), revenue=Sum("grand_total"))
            .order_by("day")
        )
        daily = [{"day": str(row["day"]), "orders": row["orders"], "revenue": str(row["revenue"] or 0)} for row in by_day]
        top_products = list(
            paid.values("items__product_id", "items__product_name", "items__sku")
            .annotate(units=Sum("items__quantity"), revenue=Sum("items__line_total"))
            .order_by("-units")[:8]
        )
        for row in top_products:
            row["revenue"] = str(row["revenue"] or 0)
        return Response(
            {
                "daily": daily,
                "top_products": top_products,
                "status_breakdown": list(Order.objects.values("status").annotate(count=Count("id"))),
            }
        )


class AdminSettingsView(AdminPermissionMixin, APIView):
    permission_area = "settings"

    def get(self, request):
        data = {row.key: row.value for row in StoreSetting.objects.all()}
        return Response(data)

    def put(self, request):
        for key, value in request.data.items():
            StoreSetting.objects.update_or_create(key=key, defaults={"value": value})
        data = {row.key: row.value for row in StoreSetting.objects.all()}
        return Response(data)
