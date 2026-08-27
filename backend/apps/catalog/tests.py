from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from apps.catalog.models import Brand, Category, Inventory, Product, TaxClass

User = get_user_model()


class CatalogApiTests(APITestCase):
    def setUp(self):
        self.tax = TaxClass.objects.create(
            name="GST 18",
            cgst_rate=Decimal("9.00"),
            sgst_rate=Decimal("9.00"),
            igst_rate=Decimal("18.00"),
        )
        self.category = Category.objects.create(name="Audio", slug="audio", description="Headphones and speakers")
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

    def test_product_list_is_paginated_and_searchable(self):
        listing = self.client.get("/api/v1/products/?search=Pulse")
        self.assertEqual(listing.status_code, 200)
        self.assertIn("results", listing.data)
        self.assertGreaterEqual(listing.data["count"], 1)

    def test_product_filter_by_category_slug(self):
        listing = self.client.get("/api/v1/products/?category=audio")
        self.assertEqual(listing.status_code, 200)
        self.assertEqual(listing.data["results"][0]["sku"], "HB-PLSE-01")

    def test_product_retrieve_by_slug_and_id(self):
        by_slug = self.client.get("/api/v1/products/harbor-pulse-earbuds/")
        by_id = self.client.get(f"/api/v1/products/{self.product.id}/")
        self.assertEqual(by_slug.status_code, 200)
        self.assertEqual(by_id.status_code, 200)
        self.assertEqual(by_slug.data["id"], by_id.data["id"])
        self.assertEqual(by_slug.data["discount_percent"], 29)

    def test_category_and_brand_retrieve(self):
        category = self.client.get("/api/v1/categories/audio/")
        brand = self.client.get("/api/v1/brands/harbor/")
        self.assertEqual(category.status_code, 200)
        self.assertEqual(brand.status_code, 200)
        self.assertEqual(category.data["name"], "Audio")

    def test_public_cannot_create_product(self):
        response = self.client.post("/api/v1/products/", {"name": "Nope"}, format="json")
        self.assertIn(response.status_code, (401, 403))

    def test_staff_can_create_update_and_soft_delete_via_product_api(self):
        admin = User.objects.create_user(
            username="writer@nexora.local",
            email="writer@nexora.local",
            password="StrongPass123",
            role=User.Role.PRODUCT_MANAGER,
        )
        login = self.client.post(
            "/api/v1/auth/login/",
            {"email": admin.email, "password": "StrongPass123"},
            format="json",
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
        created = self.client.post(
            "/api/v1/products/",
            {
                "name": "Pebble Desk Lamp",
                "sku": "PB-LAMP-11",
                "slug": "pebble-desk-lamp",
                "description": "Original compact lamp for a small desk.",
                "short_description": "Warm desk lamp.",
                "mrp": "1999.00",
                "selling_price": "1499.00",
                "tax_class": self.tax.id,
                "category": self.category.id,
                "brand": self.brand.id,
                "specifications": {"finish": "matte"},
                "initial_quantity": 8,
                "is_active": True,
                "is_featured": True,
            },
            format="json",
        )
        self.assertEqual(created.status_code, 201)
        product_id = created.data["id"]
        self.assertEqual(created.data["discount_percent"], 25)
        self.assertEqual(Product.objects.get(pk=product_id).inventory.quantity, 8)

        updated = self.client.patch(
            f"/api/v1/products/{product_id}/",
            {"selling_price": "1599.00"},
            format="json",
        )
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.data["selling_price"], "1599.00")

        too_high = self.client.patch(
            f"/api/v1/products/{product_id}/",
            {"selling_price": "5000.00"},
            format="json",
        )
        self.assertEqual(too_high.status_code, 400)

        deleted = self.client.delete(f"/api/v1/products/{product_id}/")
        self.assertEqual(deleted.status_code, 200)
        product = Product.objects.get(pk=product_id)
        self.assertFalse(product.is_active)

        self.client.credentials()
        hidden = self.client.get(f"/api/v1/products/{product_id}/")
        self.assertEqual(hidden.status_code, 404)

    def test_staff_product_create_uses_server_prices_and_inventory(self):
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
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
        created = self.client.post(
            "/api/v1/admin/products/",
            {
                "name": "Northline Cable",
                "sku": "NL-CBL-99",
                "slug": "northline-cable",
                "description": "Original accessory.",
                "short_description": "USB-C cable.",
                "mrp": "899.00",
                "selling_price": "599.00",
                "tax_class": self.tax.id,
                "category": self.category.id,
                "brand": self.brand.id,
                "specifications": {"length": "1.8m"},
                "initial_quantity": 25,
                "is_active": True,
            },
            format="json",
        )
        self.assertEqual(created.status_code, 201)
        product = Product.objects.get(sku="NL-CBL-99")
        self.assertEqual(product.inventory.quantity, 25)
        self.assertEqual(product.stock_quantity, 25)

        invalid = self.client.post(
            "/api/v1/admin/products/",
            {
                "name": "Bad Price",
                "sku": "BAD-PRICE",
                "description": "Invalid.",
                "short_description": "Invalid.",
                "mrp": "100.00",
                "selling_price": "150.00",
                "tax_class": self.tax.id,
                "category": self.category.id,
                "brand": self.brand.id,
            },
            format="json",
        )
        self.assertEqual(invalid.status_code, 400)

    def test_staff_category_and_brand_crud(self):
        admin = User.objects.create_user(
            username="catalog@nexora.local",
            email="catalog@nexora.local",
            password="StrongPass123",
            role=User.Role.SUPER_ADMIN,
        )
        login = self.client.post(
            "/api/v1/auth/login/",
            {"email": admin.email, "password": "StrongPass123"},
            format="json",
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")

        category = self.client.post(
            "/api/v1/admin/categories/",
            {"name": "Cables", "slug": "cables", "description": "Charging cables.", "is_active": True},
            format="json",
        )
        self.assertEqual(category.status_code, 201)
        category_id = category.data["id"]
        updated_category = self.client.patch(
            f"/api/v1/admin/categories/{category_id}/",
            {"description": "USB and power cables."},
            format="json",
        )
        self.assertEqual(updated_category.status_code, 200)
        listing = self.client.get("/api/v1/admin/categories/?search=Cables")
        self.assertEqual(listing.status_code, 200)
        self.assertIn("results", listing.data)

        brand = self.client.post(
            "/api/v1/admin/brands/",
            {"name": "Voltline", "slug": "voltline", "is_active": True},
            format="json",
        )
        self.assertEqual(brand.status_code, 201)
        brand_id = brand.data["id"]
        updated_brand = self.client.patch(
            f"/api/v1/admin/brands/{brand_id}/",
            {"description": "Power accessories."},
            format="json",
        )
        self.assertEqual(updated_brand.status_code, 200)
        brands = self.client.get("/api/v1/admin/brands/?search=Voltline")
        self.assertEqual(brands.status_code, 200)
        self.assertIn("results", brands.data)
