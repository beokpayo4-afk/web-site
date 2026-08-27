from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.catalog.models import Brand, Category, Inventory, Product


@receiver(post_save, sender=Product)
def ensure_inventory(sender, instance, created, **kwargs):
    if not created:
        return
    Inventory.objects.get_or_create(
        product=instance,
        defaults={"quantity": instance.stock_quantity, "reserved_quantity": 0},
    )


def _refresh_related_search_documents(queryset):
    products = list(queryset.select_related("brand", "category"))
    for product in products:
        document = product.build_search_document()
        if product.search_document != document:
            Product.objects.filter(pk=product.pk).update(search_document=document)


@receiver(post_save, sender=Brand)
def refresh_brand_search_documents(sender, instance, **kwargs):
    _refresh_related_search_documents(Product.objects.filter(brand=instance))


@receiver(post_save, sender=Category)
def refresh_category_search_documents(sender, instance, **kwargs):
    _refresh_related_search_documents(Product.objects.filter(category=instance))
