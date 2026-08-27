# Development plan

Work phase-by-phase. A phase is complete only when UI, API, persistence, validation, authz, errors, and checks for that slice all work. Do not copy the reference website. Do not rebuild modules that already pass their exit criteria.

Status key: **Done** · **Partial** · **Todo**

---

## Phase 1 — Project foundation

**Status: Done**

- Monorepo `frontend/`, `backend/`, `docs/`
- Vite + React + TypeScript + Tailwind
- ESLint (flat config) + Prettier
- Django + DRF, PostgreSQL via `DATABASE_URL`, CORS for Vite
- `GET /api/v1/health/` → `{ "status": "ok" }`
- Application shell: Header, Footer, main layout, Home, React Router
- Initial Axios API service (`src/lib/api.ts`, `src/services/health.ts`)

Exit: both apps boot; env files exist; health check passes; frontend lint/typecheck pass.

**Remaining (later phases, not this slice):** GitHub remote, Docker Compose.

---

## Phase 2 — Database and Django backend foundation

**Status: Done**

- Apps covering users, catalog, inventory, cart, orders, payments, reviews, coupons, notifications, shipping
- PostgreSQL models with FKs, indexes, unique/check constraints, timestamps
- Public read APIs for categories, brands, products (pagination/search/filter)
- Staff CRUD for categories, brands, products, inventory
- Django admin registrations
- Order money fields read-only; inventory seeded via `initial_quantity`

Exit: `migrate` on PostgreSQL; `manage.py check`; catalog + existing tests pass.

**Out of scope:** live payment gateway, admin SPA, customer storefront work.

---

## Phase 3 — Authentication

**Status: Done**

- Register, login, logout, JWT access + refresh, `/auth/me/`, `/auth/profile/`, change password
- Forgot/reset password architecture (console email in development)
- Django password hashing and validators
- Roles and staff area permissions; customers cannot access admin APIs
- Frontend: login, register, forgot/reset password, account/profile, AuthContext, protected + guest routes
- Expired access token refresh; invalid credentials and validation errors surfaced in the UI

Exit: customer can register and reach a protected account route; staff token is rejected from customer-only mistakes and vice versa.

**Out of scope for this phase:** checkout, payment, email verification, httpOnly refresh cookie.

---

## Phase 4 — Product and category management

**Status: Done**

- Product, ProductImage, Category, Brand, Inventory, TaxClass (GST)
- Unique SKU/slug; selling price cannot exceed MRP; stock cannot go negative
- Public list/detail plus staff POST/PUT/PATCH/DELETE on `/api/v1/products/`
- DELETE deactivates products so order lines stay intact
- Shop, category, product card/grid/details, search, filters, sort, pagination

Exit: staff can add an original product and it appears on the shop; visitors can browse, filter, and open details.

---

## Phase 5 — Customer storefront

**Status: Done (first version)**

Done: Home, Shop, Category, About, Contact, FAQ, policy pages, header/footer, mobile cart bar, original branding.

Todo: richer merchandising blocks, CMS-driven banners (optional).

Exit: visitor can navigate IA without an account.

---

## Phase 6 — Product details, search, filtering

**Status: Done (first version)**

Done: product detail, search `q`, category/brand/price/stock filters, sort, review list/create.

Todo: pagination controls in the UI, facet counts, image gallery when files exist.

---

## Phase 7 — Cart

**Status: Partial (auth cart Done)**

Done: get/add/update/remove; stock checks.

Todo: guest cart + merge on login.

Exit: signed-in user can persist a bag across refresh.

---

## Phase 8 — Checkout and addresses

**Status: Done (first version)**

Done: address CRUD, server quote (tax + shipping + coupon), checkout from server cart.

Todo: billing ≠ shipping UX polish; PIN validation library.

---

## Phase 9 — Orders

**Status: Partial (core Done)**

Done: order list/detail, cancel in allowed states, status machine, snapshots.

Todo: customer return-request action (`RETURN_REQUESTED`), invoice PDF.

---

## Phase 10 — Payment integration abstraction

**Status: Done for mock + webhook architecture**

Done: `PaymentGateway` adapters, mock provider, signed webhook, idempotent `event_id`, amount check, failure/cancel, env-only credentials. Live Razorpay capture waits on `RAZORPAY_*` secrets.

Todo: live Razorpay/Stripe capture and refunds through the provider API.

---

## Phase 11 — Inventory

**Status: Partial (engine Done)**

Done: reserve/commit/release/restock; low-stock count on dashboard.

Todo: admin quantity edit form; low-stock alerts; optional multi-warehouse.

---

## Phase 12 — Wishlist and reviews

**Status: Done (first version)**

Done: wishlist APIs/UI; reviews with moderation; delivered orders auto-approve.

Todo: review photos; “verified purchase” badge in UI.

---

## Phase 13 — Coupons / offers

**Status: Partial**

Done: coupon model, validate, apply in PricingService, seed `NEXORA10`, admin list.

Todo: admin create/edit form; featured offer banners on home (original copy only).

---

## Phase 14 — Notifications

**Status: Partial**

Done: in-app notifications on order events; broadcast API; account inbox.

Todo: real email/SMS provider; preference center; do not log message bodies with PII in production.

---

## Phase 15 — Shipping / tracking

**Status: Partial**

Done: Shipment row, tracking number, events on status transitions, order-detail display.

Todo: customer-friendly timeline component; carrier integration later; admin shipping editor (not JSON dump).

---

## Phase 16 — Admin dashboard

**Status: Partial**

Done: `/admin` shell, RBAC, summary tiles, list views for products/orders/customers/reviews/coupons, status prompt, broadcast form.

Todo: proper create/edit screens, filters, confirmation dialogs, accessible tables. This is the highest-leverage remaining UI work.

---

## Phase 17 — Reports

**Status: Partial**

Done: `/admin/reports/` JSON (daily revenue, top products, status breakdown).

Todo: charts, date range, CSV export, GST summary.

---

## Phase 18 — Security, performance, SEO

**Status: Partial**

Done: hashed passwords, JWT, CORS, throttles, server-side money, `.env` ignored.

Todo: httpOnly cookies, CSP, HTTPS flags, image CDN, query indexes review, per-page meta, sitemap/robots, Lighthouse pass.

---

## Phase 19 — Testing

**Status: Partial**

Done: 7 Django API tests (auth, catalog, checkout math, payment verify, admin 403); frontend lint + typecheck + build.

Todo: move tests out of `accounts/tests.py` into domain modules; permission matrix; inventory concurrency; Playwright checkout; axe on forms.

---

## Phase 20 — Production deployment

**Status: Todo**

- Docker / compose or PaaS
- Gunicorn + reverse proxy
- Managed PostgreSQL
- Object storage for media
- GitHub Actions: lint, test, migrate
- Secrets manager; `DEBUG=false`
- Domain, TLS, backups

---

## Recommended sequence from today

Do **not** restart at Phase 1. The storefront and checkout already work.

1. Use the commands in [setup.md](setup.md) to run what exists.
2. Next implementation (when authorized): **Phase 16 + remaining Phase 4** — admin product/category create-edit and product image upload. Smallest complete step; unblocks merchandising without touching pricing.
3. Then Phase 9 return flow, Phase 10 live payments (only with real env secrets), Phase 19 tests, Phase 20 deploy.

## Phase rules

1. Inspect existing code before changing architecture.
2. State what will change and its dependencies.
3. Implement the smallest complete vertical step.
4. Run backend tests + frontend lint/typecheck.
5. Fix failures before the next phase.
6. Update these docs if the architecture changes.
7. Wait for the next explicit feature request before expanding scope.
