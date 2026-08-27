# Database

PostgreSQL is the source of truth. Django tests use SQLite automatically. Runtime uses `DATABASE_ENGINE=postgres` and `DATABASE_URL`.

Domain apps map to the requested bounded contexts without empty one-table apps:

| Requested area | Django app | Entities |
| --- | --- | --- |
| users | `accounts` | User, CustomerProfile, Address |
| categories, products, inventory | `catalog` | Category, Brand, Product, ProductImage, Inventory, TaxClass |
| cart | `commerce` | Cart, CartItem, Wishlist, WishlistItem |
| orders, payments, coupons, shipping | `orders` | Order, OrderItem, Payment, Coupon, CouponUsage, Shipment |
| reviews, notifications | `engagement` | Review, Notification, ContactMessage |
| staff operations | `dashboard` | Admin API views only (no extra tables) |

Foreign keys already enforce those boundaries. Creating eleven empty apps would require destructive table moves.

## Principles

- Money is `Decimal`. Order totals are snapshots written only by `PricingService`.
- Inventory quantity/reserved is the stock source of truth; `Product.stock_quantity` is denormalized available stock.
- Payment status changes only after backend verification (`MockPaymentGateway` in this phase — no live PSP).
- GST is per `TaxClass` (CGST+SGST or IGST), not a global rate.

## Relationships

```
User 1—1 CustomerProfile
User 1—* Address
User 1—1 Cart 1—* CartItem *—1 Product
User 1—1 Wishlist 1—* WishlistItem *—1 Product
User 1—* Order 1—* OrderItem *—1 Product
Order 1—* Payment
Order 1—1 Shipment
Coupon 1—* CouponUsage *—1 Order
Product *—1 Category | Brand | TaxClass
Product 1—1 Inventory
Product 1—* ProductImage
Product 1—* Review
User 1—* Notification
```

## Constraints and indexes

- User.email unique; indexes on email and (role, is_active)
- Product sku/slug unique; `mrp >= selling_price`; indexes on slug, sku, name, selling_price, category, flags
- Inventory `quantity >= reserved_quantity`; one row per product
- CartItem unique (cart, product), quantity ≥ 1
- WishlistItem unique (wishlist, product)
- Address: at most one default per user
- Review: one per (product, user)
- Coupon.code unique; Order.order_number unique; Payment.provider_payment_id unique; Shipment.tracking_number unique

## Money and inventory rules

- Clients must not supply order totals, GST, discounts, or payment status as authority.
- Creating a product via staff API accepts `initial_quantity`; later stock changes go through Inventory.
- Order serializer money/status fields are read-only.

## Seed

`python manage.py seed_catalog` (later catalogue phase) loads original products. Not required for the schema itself.
