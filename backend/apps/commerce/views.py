from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.commerce.models import Cart, CartItem, Wishlist, WishlistItem
from apps.commerce.serializers import CartItemSerializer, CartSerializer, WishlistItemSerializer
from apps.common.exceptions import ConflictError


class CartView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        cart, _ = Cart.objects.get_or_create(user=request.user)
        cart = Cart.objects.prefetch_related("items__product__category", "items__product__brand", "items__product__images").get(pk=cart.pk)
        return Response(CartSerializer(cart, context={"request": request}).data)


class CartItemCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        cart, _ = Cart.objects.get_or_create(user=request.user)
        serializer = CartItemSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        product = serializer.validated_data["product"]
        quantity = serializer.validated_data.get("quantity", 1)
        item, created = CartItem.objects.get_or_create(cart=cart, product=product, defaults={"quantity": quantity})
        if not created:
            item.quantity += quantity
            if item.quantity > product.stock_quantity:
                raise ConflictError("Not enough stock to add that quantity.")
            item.save(update_fields=["quantity", "updated_at"])
        return Response(CartItemSerializer(item, context={"request": request}).data, status=status.HTTP_201_CREATED)


class CartItemDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = CartItemSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return CartItem.objects.filter(cart__user=self.request.user).select_related("product")


class WishlistView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        wishlist, _ = Wishlist.objects.get_or_create(user=request.user)
        items = wishlist.items.select_related("product__category", "product__brand").prefetch_related("product__images")
        return Response(WishlistItemSerializer(items, many=True, context={"request": request}).data)

    def post(self, request):
        wishlist, _ = Wishlist.objects.get_or_create(user=request.user)
        serializer = WishlistItemSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        product = serializer.validated_data["product"]
        item, created = WishlistItem.objects.get_or_create(wishlist=wishlist, product=product)
        if not created:
            raise ConflictError("This product is already in your wishlist.")
        return Response(WishlistItemSerializer(item, context={"request": request}).data, status=status.HTTP_201_CREATED)


class WishlistMoveToCartView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        item = generics.get_object_or_404(WishlistItem, pk=pk, wishlist__user=request.user)
        product = item.product
        if not product.is_active or product.stock_quantity < 1:
            raise ConflictError("This product is currently unavailable.")
        cart, _ = Cart.objects.get_or_create(user=request.user)
        cart_item, created = CartItem.objects.get_or_create(cart=cart, product=product, defaults={"quantity": 1})
        if not created:
            if cart_item.quantity + 1 > product.stock_quantity:
                raise ConflictError("Not enough stock to move this item to your cart.")
            cart_item.quantity += 1
            cart_item.save(update_fields=["quantity", "updated_at"])
        wishlist_id = item.id
        item.delete()
        return Response(
            {
                "wishlist_item_id": wishlist_id,
                "cart_item": CartItemSerializer(cart_item, context={"request": request}).data,
            },
            status=status.HTTP_200_OK,
        )


class WishlistItemDeleteView(generics.DestroyAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return WishlistItem.objects.filter(wishlist__user=self.request.user)
