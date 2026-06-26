# Payment Provider Readiness

This document is the live-provider readiness checklist for ATouPay billing. It does not approve production money movement.

## Current State

- Tenant rent payments use a provider-agnostic backend module.
- The default provider is still `simulated`.
- Moosyl is implemented as the first real adapter for tenant rent payment intents only.
- Moosyl must be test/sandbox mode until production launch decisions are approved.
- Owner account access fee payment is simulated or manually recorded by an agency admin only.
- No live debit, transfer, payout, card charge, mobile-money charge, or settlement is enabled by default.
- Provider-confirmed rent completion must come from backend-confirmed provider state or verified webhook, never frontend success alone.
- Tenant rent payments and owner account access fees are separate financial objects.
- Rent receipts are rent receipts only. They must not include owner access fees.

## Provider Candidates

- Moosyl: implemented first for Mauritania-local tenant rent payment intents; supports MRU amounts and Mauritania banking apps such as Bankily, Sedad, Masrivi, BimBank, and Click.
- Stripe: candidate only if card billing or subscription billing is chosen later.
- Manual agency confirmation: acceptable for a controlled pilot phase when the agency confirms owner access fee payment outside ATouPay and records it in the backend.

## Required Decisions Before Live Payments

- Merchant of record: decide whether ATouPay, the agency, the owner, or a provider-managed merchant receives and owns the payment relationship.
- Currency: decide whether the owner access fee is charged in EUR or as an approved MRU equivalent.
- Provider fee schedule: document provider fees, taxes, payout fees, refund fees, chargeback fees, and who absorbs each cost.
- Refund process: define who can approve a refund, where it is recorded, and what happens to owner account access after a refund.
- Dispute process: define chargeback/dispute ownership, evidence handling, deadlines, and account status during disputes.
- Reconciliation process: define how ATouPay records are matched to provider statements, including duplicate callbacks, missing callbacks, partial failures, and manual corrections.
- App-store policy decision: decide whether the owner access fee is allowed through the intended mobile distribution model and whether web-only payment, in-app purchase, or another approved flow is required.
- Moosyl launch mode: confirm test keys, webhook endpoint, supported status payloads, payout timing, and whether live keys are approved.

## Separation Warning

Tenant rent payments and owner access fees must remain separate.

- Do not deduct the owner access fee from rent.
- Do not add the owner access fee to tenant totals.
- Do not mention the owner access fee on rent receipts.
- Do not describe owner access fees as agency commission.
- Do not create rent ledger records for owner access fee payments.

## Production Readiness Gate

Before live provider mode is enabled, confirm:

- backend provider credentials are stored only in a secret manager or equivalent protected runtime config
- provider confirmation comes from backend-verified provider callbacks or backend-controlled confirmation, not frontend success screens
- idempotency keys are implemented for provider payment attempts and callbacks
- webhook signature verification and replay protection are implemented
- refund, dispute, reconciliation, audit log, and support workflows are tested
- production app UI does not show simulated payment actions
- production app UI does not show external payment links unless the payment strategy has been approved

## Implemented Safety Controls

- `PAYMENT_PROVIDER=simulated|moosyl`
- `PAYMENT_LIVE_MODE=false` by default
- production blocks Moosyl real-provider calls while live mode is false
- Moosyl config requires backend-only secret key, webhook secret, publishable key, and public URLs
- Moosyl webhook signature verification uses the raw request body
- duplicate Moosyl paid webhooks are idempotent
- amount or currency mismatches are flagged in reconciliation records and do not mark rent paid
- failed and cancelled provider states do not generate receipts

## Still Not Implemented

- live owner access fee payment
- automatic refunds
- dispute resolution workflow
- provider payout reconciliation dashboard
- StoreKit, Google Play Billing, RevenueCat, Stripe, or production owner-fee external payment links
