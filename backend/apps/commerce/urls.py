from django.urls import path

from apps.commerce.views import (
    CartItemCreateView,
    CartItemDetailView,
    CartView,
    WishlistItemDeleteView,
    WishlistMoveToCartView,
    WishlistView,
)

urlpatterns = [
    path("cart/", CartView.as_view(), name="cart"),
    path("cart/items/", CartItemCreateView.as_view(), name="cart_items"),
    path("cart/items/<int:pk>/", CartItemDetailView.as_view(), name="cart_item_detail"),
    path("wishlist/", WishlistView.as_view(), name="wishlist"),
    path("wishlist/<int:pk>/move-to-cart/", WishlistMoveToCartView.as_view(), name="wishlist_move_to_cart"),
    path("wishlist/<int:pk>/", WishlistItemDeleteView.as_view(), name="wishlist_item_delete"),
]
