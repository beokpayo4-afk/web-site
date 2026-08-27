from decimal import Decimal

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.catalog.models import Inventory
from apps.orders.models import Coupon, CouponUsage, StoreSetting


def money(value) -> Decimal:
    return Decimal(value).quantize(Decimal("0.01"))


def get_setting(key: str, default):
    row = StoreSetting.objects.filter(key=key).first()
    return row.value if row else default


class PricingService:
    """Server-side pricing. Never trust client-submitted price, tax, discount, or totals."""

    def __init__(self, origin_state: str | None = None):
        self.origin_state = origin_state or get_setting("origin_state", "Chhattisgarh")

    def line_tax_rate(self, product, destination_state: str) -> Decimal:
        tax = product.tax_class
        if destination_state.strip().lower() == self.origin_state.strip().lower():
            return money(tax.cgst_rate + tax.sgst_rate)
        return money(tax.igst_rate)

    def apply_coupon(self, coupon: Coupon | None, user, subtotal: Decimal) -> Decimal:
        if coupon is None:
            return Decimal("0.00")
        now = timezone.now()
        if not coupon.is_active or coupon.starts_at > now or coupon.ends_at < now:
            raise ValidationError({"coupon": "This coupon is not active."})
        if subtotal < coupon.min_order_amount:
            raise ValidationError({"coupon": f"Minimum order amount is ₹{coupon.min_order_amount}."})
        if coupon.usage_limit is not None and coupon.usages.count() >= coupon.usage_limit:
            raise ValidationError({"coupon": "This coupon has reached its usage limit."})
        if user and CouponUsage.objects.filter(coupon=coupon, user=user).count() >= coupon.usage_limit_per_user:
            raise ValidationError({"coupon": "You have already used this coupon."})

        if coupon.discount_type == Coupon.DiscountType.PERCENT:
            discount = subtotal * (coupon.value / Decimal("100"))
            if coupon.max_discount_amount is not None:
                discount = min(discount, coupon.max_discount_amount)
        else:
            discount = coupon.value
        return money(min(discount, subtotal))

    def shipping_amount(self, taxable_subtotal: Decimal) -> Decimal:
        flat = money(get_setting("shipping_flat_rate", "0.00"))
        threshold = money(get_setting("free_shipping_threshold", "0.00"))
        if taxable_subtotal >= threshold:
            return Decimal("0.00")
        return flat

    def quote(self, items: list[dict], destination_state: str, coupon=None, user=None) -> dict:
        """
        items: [{product, quantity}]
        """
        lines = []
        subtotal = Decimal("0.00")
        for item in items:
            product = item["product"]
            quantity = int(item["quantity"])
            if quantity < 1:
                raise ValidationError({"quantity": "Quantity must be at least 1."})
            unit_price = money(product.selling_price)
            line_subtotal = money(unit_price * quantity)
            tax_rate = self.line_tax_rate(product, destination_state)
            lines.append(
                {
                    "product": product,
                    "quantity": quantity,
                    "unit_price": unit_price,
                    "mrp": money(product.mrp),
                    "line_subtotal": line_subtotal,
                    "tax_rate": tax_rate,
                }
            )
            subtotal += line_subtotal

        discount = self.apply_coupon(coupon, user, subtotal)
        taxable = money(subtotal - discount)
        tax_amount = Decimal("0.00")
        discount_remaining = discount
        priced_lines = []
        for line in lines:
            share = Decimal("0.00") if subtotal == 0 else money(line["line_subtotal"] / subtotal * discount)
            if share > discount_remaining:
                share = discount_remaining
            discount_remaining -= share
            taxable_line = money(line["line_subtotal"] - share)
            line_tax = money(taxable_line * line["tax_rate"] / Decimal("100"))
            tax_amount += line_tax
            priced_lines.append(
                {
                    **line,
                    "discount_share": share,
                    "tax_amount": line_tax,
                    "line_total": money(taxable_line + line_tax),
                }
            )

        shipping = self.shipping_amount(taxable)
        grand_total = money(taxable + tax_amount + shipping)
        return {
            "lines": priced_lines,
            "subtotal": money(subtotal),
            "discount_amount": money(discount),
            "tax_amount": money(tax_amount),
            "shipping_amount": shipping,
            "grand_total": grand_total,
        }


class InventoryService:
    @staticmethod
    def assert_available(product, quantity: int):
        inventory = getattr(product, "inventory", None)
        available = inventory.available_quantity if inventory else product.stock_quantity
        if available < quantity:
            raise ValidationError({"inventory": f"{product.name} has only {available} item(s) left."})

    @staticmethod
    @transaction.atomic
    def reserve(product, quantity: int):
        inventory = Inventory.objects.select_for_update().get(product=product)
        if inventory.available_quantity < quantity:
            raise ValidationError({"inventory": f"{product.name} is out of stock."})
        inventory.reserved_quantity += quantity
        inventory.save()

    @staticmethod
    @transaction.atomic
    def release(product, quantity: int):
        inventory = Inventory.objects.select_for_update().get(product=product)
        inventory.reserved_quantity = max(0, inventory.reserved_quantity - quantity)
        inventory.save()

    @staticmethod
    @transaction.atomic
    def commit(product, quantity: int):
        inventory = Inventory.objects.select_for_update().get(product=product)
        inventory.quantity -= quantity
        inventory.reserved_quantity = max(0, inventory.reserved_quantity - quantity)
        inventory.save()

    @staticmethod
    @transaction.atomic
    def restock(product, quantity: int):
        inventory = Inventory.objects.select_for_update().get(product=product)
        inventory.quantity += quantity
        inventory.save()
