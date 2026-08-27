from django.db.models import Count, Max, Min, Prefetch
from django.shortcuts import get_object_or_404
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import generics, permissions, status
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.catalog.filters import ProductFilter
from apps.catalog.models import Brand, Category, Product, ProductImage
from apps.catalog.search import ProductSearchBackend, apply_search
from apps.catalog.serializers import (
    AdminProductSerializer,
    BrandSerializer,
    CategorySerializer,
    ProductDetailSerializer,
    ProductImageSerializer,
    ProductListSerializer,
    with_review_stats,
)
from apps.catalog.services import deactivate_product
from apps.common.permissions import ROLE_PERMISSIONS, STAFF_ROLES, IsCatalogReadOrProductStaff
from apps.orders.models import OrderItem


def _base_product_qs():
    return Product.objects.select_related("category", "brand", "tax_class").prefetch_related(
        Prefetch("images", queryset=ProductImage.objects.all())
    )


def _public_product_qs():
    return with_review_stats(_base_product_qs().filter(is_active=True))


def _staff_catalog_qs():
    return with_review_stats(_base_product_qs())


def _can_manage_products(user):
    return bool(
        user
        and user.is_authenticated
        and getattr(user, "role", None) in STAFF_ROLES
        and "products" in ROLE_PERMISSIONS.get(user.role, set())
    )


class CategoryListView(generics.ListAPIView):
    serializer_class = CategorySerializer
    pagination_class = None
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ["name", "slug", "description"]
    ordering_fields = ["sort_order", "name"]
    queryset = Category.objects.filter(is_active=True)


class CategoryDetailView(generics.RetrieveAPIView):
    serializer_class = CategorySerializer
    lookup_field = "slug"
    queryset = Category.objects.filter(is_active=True)


class BrandListView(generics.ListAPIView):
    serializer_class = BrandSerializer
    pagination_class = None
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ["name", "slug", "description"]
    ordering_fields = ["name"]
    queryset = Brand.objects.filter(is_active=True)


class BrandDetailView(generics.RetrieveAPIView):
    serializer_class = BrandSerializer
    lookup_field = "slug"
    queryset = Brand.objects.filter(is_active=True)


class ProductListView(generics.ListCreateAPIView):
    permission_classes = [IsCatalogReadOrProductStaff]
    filterset_class = ProductFilter
    filter_backends = [DjangoFilterBackend, ProductSearchBackend]
    search_fields = ["name", "sku", "short_description", "description", "brand__name", "category__name", "tags"]

    def get_queryset(self):
        if self.request.method != "GET":
            return _staff_catalog_qs()
        if _can_manage_products(self.request.user) and self.request.query_params.get("include_inactive") == "true":
            return _staff_catalog_qs()
        return _public_product_qs()

    def get_serializer_class(self):
        if self.request.method == "POST":
            return AdminProductSerializer
        return ProductListSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        product = serializer.save()
        detail = ProductDetailSerializer(product, context=self.get_serializer_context())
        return Response(detail.data, status=status.HTTP_201_CREATED)


class ProductFacetView(APIView):
    """Counts and price bounds for the current search, without product rows."""

    permission_classes = [permissions.AllowAny]

    def get(self, request):
        queryset = apply_search(
            _public_product_qs(),
            request.query_params.get("search") or request.query_params.get("q") or "",
        )
        params = request.query_params

        def without(*keys):
            data = params.copy()
            for key in keys:
                data.pop(key, None)
            return ProductFilter(data, queryset=queryset).qs

        filtered_ids = ProductFilter(params, queryset=queryset).qs.values("id")
        filtered = Product.objects.filter(id__in=filtered_ids, is_active=True)
        prices = filtered.aggregate(min_price=Min("selling_price"), max_price=Max("selling_price"))
        category_ids = without("category").values("id")
        brand_ids = without("brand").values("id")
        categories = (
            Product.objects.filter(id__in=category_ids, is_active=True)
            .values("category__slug", "category__name")
            .annotate(count=Count("id"))
            .order_by("category__name")
        )
        brands = (
            Product.objects.filter(id__in=brand_ids, is_active=True)
            .values("brand__slug", "brand__name")
            .annotate(count=Count("id"))
            .order_by("brand__name")
        )
        return Response(
            {
                "count": filtered.count(),
                "min_price": prices["min_price"],
                "max_price": prices["max_price"],
                "categories": [
                    {"slug": row["category__slug"], "name": row["category__name"], "count": row["count"]}
                    for row in categories
                    if row["category__slug"]
                ],
                "brands": [
                    {"slug": row["brand__slug"], "name": row["brand__name"], "count": row["count"]}
                    for row in brands
                    if row["brand__slug"]
                ],
            }
        )


class ProductDetailByIdView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsCatalogReadOrProductStaff]
    lookup_field = "pk"

    def get_queryset(self):
        if self.request.method == "GET" and not _can_manage_products(self.request.user):
            return _public_product_qs()
        return _staff_catalog_qs()

    def get_serializer_class(self):
        if self.request.method in ("PUT", "PATCH"):
            return AdminProductSerializer
        return ProductDetailSerializer

    def perform_destroy(self, instance):
        deactivate_product(instance)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        has_orders = OrderItem.objects.filter(product=instance).exists()
        deactivate_product(instance)
        return Response(
            {
                "detail": "Product deactivated.",
                "id": instance.id,
                "is_active": False,
                "preserved_order_history": has_orders,
            },
            status=status.HTTP_200_OK,
        )


class ProductDetailView(generics.RetrieveAPIView):
    serializer_class = ProductDetailSerializer
    lookup_field = "slug"
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        if _can_manage_products(self.request.user):
            return _staff_catalog_qs()
        return _public_product_qs()


class ProductImageListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsCatalogReadOrProductStaff]
    serializer_class = ProductImageSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    pagination_class = None

    def get_queryset(self):
        return ProductImage.objects.filter(product_id=self.kwargs["pk"])

    def perform_create(self, serializer):
        product = get_object_or_404(Product, pk=self.kwargs["pk"])
        serializer.save(product=product)


class ProductImageDeleteView(generics.DestroyAPIView):
    permission_classes = [IsCatalogReadOrProductStaff]
    serializer_class = ProductImageSerializer
    lookup_url_kwarg = "image_pk"

    def get_queryset(self):
        return ProductImage.objects.filter(product_id=self.kwargs["pk"])
