from rest_framework import serializers

from apps.catalog.models import Product
from apps.catalog.serializers import ProductListSerializer
from apps.commerce.models import Cart, CartItem, WishlistItem


class CartItemSerializer(serializers.ModelSerializer):
    product = ProductListSerializer(read_only=True)
    product_id = serializers.PrimaryKeyRelatedField(queryset=Product.objects.filter(is_active=True), source="product", write_only=True)

    class Meta:
        model = CartItem
        fields = ("id", "product", "product_id", "quantity", "added_at")

    def validate(self, attrs):
        product = attrs.get("product") or getattr(self.instance, "product", None)
        quantity = attrs.get("quantity", getattr(self.instance, "quantity", 1))
        available = product.stock_quantity
        if quantity > available:
            raise serializers.ValidationError({"quantity": f"Only {available} item(s) available."})
        return attrs


class CartSerializer(serializers.ModelSerializer):
    items = CartItemSerializer(many=True, read_only=True)

    class Meta:
        model = Cart
        fields = ("id", "items", "updated_at")


class WishlistItemSerializer(serializers.ModelSerializer):
    product = ProductListSerializer(read_only=True)
    product_id = serializers.PrimaryKeyRelatedField(
        queryset=Product.objects.filter(is_active=True), source="product", write_only=True
    )

    class Meta:
        model = WishlistItem
        fields = ("id", "product", "product_id", "added_at")
