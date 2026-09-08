from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.files.uploadedfile import UploadedFile
from django.core.validators import URLValidator
from django.db.models import Avg, Count, Q
from rest_framework import serializers
from rest_framework.fields import empty

from apps.catalog.models import Brand, Category, Inventory, Product, ProductImage, TaxClass, normalize_tags


def public_image_url(image, request=None):
    url = image.display_url() if image else ""
    if not url:
        return None
    if url.startswith("http://") or url.startswith("https://"):
        return url
    return request.build_absolute_uri(url) if request else url


def _is_uploaded_file(value):
    return isinstance(value, UploadedFile) or (
        value is not None
        and not isinstance(value, (str, bytes, bytearray))
        and callable(getattr(value, "read", None))
        and hasattr(value, "name")
    )


class ImageURLOrFileField(serializers.CharField):
    """Accepts an http(s) image URL or a multipart uploaded file."""

    def to_internal_value(self, data):
        if _is_uploaded_file(data):
            return data
        return super().to_internal_value(data)


class TaxClassSerializer(serializers.ModelSerializer):
    class Meta:
        model = TaxClass
        fields = ("id", "name", "hsn_sac_code", "cgst_rate", "sgst_rate", "igst_rate", "is_active")


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ("id", "name", "slug", "description", "parent", "is_active", "sort_order", "created_at", "updated_at")
        read_only_fields = ("created_at", "updated_at")


class BrandSerializer(serializers.ModelSerializer):
    class Meta:
        model = Brand
        fields = ("id", "name", "slug", "description", "is_active", "created_at", "updated_at")
        read_only_fields = ("created_at", "updated_at")


class ProductImageSerializer(serializers.ModelSerializer):
    image = ImageURLOrFileField(required=False, allow_blank=True, max_length=1000)

    class Meta:
        model = ProductImage
        fields = ("id", "image", "alt_text", "is_primary", "sort_order")

    def validate_image(self, value):
        if _is_uploaded_file(value):
            return value
        value = (value or "").strip() if isinstance(value, str) else ""
        if not value:
            return ""
        try:
            URLValidator()(value)
        except DjangoValidationError:
            raise serializers.ValidationError("Enter a valid image URL.") from None
        if not value.lower().startswith(("http://", "https://")):
            raise serializers.ValidationError("Image URL must start with http:// or https://.")
        return value

    def _uploaded_file(self, image_value=empty):
        if image_value is not empty and _is_uploaded_file(image_value):
            return image_value
        request = self.context.get("request")
        if not request:
            return None
        return request.FILES.get("image")

    def validate(self, attrs):
        if self.instance is None and not attrs.get("image") and not self._uploaded_file(attrs.get("image", empty)):
            raise serializers.ValidationError({"image": "Image URL is required."})
        return attrs

    def _clear_file(self, instance):
        if instance.image:
            instance.image.delete(save=False)
        instance.image = ""

    def create(self, validated_data):
        image_value = validated_data.pop("image", "") or ""
        uploaded = self._uploaded_file(image_value)
        instance = ProductImage(**validated_data)
        if uploaded:
            instance.image = uploaded
            instance.image_url = ""
        elif isinstance(image_value, str) and image_value:
            instance.image = ""
            instance.image_url = image_value
        instance.save()
        return instance

    def update(self, instance, validated_data):
        image_value = validated_data.pop("image", empty)
        uploaded = self._uploaded_file(image_value)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if uploaded:
            instance.image = uploaded
            instance.image_url = ""
        elif image_value is not empty and image_value:
            self._clear_file(instance)
            instance.image_url = image_value
        instance.save()
        return instance

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["image"] = public_image_url(instance, self.context.get("request")) or ""
        return data


class ProductListSerializer(serializers.ModelSerializer):
    category = CategorySerializer(read_only=True)
    brand = BrandSerializer(read_only=True, allow_null=True)
    discount_percent = serializers.IntegerField(read_only=True)
    discount_amount = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    average_rating = serializers.FloatField(read_only=True)
    review_count = serializers.IntegerField(read_only=True)
    primary_image = serializers.SerializerMethodField()
    tags = serializers.ListField(child=serializers.CharField(), read_only=True)

    class Meta:
        model = Product
        fields = (
            "id",
            "name",
            "sku",
            "slug",
            "short_description",
            "mrp",
            "selling_price",
            "discount_percent",
            "discount_amount",
            "stock_quantity",
            "category",
            "brand",
            "is_featured",
            "is_bestseller",
            "average_rating",
            "review_count",
            "primary_image",
            "tags",
            "is_active",
        )

    def get_primary_image(self, obj):
        image = next((img for img in obj.images.all() if img.is_primary), None)
        if image is None:
            image = obj.images.first()
        return public_image_url(image, self.context.get("request"))


class ProductDetailSerializer(ProductListSerializer):
    images = ProductImageSerializer(many=True, read_only=True)
    tax_class = TaxClassSerializer(read_only=True)
    specifications = serializers.JSONField()
    in_wishlist = serializers.SerializerMethodField()

    class Meta(ProductListSerializer.Meta):
        fields = ProductListSerializer.Meta.fields + (
            "description",
            "specifications",
            "images",
            "tax_class",
            "created_at",
            "updated_at",
            "in_wishlist",
        )

    def get_in_wishlist(self, obj):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return False
        from apps.commerce.models import WishlistItem

        return WishlistItem.objects.filter(wishlist__user=user, product_id=obj.id).exists()


class AdminProductSerializer(serializers.ModelSerializer):
    initial_quantity = serializers.IntegerField(write_only=True, required=False, min_value=0, default=0)
    stock_quantity = serializers.IntegerField(required=False, min_value=0)
    discount_percent = serializers.IntegerField(read_only=True)
    discount_amount = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    category_name = serializers.CharField(source="category.name", read_only=True)
    brand_name = serializers.SerializerMethodField()
    tax_class_name = serializers.CharField(source="tax_class.name", read_only=True)
    gst_rate = serializers.DecimalField(source="tax_class.igst_rate", max_digits=5, decimal_places=2, read_only=True)
    gst_amount = serializers.SerializerMethodField()
    images = ProductImageSerializer(many=True, read_only=True)
    primary_image = serializers.SerializerMethodField()
    low_stock_threshold = serializers.SerializerMethodField()
    stock_status = serializers.SerializerMethodField()
    tags = serializers.ListField(child=serializers.CharField(max_length=40), required=False)
    brand = serializers.PrimaryKeyRelatedField(queryset=Brand.objects.all(), allow_null=True, required=False)

    class Meta:
        model = Product
        fields = (
            "id",
            "name",
            "sku",
            "slug",
            "description",
            "short_description",
            "mrp",
            "selling_price",
            "discount_percent",
            "discount_amount",
            "tax_class",
            "tax_class_name",
            "gst_rate",
            "gst_amount",
            "category",
            "category_name",
            "brand",
            "brand_name",
            "specifications",
            "tags",
            "stock_quantity",
            "initial_quantity",
            "low_stock_threshold",
            "stock_status",
            "images",
            "primary_image",
            "status",
            "is_active",
            "is_featured",
            "is_bestseller",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "discount_percent",
            "discount_amount",
            "gst_rate",
            "gst_amount",
            "low_stock_threshold",
            "stock_status",
            "primary_image",
            "is_active",
            "created_at",
            "updated_at",
        )

    def get_brand_name(self, obj):
        return obj.brand.name if obj.brand_id else ""

    def get_gst_amount(self, obj):
        from decimal import Decimal

        rate = obj.tax_class.igst_rate if obj.tax_class_id else Decimal("0")
        return (obj.selling_price * rate / Decimal("100")).quantize(Decimal("0.01"))

    def get_primary_image(self, obj):
        images = list(obj.images.all())
        primary = next((img for img in images if img.is_primary), images[0] if images else None)
        return public_image_url(primary, self.context.get("request"))

    def get_low_stock_threshold(self, obj):
        inventory = getattr(obj, "inventory", None)
        return inventory.low_stock_threshold if inventory else 5

    def get_stock_status(self, obj):
        stock = obj.stock_quantity
        threshold = self.get_low_stock_threshold(obj)
        if stock <= 0:
            return "out_of_stock"
        if stock <= threshold:
            return "low_stock"
        return "in_stock"

    def validate_name(self, value):
        cleaned = " ".join(str(value).split())
        if len(cleaned) < 2:
            raise serializers.ValidationError("Product name must be at least 2 characters.")
        if len(cleaned) > 180:
            raise serializers.ValidationError("Product name cannot exceed 180 characters.")
        return cleaned

    def validate_sku(self, value):
        cleaned = str(value).strip().upper()
        if len(cleaned) < 3:
            raise serializers.ValidationError("SKU must be at least 3 characters.")
        qs = Product.objects.filter(sku__iexact=cleaned)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("SKU must be unique.")
        return cleaned

    def validate_tags(self, value):
        return normalize_tags(value)

    def validate_slug(self, value):
        qs = Product.objects.filter(slug=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("Slug must be unique.")
        return value

    def validate_specifications(self, value):
        if value in (None, ""):
            return {}
        if not isinstance(value, dict):
            raise serializers.ValidationError("Specifications must be an object of name/value pairs.")
        cleaned = {}
        for key, raw in value.items():
            name = str(key).strip()[:80]
            if not name:
                continue
            cleaned[name] = str(raw).strip()[:200]
            if len(cleaned) >= 40:
                break
        return cleaned

    def validate_short_description(self, value):
        return str(value or "").strip()[:280]

    def validate(self, attrs):
        mrp = attrs.get("mrp", getattr(self.instance, "mrp", None))
        selling = attrs.get("selling_price", getattr(self.instance, "selling_price", None))
        if mrp is not None and selling is not None and selling > mrp:
            raise serializers.ValidationError({"selling_price": "Selling price cannot exceed MRP."})
        if "status" not in attrs and "is_active" in self.initial_data:
            # Back-compat: map is_active toggles from older clients to status.
            if self.initial_data.get("is_active") in (True, "true", "True", 1, "1"):
                attrs["status"] = Product.Status.PUBLISHED
            else:
                attrs["status"] = Product.Status.UNPUBLISHED
        status_value = attrs.get("status", getattr(self.instance, "status", Product.Status.DRAFT))
        if status_value == Product.Status.PUBLISHED:
            name = attrs.get("name", getattr(self.instance, "name", ""))
            category = attrs.get("category", getattr(self.instance, "category", None))
            price = attrs.get("selling_price", getattr(self.instance, "selling_price", None))
            if not name or category is None or price is None:
                raise serializers.ValidationError({"status": "Published products need name, category, and price."})
        return attrs

    def create(self, validated_data):
        quantity = validated_data.pop("initial_quantity", validated_data.pop("stock_quantity", 0) or 0)
        validated_data.setdefault("status", Product.Status.DRAFT)
        if not validated_data.get("slug"):
            from django.utils.text import slugify

            base = slugify(validated_data.get("sku") or validated_data.get("name") or "product")
            slug = base
            index = 1
            while Product.objects.filter(slug=slug).exists():
                slug = f"{base}-{index}"
                index += 1
            validated_data["slug"] = slug
        if validated_data.get("mrp") is None and validated_data.get("selling_price") is not None:
            validated_data["mrp"] = validated_data["selling_price"]
        product = super().create(validated_data)
        Inventory.objects.update_or_create(
            product=product,
            defaults={"quantity": quantity, "reserved_quantity": 0},
        )
        product.refresh_from_db()
        return product

    def update(self, instance, validated_data):
        quantity = validated_data.pop("initial_quantity", None)
        stock_quantity = validated_data.pop("stock_quantity", None)
        if quantity is None:
            quantity = stock_quantity
        product = super().update(instance, validated_data)
        if quantity is not None:
            inventory, _ = Inventory.objects.get_or_create(product=product, defaults={"quantity": 0, "reserved_quantity": 0})
            if quantity < inventory.reserved_quantity:
                raise serializers.ValidationError({"stock_quantity": "Stock cannot be below reserved quantity."})
            inventory.quantity = quantity
            inventory.save()
            product.refresh_from_db()
        return product


class InventorySerializer(serializers.ModelSerializer):
    sku = serializers.CharField(source="product.sku", read_only=True)
    name = serializers.CharField(source="product.name", read_only=True)
    available_quantity = serializers.IntegerField(read_only=True)

    class Meta:
        model = Inventory
        fields = (
            "id",
            "product",
            "sku",
            "name",
            "quantity",
            "reserved_quantity",
            "available_quantity",
            "low_stock_threshold",
            "warehouse_code",
            "updated_at",
        )
        read_only_fields = ("reserved_quantity", "updated_at")

    def validate_quantity(self, value):
        if value < 0:
            raise serializers.ValidationError("Stock cannot be negative.")
        return value

    def validate(self, attrs):
        quantity = attrs.get("quantity", getattr(self.instance, "quantity", 0))
        reserved = getattr(self.instance, "reserved_quantity", 0)
        if quantity < reserved:
            raise serializers.ValidationError(
                {"quantity": "On-hand quantity cannot be below reserved stock."}
            )
        return attrs


def with_review_stats(queryset):
    return queryset.annotate(
        average_rating=Avg("reviews__rating", filter=Q(reviews__is_approved=True)),
        review_count=Count("reviews", filter=Q(reviews__is_approved=True), distinct=True),
    )
