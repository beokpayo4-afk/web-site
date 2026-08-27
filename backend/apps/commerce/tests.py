from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from apps.catalog.models import Brand, Category, Inventory, Product, TaxClass
from apps.commerce.models import CartItem, WishlistItem

User = get_user_model()


class WishlistApiTests(APITestCase):
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
        self.out = Product.objects.create(
            name="Quiet Stock",
            sku="QS-OUT-01",
            slug="quiet-stock",
            description="Unavailable.",
            short_description="Out.",
            mrp=Decimal("99.00"),
            selling_price=Decimal("79.00"),
            tax_class=self.tax,
            category=self.category,
            brand=self.brand,
            stock_quantity=0,
        )
        Inventory.objects.update_or_create(product=self.out, defaults={"quantity": 0, "reserved_quantity": 0})

    def auth(self, email="wish@nexora.local"):
        user = User.objects.create_user(username=email, email=email, password="StrongPass123")
        login = self.client.post("/api/v1/auth/login/", {"email": email, "password": "StrongPass123"}, format="json")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
        return user

    def test_guest_cannot_use_wishlist(self):
        listing = self.client.get("/api/v1/wishlist/")
        create = self.client.post("/api/v1/wishlist/", {"product_id": self.product.id}, format="json")
        self.assertEqual(listing.status_code, 401)
        self.assertEqual(create.status_code, 401)

    def test_add_list_remove_and_duplicate(self):
        self.auth()
        created = self.client.post("/api/v1/wishlist/", {"product_id": self.product.id}, format="json")
        self.assertEqual(created.status_code, 201)
        item_id = created.data["id"]
        listing = self.client.get("/api/v1/wishlist/")
        self.assertEqual(listing.status_code, 200)
        self.assertEqual(len(listing.data), 1)
        self.assertEqual(listing.data[0]["product"]["sku"], "HB-PLSE-01")
        duplicate = self.client.post("/api/v1/wishlist/", {"product_id": self.product.id}, format="json")
        self.assertEqual(duplicate.status_code, 409)
        deleted = self.client.delete(f"/api/v1/wishlist/{item_id}/")
        self.assertEqual(deleted.status_code, 204)
        empty = self.client.get("/api/v1/wishlist/")
        self.assertEqual(empty.data, [])

    def test_move_to_cart_then_removes_wishlist_item(self):
        user = self.auth()
        created = self.client.post("/api/v1/wishlist/", {"product_id": self.product.id}, format="json")
        moved = self.client.post(f"/api/v1/wishlist/{created.data['id']}/move-to-cart/")
        self.assertEqual(moved.status_code, 200, moved.data)
        self.assertFalse(WishlistItem.objects.filter(wishlist__user=user, product=self.product).exists())
        self.assertEqual(CartItem.objects.get(cart__user=user, product=self.product).quantity, 1)
        cart = self.client.get("/api/v1/cart/")
        self.assertEqual(cart.data["items"][0]["product"]["sku"], "HB-PLSE-01")

    def test_cannot_move_out_of_stock_item(self):
        self.auth()
        created = self.client.post("/api/v1/wishlist/", {"product_id": self.out.id}, format="json")
        self.assertEqual(created.status_code, 201)
        moved = self.client.post(f"/api/v1/wishlist/{created.data['id']}/move-to-cart/")
        self.assertEqual(moved.status_code, 409)
        self.assertTrue(WishlistItem.objects.filter(pk=created.data["id"]).exists())
