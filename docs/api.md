# API

Base: `/api/v1/`  
Auth: `Authorization: Bearer <access>`  
Pagination: `{ count, next, previous, results }` (page size 12, `page_size` max 60) unless noted.

## Documentation

| Path | Purpose |
| --- | --- |
| `/api/v1/schema/` | OpenAPI 3 schema (JSON) |
| `/api/v1/docs/` | Swagger UI for the same schema |

This file is the human-readable contract. The schema endpoint is generated from serializers and views.

## Errors

```json
{ "success": false, "error": { "status": 400, "message": "...", "details": {} } }
```

400 validation · 401 unauthenticated / invalid credentials · 403 forbidden · 404 missing · 405 method not allowed · 409 conflict · 429 throttle · 500 unexpected.

## Phase 3 auth

JWT access (default 30 minutes) + refresh (7 days, rotation + blacklist). Passwords are hashed with Django’s PBKDF2. Clients send `Authorization: Bearer <access>`. Role cannot be set from register/profile payloads.

Roles: `CUSTOMER`, `SUPER_ADMIN`, `PRODUCT_MANAGER`, `ORDER_MANAGER`, `INVENTORY_MANAGER`, `CUSTOMER_SUPPORT` (support).

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| POST | `/auth/register/` | public | Issues JWT. Always creates `CUSTOMER`. |
| POST | `/auth/login/` | public | Email + password. Invalid credentials → 401. |
| POST | `/auth/refresh/` | public | Body `{ "refresh" }`. Rotates refresh. |
| POST | `/auth/logout/` | JWT | Blacklists the refresh token. |
| GET | `/auth/me/` | JWT | Current user/profile. No password or username. |
| GET/PATCH | `/auth/profile/` | JWT | Update `full_name`, `phone`, `date_of_birth`. Email/role read-only. |
| POST | `/auth/change-password/` | JWT | `{ current_password, new_password }`. Revokes old refresh; returns new JWT. |
| POST | `/auth/forgot-password/` | public | Always the same success message. |
| POST | `/auth/reset-password/` | public | `{ uid, token, new_password }`. |

Staff `/admin/*` routes require a staff role plus an area permission. Customers receive 403.

## Phase 2 catalog (public, read)

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/health/` | `{ "status": "ok" }` |
| GET | `/categories/` | Active; unpaginated (nav). `search`, `ordering` |
| GET | `/categories/{slug}/` | Retrieve |
| GET | `/brands/` | Active; unpaginated. `search`, `ordering` |
| GET | `/brands/{slug}/` | Retrieve |
| GET | `/products/` | Paginated. Filters below |
| GET | `/products/{id}/` | Retrieve by id |
| GET | `/products/{slug}/` | Retrieve by slug |

Product query params: `search`, `category` (slug), `brand` (slug), `min_price`, `max_price`, `featured`, `bestseller`, `in_stock`, `ordering` (`selling_price`, `created_at`, `name`), `page`, `page_size`. Staff may pass `include_inactive=true`.

Writes on `/products/` require JWT + a staff role with the `products` permission. Customers receive 401/403. Selling price cannot exceed MRP. `stock_quantity` is read-only; seed stock with `initial_quantity` on create, then use inventory APIs. DELETE deactivates the product so order history is preserved.

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| GET | `/products/` | public | Paginated list |
| POST | `/products/` | staff | Create |
| GET | `/products/{id}/` | public | Retrieve active; staff can retrieve inactive |
| PUT/PATCH | `/products/{id}/` | staff | Update. Prices validated server-side |
| DELETE | `/products/{id}/` | staff | Soft delete (`is_active=false`) |
| GET | `/products/{slug}/` | public | Storefront retrieve |
| GET/POST | `/products/{id}/images/` | GET public, POST staff | Product images |
| GET | `/categories/` | public | Active; unpaginated nav. `search`, `ordering` |
| GET | `/brands/` | public | Active; unpaginated. `search`, `ordering` |

## Phase 2 catalog (staff CRUD)

Prefix `/admin/`. Requires JWT + staff role + area permission.

| Path | Area | Operations |
| --- | --- | --- |
| `/admin/categories/` | categories | list (paginated), create |
| `/admin/categories/{id}/` | categories | retrieve, update, delete |
| `/admin/brands/` | categories | list, create |
| `/admin/brands/{id}/` | categories | retrieve, update, delete |
| `/admin/products/` | products | list, create |
| `/admin/products/{id}/` | products | retrieve, update, delete |
| `/admin/inventory/` | inventory | list, update quantity (not reserved) |
| `/admin/tax-classes/` | products | list, create |

Create product body (server validates `selling_price <= mrp`):

```json
{
  "name": "...",
  "sku": "...",
  "slug": "...",
  "description": "...",
  "short_description": "...",
  "mrp": "899.00",
  "selling_price": "599.00",
  "tax_class": 1,
  "category": 1,
  "brand": 1,
  "specifications": {},
  "initial_quantity": 25,
  "is_active": true
}
```

`stock_quantity` is read-only. `initial_quantity` seeds Inventory. Later stock changes use `/admin/inventory/{id}/`.

## Checkout

JWT required. Totals are calculated only by `PricingService` from the **server cart**, live product prices, tax class, destination address, and coupon. Client `subtotal`, `grand_total`, line prices, and `items` are rejected.

| Method | Path | Notes |
| --- | --- | --- |
| GET/POST | `/auth/addresses/` | List/create. PIN must be 6 digits; mobile 10 digits; India only. |
| GET/PATCH/DELETE | `/auth/addresses/{id}/` | Owner only. |
| POST | `/checkout/preview/` | `{ shipping_address_id, billing_address_id?, coupon_code? }`. Returns lines + subtotal, discount, GST, shipping, grand total. Does not create an order or reserve stock. |
| POST | `/orders/` | Same body. Creates `PENDING` order from the cart, snapshots addresses, reserves stock, opens a payment session. Does not accept a client payment status. |
| POST | `/payments/mock/complete/` | Local mock only. `{ provider_payment_id, outcome: success\|failed\|cancelled }`. Emits a signed event into the webhook pipeline. |
| POST | `/payments/webhook/` | Provider callback. `X-Nexora-Signature` HMAC of the raw body. Verifies amount against `order.grand_total`. |
| POST | `/checkout/verify-payment/` | `{ provider_payment_id }`. Re-reads provider status. Cannot mark paid from a client flag. |
| POST | `/checkout/quote/` | Legacy quote by `shipping_state`. Prefer preview. |

## Orders

JWT required. Customers see **only their own** orders. Order status and payment status are separate; only the server may change them.

Statuses: `PENDING`, `CONFIRMED`, `PROCESSING`, `PACKED`, `SHIPPED`, `OUT_FOR_DELIVERY`, `DELIVERED`, `CANCELLED`, `RETURN_REQUESTED`, `RETURNED`, `REFUND_PENDING`, `REFUNDED`.

Payment: `PENDING`, `AUTHORIZED`, `PAID`, `FAILED`, `REFUNDED`, `PARTIALLY_REFUNDED`.

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/orders/` | Paginated list for the authenticated customer. |
| GET | `/orders/{id}/` | Detail, items, payments, shipment tracking. 404 if not the owner. |
| POST | `/orders/{id}/cancel/` | Allowed while `PENDING`, `CONFIRMED`, `PROCESSING`, or `PACKED`. Unpaid → payment `FAILED`. Paid → payment stays `PAID`. |

Staff change fulfillment with `POST /admin/orders/{id}/status/` (`{ "status": "..." }`). `payment_status` is rejected on that endpoint.

Payment providers implement `PaymentGateway` in `apps/orders/payments.py`. Local default is `PAYMENT_PROVIDER=mock`. Credentials: [payments.md](payments.md). Do not send card numbers.

## Other `/api/v1/` routes (present, later phases)

Auth, cart, checkout, orders, coupons, reviews, notifications, contact, remaining admin reports/shipping. Live Razorpay capture stays off until `RAZORPAY_*` secrets are set on the server.

## Rules

1. Do not trust client product price, discount, GST, inventory, payment status, or order total.
2. Payment status is set only after backend verification.
3. Inventory available = on-hand − reserved.
