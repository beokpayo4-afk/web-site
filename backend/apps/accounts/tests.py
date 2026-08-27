from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.catalog.models import Brand, Category, Inventory, Product, TaxClass
from apps.orders.models import Coupon, StoreSetting

User = get_user_model()


class ApiTestCase(TestCase):
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
        Inventory.objects.update_or_create(
            product=self.product,
            defaults={"quantity": 10, "reserved_quantity": 0},
        )
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

    def auth(self, email="buyer@nexora.local", password="StrongPass123"):
        register = self.client.post(
            "/api/v1/auth/register/",
            {"email": email, "password": password, "full_name": "Asha Rao", "phone": "9876543210"},
            format="json",
        )
        self.assertEqual(register.status_code, 201)
        token = register.data["access"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        return register.data["user"]


class AuthCatalogTests(ApiTestCase):
    def test_register_login_and_me(self):
        self.auth()
        me = self.client.get(" /api/v1/auth/me/".strip())
        self.assertEqual(me.status_code, 200)
        self.assertEqual(me.data["email"], "buyer@nexora.local")

    def test_duplicate_email_conflict(self):
        self.auth()
        self.client.credentials()
        again = self.client.post(
            "/api/v1/auth/register/",
            {"email": "buyer@nexora.local", "password": "StrongPass123", "full_name": "Asha Rao"},
            format="json",
        )
        self.assertEqual(again.status_code, 400)

    def test_product_list_and_detail(self):
        listing = self.client.get("/api/v1/products/")
        self.assertEqual(listing.status_code, 200)
        self.assertGreaterEqual(listing.data["count"], 1)
        detail = self.client.get("/api/v1/products/harbor-pulse-earbuds/")
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(detail.data["sku"], "HB-PLSE-01")
        self.assertEqual(detail.data["discount_percent"], 29)


class CheckoutSecurityTests(ApiTestCase):
    def test_backend_calculates_totals_and_verifies_payment(self):
        self.auth()
        address = self.client.post(
            "/api/v1/auth/addresses/",
            {
                "full_name": "Asha Rao",
                "phone": "9876543210",
                "line1": "12 Lake View",
                "city": "Raipur",
                "state": "Chhattisgarh",
                "postal_code": "492001",
            },
            format="json",
        )
        self.assertEqual(address.status_code, 201)
        add = self.client.post("/api/v1/cart/items/", {"product_id": self.product.id, "quantity": 2}, format="json")
        self.assertEqual(add.status_code, 201)

        quote = self.client.post(
            "/api/v1/checkout/quote/",
            {"shipping_state": "Chhattisgarh", "coupon_code": "NEXORA10"},
            format="json",
        )
        self.assertEqual(quote.status_code, 200)
        # 2 x 2499 = 4998, 10% coupon = 499.80, taxable 4498.20, GST 18% = 809.68, shipping 0 (over 999)
        self.assertEqual(quote.data["subtotal"], "4998.00")
        self.assertEqual(quote.data["discount_amount"], "499.80")

        order = self.client.post(
            "/api/v1/orders/",
            {"shipping_address_id": address.data["id"], "coupon_code": "NEXORA10"},
            format="json",
        )
        self.assertEqual(order.status_code, 201)
        self.assertEqual(order.data["grand_total"], quote.data["grand_total"])
        self.assertEqual(order.data["status"], "PENDING")
        self.assertEqual(order.data["payment_status"], "PENDING")

        verify = self.client.post(
            "/api/v1/checkout/verify-payment/",
            {"provider_payment_id": order.data["payment"]["provider_payment_id"], "status": "PAID"},
            format="json",
        )
        self.assertEqual(verify.status_code, 200)
        self.assertEqual(verify.data["payment_status"], "PENDING")

        good = self.client.post(
            "/api/v1/payments/mock/complete/",
            {
                "provider_payment_id": order.data["payment"]["provider_payment_id"],
                "outcome": "success",
            },
            format="json",
        )
        self.assertEqual(good.status_code, 200)
        self.assertEqual(good.data["payment_status"], "PAID")
        self.assertEqual(good.data["status"], "CONFIRMED")

    def test_cannot_order_more_than_stock(self):
        self.auth()
        address = self.client.post(
            "/api/v1/auth/addresses/",
            {
                "full_name": "Asha Rao",
                "phone": "9876543210",
                "line1": "12 Lake View",
                "city": "Raipur",
                "state": "Maharashtra",
                "postal_code": "400001",
            },
            format="json",
        )
        self.client.post("/api/v1/cart/items/", {"product_id": self.product.id, "quantity": 99}, format="json")
        order = self.client.post("/api/v1/orders/", {"shipping_address_id": address.data["id"]}, format="json")
        self.assertIn(order.status_code, (400, 409))


class AdminPermissionTests(ApiTestCase):
    def test_customer_cannot_access_admin(self):
        self.auth()
        response = self.client.get("/api/v1/admin/summary/")
        self.assertEqual(response.status_code, 403)

    def test_super_admin_can_access_dashboard(self):
        admin = User.objects.create_user(
            username="ops@nexora.local",
            email="ops@nexora.local",
            password="StrongPass123",
            role=User.Role.SUPER_ADMIN,
        )
        login = self.client.post(
            "/api/v1/auth/login/",
            {"email": admin.email, "password": "StrongPass123"},
            format="json",
        )
        self.assertEqual(login.status_code, 200)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
        summary = self.client.get("/api/v1/admin/summary/")
        self.assertEqual(summary.status_code, 200)
        self.assertIn("revenue", summary.data)


class AuthenticationTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_register_hashes_password_issues_jwt_and_ignores_role(self):
        response = self.client.post(
            "/api/v1/auth/register/",
            {
                "email": "Asha@Nexora.local",
                "password": "StrongPass123",
                "full_name": "Asha Rao",
                "phone": "9876543210",
                "role": "SUPER_ADMIN",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)
        self.assertNotIn("password", response.data["user"])
        self.assertNotIn("username", response.data["user"])
        user = User.objects.get(email="asha@nexora.local")
        self.assertTrue(user.password.startswith("pbkdf2_"))
        self.assertTrue(user.check_password("StrongPass123"))
        self.assertEqual(user.role, User.Role.CUSTOMER)

    def test_register_rejects_short_password_and_duplicate_email(self):
        weak = self.client.post(
            "/api/v1/auth/register/",
            {"email": "weak@nexora.local", "password": "short", "full_name": "Weak User"},
            format="json",
        )
        self.assertEqual(weak.status_code, 400)
        self.client.post(
            "/api/v1/auth/register/",
            {"email": "dup@nexora.local", "password": "StrongPass123", "full_name": "Dup"},
            format="json",
        )
        duplicate = self.client.post(
            "/api/v1/auth/register/",
            {"email": "dup@nexora.local", "password": "StrongPass123", "full_name": "Dup"},
            format="json",
        )
        self.assertEqual(duplicate.status_code, 400)

    def test_login_refresh_me_and_invalid_credentials(self):
        self.client.post(
            "/api/v1/auth/register/",
            {"email": "buyer@nexora.local", "password": "StrongPass123", "full_name": "Asha Rao"},
            format="json",
        )
        bad = self.client.post(
            "/api/v1/auth/login/",
            {"email": "buyer@nexora.local", "password": "WrongPass123"},
            format="json",
        )
        self.assertEqual(bad.status_code, 401)

        login = self.client.post(
            "/api/v1/auth/login/",
            {"email": "Buyer@nexora.local", "password": "StrongPass123"},
            format="json",
        )
        self.assertEqual(login.status_code, 200)
        access, refresh = login.data["access"], login.data["refresh"]

        anonymous = APIClient()
        self.assertEqual(anonymous.get("/api/v1/auth/me/").status_code, 401)

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        me = self.client.get("/api/v1/auth/me/")
        self.assertEqual(me.status_code, 200)
        self.assertEqual(me.data["email"], "buyer@nexora.local")
        self.assertEqual(me.data["role"], "CUSTOMER")
        self.assertNotIn("password", me.data)

        rotated = self.client.post("/api/v1/auth/refresh/", {"refresh": refresh}, format="json")
        self.assertEqual(rotated.status_code, 200)
        self.assertIn("access", rotated.data)

    def test_profile_update_cannot_change_role_or_email(self):
        register = self.client.post(
            "/api/v1/auth/register/",
            {"email": "profile@nexora.local", "password": "StrongPass123", "full_name": "Priya Shah"},
            format="json",
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {register.data['access']}")
        updated = self.client.patch(
            "/api/v1/auth/profile/",
            {"full_name": "Priya S", "phone": "9998887776", "role": "SUPER_ADMIN", "email": "hack@nexora.local"},
            format="json",
        )
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.data["full_name"], "Priya S")
        self.assertEqual(updated.data["phone"], "9998887776")
        self.assertEqual(updated.data["role"], "CUSTOMER")
        self.assertEqual(updated.data["email"], "profile@nexora.local")

    def test_change_password_issues_new_tokens_and_revokes_refresh(self):
        register = self.client.post(
            "/api/v1/auth/register/",
            {"email": "pw@nexora.local", "password": "StrongPass123", "full_name": "Pat Wong"},
            format="json",
        )
        old_refresh = register.data["refresh"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {register.data['access']}")
        changed = self.client.post(
            "/api/v1/auth/change-password/",
            {"current_password": "StrongPass123", "new_password": "NewerPass123"},
            format="json",
        )
        self.assertEqual(changed.status_code, 200)
        self.assertIn("access", changed.data)

        stale = APIClient()
        denied = stale.post("/api/v1/auth/refresh/", {"refresh": old_refresh}, format="json")
        self.assertEqual(denied.status_code, 401)

        old_login = stale.post(
            "/api/v1/auth/login/",
            {"email": "pw@nexora.local", "password": "StrongPass123"},
            format="json",
        )
        self.assertEqual(old_login.status_code, 401)
        new_login = stale.post(
            "/api/v1/auth/login/",
            {"email": "pw@nexora.local", "password": "NewerPass123"},
            format="json",
        )
        self.assertEqual(new_login.status_code, 200)

    def test_logout_blacklists_refresh_token(self):
        register = self.client.post(
            "/api/v1/auth/register/",
            {"email": "out@nexora.local", "password": "StrongPass123", "full_name": "Out User"},
            format="json",
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {register.data['access']}")
        logout = self.client.post("/api/v1/auth/logout/", {"refresh": register.data["refresh"]}, format="json")
        self.assertEqual(logout.status_code, 204)
        reused = self.client.post("/api/v1/auth/refresh/", {"refresh": register.data["refresh"]}, format="json")
        self.assertEqual(reused.status_code, 401)

    def test_forgot_password_does_not_reveal_whether_account_exists(self):
        known = self.client.post("/api/v1/auth/forgot-password/", {"email": "missing@nexora.local"}, format="json")
        self.client.post(
            "/api/v1/auth/register/",
            {"email": "known@nexora.local", "password": "StrongPass123", "full_name": "Known"},
            format="json",
        )
        existing = self.client.post("/api/v1/auth/forgot-password/", {"email": "known@nexora.local"}, format="json")
        self.assertEqual(known.status_code, 200)
        self.assertEqual(existing.status_code, 200)
        self.assertEqual(known.data["detail"], existing.data["detail"])

    def test_inactive_user_cannot_login(self):
        user = User.objects.create_user(
            username="quiet@nexora.local",
            email="quiet@nexora.local",
            password="StrongPass123",
            is_active=False,
        )
        login = self.client.post(
            "/api/v1/auth/login/",
            {"email": user.email, "password": "StrongPass123"},
            format="json",
        )
        self.assertEqual(login.status_code, 401)

    def test_support_cannot_access_settings_admin(self):
        support = User.objects.create_user(
            username="help@nexora.local",
            email="help@nexora.local",
            password="StrongPass123",
            role=User.Role.CUSTOMER_SUPPORT,
        )
        login = self.client.post(
            "/api/v1/auth/login/",
            {"email": support.email, "password": "StrongPass123"},
            format="json",
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
        settings = self.client.get("/api/v1/admin/settings/")
        self.assertEqual(settings.status_code, 403)
        orders = self.client.get("/api/v1/admin/orders/")
        self.assertEqual(orders.status_code, 200)
