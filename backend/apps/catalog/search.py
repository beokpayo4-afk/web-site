from django.db import connection
from django.db.models import (
    Case,
    DecimalField,
    ExpressionWrapper,
    F,
    FloatField,
    IntegerField,
    OuterRef,
    Q,
    Subquery,
    Sum,
    Value,
    When,
)
from django.db.models.functions import Coalesce
from rest_framework.filters import BaseFilterBackend

SEARCH_RANK_ZERO = Value(0.0, output_field=FloatField())

SORT_CHOICES = {
    "relevance": "relevance",
    "newest": "newest",
    "-created_at": "newest",
    "created_at": "newest",
    "selling_price": "price_asc",
    "price_asc": "price_asc",
    "-selling_price": "price_desc",
    "price_desc": "price_desc",
    "popularity": "popularity",
    "-review_count": "popularity",
    "rating": "rating",
    "-average_rating": "rating",
    "name": "name",
}


def _units_sold_subquery():
    from apps.orders.models import OrderItem

    return (
        OrderItem.objects.filter(product_id=OuterRef("pk"))
        .values("product_id")
        .annotate(total=Sum("quantity"))
        .values("total")
    )


def annotate_popularity(queryset):
    if "units_sold" in queryset.query.annotations:
        return queryset
    return queryset.annotate(
        units_sold=Coalesce(Subquery(_units_sold_subquery(), output_field=IntegerField()), Value(0)),
    )


def annotate_discount(queryset):
    if "discount_pct" in queryset.query.annotations:
        return queryset
    percent = Case(
        When(mrp__lte=0, then=Value(0)),
        default=ExpressionWrapper(
            (F("mrp") - F("selling_price")) * Value(100) / F("mrp"),
            output_field=DecimalField(max_digits=8, decimal_places=2),
        ),
        output_field=DecimalField(max_digits=8, decimal_places=2),
    )
    return queryset.annotate(discount_pct=percent)


def apply_search(queryset, term: str):
    term = (term or "").strip()
    if not term:
        return queryset.annotate(search_rank=SEARCH_RANK_ZERO, relevance=SEARCH_RANK_ZERO)

    if connection.vendor == "postgresql":
        return _postgres_search(queryset, term)
    return _fallback_search(queryset, term)


def _fallback_search(queryset, term: str):
    tokens = [token for token in term.replace(",", " ").split() if token]
    combined = Q()
    for token in tokens:
        token_q = (
            Q(search_document__icontains=token)
            | Q(name__icontains=token)
            | Q(sku__icontains=token)
            | Q(brand__name__icontains=token)
            | Q(category__name__icontains=token)
            | Q(description__icontains=token)
            | Q(short_description__icontains=token)
            | Q(tags__icontains=token)
        )
        combined &= token_q
    sku_boost = Case(
        When(sku__iexact=term, then=Value(5.0)),
        When(sku__istartswith=term, then=Value(3.0)),
        When(name__icontains=term, then=Value(2.0)),
        default=Value(1.0),
        output_field=FloatField(),
    )
    return queryset.filter(combined).annotate(search_rank=sku_boost, relevance=sku_boost)


def _postgres_search(queryset, term: str):
    from django.contrib.postgres.search import SearchQuery, SearchRank, SearchVector, TrigramSimilarity

    tokens = [token for token in term.replace("-", " ").replace(",", " ").split() if len(token) >= 2]
    fts_term = " ".join(tokens) or term
    vector = SearchVector("search_document", config="english")
    query = SearchQuery(fts_term, search_type="plain", config="english")
    ranked = queryset.annotate(
        search_rank=SearchRank(vector, query),
        name_sim=TrigramSimilarity("name", term),
        sku_sim=TrigramSimilarity("sku", term),
        sku_boost=Case(
            When(sku__iexact=term, then=Value(2.0)),
            When(sku__istartswith=term, then=Value(1.0)),
            default=Value(0.0),
            output_field=FloatField(),
        ),
    ).annotate(
        relevance=ExpressionWrapper(
            F("search_rank") * Value(2.0)
            + F("name_sim")
            + F("sku_sim") * Value(1.5)
            + F("sku_boost"),
            output_field=FloatField(),
        )
    )
    matched = Q(search_document__icontains=term) | Q(name__icontains=term) | Q(sku__icontains=term)
    matched |= Q(brand__name__icontains=term) | Q(category__name__icontains=term)
    matched |= Q(description__icontains=term) | Q(short_description__icontains=term) | Q(tags__icontains=term)
    if tokens:
        matched |= Q(search_rank__gt=0)
    if len(term) >= 4:
        matched |= Q(name_sim__gt=0.35) | Q(sku_sim__gt=0.4)
    return ranked.filter(matched)


def apply_sort(queryset, ordering: str | None, *, has_search: bool):
    key = SORT_CHOICES.get((ordering or "").strip(), "relevance")

    if key == "popularity":
        queryset = annotate_popularity(queryset)
        return queryset.order_by("-units_sold", "-review_count", "-is_bestseller", "-id")
    if key == "price_asc":
        return queryset.order_by("selling_price", "id")
    if key == "price_desc":
        return queryset.order_by("-selling_price", "id")
    if key == "newest":
        return queryset.order_by("-created_at", "-id")
    if key == "rating":
        return queryset.order_by(F("average_rating").desc(nulls_last=True), "-review_count", "-id")
    if key == "name":
        return queryset.order_by("name", "id")
    if has_search:
        return queryset.order_by("-relevance", "-is_bestseller", "-created_at", "-id")
    return queryset.order_by("-is_bestseller", "-is_featured", "-created_at", "-id")


class ProductSearchBackend(BaseFilterBackend):
    """Search + sort in one pass so relevance ranking is available to ORDER BY."""

    def filter_queryset(self, request, queryset, view):
        params = request.query_params
        term = (params.get("search") or params.get("q") or "").strip()
        queryset = apply_search(queryset, term)
        return apply_sort(queryset, params.get("ordering"), has_search=bool(term))
