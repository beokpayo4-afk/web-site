from django.urls import path

from apps.catalog.views import (
    BrandDetailView,
    BrandListView,
    CategoryDetailView,
    CategoryListView,
    ProductDetailByIdView,
    ProductDetailView,
    ProductFacetView,
    ProductImageDeleteView,
    ProductImageListCreateView,
    ProductListView,
)

urlpatterns = [
    path("categories/", CategoryListView.as_view(), name="categories"),
    path("categories/<slug:slug>/", CategoryDetailView.as_view(), name="category_detail"),
    path("brands/", BrandListView.as_view(), name="brands"),
    path("brands/<slug:slug>/", BrandDetailView.as_view(), name="brand_detail"),
    path("products/", ProductListView.as_view(), name="products"),
    path("products/facets/", ProductFacetView.as_view(), name="product_facets"),
    path("products/<int:pk>/", ProductDetailByIdView.as_view(), name="product_detail_id"),
    path("products/<int:pk>/images/", ProductImageListCreateView.as_view(), name="product_images"),
    path("products/<int:pk>/images/<int:image_pk>/", ProductImageDeleteView.as_view(), name="product_image_delete"),
    path("products/<slug:slug>/", ProductDetailView.as_view(), name="product_detail"),
]
