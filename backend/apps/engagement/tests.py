from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from apps.accounts.models import CustomerProfile
from apps.catalog.models import Brand, Category, Inventory, Product, TaxClass
from apps.engagement.models import Review
from apps.orders.models import Order, OrderItem

User = get_user_model()

SNAPSHOT = {
    "full_name": "Asha Rao",
    "phone": "9876543210",
    "line1": "12 Lake View",
    "city": "Raipur",
    "state": "Chhattisgarh",
    "postal_code": "492001",
    "country": "India",
}


class ReviewApiTests(APITestCase):
    def setUp(self):
        self.tax = TaxClass.objects.create(name="GST 18", igst_rate=Decimal("18.00"))
        self.category = Category.objects.create(name="Audio", slug="audio")
        self.brand = Brand.objects.create(name="Harbor", slug="harbor")
        self.product = Product.objects.create(
            name="Harbor Pulse Earbuds",
            sku="HB-PLSE-01",
            slug="harbor-pulse-earbuds",
            description="Wireless earbuds.",
            short_description="Earbuds.",
            mrp=Decimal("499.00"),
            selling_price=Decimal("399.00"),
            tax_class=self.tax,
            category=self.category,
            brand=self.brand,
            stock_quantity=8,
        )
        Inventory.objects.update_or_create(product=self.product, defaults={"quantity": 8, "reserved_quantity": 0})

    def auth(self, email="reviewer@nexora.local", role=None):
        kwargs = {"username": email, "email": email, "password": "StrongPass123"}
        if role:
            kwargs["role"] = role
        user = User.objects.create_user(**kwargs)
        CustomerProfile.objects.update_or_create(user=user, defaults={"full_name": "Asha Rao"})
        login = self.client.post("/api/v1/auth/login/", {"email": email, "password": "StrongPass123"}, format="json")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
        return user

    def deliver(self, user, product=None):
        product = product or self.product
        order = Order.objects.create(
            order_number=f"NXREV{user.id}{Order.objects.count():04d}",
            user=user,
            status=Order.Status.DELIVERED,
            payment_status=Order.PaymentStatus.PAID,
            shipping_address=SNAPSHOT,
            billing_address=SNAPSHOT,
            grand_total=product.selling_price,
        )
        OrderItem.objects.create(
            order=order,
            product=product,
            product_name=product.name,
            sku=product.sku,
            quantity=1,
            unit_price=product.selling_price,
            mrp=product.mrp,
            tax_rate=Decimal("18.00"),
            tax_amount=Decimal("0"),
            line_total=product.selling_price,
        )
        return order

    def test_guest_cannot_create_review(self):
        response = self.client.post(
            f"/api/v1/products/{self.product.id}/reviews/",
            {"rating": 5, "title": "Great", "body": "Really clear calls."},
            format="json",
        )
        self.assertEqual(response.status_code, 401)

    def test_review_requires_delivered_purchase(self):
        self.auth()
        blocked = self.client.post(
            f"/api/v1/products/{self.product.id}/reviews/",
            {"rating": 5, "title": "Great kit", "body": "Really clear calls."},
            format="json",
        )
        self.assertEqual(blocked.status_code, 403)

    def test_create_lists_own_pending_and_hides_from_public(self):
        user = self.auth()
        self.deliver(user)
        created = self.client.post(
            f"/api/v1/products/{self.product.id}/reviews/",
            {"rating": 5, "title": "Great kit", "body": "Really clear calls on the commute."},
            format="json",
        )
        self.assertEqual(created.status_code, 201, created.data)
        self.assertEqual(created.data["status"], "PENDING")
        self.assertTrue(created.data["is_verified_purchase"])
        self.assertFalse(created.data["is_approved"])
        mine = self.client.get(f"/api/v1/products/{self.product.id}/reviews/")
        self.assertEqual(mine.data["count"], 1)
        self.client.credentials()
        public = self.client.get(f"/api/v1/products/{self.product.id}/reviews/")
        self.assertEqual(public.data["count"], 0)

    def test_duplicate_review_is_rejected(self):
        user = self.auth()
        self.deliver(user)
        payload = {"rating": 4, "title": "Solid pair", "body": "Battery lasts a full workday."}
        first = self.client.post(f"/api/v1/products/{self.product.id}/reviews/", payload, format="json")
        second = self.client.post(f"/api/v1/products/{self.product.id}/reviews/", payload, format="json")
        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 409)

    def test_customer_can_see_own_review_status_and_admin_can_moderate(self):
        user = self.auth()
        self.deliver(user)
        created = self.client.post(
            f"/api/v1/products/{self.product.id}/reviews/",
            {"rating": 5, "title": "Great kit", "body": "Really clear calls on the commute."},
            format="json",
        )
        mine = self.client.get("/api/v1/reviews/me/")
        self.assertEqual(mine.status_code, 200)
        self.assertEqual(mine.data["results"][0]["status"], "PENDING")
        eligibility = self.client.get(f"/api/v1/products/{self.product.id}/review-eligibility/")
        self.assertFalse(eligibility.data["can_review"])
        self.assertEqual(eligibility.data["reason"], "already_reviewed")

        self.client.credentials()
        admin = User.objects.create_user(
            username="mod@nexora.local",
            email="mod@nexora.local",
            password="StrongPass123",
            role=User.Role.CUSTOMER_SUPPORT,
        )
        login = self.client.post(
            "/api/v1/auth/login/",
            {"email": admin.email, "password": "StrongPass123"},
            format="json",
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
        approved = self.client.post(
            f"/api/v1/admin/reviews/{created.data['id']}/moderate/",
            {"status": "APPROVED"},
            format="json",
        )
        self.assertEqual(approved.status_code, 200)
        self.assertEqual(approved.data["status"], "APPROVED")
        self.assertTrue(approved.data["is_approved"])
        self.client.credentials()
        public = self.client.get(f"/api/v1/products/{self.product.id}/reviews/")
        self.assertEqual(public.data["count"], 1)
        self.assertTrue(public.data["results"][0]["is_verified_purchase"])
        self.assertIn("created_at", public.data["results"][0])

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
        rejected = self.client.post(
            f"/api/v1/admin/reviews/{created.data['id']}/moderate/",
            {"status": "REJECTED", "moderation_note": "Off-topic."},
            format="json",
        )
        self.assertEqual(rejected.status_code, 200)
        self.assertEqual(rejected.data["status"], "REJECTED")
        self.client.credentials()
        hidden = self.client.get(f"/api/v1/products/{self.product.id}/reviews/")
        self.assertEqual(hidden.data["count"], 0)
