from apps.catalog.models import Product


def deactivate_product(product: Product) -> Product:
    """Soft-delete a product so order history and SKUs stay intact."""
    product.status = Product.Status.UNPUBLISHED
    product.is_active = False
    product.save(update_fields=["status", "is_active", "updated_at"])
    return product


def publish_product(product: Product) -> Product:
    product.status = Product.Status.PUBLISHED
    product.is_active = True
    product.save(update_fields=["status", "is_active", "updated_at"])
    return product


def unpublish_product(product: Product) -> Product:
    product.status = Product.Status.UNPUBLISHED
    product.is_active = False
    product.save(update_fields=["status", "is_active", "updated_at"])
    return product
