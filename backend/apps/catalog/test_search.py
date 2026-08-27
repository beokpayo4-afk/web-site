from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from apps.catalog.models import Brand, Category, Inventory, Product, TaxClass
from apps.engagement.models import Review

User = get_user_model()


class ProductSearchApiTests(APITestCase):
    def setUp(self):
        self.tax = TaxClass.objects.create(
            name="GST 18 Search",
            cgst_rate=Decimal("9.00"),
            sgst_rate=Decimal("9.00"),
            igst_rate=Decimal("18.00"),
        )
        self.audio = Category.objects.create(name="Audio", slug="audio")
        self.charging = Category.objects.create(name="Charging", slug="charging")
        self.harbor = Brand.objects.create(name="Harbor", slug="harbor")
        self.northline = Brand.objects.create(name="Northline", slug="northline")
        self.reviewer = User.objects.create_user(
            username="searcher@nexora.local",
            email="searcher@nexora.local",
            password="StrongPass123",
        )
        self.earbuds = self._product(
            name="Harbor Pulse Earbuds",
            sku="HB-PLSE-01",
            slug="harbor-pulse-earbuds",
            description="Wireless earbuds for commutes and long workdays.",
            short="Wireless earbuds.",
            mrp="500.00",
            price="400.00",
            category=self.audio,
            brand=self.harbor,
            stock=10,
            tags=["earbuds", "wireless", "commute"],
            featured=True,
            bestseller=True,
        )
        self.cable = self._product(
            name="Harbor Braid USB-C Cable",
            sku="HB-CBL18-05",
            slug="harbor-braid-cable",
            description="Braided charging cable rated for 100W.",
            short="Braided USB-C cable.",
            mrp="49.00",
            price="30.00",
            category=self.charging,
            brand=self.harbor,
            stock=0,
            tags=["cable", "usb-c"],
        )
        self.charger = self._product(
            name="Northline GaN Charger",
            sku="NL-GAN65-04",
            slug="northline-gan-charger",
            description="Compact two-port charger for laptop and phone.",
            short="65W GaN charger.",
            mrp="199.00",
            price="199.00",
            category=self.charging,
            brand=self.northline,
            stock=8,
            tags=["charger", "gan"],
        )
        Review.objects.create(
            product=self.earbuds,
            user=self.reviewer,
            rating=5,
            title="Clear",
            body="Balanced sound for calls.",
            is_approved=True,
        )
        extra = User.objects.create_user(
            username="rater@nexora.local",
            email="rater@nexora.local",
            password="StrongPass123",
        )
        Review.objects.create(
            product=self.charger,
            user=extra,
            rating=2,
            title="Warm",
            body="Gets warm on the desk.",
            is_approved=True,
        )

    def _product(self, **kwargs):
        product = Product.objects.create(
            name=kwargs["name"],
            sku=kwargs["sku"],
            slug=kwargs["slug"],
            description=kwargs["description"],
            short_description=kwargs["short"],
            mrp=Decimal(kwargs["mrp"]),
            selling_price=Decimal(kwargs["price"]),
            tax_class=self.tax,
            category=kwargs["category"],
            brand=kwargs["brand"],
            stock_quantity=kwargs["stock"],
            tags=kwargs.get("tags", []),
            is_featured=kwargs.get("featured", False),
            is_bestseller=kwargs.get("bestseller", False),
        )
        Inventory.objects.update_or_create(
            product=product,
            defaults={"quantity": kwargs["stock"], "reserved_quantity": 0},
        )
        return product

    def _skus(self, response):
        return [row["sku"] for row in response.data["results"]]

    def test_search_matches_name_sku_brand_category_description_and_tags(self):
        cases = {
            "Pulse": "HB-PLSE-01",
            "HB-CBL18-05": "HB-CBL18-05",
            "Northline": "NL-GAN65-04",
            "Audio": "HB-PLSE-01",
            "100W": "HB-CBL18-05",
            "earbuds": "HB-PLSE-01",
        }
        for term, sku in cases.items():
            with self.subTest(term=term):
                response = self.client.get("/api/v1/products/", {"search": term})
                self.assertEqual(response.status_code, 200)
                self.assertIn(sku, self._skus(response))

    def test_category_and_brand_filters(self):
        by_category = self.client.get("/api/v1/products/", {"category": "charging"})
        by_brand = self.client.get("/api/v1/products/", {"brand": "harbor"})
        self.assertEqual(set(self._skus(by_category)), {"HB-CBL18-05", "NL-GAN65-04"})
        self.assertEqual(set(self._skus(by_brand)), {"HB-PLSE-01", "HB-CBL18-05"})

    def test_price_range_availability_rating_and_discount(self):
        price = self.client.get("/api/v1/products/", {"min_price": "50", "max_price": "150"})
        self.assertEqual(self._skus(price), [])

        cheap = self.client.get("/api/v1/products/", {"max_price": "50"})
        self.assertEqual(self._skus(cheap), ["HB-CBL18-05"])

        in_stock = self.client.get("/api/v1/products/", {"availability": "in_stock"})
        self.assertNotIn("HB-CBL18-05", self._skus(in_stock))
        self.assertIn("HB-PLSE-01", self._skus(in_stock))

        out = self.client.get("/api/v1/products/", {"availability": "out_of_stock"})
        self.assertEqual(self._skus(out), ["HB-CBL18-05"])

        rated = self.client.get("/api/v1/products/", {"min_rating": "4"})
        self.assertEqual(self._skus(rated), ["HB-PLSE-01"])

        sale = self.client.get("/api/v1/products/", {"on_sale": "true", "min_discount": "15"})
        self.assertIn("HB-PLSE-01", self._skus(sale))
        self.assertNotIn("NL-GAN65-04", self._skus(sale))

    def test_sorting_and_pagination_stay_on_the_server(self):
        newest = self.client.get("/api/v1/products/", {"ordering": "newest"})
        self.assertEqual(newest.status_code, 200)
        self.assertEqual(self._skus(newest)[0], "NL-GAN65-04")

        low = self.client.get("/api/v1/products/", {"ordering": "selling_price"})
        self.assertEqual(self._skus(low)[0], "HB-CBL18-05")

        high = self.client.get("/api/v1/products/", {"ordering": "-selling_price"})
        self.assertEqual(self._skus(high)[0], "HB-PLSE-01")

        rated = self.client.get("/api/v1/products/", {"ordering": "rating"})
        self.assertEqual(self._skus(rated)[0], "HB-PLSE-01")

        popular = self.client.get("/api/v1/products/", {"ordering": "popularity"})
        self.assertEqual(popular.status_code, 200)
        self.assertEqual(self._skus(popular)[0], "HB-PLSE-01")

        for index in range(15):
            self._product(
                name=f"Spare Cable {index}",
                sku=f"SP-CBL-{index:02d}",
                slug=f"spare-cable-{index}",
                description="Extra charging cable for pagination.",
                short="Spare cable.",
                mrp="80.00",
                price="60.00",
                category=self.charging,
                brand=self.harbor,
                stock=4,
                tags=["cable"],
            )

        page = self.client.get("/api/v1/products/", {"page": 1, "page_size": 12, "ordering": "name"})
        self.assertEqual(page.status_code, 200)
        self.assertEqual(len(page.data["results"]), 12)
        self.assertGreater(page.data["count"], 12)
        self.assertIsNotNone(page.data["next"])

        oversized = self.client.get("/api/v1/products/", {"page_size": 500})
        self.assertLessEqual(len(oversized.data["results"]), 60)

    def test_hyphenated_terms_do_not_match_the_whole_catalogue(self):
        response = self.client.get("/api/v1/products/", {"search": "usb-c"})
        self.assertEqual(response.status_code, 200)
        self.assertIn("HB-CBL18-05", self._skus(response))
        self.assertNotIn("NL-GAN65-04", self._skus(response))

    def test_facets_do_not_return_product_rows(self):
        response = self.client.get("/api/v1/products/facets/", {"search": "harbor"})
        self.assertEqual(response.status_code, 200)
        self.assertNotIn("results", response.data)
        self.assertGreaterEqual(response.data["count"], 2)
        self.assertTrue(any(row["slug"] == "harbor" for row in response.data["brands"]))
