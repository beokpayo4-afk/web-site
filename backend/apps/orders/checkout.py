import re
from decimal import Decimal

from rest_framework.exceptions import ValidationError

from apps.catalog.models import Inventory, Product
from apps.commerce.models import Cart
from apps.orders.models import Coupon
from apps.orders.pricing import InventoryService, PricingService, money

CLIENT_PRICE_FIELDS = frozenset(
    {
        "subtotal",
        "grand_total",
        "unit_price",
        "tax_amount",
        "shipping_amount",
        "discount_amount",
        "line_total",
        "selling_price",
        "mrp",
        "items",
        "price",
        "total",
    }
)

PIN_RE = re.compile(r"^\d{6}$")
PHONE_RE = re.compile(r"^[6-9]\d{9}$")


def reject_client_totals(payload: dict):
    """Refuse any client-submitted money or line payload. Totals come from PricingService only."""
    extra = sorted(CLIENT_PRICE_FIELDS.intersection(payload.keys()))
    if extra:
        raise ValidationError({field: "Prices and totals are calculated on the server." for field in extra})


def validate_shippable_address(address):
    if not address:
        raise ValidationError({"shipping": "A delivery address is required."})
    country = (address.country or "").strip().lower()
    if country not in {"india", "in"}:
        raise ValidationError({"shipping": "Nexora currently ships within India only."})
    state = (address.state or "").strip()
    if len(state) < 2:
        raise ValidationError({"shipping": "State is required to calculate GST and shipping."})
    pin = (address.postal_code or "").strip()
    if not PIN_RE.match(pin):
        raise ValidationError({"shipping": "Enter a valid 6-digit PIN code."})
    phone = re.sub(r"\D", "", address.phone or "")
    if not PHONE_RE.match(phone[-10:] if len(phone) >= 10 else phone):
        raise ValidationError({"shipping": "Enter a valid 10-digit Indian mobile number."})
    if not (address.line1 or "").strip() or not (address.city or "").strip():
        raise ValidationError({"shipping": "City and address line are required."})


def resolve_coupon(code, user):
    if code is None:
        return None
    cleaned = str(code).strip()
    if not cleaned:
        return None
    coupon = Coupon.objects.filter(code__iexact=cleaned).first()
    if coupon is None:
        raise ValidationError({"coupon": "Invalid coupon code."})
    return coupon


def serialize_quote(quote: dict) -> dict:
    lines = []
    for line in quote.get("lines", []):
        product = line["product"]
        lines.append(
            {
                "product_id": product.id,
                "name": product.name,
                "sku": product.sku,
                "quantity": line["quantity"],
                "unit_price": str(line["unit_price"]),
                "mrp": str(line["mrp"]),
                "tax_rate": str(line["tax_rate"]),
                "tax_amount": str(line["tax_amount"]),
                "discount_share": str(line["discount_share"]),
                "line_total": str(line["line_total"]),
            }
        )
    return {
        "lines": lines,
        "subtotal": str(quote["subtotal"]),
        "discount_amount": str(quote["discount_amount"]),
        "tax_amount": str(quote["tax_amount"]),
        "shipping_amount": str(quote["shipping_amount"]),
        "grand_total": str(quote["grand_total"]),
    }


def hydrate_cart(*, user, lock=False):
    cart, _ = Cart.objects.get_or_create(user=user)
    product_ids = list(cart.items.values_list("product_id", flat=True))
    if lock and product_ids:
        list(Inventory.objects.select_for_update().filter(product_id__in=product_ids))
    items = list(cart.items.select_related("product__tax_class", "product__inventory"))
    if not items:
        raise ValidationError({"cart": "Your cart is empty."})

    hydrated = []
    for item in items:
        product = item.product
        if not product.is_active:
            raise ValidationError({"items": f"{product.name} is no longer available."})
        if money(product.selling_price) <= Decimal("0.00"):
            raise ValidationError({"prices": f"{product.name} cannot be purchased at the listed price."})
        InventoryService.assert_available(product, item.quantity)
        hydrated.append({"product": product, "quantity": item.quantity, "product_id": product.id})
    return cart, hydrated


def prepare_checkout(*, user, shipping_address, billing_address, coupon_code=None, lock=False):
    validate_shippable_address(shipping_address)
    validate_shippable_address(billing_address)
    cart, hydrated = hydrate_cart(user=user, lock=lock)
    coupon = resolve_coupon(coupon_code, user)
    quote = PricingService().quote(
        hydrated,
        destination_state=shipping_address.state,
        coupon=coupon,
        user=user,
    )
    return {
        "cart": cart,
        "hydrated": hydrated,
        "coupon": coupon,
        "quote": quote,
        "shipping_address": shipping_address,
        "billing_address": billing_address,
    }


def hydrate_explicit_items(payload_items: list[dict]):
    """Quote helper: product_id + quantity only. Any client prices on the row are ignored."""
    if not payload_items:
        raise ValidationError({"items": "No items to price."})
    product_ids = [int(row["product_id"]) for row in payload_items]
    products = {
        p.id: p
        for p in Product.objects.select_related("tax_class", "inventory").filter(id__in=product_ids, is_active=True)
    }
    hydrated = []
    for row in payload_items:
        product = products.get(int(row["product_id"]))
        if not product:
            raise ValidationError({"items": "One or more products are unavailable."})
        quantity = int(row["quantity"])
        InventoryService.assert_available(product, quantity)
        hydrated.append({"product": product, "quantity": quantity, "product_id": product.id})
    return hydrated
