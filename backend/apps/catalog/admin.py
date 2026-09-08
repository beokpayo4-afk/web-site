from django.contrib import admin

from apps.catalog.models import Brand, Category, Inventory, Product, ProductImage, TaxClass


class ProductImageInline(admin.TabularInline):
    model = ProductImage
    extra = 0
    fields = ("image_url", "image", "alt_text", "is_primary", "sort_order")


class InventoryInline(admin.StackedInline):
    model = Inventory
    extra = 0
    max_num = 1


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ("name", "sku", "selling_price", "stock_quantity", "category", "is_active")
    list_filter = ("is_active", "is_featured", "is_bestseller", "category", "brand")
    search_fields = ("name", "sku", "slug", "brand__name", "category__name", "search_document")
    prepopulated_fields = {"slug": ("name",)}
    inlines = [ProductImageInline, InventoryInline]
    readonly_fields = ("stock_quantity",)


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "parent", "is_active", "sort_order")
    search_fields = ("name", "slug")
    list_filter = ("is_active",)
    prepopulated_fields = {"slug": ("name",)}


@admin.register(Brand)
class BrandAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "is_active")
    search_fields = ("name", "slug")
    prepopulated_fields = {"slug": ("name",)}


@admin.register(TaxClass)
class TaxClassAdmin(admin.ModelAdmin):
    list_display = ("name", "hsn_sac_code", "cgst_rate", "sgst_rate", "igst_rate", "is_active")


@admin.register(Inventory)
class InventoryAdmin(admin.ModelAdmin):
    list_display = ("product", "quantity", "reserved_quantity", "warehouse_code", "updated_at")
    search_fields = ("product__sku", "product__name")
    list_filter = ("warehouse_code",)
    readonly_fields = ("reserved_quantity",)
