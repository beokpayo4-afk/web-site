# Architecture

Nexora is an original full-stack e-commerce platform. The reference site (buslinfresh.com) is used only to understand typical customer IA: home, shop, category, product, cart, account, and policy pages. This project must not copy that site’s source, logo, images, product copy, or other protected assets.

Business context from the company MOA (private): e-commerce, online trading, digital marketplace, retail, distribution, logistics, warehousing, payments, and customer support. Public pages must not expose private incorporation data from the MOA.

Public brand: **Nexora** (original). Domain of the catalogue: electronics and compact home appliances, with original product names and descriptions.

## 1. Repository structure (current)

```
web site/
├── .env / .env.example     # local secrets; never commit .env
├── .gitignore
├── README.md
├── docs/                   # this architecture set
├── backend/                # Django + DRF
│   ├── manage.py
│   ├── requirements.txt
│   ├── config/             # settings, urls, wsgi, asgi
│   └── apps/
│       ├── accounts/       # users, JWT, addresses
│       ├── catalog/        # products, categories, tax, inventory
│       ├── commerce/       # cart, wishlist
│       ├── orders/         # orders, payments, coupons, shipping
│       ├── engagement/     # reviews, notifications, contact
│       ├── dashboard/      # staff APIs, reports
│       └── common/         # errors, pagination, permissions
└── frontend/               # Vite + React + TypeScript
    └── src/
        ├── components/     # layout, ui, product
        ├── hooks/
        ├── lib/            # axios client, tokens, formatters
        ├── pages/
        ├── services/       # typed API layer
        └── types/
```

The repo is **not empty**. It is a **partial production slice**: models, versioned APIs, a customer storefront, a staff shell, PostgreSQL wiring, and a small Django test suite already exist. Git is not initialized in this workspace.

## 2. What already exists vs remaining

| Area | Status |
| --- | --- |
| Monorepo, env examples, Vite/Django scaffold | Done |
| PostgreSQL as runtime DB; SQLite for tests | Done |
| JWT auth, register/login/refresh/logout, password reset | Done |
| Catalog models, search/filter/sort, seed data | Done |
| Customer pages listed below | Done (storefront) |
| Cart, checkout quote, mock payment verify | Done |
| Orders, inventory reserve/commit | Done |
| Wishlist, reviews, coupons, in-app notifications | Done (backend + basic UI) |
| Admin APIs + role matrix | Done |
| Admin create/edit forms, image upload UI | Partial / missing |
| Guest cart, live PSP, email provider, sitemap | Missing |
| Docker, CI, production deploy | Missing |
| Broad automated tests / E2E | Partial |

Do not rebuild working checkout, pricing, or auth. Extend them.

## 3. Frontend architecture (required)

Stack: React 19, TypeScript, Vite, Tailwind CSS 4, React Router 7, Axios, TanStack Query, React Hook Form, Zod.

Rules:

- Functional components only; keep pages thin.
- Presentation in `components/`; server calls only in `services/`.
- Typed DTOs in `types/api.ts`.
- Validate user input with Zod on forms; still treat the API as the source of truth for money.
- Query keys: `['me']`, `['products', query]`, `['cart']`, `['orders']`, `['admin-*']`.
- Access JWT in `sessionStorage`; refresh in `localStorage` today. Target: httpOnly refresh cookie (Phase 18).
- Route guards: `RequireAuth`, `RequireStaff`.

## 4. Backend architecture (required)

Stack: Python 3.10+, Django 5.2, DRF, SimpleJWT, django-filter, CORS, PostgreSQL.

Rules:

- Versioned API under `/api/v1/`.
- Custom `User` with email as `USERNAME_FIELD`.
- Passwords hashed by Django; never logged.
- `PricingService` is the only calculator for price, discount, GST, shipping, grand total.
- `InventoryService` is the only mutator of on-hand/reserved stock.
- Payment gateway is an interface (`MockPaymentGateway` today).
- Staff endpoints require role **and** `permission_area`.
- Errors use a consistent envelope (`apps/common/exceptions.py`).
- Throttles: anon 60/min, user 120/min, auth 10/min.

## 5–20. Domain architecture

See companion files:

- Database design → [database.md](database.md)
- HTTP API → [api.md](api.md)
- Local run → [setup.md](setup.md)
- Phased roadmap (1–20) → [development-plan.md](development-plan.md)

### Authentication

Email + password → JWT access (30 min) + refresh (7 days, rotation + blacklist). Roles: `CUSTOMER`, `SUPER_ADMIN`, `PRODUCT_MANAGER`, `ORDER_MANAGER`, `INVENTORY_MANAGER`, `CUSTOMER_SUPPORT`. Password reset uses Django tokens and the console email backend in development.

### Product / catalog

`Product` has name, SKU, slug, descriptions, MRP, selling price, `TaxClass`, stock snapshot, category, brand, specifications JSON, active/featured/bestseller flags, timestamps. Discount is derived (`mrp - selling_price`), never trusted from the client. GST is per tax class (CGST+SGST vs IGST by destination state).

### Cart

Authenticated `Cart` / `CartItem`. Quantity cannot exceed available stock. Guest cart is a later addition (merge on login).

### Checkout

Server quote → create `PENDING` order from **server cart**, snapshot addresses, reserve stock, open payment session. Client cannot submit line prices.

### Orders

Order status and payment status are separate. Status machine is in `apps/orders/services.py`.

### Payments

Abstract provider (`PaymentGateway`). Mock flow: signed webhook, amount checked against `order.grand_total`, idempotent `event_id`. The frontend cannot set payment status. Production keys: [payments.md](payments.md).

### Inventory

`Inventory.quantity` and `reserved_quantity`; available = quantity − reserved. Reserve on order create, commit on paid, release/restock on cancel.

### Reviews / coupons / notifications / shipping

Models and APIs exist. Reviews auto-approve only after a delivered order. Coupons validated server-side. Notifications are in-app (+ broadcast). Each paid order gets a `Shipment` with tracking number and event log.

## 21. SEO

Current: semantic HTML, unique title/description on index, slug URLs.

Required later: per-route titles, Open Graph, JSON-LD Product, `sitemap.xml`, `robots.txt`, canonical URLs, SSR or prerender for key landing pages if organic search becomes a goal.

## 22. Security

Implemented: hashed passwords, JWT, CORS allowlist, CSRF middleware, server-side money/tax/stock, payment signature check, role permissions, auth throttling, `.env` gitignored.

Required later: httpOnly cookies, rate-limit login by IP, audit log, CSP, HTTPS-only cookies, secrets manager, no DEBUG in production, file-upload validation.

Never trust the frontend for: product price, discount, GST, inventory, payment status, order total.

## 23. Testing

Current: Django tests for register/login, catalog, quote math, payment reject/accept, admin 403 vs 200. Frontend: `oxlint`, `tsc -b`, Vite production build.

Required: permission matrix tests, coupon edge cases, inventory race tests, Playwright checkout smoke, axe accessibility on forms.

## 24. Deployment

Not started. Target: containerized API (Gunicorn + WhiteNoise or nginx), static SPA on a CDN or nginx, managed PostgreSQL, env-based secrets, GitHub Actions (lint, test, migrate), object storage for product images.

## Constraints

- Original implementation and original catalogue only.
- Do not scrape or reproduce protected content from the reference website.
- Do not expose MOA private information on the public site.
- Work phase-by-phase; do not rewrite working modules without a documented reason.
