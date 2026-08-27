# Payments

The store never trusts the browser to mark a payment as paid.

```
Customer → Checkout → Backend creates order + payment
        → Payment provider
        → Customer pays
        → Provider webhook (signed)
        → Backend verifies signature and amount
        → Backend updates Payment, then Order
```

## Local development (mock)

Set these in the **project root** `.env` (copied from `.env.example`). Django also reads `backend/.env`.

```
PAYMENT_PROVIDER=mock
PAYMENT_WEBHOOK_SECRET=a-long-random-string
PAYMENT_CURRENCY=INR
```

`PAYMENT_WEBHOOK_SECRET` is the HMAC key for mock webhooks. It must never be sent to the frontend or committed with a real production value.

Mock checkout calls `POST /api/v1/payments/mock/complete/` (authenticated owner). That endpoint only exists when `PAYMENT_PROVIDER=mock`. It builds a signed provider event and runs the **same** `process_provider_event` path as the public webhook.

Public webhook: `POST /api/v1/payments/webhook/`  
Header: `X-Nexora-Signature: <hmac-sha256 of raw body>`

## Production credentials

Do **not** put live keys in frontend code, git, or `VITE_*` variables.

Configure them only in the server environment (or a secrets manager that injects env vars), using the names below.

| Variable | Where | Purpose |
| --- | --- | --- |
| `PAYMENT_PROVIDER` | server `.env` / host secrets | `mock` locally; `razorpay` when the live adapter is enabled |
| `PAYMENT_WEBHOOK_SECRET` | server secrets | Mock (and generic HMAC) webhook signing |
| `PAYMENT_CURRENCY` | server `.env` | Default `INR` |
| `RAZORPAY_KEY_ID` | server secrets | Razorpay key id |
| `RAZORPAY_KEY_SECRET` | server secrets | Razorpay key secret (server only) |
| `RAZORPAY_WEBHOOK_SECRET` | server secrets | Razorpay webhook HMAC secret |

Code reads these in `backend/config/settings.py`. The adapter registry is `apps.orders.payments.PROVIDERS`. Adding Stripe later means a new adapter class plus `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` in the same settings file — not a change to checkout totals or order status rules.

Live Razorpay capture is not turned on until those three `RAZORPAY_*` values are set **and** `PAYMENT_PROVIDER=razorpay`. Until then keep `PAYMENT_PROVIDER=mock`.

## Idempotency

Each webhook `event_id` is stored on `PaymentWebhookEvent` (unique). A duplicate delivery returns `already_processed: true` and does not recapture stock or re-mark the order paid.
