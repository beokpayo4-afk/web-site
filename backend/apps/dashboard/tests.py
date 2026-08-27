from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.accounts.models import CustomerProfile
from apps.catalog.models import Brand, Category, Inventory, Product, TaxClass
from apps.orders.models import Coupon, Order, OrderItem, StoreSetting

User = get_user_model()

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


class DashboardAdminTests(APITestCase):
    def setUp(self):
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
            stock_quantity=2,
        )
        Inventory.objects.update_or_create(
            product=self.product,
            defaults={"quantity": 2, "reserved_quantity": 0, "low_stock_threshold": 5},
        )
        StoreSetting.objects.update_or_create(key="origin_state", defaults={"value": "Chhattisgarh"})
        now = timezone.now()
        Coupon.objects.create(
            code="OPS10",
            discount_type=Coupon.DiscountType.PERCENT,
            value=Decimal("10.00"),
            starts_at=now,
            ends_at=now + timedelta(days=10),
            is_active=True,
        )

    def login_role(self, role, email=None):
        email = email or f"{role.lower()}@nexora.local"
        user = User.objects.create_user(
            username=email,
            email=email,
            password="StrongPass123",
            role=role,
        )
        login = self.client.post(
            "/api/v1/auth/login/",
            {"email": email, "password": "StrongPass123"},
            format="json",
        )
        self.assertEqual(login.status_code, 200)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
        return user

    def make_customer(self, email="buyer@nexora.local"):
        user = User.objects.create_user(
            username=email,
            email=email,
            password="StrongPass123",
            role=User.Role.CUSTOMER,
            phone="9876543210",
        )
        CustomerProfile.objects.update_or_create(user=user, defaults={"full_name": "Asha Rao"})
        return user

    def make_order(self, user, status=Order.Status.PENDING, payment_status=Order.PaymentStatus.PAID):
        order = Order.objects.create(
            order_number=f"NXADM{user.id}{Order.objects.count():04d}",
            user=user,
            status=status,
            payment_status=payment_status,
            shipping_address=SNAPSHOT,
            billing_address=SNAPSHOT,
            grand_total=Decimal("2499.00"),
        )
        OrderItem.objects.create(
            order=order,
            product=self.product,
            product_name=self.product.name,
            sku=self.product.sku,
            quantity=1,
            unit_price=self.product.selling_price,
            mrp=self.product.mrp,
            tax_rate=Decimal("18.00"),
            tax_amount=Decimal("0"),
            line_total=self.product.selling_price,
        )
        return order

    def test_customer_cannot_access_admin_apis(self):
        self.make_customer()
        login = self.client.post(
            "/api/v1/auth/login/",
            {"email": "buyer@nexora.local", "password": "StrongPass123"},
            format="json",
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
        for path in ("/api/v1/admin/summary/", "/api/v1/admin/products/", "/api/v1/admin/orders/", "/api/v1/admin/settings/"):
            response = self.client.get(path)
            self.assertEqual(response.status_code, 403, path)

    def test_role_permissions_are_enforced_on_the_backend(self):
        self.login_role(User.Role.PRODUCT_MANAGER)
        self.assertEqual(self.client.get("/api/v1/admin/products/").status_code, 200)
        self.assertEqual(self.client.get("/api/v1/admin/categories/").status_code, 200)
        self.assertEqual(self.client.get("/api/v1/admin/brands/").status_code, 200)
        self.assertEqual(self.client.get("/api/v1/admin/orders/").status_code, 403)
        self.assertEqual(self.client.get("/api/v1/admin/customers/").status_code, 403)
        self.assertEqual(self.client.get("/api/v1/admin/settings/").status_code, 403)
        self.assertEqual(self.client.get("/api/v1/admin/inventory/").status_code, 403)

        self.client.credentials()
        self.login_role(User.Role.ORDER_MANAGER)
        self.assertEqual(self.client.get("/api/v1/admin/orders/").status_code, 200)
        self.assertEqual(self.client.get("/api/v1/admin/customers/").status_code, 200)
        self.assertEqual(self.client.get("/api/v1/admin/shipping/").status_code, 200)
        self.assertEqual(self.client.get("/api/v1/admin/products/").status_code, 403)
        self.assertEqual(self.client.get("/api/v1/admin/reports/").status_code, 403)
        self.assertEqual(self.client.post("/api/v1/admin/products/", {"name": "Nope"}, format="json").status_code, 403)

        self.client.credentials()
        self.login_role(User.Role.INVENTORY_MANAGER)
        self.assertEqual(self.client.get("/api/v1/admin/inventory/").status_code, 200)
        self.assertEqual(self.client.get("/api/v1/admin/products/").status_code, 200)
        self.assertEqual(self.client.get("/api/v1/admin/orders/").status_code, 403)
        self.assertEqual(self.client.get("/api/v1/admin/customers/").status_code, 403)

        self.client.credentials()
        self.login_role(User.Role.CUSTOMER_SUPPORT)
        self.assertEqual(self.client.get("/api/v1/admin/customers/").status_code, 200)
        self.assertEqual(self.client.get("/api/v1/admin/orders/").status_code, 200)
        self.assertEqual(self.client.get("/api/v1/admin/reviews/").status_code, 200)
        self.assertEqual(self.client.get("/api/v1/admin/settings/").status_code, 403)
        self.assertEqual(self.client.get("/api/v1/admin/coupons/").status_code, 403)
        self.assertEqual(self.client.get("/api/v1/admin/products/").status_code, 403)

    def test_dashboard_summary_includes_operations_metrics(self):
        customer = self.make_customer()
        self.make_order(customer, status=Order.Status.PENDING, payment_status=Order.PaymentStatus.PAID)
        self.make_order(customer, status=Order.Status.DELIVERED, payment_status=Order.PaymentStatus.PAID)
        self.login_role(User.Role.SUPER_ADMIN)
        summary = self.client.get("/api/v1/admin/summary/")
        self.assertEqual(summary.status_code, 200)
        for key in (
            "revenue",
            "orders",
            "pending_orders",
            "delivered_orders",
            "customers",
            "products",
            "low_stock",
            "recent_orders",
            "best_selling_products",
            "sales_overview",
            "low_stock_products",
            "recent_customers",
        ):
            self.assertIn(key, summary.data)
        self.assertEqual(summary.data["pending_orders"], 1)
        self.assertEqual(summary.data["delivered_orders"], 1)
        self.assertEqual(len(summary.data["sales_overview"]), 14)
        self.assertGreaterEqual(len(summary.data["recent_orders"]), 2)
        self.assertGreaterEqual(summary.data["low_stock"], 1)

    def test_product_crud_deactivate_and_featured_state(self):
        self.login_role(User.Role.PRODUCT_MANAGER)
        created = self.client.post(
            "/api/v1/admin/products/",
            {
                "name": "Harbor Desk Fan",
                "sku": "HB-FAN-01",
                "slug": "harbor-desk-fan",
                "description": "Compact desk fan.",
                "short_description": "Quiet airflow.",
                "mrp": "1999.00",
                "selling_price": "1499.00",
                "tax_class": self.tax.id,
                "category": self.category.id,
                "brand": self.brand.id,
                "is_featured": True,
                "is_bestseller": False,
                "initial_quantity": 8,
            },
            format="json",
        )
        self.assertEqual(created.status_code, 201)
        product_id = created.data["id"]
        self.assertTrue(created.data["is_featured"])
        self.assertEqual(created.data["stock_quantity"], 8)

        updated = self.client.patch(
            f"/api/v1/admin/products/{product_id}/",
            {"selling_price": "1399.00", "is_bestseller": True, "tax_class": self.tax.id},
            format="json",
        )
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.data["selling_price"], "1399.00")
        self.assertTrue(updated.data["is_bestseller"])

        deleted = self.client.delete(f"/api/v1/admin/products/{product_id}/")
        self.assertEqual(deleted.status_code, 204)
        product = Product.objects.get(pk=product_id)
        self.assertFalse(product.is_active)

    def test_order_search_filter_and_status_update_reject_payment_writes(self):
        customer = self.make_customer()
        order = self.make_order(customer, status=Order.Status.PENDING, payment_status=Order.PaymentStatus.PAID)
        self.login_role(User.Role.ORDER_MANAGER)
        listing = self.client.get("/api/v1/admin/orders/?search=NXADM&status=PENDING")
        self.assertEqual(listing.status_code, 200)
        self.assertGreaterEqual(listing.data["count"], 1)
        self.assertEqual(listing.data["results"][0]["customer_email"], customer.email)

        detail = self.client.get(f"/api/v1/admin/orders/{order.id}/")
        self.assertEqual(detail.status_code, 200)
        self.assertIn("CONFIRMED", detail.data["next_statuses"])
        self.assertEqual(detail.data["shipping_address"]["city"], "Raipur")

        rejected = self.client.post(
            f"/api/v1/admin/orders/{order.id}/status/",
            {"status": "CONFIRMED", "payment_status": "REFUNDED"},
            format="json",
        )
        self.assertEqual(rejected.status_code, 400)

        updated = self.client.post(
            f"/api/v1/admin/orders/{order.id}/status/",
            {"status": "CONFIRMED"},
            format="json",
        )
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.data["status"], "CONFIRMED")
        self.assertEqual(updated.data["payment_status"], "PAID")

        illegal = self.client.post(
            f"/api/v1/admin/orders/{order.id}/status/",
            {"status": "DELIVERED"},
            format="json",
        )
        self.assertEqual(illegal.status_code, 400)

    def test_customer_detail_orders_and_activation(self):
        customer = self.make_customer()
        self.make_order(customer)
        self.login_role(User.Role.CUSTOMER_SUPPORT)
        listing = self.client.get("/api/v1/admin/customers/?search=asha")
        self.assertEqual(listing.status_code, 200)
        self.assertEqual(listing.data["results"][0]["order_count"], 1)

        detail = self.client.get(f"/api/v1/admin/customers/{customer.id}/")
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(detail.data["email"], customer.email)

        orders = self.client.get(f"/api/v1/admin/customers/{customer.id}/orders/")
        self.assertEqual(orders.status_code, 200)
        self.assertEqual(orders.data["count"], 1)

        escalated = self.client.patch(
            f"/api/v1/admin/customers/{customer.id}/",
            {"is_active": False, "role": "SUPER_ADMIN", "email": "hack@nexora.local"},
            format="json",
        )
        self.assertEqual(escalated.status_code, 400)

        deactivated = self.client.patch(
            f"/api/v1/admin/customers/{customer.id}/",
            {"is_active": False},
            format="json",
        )
        self.assertEqual(deactivated.status_code, 200)
        customer.refresh_from_db()
        self.assertFalse(customer.is_active)
        self.assertEqual(customer.role, User.Role.CUSTOMER)
        self.assertEqual(customer.email, "buyer@nexora.local")

        reactivated = self.client.patch(
            f"/api/v1/admin/customers/{customer.id}/",
            {"is_active": True},
            format="json",
        )
        self.assertEqual(reactivated.status_code, 200)
        customer.refresh_from_db()
        self.assertTrue(customer.is_active)

    def test_inventory_update_is_role_gated(self):
        inventory = self.product.inventory
        self.login_role(User.Role.ORDER_MANAGER)
        self.assertEqual(
            self.client.patch(f"/api/v1/admin/inventory/{inventory.id}/", {"quantity": 20}, format="json").status_code,
            403,
        )
        self.client.credentials()
        self.login_role(User.Role.INVENTORY_MANAGER)
        updated = self.client.patch(
            f"/api/v1/admin/inventory/{inventory.id}/",
            {"quantity": 12, "low_stock_threshold": 3},
            format="json",
        )
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.data["quantity"], 12)
