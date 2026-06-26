# Tenant Rent Payment Module: Moosyl

This module is for tenant rent payments only. It does not enable live owner account access fee payment.

## Current State

- `PAYMENT_PROVIDER=simulated` remains the default.
- `PAYMENT_PROVIDER=moosyl` enables the Moosyl adapter for tenant rent payment intents only.
- `PAYMENT_LIVE_MODE=false` is the default.
- In production, real-provider calls are blocked while `PAYMENT_LIVE_MODE=false`.
- No Stripe, StoreKit, Google Play Billing, RevenueCat, or owner-fee external payment links are implemented.

## Environment Variables

Backend-only:

```dotenv
PAYMENT_PROVIDER=moosyl
PAYMENT_LIVE_MODE=false
PAYMENT_PROVIDER_LIVE_ACK=
MOOSYL_SECRET_KEY=sk_test_placeholder
MOOSYL_WEBHOOK_SECRET=whsec_test_placeholder
PUBLIC_APP_URL=https://app.dev.example
PUBLIC_API_URL=https://api.dev.example
```

Safe to return to the app when Moosyl is selected:

```dotenv
MOOSYL_PUBLISHABLE_KEY=pk_test_placeholder
```

Do not put `MOOSYL_SECRET_KEY` or `MOOSYL_WEBHOOK_SECRET` in Expo public env vars.

## Flow

1. Tenant calls `POST /v1/payments/{paymentId}/intent`.
2. Backend verifies tenant scope and payable rent status.
3. Backend creates or reuses an idempotent `paymentIntents/{intentId}` record.
4. Backend creates the Moosyl payment request using the secret key.
5. App receives only safe fields: provider, status, amount, currency, transaction ID, checkout URL if present, and publishable key if needed.
6. App refreshes backend status after any frontend callback or checkout return.
7. Backend marks rent paid only after backend-confirmed provider status or verified webhook.

## Webhooks

Endpoint:

```text
POST /v1/webhooks/moosyl
```

Requirements:

- verify `x-webhook-signature` with `MOOSYL_WEBHOOK_SECRET`
- read `x-webhook-event`
- verify the HMAC over the raw request body
- store every webhook attempt in `paymentWebhookEvents`
- handle duplicate delivery idempotently
- ignore unknown events safely
- never create duplicate receipts for repeated paid callbacks

Known event types:

- `payment-request-created`
- `payment-request-updated`
- `payment-created`
- `payment-updated`

## Ledger Invariants

Every new tenant rent payment intent and confirmed rent payment keeps:

```text
tenantFeeAmount = 0
platformRentFeeAmount = 0
agencyFeeAmount = 0
commissionRate = 0
ownerNetAmount = rentAmount
ownerReceivableAmount = rentAmount
```

The owner access fee is a separate financial object and must never appear on tenant rent screens, rent receipts, rent ledgers, or provider rent metadata.

## Moosyl Notes

- Payment requests are created by the backend with a secret key.
- The frontend/mobile flow uses a publishable key plus `transactionId`.
- Supported Mauritania banking apps include Bankily, Sedad, Masrivi, BimBank, and Click.
- Moosyl currently supports MRU for payment amounts.
- Moosyl refunds are not automated in ATouPay because refund support is not available in the current Moosyl facts for this implementation.

## Local Sandbox Testing

Start the backend locally:

```bash
cd backend
npm install
npm run dev
```

Start the Expo app in another terminal with the API URL pointing at the backend.
Use test Firebase data and Moosyl test keys only.

Live mode is intentionally guarded. If a future approved live Moosyl rollout sets
`PAYMENT_LIVE_MODE=true`, backend startup also requires:

```dotenv
PAYMENT_PROVIDER_LIVE_ACK=I_UNDERSTAND_LIVE_MONEY_MOVEMENT
```

Do not set that acknowledgement during sandbox testing.

## Local Webhook Testing

Use a tunnel for local development:

```bash
ngrok http 3001
```

Configure Moosyl dashboard webhook URL:

```text
https://<tunnel-host>/v1/webhooks/moosyl
```

Replay a local fixture against the backend:

```bash
cd backend
MOOSYL_WEBHOOK_SECRET=whsec_test_placeholder npm run webhook:replay:moosyl -- tests/fixtures/moosyl/webhook-paid.json --event-type payment-updated --url http://127.0.0.1:3001/v1/webhooks/moosyl
```

The replay utility signs the exact fixture bytes with HMAC-SHA256 and sends:

```text
x-webhook-event: payment-updated
x-webhook-signature: sha256=<computed-signature>
```

It prints only the HTTP status and response body. It never prints the webhook
secret.

To confirm duplicate webhook idempotency:

1. Create a Moosyl rent payment intent in the app or API.
2. Replay the matching paid fixture once and confirm the payment becomes paid.
3. Replay the same fixture again.
4. Confirm `paymentWebhookEvents` records the duplicate safely and the rent
   receipt count for that payment remains exactly one.

To verify receipt generation exactly once, check `GET /v1/payments/{paymentId}/status`
and the `receipts` collection for the same `paymentId`. The receipt should say
the payment was confirmed by the payment provider and must not mention owner
access fees, commissions, tenant fees, or platform fees.

Use test keys only. Do not commit keys to this public repository.

## Production Launch Checklist

- confirm merchant of record
- confirm whether rent is collected by ATouPay, agency, owner, or provider-managed merchant
- confirm Moosyl fee schedule and payout timing
- confirm refund and dispute process
- confirm reconciliation process for duplicate, missing, and mismatched callbacks
- move secrets to protected runtime configuration
- test webhook signature verification with raw body in the deployed environment
- run a small pilot with test/sandbox mode before live credentials
- keep owner access fee payment disabled unless a separate approved strategy exists
