from django.db.models import F, Q

import django_filters

from apps.catalog.models import Product
from apps.catalog.search import annotate_discount


class ProductFilter(django_filters.FilterSet):
    min_price = django_filters.NumberFilter(field_name="selling_price", lookup_expr="gte")
    max_price = django_filters.NumberFilter(field_name="selling_price", lookup_expr="lte")
    category = django_filters.CharFilter(method="filter_category")
    brand = django_filters.CharFilter(method="filter_brand")
    featured = django_filters.BooleanFilter(field_name="is_featured")
    bestseller = django_filters.BooleanFilter(field_name="is_bestseller")
    in_stock = django_filters.BooleanFilter(method="filter_in_stock")
    availability = django_filters.CharFilter(method="filter_availability")
    min_rating = django_filters.NumberFilter(method="filter_min_rating")
    on_sale = django_filters.BooleanFilter(method="filter_on_sale")
    min_discount = django_filters.NumberFilter(method="filter_min_discount")
    tag = django_filters.CharFilter(method="filter_tag")

    class Meta:
        model = Product
        fields = ["category", "brand", "featured", "bestseller"]

    def filter_category(self, queryset, name, value):
        if not value:
            return queryset
        slugs = [part.strip() for part in str(value).split(",") if part.strip()]
        if not slugs:
            return queryset
        return queryset.filter(category__slug__in=slugs)

    def filter_brand(self, queryset, name, value):
        if not value:
            return queryset
        slugs = [part.strip() for part in str(value).split(",") if part.strip()]
        if not slugs:
            return queryset
        return queryset.filter(brand__slug__in=slugs)

    def filter_in_stock(self, queryset, name, value):
        if value:
            return queryset.filter(stock_quantity__gt=0)
        return queryset

    def filter_availability(self, queryset, name, value):
        key = (value or "").strip().lower()
        if key in {"in_stock", "in-stock", "available"}:
            return queryset.filter(stock_quantity__gt=0)
        if key in {"out_of_stock", "out-of-stock", "unavailable"}:
            return queryset.filter(stock_quantity=0)
        return queryset

    def filter_min_rating(self, queryset, name, value):
        if value is None:
            return queryset
        return queryset.filter(average_rating__gte=value)

    def filter_on_sale(self, queryset, name, value):
        if value:
            return queryset.filter(mrp__gt=F("selling_price"))
        return queryset

    def filter_min_discount(self, queryset, name, value):
        if value is None:
            return queryset
        return annotate_discount(queryset).filter(discount_pct__gte=value)

    def filter_tag(self, queryset, name, value):
        tag = (value or "").strip().lower()
        if not tag:
            return queryset
        return queryset.filter(Q(tags__icontains=tag) | Q(search_document__icontains=tag))
