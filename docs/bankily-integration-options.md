# Bankily Integration Options

This document describes Bankily-ready tenant rent payment UX without assuming
that Bankily supports verified app-to-app deep-link confirmation.

## Ideal Client Flow

The desired product flow is:

1. Tenant taps `Payer`.
2. ATouPay opens Bankily.
3. Landlord Bankily recipient is prefilled.
4. Rent amount is prefilled.
5. Tenant completes payment in Bankily.
6. Tenant returns to ATouPay.
7. ATouPay verifies the payment through a trusted backend/provider signal.
8. ATouPay generates the rent receipt.

The key dependency is step 7. ATouPay must not generate a receipt from the app
return alone.

## Technical Dependency

Public Bankily information confirms consumer transfers, QR/NFC payment,
merchant code/QR payment, and USSD-style payment paths.

Needs confirmation from Bankily/BPM:

- whether Bankily has official app-to-app deep links
- whether a deep link can safely prefill recipient and amount
- whether the return to ATouPay includes a verifiable transaction result
- whether a backend API or webhook can confirm a transaction
- whether official merchant/payment references can be carried end to end

Until those are confirmed, ATouPay must treat direct Bankily app opening as a
manual/proof workflow.

## Capability Modes

`BankilyIntegrationMode`:

- `not_configured`: owner has no Bankily payment details configured.
- `qr_or_code_manual`: default. Show owner Bankily phone/merchant code/QR,
  amount, and unique ATouPay reference. Tenant can open Bankily manually and
  submit reference/proof. Receipt requires owner/agency confirmation.
- `deep_link_unverified`: development/preview testing only. Opens a configured
  template but never marks paid from return.
- `deep_link_confirmed`: requires official Bankily/BPM docs for template,
  return handling, and backend verification. Receipt only after backend-verified
  payment status.
- `moosyl_provider`: use the existing Moosyl provider intent/webhook flow.

Default mode: `qr_or_code_manual`.

## Fallback QR/Code Manual Mode

In `qr_or_code_manual`, tenant UI should show:

- Bankily recipient phone number, merchant code, or QR image URL if configured
- rent amount
- unique ATouPay reference
- button: `Ouvrir Bankily`
- instruction: `Après paiement, ajoutez la référence ou une preuve.`

Rules:

- opening Bankily does not mark rent paid
- returning to ATouPay does not mark rent paid
- tenant proof submission does not generate a receipt
- owner or agency confirmation can generate the receipt

Screenshot/photo proof:

- tenants can attach a screenshot/photo after paying outside ATouPay
- tenants must enter the unique ATouPay reference shown on the rent payment
- tenants must declare amount, MRU currency, payment date, payment method, and
  transaction reference/screenshot/note
- backend risk checks compare submitted reference, amount, currency, and date
- the app uploads the image to Firebase Storage when configured
- the backend stores only proof metadata on the support/proof record:
  `proofImageStoragePath`, `proofImageFileName`,
  `proofImageOriginalFileName`, `proofImageContentType`,
  `proofImageSizeBytes`, and `proofSubmittedAt`
- proof images use `paymentProofs/{agencyId}/{paymentId}/{tenantId}/{fileName}`
- proof image public download URLs are not stored in backend records
- allowed image types are JPG, PNG, and WebP, with a 5 MB limit
- screenshot proof is supporting evidence only
- screenshot proof is not Bankily/provider verification
- high-risk proof can be submitted but requires agency review; agency override
  reason is required before high-risk confirmation
- owner Bankily details must be agency-verified before tenants can use direct
  Bankily/QR details
- owner reminders are generated after 24 hours and agency escalation becomes
  available after 48 hours
- rent receipts must not embed the screenshot
- receipt generation still requires owner or agency confirmation

Receipt wording:

```text
Paiement déclaré par le locataire et confirmé par le propriétaire.
```

Agency fallback confirmation uses:

```text
Paiement déclaré par le locataire et confirmé par l’agence après vérification.
```

## Moosyl Provider Mode

In `moosyl_provider`, Bankily can be surfaced through the existing Moosyl
tenant rent provider flow if Moosyl supports the relevant Bankily payment
rails.

Rules:

- backend creates the provider intent
- backend verifies provider webhook/status
- duplicate webhooks are idempotent
- failed/cancelled callbacks do not create receipts
- receipt wording is:

```text
Paiement confirmé par le prestataire de paiement.
```

## Why Receipts Require Confirmed Payment

A rent receipt is an authoritative ATouPay record. If ATouPay generated a
receipt from an app return alone, a tenant could leave Bankily without paying
and still create proof of payment. Therefore:

- app return is not proof
- frontend success callback is not proof
- tenant-entered reference is not proof
- screenshot/proof submission is not proof by itself
- backend/provider confirmation or owner/agency confirmation is required

## Questions For Bankily/BPM

- Is there an official Bankily mobile deep-link scheme or universal/app link?
- What parameters are supported for recipient, merchant code, amount, currency,
  and reference?
- Is there a signed return payload to the originating app?
- Is there a backend API to verify transaction status by reference?
- Are webhooks available for merchant payments?
- Can duplicate callbacks happen, and what idempotency key is guaranteed?
- Can ATouPay use a unique payment reference visible to owner/agency?
- What are supported currencies and limits?
- What is the refund/dispute process?
- What production credentials and merchant approval are required?
