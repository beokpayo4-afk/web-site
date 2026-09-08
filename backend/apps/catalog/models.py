from django.core.validators import MinValueValidator
from django.db import models
from django.utils.text import slugify


def normalize_tags(value):
    if not value:
        return []
    if isinstance(value, str):
        raw = [part.strip() for part in value.split(",")]
    elif isinstance(value, (list, tuple)):
        raw = value
    else:
        raw = [value]
    tags = []
    for item in raw:
        tag = str(item).strip().lower()[:40]
        if tag and tag not in tags:
            tags.append(tag)
        if len(tags) >= 16:
            break
    return tags


def compose_search_document(*, name, sku, brand_name, category_name, short_description, description, tags):
    parts = [
        name or "",
        sku or "",
        brand_name or "",
        category_name or "",
        short_description or "",
        description or "",
        *normalize_tags(tags),
    ]
    return " ".join(part for part in parts if part).lower()


class TaxClass(models.Model):
    """Flexible GST configuration. Products never assume a single tax rate."""

    name = models.CharField(max_length=80, unique=True)
    hsn_sac_code = models.CharField(max_length=16, blank=True)
    cgst_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0, validators=[MinValueValidator(0)])
    sgst_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0, validators=[MinValueValidator(0)])
    igst_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0, validators=[MinValueValidator(0)])
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "Tax classes"

    def __str__(self):
        return self.name


class Category(models.Model):
    name = models.CharField(max_length=80)
    slug = models.SlugField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    parent = models.ForeignKey("self", null=True, blank=True, on_delete=models.SET_NULL, related_name="children")
    image = models.ImageField(upload_to="categories/", blank=True)
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "Categories"
        ordering = ["sort_order", "name"]
        indexes = [
            models.Index(fields=["slug"]),
            models.Index(fields=["is_active", "sort_order"]),
        ]

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class Brand(models.Model):
    name = models.CharField(max_length=80, unique=True)
    slug = models.SlugField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        indexes = [models.Index(fields=["slug"])]

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class Product(models.Model):
    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        PUBLISHED = "PUBLISHED", "Published"
        UNPUBLISHED = "UNPUBLISHED", "Unpublished"

    name = models.CharField(max_length=180)
    sku = models.CharField(max_length=40, unique=True)
    slug = models.SlugField(max_length=200, unique=True)
    description = models.TextField(blank=True, default="")
    short_description = models.CharField(max_length=280, blank=True, default="")
    mrp = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(0)])
    selling_price = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(0)])
    tax_class = models.ForeignKey(TaxClass, on_delete=models.PROTECT, related_name="products")
    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name="products")
    brand = models.ForeignKey(Brand, null=True, blank=True, on_delete=models.PROTECT, related_name="products")
    specifications = models.JSONField(default=dict, blank=True)
    tags = models.JSONField(default=list, blank=True)
    search_document = models.TextField(blank=True, default="")
    stock_quantity = models.PositiveIntegerField(default=0)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PUBLISHED, db_index=True)
    is_active = models.BooleanField(default=True)
    is_featured = models.BooleanField(default=False)
    is_bestseller = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["slug"]),
            models.Index(fields=["sku"]),
            models.Index(fields=["is_active", "is_featured"]),
            models.Index(fields=["is_active", "is_bestseller"]),
            models.Index(fields=["status", "is_active"]),
            models.Index(fields=["category", "is_active"]),
            models.Index(fields=["brand", "is_active"]),
            models.Index(fields=["name"]),
            models.Index(fields=["selling_price"]),
            models.Index(fields=["is_active", "selling_price"], name="catalog_prod_active_price"),
            models.Index(fields=["is_active", "stock_quantity"], name="catalog_prod_active_stock"),
            models.Index(fields=["is_active", "created_at"], name="catalog_prod_active_created"),
        ]
        constraints = [
            models.CheckConstraint(check=models.Q(mrp__gte=models.F("selling_price")), name="mrp_gte_selling_price"),
            models.CheckConstraint(check=models.Q(selling_price__gte=0), name="selling_price_non_negative"),
        ]

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        self.tags = normalize_tags(self.tags)
        # Storefront visibility stays tied to is_active; status is the admin workflow.
        self.is_active = self.status == self.Status.PUBLISHED
        update_fields = kwargs.get("update_fields")
        if update_fields is not None and "status" in update_fields and "is_active" not in update_fields:
            kwargs["update_fields"] = [*update_fields, "is_active"]
        search_fields = {"name", "sku", "description", "short_description", "tags", "brand", "category", "search_document"}
        if update_fields is None or search_fields.intersection(update_fields):
            self.search_document = self.build_search_document()
            if update_fields is not None and "search_document" not in update_fields:
                kwargs["update_fields"] = [*kwargs.get("update_fields", update_fields), "search_document"]
        super().save(*args, **kwargs)

    def build_search_document(self):
        brand_name = ""
        category_name = ""
        if self.brand_id:
            brand_name = getattr(getattr(self, "brand", None), "name", "") or ""
        if self.category_id:
            category_name = getattr(getattr(self, "category", None), "name", "") or ""
        return compose_search_document(
            name=self.name,
            sku=self.sku,
            brand_name=brand_name,
            category_name=category_name,
            short_description=self.short_description,
            description=self.description,
            tags=self.tags,
        )

    @property
    def discount_amount(self):
        return self.mrp - self.selling_price

    @property
    def discount_percent(self):
        if self.mrp <= 0:
            return 0
        return round((self.discount_amount / self.mrp) * 100)

    def __str__(self):
        return self.name


class ProductImage(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="images")
    image = models.ImageField(upload_to="products/", blank=True)
    image_url = models.URLField(max_length=1000, blank=True)
    alt_text = models.CharField(max_length=160, blank=True)
    is_primary = models.BooleanField(default=False)
    sort_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["sort_order", "id"]
        indexes = [models.Index(fields=["product", "is_primary"])]

    def display_url(self):
        if self.image_url:
            return self.image_url
        if self.image:
            try:
                return self.image.url
            except ValueError:
                return ""
        return ""


class Inventory(models.Model):
    product = models.OneToOneField(Product, on_delete=models.CASCADE, related_name="inventory")
    quantity = models.PositiveIntegerField(default=0)
    reserved_quantity = models.PositiveIntegerField(default=0)
    low_stock_threshold = models.PositiveIntegerField(default=5)
    warehouse_code = models.CharField(max_length=32, default="MAIN")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "Inventory"
        indexes = [
            models.Index(fields=["warehouse_code"]),
            models.Index(fields=["quantity"]),
        ]
        constraints = [
            models.CheckConstraint(
                check=models.Q(quantity__gte=models.F("reserved_quantity")),
                name="quantity_gte_reserved",
            )
        ]

    @property
    def available_quantity(self):
        return self.quantity - self.reserved_quantity

    def sync_product_stock(self):
        Product.objects.filter(pk=self.product_id).update(stock_quantity=self.available_quantity)

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        self.sync_product_stock()

    def __str__(self):
        return f"{self.product.sku} ({self.available_quantity} available)"
