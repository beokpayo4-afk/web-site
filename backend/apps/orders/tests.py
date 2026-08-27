from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.catalog.models import Brand, Category, Inventory, Product, TaxClass
from apps.orders.models import Coupon, Order, StoreSetting
from apps.orders.payments import PaymentGateway, get_payment_gateway

User = get_user_model()


class CheckoutAPITestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.tax = TaxClass.objects.create(
            name="GST 18",
            cgst_rate=Decimal("9.00"),
            sgst_rate=Decimal("9.00"),
            igst_rate=Decimal("18.00"),
        )
        self.category = Category.objects.create(name="Audio", slug="audio")
        self.brand = Brand.objects.create(name="Harbor", slug="harbor")
        self.product = Product.objects.create(
            name="Harbor Pulse Earbuds",
            sku="HB-PLSE-01",
            slug="harbor-pulse-earbuds",
            description="Original test product.",
            short_description="Wireless earbuds.",
            mrp=Decimal("3499.00"),
            selling_price=Decimal("2499.00"),
            tax_class=self.tax,
            category=self.category,
            brand=self.brand,
            stock_quantity=10,
        )
        Inventory.objects.update_or_create(product=self.product, defaults={"quantity": 10, "reserved_quantity": 0})
        self.cheap = Product.objects.create(
            name="Cable Clip",
            sku="NX-CLIP-01",
            slug="cable-clip",
            description="A small clip.",
            short_description="Desk clip.",
            mrp=Decimal("199.00"),
            selling_price=Decimal("99.00"),
            tax_class=self.tax,
            category=self.category,
            brand=self.brand,
            stock_quantity=20,
        )
        Inventory.objects.update_or_create(product=self.cheap, defaults={"quantity": 20, "reserved_quantity": 0})
        StoreSetting.objects.update_or_create(key="origin_state", defaults={"value": "Chhattisgarh"})
        StoreSetting.objects.update_or_create(key="shipping_flat_rate", defaults={"value": "0.00"})
        StoreSetting.objects.update_or_create(key="free_shipping_threshold", defaults={"value": "0.00"})
        now = timezone.now()
        self.coupon = Coupon.objects.create(
            code="NEXORA10",
            discount_type=Coupon.DiscountType.PERCENT,
            value=Decimal("10.00"),
            min_order_amount=Decimal("0"),
            max_discount_amount=Decimal("500"),
            starts_at=now,
            ends_at=now + timedelta(days=10),
            is_active=True,
        )
        self.high_min_coupon = Coupon.objects.create(
            code="BIGMIN",
            discount_type=Coupon.DiscountType.FLAT,
            value=Decimal("50.00"),
            min_order_amount=Decimal("50000"),
            starts_at=now,
            ends_at=now + timedelta(days=10),
            is_active=True,
        )

    def auth(self, email="buyer@nexora.local", password="StrongPass123"):
        register = self.client.post(
            "/api/v1/auth/register/",
            {"email": email, "password": password, "full_name": "Asha Rao", "phone": "9876543210"},
            format="json",
        )
        self.assertEqual(register.status_code, 201)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {register.data['access']}")
        return register.data["user"]

    def add_address(self, **overrides):
        payload = {
            "full_name": "Asha Rao",
            "phone": "9876543210",
            "line1": "12 Lake View",
            "city": "Raipur",
            "state": "Chhattisgarh",
            "postal_code": "492001",
            "country": "India",
        }
        payload.update(overrides)
        response = self.client.post("/api/v1/auth/addresses/", payload, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        return response.data

    def add_to_cart(self, product_id=None, quantity=1):
        response = self.client.post(
            "/api/v1/cart/items/",
            {"product_id": product_id or self.product.id, "quantity": quantity},
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        return response.data


class AddressManagementTests(CheckoutAPITestCase):
    def test_create_edit_delete_address(self):
        self.auth()
        created = self.add_address(label="Home")
        listing = self.client.get("/api/v1/auth/addresses/")
        self.assertEqual(listing.status_code, 200)
        self.assertEqual(len(listing.data), 1)

        patched = self.client.patch(
            f"/api/v1/auth/addresses/{created['id']}/",
            {"line1": "14 Lake View", "label": "Studio"},
            format="json",
        )
        self.assertEqual(patched.status_code, 200)
        self.assertEqual(patched.data["line1"], "14 Lake View")
        self.assertEqual(patched.data["label"], "Studio")

        deleted = self.client.delete(f"/api/v1/auth/addresses/{created['id']}/")
        self.assertEqual(deleted.status_code, 204)
        self.assertEqual(self.client.get("/api/v1/auth/addresses/").data, [])

    def test_cannot_use_another_users_address(self):
        self.auth("owner@nexora.local")
        address = self.add_address()
        self.client.credentials()
        self.auth("other@nexora.local")
        self.add_to_cart()
        preview = self.client.post(
            "/api/v1/checkout/preview/",
            {"shipping_address_id": address["id"]},
            format="json",
        )
        self.assertEqual(preview.status_code, 400)
        order = self.client.post("/api/v1/orders/", {"shipping_address_id": address["id"]}, format="json")
        self.assertEqual(order.status_code, 400)


class CheckoutPreviewAndOrderTests(CheckoutAPITestCase):
    def test_preview_and_order_use_server_totals(self):
        self.auth()
        address = self.add_address()
        self.add_to_cart(quantity=2)

        preview = self.client.post(
            "/api/v1/checkout/preview/",
            {"shipping_address_id": address["id"], "coupon_code": "NEXORA10"},
            format="json",
        )
        self.assertEqual(preview.status_code, 200, preview.data)
        self.assertEqual(preview.data["subtotal"], "4998.00")
        self.assertEqual(preview.data["discount_amount"], "499.80")
        self.assertEqual(preview.data["shipping_amount"], "0.00")
        self.assertIn("tax_amount", preview.data)
        self.assertIn("grand_total", preview.data)
        self.assertEqual(len(preview.data["lines"]), 1)
        self.assertEqual(preview.data["lines"][0]["unit_price"], "2499.00")

        order = self.client.post(
            "/api/v1/orders/",
            {"shipping_address_id": address["id"], "coupon_code": "NEXORA10"},
            format="json",
        )
        self.assertEqual(order.status_code, 201, order.data)
        self.assertEqual(order.data["grand_total"], preview.data["grand_total"])
        self.assertEqual(order.data["subtotal"], preview.data["subtotal"])
        self.assertEqual(order.data["status"], "PENDING")
        self.assertEqual(order.data["payment"]["provider"], "mock")
        self.assertNotIn("confirm_token", order.data["payment"])

    def test_rejects_client_price_manipulation_on_preview_and_order(self):
        self.auth()
        address = self.add_address()
        self.add_to_cart(quantity=1)

        preview = self.client.post(
            "/api/v1/checkout/preview/",
            {
                "shipping_address_id": address["id"],
                "grand_total": "1.00",
                "unit_price": "1.00",
                "items": [{"product_id": self.product.id, "quantity": 1, "unit_price": "1.00"}],
            },
            format="json",
        )
        self.assertEqual(preview.status_code, 400)

        order = self.client.post(
            "/api/v1/orders/",
            {
                "shipping_address_id": address["id"],
                "grand_total": "1.00",
                "subtotal": "1.00",
                "tax_amount": "0.00",
            },
            format="json",
        )
        self.assertEqual(order.status_code, 400)
        self.assertFalse(Order.objects.exists())

    def test_order_total_ignores_cart_display_and_matches_live_selling_price(self):
        self.auth()
        address = self.add_address()
        self.add_to_cart(quantity=1)
        self.product.selling_price = Decimal("1999.00")
        self.product.save()

        preview = self.client.post(
            "/api/v1/checkout/preview/",
            {"shipping_address_id": address["id"]},
            format="json",
        )
        self.assertEqual(preview.status_code, 200)
        self.assertEqual(preview.data["lines"][0]["unit_price"], "1999.00")
        self.assertEqual(preview.data["subtotal"], "1999.00")

    def test_cannot_order_more_than_available_stock(self):
        self.auth()
        address = self.add_address(state="Maharashtra", postal_code="400001")
        too_many = self.client.post(
            "/api/v1/cart/items/",
            {"product_id": self.product.id, "quantity": 99},
            format="json",
        )
        self.assertIn(too_many.status_code, (400, 409))

        self.add_to_cart(quantity=10)
        inventory = self.product.inventory
        inventory.reserved_quantity = 6
        inventory.save()
        preview = self.client.post(
            "/api/v1/checkout/preview/",
            {"shipping_address_id": address["id"]},
            format="json",
        )
        self.assertEqual(preview.status_code, 400)
        order = self.client.post("/api/v1/orders/", {"shipping_address_id": address["id"]}, format="json")
        self.assertEqual(order.status_code, 400)

    def test_inactive_product_cannot_be_checked_out(self):
        self.auth()
        address = self.add_address()
        self.add_to_cart(quantity=1)
        self.product.is_active = False
        self.product.save()
        preview = self.client.post(
            "/api/v1/checkout/preview/",
            {"shipping_address_id": address["id"]},
            format="json",
        )
        self.assertEqual(preview.status_code, 400)
        order = self.client.post("/api/v1/orders/", {"shipping_address_id": address["id"]}, format="json")
        self.assertEqual(order.status_code, 400)

    def test_invalid_and_ineligible_coupons(self):
        self.auth()
        address = self.add_address()
        self.add_to_cart(quantity=1)
        missing = self.client.post(
            "/api/v1/checkout/preview/",
            {"shipping_address_id": address["id"], "coupon_code": "FAKECODE"},
            format="json",
        )
        self.assertEqual(missing.status_code, 400)
        too_small = self.client.post(
            "/api/v1/checkout/preview/",
            {"shipping_address_id": address["id"], "coupon_code": "BIGMIN"},
            format="json",
        )
        self.assertEqual(too_small.status_code, 400)

    def test_shipping_is_free_by_default(self):
        self.auth()
        address = self.add_address()
        self.add_to_cart(product_id=self.cheap.id, quantity=1)
        preview = self.client.post(
            "/api/v1/checkout/preview/",
            {"shipping_address_id": address["id"]},
            format="json",
        )
        self.assertEqual(preview.status_code, 200)
        self.assertEqual(preview.data["subtotal"], "99.00")
        self.assertEqual(preview.data["shipping_amount"], "0.00")

    def test_shipping_applies_when_a_flat_rate_is_configured(self):
        StoreSetting.objects.update_or_create(key="shipping_flat_rate", defaults={"value": "49.00"})
        StoreSetting.objects.update_or_create(key="free_shipping_threshold", defaults={"value": "999.00"})
        self.auth()
        address = self.add_address()
        self.add_to_cart(product_id=self.cheap.id, quantity=1)
        preview = self.client.post(
            "/api/v1/checkout/preview/",
            {"shipping_address_id": address["id"]},
            format="json",
        )
        self.assertEqual(preview.status_code, 200)
        self.assertEqual(preview.data["shipping_amount"], "49.00")

    def test_empty_cart_cannot_preview_or_order(self):
        self.auth()
        address = self.add_address()
        preview = self.client.post(
            "/api/v1/checkout/preview/",
            {"shipping_address_id": address["id"]},
            format="json",
        )
        self.assertEqual(preview.status_code, 400)
        order = self.client.post("/api/v1/orders/", {"shipping_address_id": address["id"]}, format="json")
        self.assertEqual(order.status_code, 400)

    def test_payment_gateway_is_an_interface_and_amount_must_match(self):
        gateway = get_payment_gateway()
        self.assertIsInstance(gateway, PaymentGateway)
        self.auth()
        address = self.add_address()
        self.add_to_cart(quantity=1)
        order = self.client.post("/api/v1/orders/", {"shipping_address_id": address["id"]}, format="json")
        self.assertEqual(order.status_code, 201)
        paid = self.client.post(
            "/api/v1/payments/mock/complete/",
            {
                "provider_payment_id": order.data["payment"]["provider_payment_id"],
                "outcome": "success",
            },
            format="json",
        )
        self.assertEqual(paid.status_code, 200)
        self.assertEqual(paid.data["payment_status"], "PAID")
        self.product.inventory.refresh_from_db()
        self.assertEqual(self.product.inventory.quantity, 9)
        self.assertEqual(self.product.inventory.reserved_quantity, 0)


SNAPSHOT = {
    "full_name": "Asha Rao",
    "phone": "9876543210",
    "line1": "12 Lake View",
    "line2": "",
    "city": "Raipur",
    "state": "Chhattisgarh",
    "postal_code": "492001",
    "country": "India",
}


class OrderManagementTests(CheckoutAPITestCase):
    def make_order(self, user, status=Order.Status.PENDING, payment_status=Order.PaymentStatus.PENDING):
        return Order.objects.create(
            order_number=f"NXTEST{user.id}{Order.objects.count():04d}",
            user=user,
            status=status,
            payment_status=payment_status,
            shipping_address=SNAPSHOT,
            billing_address=SNAPSHOT,
            grand_total=Decimal("100.00"),
        )

    def test_invalid_state_transitions_are_rejected(self):
        from rest_framework.exceptions import ValidationError

        from apps.orders.services import transition_order

        user = User.objects.create_user(
            username="buyer@nexora.local",
            email="buyer@nexora.local",
            password="StrongPass123",
        )
        pending = self.make_order(user, status=Order.Status.PENDING)
        with self.assertRaises(ValidationError):
            transition_order(pending, Order.Status.SHIPPED)
        delivered = self.make_order(user, status=Order.Status.DELIVERED, payment_status=Order.PaymentStatus.PAID)
        with self.assertRaises(ValidationError):
            transition_order(delivered, Order.Status.CANCELLED)
        refunded = self.make_order(user, status=Order.Status.REFUNDED, payment_status=Order.PaymentStatus.REFUNDED)
        with self.assertRaises(ValidationError):
            transition_order(refunded, Order.Status.CONFIRMED)
        packed = self.make_order(user, status=Order.Status.PACKED, payment_status=Order.PaymentStatus.PAID)
        moved = transition_order(packed, Order.Status.SHIPPED)
        self.assertEqual(moved.status, Order.Status.SHIPPED)
        self.assertEqual(moved.payment_status, Order.PaymentStatus.PAID)

    def test_customer_sees_only_own_orders(self):
        register = self.client.post(
            "/api/v1/auth/register/",
            {"email": "owner@nexora.local", "password": "StrongPass123", "full_name": "Asha Rao", "phone": "9876543210"},
            format="json",
        )
        self.assertEqual(register.status_code, 201)
        owner_token = register.data["access"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {owner_token}")
        address = self.add_address()
        self.add_to_cart(quantity=1)
        created = self.client.post("/api/v1/orders/", {"shipping_address_id": address["id"]}, format="json")
        self.assertEqual(created.status_code, 201)
        order_id = created.data["id"]

        self.client.credentials()
        self.auth("other@nexora.local")
        listing = self.client.get("/api/v1/orders/")
        self.assertEqual(listing.status_code, 200)
        self.assertEqual(listing.data["count"], 0)
        hidden = self.client.get(f"/api/v1/orders/{order_id}/")
        self.assertEqual(hidden.status_code, 404)
        cancel = self.client.post(f"/api/v1/orders/{order_id}/cancel/", format="json")
        self.assertEqual(cancel.status_code, 404)

        anonymous = APIClient()
        self.assertEqual(anonymous.get("/api/v1/orders/").status_code, 401)
        self.assertEqual(anonymous.get(f"/api/v1/orders/{order_id}/").status_code, 401)

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {owner_token}")
        mine = self.client.get(f"/api/v1/orders/{order_id}/")
        self.assertEqual(mine.status_code, 200)
        self.assertEqual(mine.data["id"], order_id)
        self.assertTrue(mine.data["cancellable"])
        self.assertEqual(mine.data["status"], "PENDING")
        self.assertEqual(mine.data["payment_status"], "PENDING")
        forbidden_write = self.client.patch(f"/api/v1/orders/{order_id}/", {"status": "DELIVERED"}, format="json")
        self.assertEqual(forbidden_write.status_code, 405)

    def test_cancel_unpaid_fails_payment_but_paid_cancel_keeps_payment_paid(self):
        self.auth()
        address = self.add_address()
        self.add_to_cart(quantity=1)
        pending = self.client.post("/api/v1/orders/", {"shipping_address_id": address["id"]}, format="json")
        self.assertEqual(pending.status_code, 201)
        cancelled = self.client.post(f"/api/v1/orders/{pending.data['id']}/cancel/", format="json")
        self.assertEqual(cancelled.status_code, 200)
        self.assertEqual(cancelled.data["status"], "CANCELLED")
        self.assertEqual(cancelled.data["payment_status"], "FAILED")
        again = self.client.post(f"/api/v1/orders/{pending.data['id']}/cancel/", format="json")
        self.assertEqual(again.status_code, 400)

        self.add_to_cart(quantity=1)
        paid_order = self.client.post("/api/v1/orders/", {"shipping_address_id": address["id"]}, format="json")
        self.client.post(
            "/api/v1/payments/mock/complete/",
            {
                "provider_payment_id": paid_order.data["payment"]["provider_payment_id"],
                "outcome": "success",
            },
            format="json",
        )
        paid_cancel = self.client.post(f"/api/v1/orders/{paid_order.data['id']}/cancel/", format="json")
        self.assertEqual(paid_cancel.status_code, 200)
        self.assertEqual(paid_cancel.data["status"], "CANCELLED")
        self.assertEqual(paid_cancel.data["payment_status"], "PAID")

    def test_cannot_cancel_after_shipped(self):
        from rest_framework.exceptions import ValidationError

        from apps.orders.services import cancel_order

        self.auth()
        user = User.objects.get(email="buyer@nexora.local")
        order = self.make_order(user, status=Order.Status.SHIPPED, payment_status=Order.PaymentStatus.PAID)
        blocked = self.client.post(f"/api/v1/orders/{order.id}/cancel/", format="json")
        self.assertEqual(blocked.status_code, 400)
        with self.assertRaises(ValidationError):
            cancel_order(order)

