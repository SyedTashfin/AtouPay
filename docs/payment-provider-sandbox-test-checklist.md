# Payment Provider Sandbox Test Checklist

Use this checklist before any Moosyl sandbox or pilot validation. This project
must not use live credentials until the live-payment decision record is approved.

## Environment

- `PAYMENT_PROVIDER=moosyl`
- `PAYMENT_LIVE_MODE=false`
- `PAYMENT_PROVIDER_LIVE_ACK=` blank for sandbox testing
- `MOOSYL_SECRET_KEY=sk_test_placeholder`
- `MOOSYL_PUBLISHABLE_KEY=pk_test_placeholder`
- `MOOSYL_WEBHOOK_SECRET=whsec_test_placeholder`
- `PUBLIC_API_URL=http://127.0.0.1:3001`
- `PUBLIC_APP_URL=http://127.0.0.1:8081`

Keep real values in protected runtime config only. Do not commit `.env` files or
provider dashboard screenshots containing keys.

## Backend and App

- Start the backend: `cd backend && npm run dev`
- Start the app with the local backend URL.
- Sign in as an existing tenant assigned to a payable rent record.
- Create a tenant rent payment intent from the tenant payment screen.
- Confirm the intent returns `provider=moosyl`, `currency=MRU`, and a transaction ID.
- Confirm the response does not include `MOOSYL_SECRET_KEY` or `MOOSYL_WEBHOOK_SECRET`.

## Sandbox Payment Flow

- Complete the sandbox provider flow in the Moosyl interface or checkout.
- Confirm the frontend shows a pending/processing state until backend status changes.
- Confirm frontend callbacks only refresh backend status and do not mark rent paid.
- Confirm the webhook reaches `POST /v1/webhooks/moosyl`.
- Confirm `GET /v1/payments/{paymentId}/status` returns the provider-confirmed state.
- Confirm the rent receipt is generated exactly once.

## Webhook Replay

- Replay a paid fixture:
  `cd backend && MOOSYL_WEBHOOK_SECRET=whsec_test_placeholder npm run webhook:replay:moosyl -- tests/fixtures/moosyl/webhook-paid.json --event-type payment-updated --url http://127.0.0.1:3001/v1/webhooks/moosyl`
- Replay the same paid fixture again and confirm no duplicate receipt or ledger mutation.
- Replay `webhook-failed.json` and confirm no receipt is created.
- Replay `webhook-cancelled.json` and confirm no receipt is created.
- Replay `webhook-amount-mismatch.json` and confirm the payment is not marked paid.
- Replay `webhook-currency-mismatch.json` and confirm the payment is not marked paid.

## Financial Invariants

- Confirm tenant fee remains zero.
- Confirm platform rent fee remains zero.
- Confirm agency fee remains zero.
- Confirm commission rate remains zero.
- Confirm owner receivable equals rent amount.
- Confirm the owner access fee does not appear anywhere in the tenant payment screen.
- Confirm the owner access fee does not appear anywhere in the rent receipt.

## Stop Conditions

- Stop testing if any live key is present in logs, app output, fixtures, or committed files.
- Stop testing if any rent receipt mentions commission, platform fee, tenant fee, or owner access fee.
- Stop testing if a frontend success callback can mark rent paid without backend confirmation.
- Stop testing if duplicate paid webhooks create duplicate receipts.
