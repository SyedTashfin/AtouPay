# ATouPay Backend API V1 Draft

This document defines the first backend slice to introduce on top of the current Firebase-based mobile app.

## Design Assumptions

- Firebase Authentication remains the login system
- the mobile app sends a Firebase ID token in `Authorization: Bearer <token>`
- the backend verifies the token with Firebase Admin SDK
- Firestore remains the primary data store
- tenant rent payments use a provider-agnostic backend payment module
- `PAYMENT_PROVIDER=simulated` remains the default provider
- `PAYMENT_PROVIDER=moosyl` enables Moosyl test/sandbox rent payment intents when required backend env vars are present
- `PAYMENT_LIVE_MODE=false` is the default, and production blocks real-provider calls while live mode is false
- tenants pay rent only
- ATouPay charges no tenant fee
- rent payments are not commission-split
- owners pay a separate 10 EUR account access fee every 6 weeks
- owner account fees are separate from rent payments, rent receipts, and tenant screens
- real owner-fee payment provider integration is not enabled; current owner billing payment actions are simulated or manually recorded by an agency admin
- rent payment receipts are generated once after simulated completion or backend-confirmed provider completion

## Common API Conventions

### Base path

- `/v1`

### Authentication

- protected endpoints require a valid Firebase ID token
- the backend must derive `uid`, `email`, and provider info from the verified token

### Response shape

Successful responses should be small and explicit:

```json
{
  "ok": true,
  "data": {}
}
```

Error responses should be machine-readable:

```json
{
  "ok": false,
  "error": {
    "code": "invite_already_claimed",
    "message": "Cette invitation a déjà été utilisée."
  }
}
```

## 1. Profile Bootstrap

### `POST /v1/profile/bootstrap`

Ensures the authenticated user has an application profile and role metadata.

#### Request body

```json
{
  "role": "owner"
}
```

#### Rules

- accepted roles: `owner`, `tenant`
- if the user profile already has a role, the backend should not silently switch it
- owner bootstrap creates or merges:
  - `users/{uid}`
  - `owners/{uid}`
- tenant bootstrap creates or merges:
  - `users/{uid}`

#### Response

```json
{
  "ok": true,
  "data": {
    "uid": "firebase-uid",
    "role": "owner",
    "ownerId": "firebase-uid",
    "tenantId": null
  }
}
```

## 2. Create Property

### `POST /v1/properties`

Creates an owner-scoped property.

#### Request body

```json
{
  "label": "Résidence Tevragh-Zeina",
  "address": "Tevragh-Zeina, Nouakchott"
}
```

#### Rules

- caller must be an authenticated owner
- owner identity comes from the caller’s `users/{uid}` profile, not the request body

#### Firestore side effects

- create `properties/{propertyId}`

#### Response

```json
{
  "ok": true,
  "data": {
    "id": "property-id",
    "ownerId": "firebase-uid"
  }
}
```

## 3. Create Unit

### `POST /v1/units`

Creates a rentable unit under an owner-owned property.

#### Request body

```json
{
  "propertyId": "property-id",
  "label": "Appartement A2",
  "rentAmount": 150000,
  "currency": "MRU"
}
```

#### Rules

- caller must be an authenticated owner
- property must belong to that owner
- new units start as:
  - `tenantId = null`
  - `status = "vacant"`
  - `activeInviteId = null`

## 4. Generate Tenant Invite

### `POST /v1/invites`

Generates a single-use invite tied to one specific unit.

#### Request body

```json
{
  "unitId": "unit-id",
  "inviteType": "code",
  "email": "tenant@example.com"
}
```

#### Rules

- caller must be an authenticated owner
- unit must belong to the owner
- unit must be `vacant`
- only one active invite per unit
- raw invite code is generated server-side
- only a hash is stored in Firestore

#### Firestore side effects

- create `tenantInvites/{inviteHash}`
- update `units/{unitId}`:
  - `status = "invited"`
  - `activeInviteId = inviteHash`

#### Response

```json
{
  "ok": true,
  "data": {
    "inviteId": "invite-hash",
    "inviteCode": "ATP-84XQ-2L7M",
    "inviteLink": "atoupay://invite/ATP-84XQ-2L7M",
    "expiresAt": "2026-04-29T10:00:00.000Z"
  }
}
```

### Important note

The raw invite code should only appear in the response that creates it. It should not be recoverable later from Firestore.

## 5. Redeem Tenant Invite

### `POST /v1/invites/redeem`

Claims an invite and attaches the tenant to the referenced unit.

#### Request body

```json
{
  "inviteCode": "ATP-84XQ-2L7M"
}
```

#### Rules

- caller must be an authenticated tenant
- caller must not already be attached to another unit
- invite must exist, be pending, and not be expired
- if invite has an e-mail restriction, caller e-mail must match
- targeted unit must still be available
- claim must happen in one transaction

#### Firestore side effects

- update `tenantInvites/{inviteId}` to `claimed`
- update `units/{unitId}` to:
  - `tenantId = caller uid`
  - `status = "occupied"`
  - `activeInviteId = null`
- create `tenants/{uid}`
- update `users/{uid}` with:
  - `tenantId = uid`
  - `ownerId = ownerId from invite`
- seed current pending rent in `rentPayments/{paymentId}`

#### Response

```json
{
  "ok": true,
  "data": {
    "tenantId": "firebase-uid",
    "ownerId": "owner-uid",
    "propertyId": "property-id",
    "unitId": "unit-id",
    "paymentId": "rent-firebase-uid-2026-04"
  }
}
```

#### Expected error codes

- `invite_invalid`
- `invite_expired`
- `invite_already_claimed`
- `invite_email_mismatch`
- `unit_already_occupied`
- `tenant_already_attached`
- `forbidden_role`

## 6. Tenant Rent Payment Intents

### `POST /v1/payments/{paymentId}/intent`

Creates or reuses an active backend-owned rent payment intent.

#### Rules

- caller must be the tenant attached to the rent payment
- owners and agency admins cannot create tenant payment intents
- payment must be payable
- tenant total equals rent amount
- `tenantFeeAmount = 0`
- `platformRentFeeAmount = 0`
- `agencyFeeAmount = 0`
- `commissionRate = 0`
- `ownerNetAmount = rentAmount`
- `ownerReceivableAmount = rentAmount`
- owner access fee is never included
- frontend success/cancel callbacks never mark rent paid by themselves

#### Response

```json
{
  "ok": true,
  "data": {
    "paymentId": "payment-id",
    "intentId": "intent-id",
    "provider": "moosyl",
    "status": "processing",
    "amount": 200000,
    "currency": "MRU",
    "transactionId": "provider-transaction-id",
    "checkoutUrl": "https://checkout.example/optional",
    "publishableKey": "pk_test_placeholder"
  }
}
```

`publishableKey` is safe to return when needed. Secret keys are never returned.

### `GET /v1/payments/{paymentId}/status`

Tenant, owner, or agency-admin scoped read. Returns rent payment state, provider state, receipt ID if available, and safe provider reference only.

### `POST /v1/payments/{paymentId}/cancel`

Tenant only. Cancels active non-paid intents only. It does not delete payment records and does not affect paid rent payments.

### `POST /v1/webhooks/moosyl`

Public webhook endpoint for Moosyl tenant rent payment callbacks.

#### Rules

- verify `x-webhook-signature` against the raw request body using `MOOSYL_WEBHOOK_SECRET`
- read event type from `x-webhook-event`
- store every webhook attempt in `paymentWebhookEvents`
- handle duplicate paid callbacks idempotently
- ignore unknown event types safely
- validate amount and currency before marking rent paid
- create exactly one rent receipt after paid provider confirmation
- do not create receipts for failed or cancelled callbacks

Known events:

- `payment-request-created`
- `payment-request-updated`
- `payment-created`
- `payment-updated`

## 7. Simulated Payment Settlement

### `POST /v1/payments/{paymentId}/simulate-complete`

Marks a rent payment as paid and creates a receipt through the simulated provider path.

#### Request body

```json
{
  "paymentMethod": "Bankily"
}
```

#### Rules

- caller must be the tenant attached to the payment
- payment must currently be `pending` or `late`
- no real charge is executed
- response and stored metadata must clearly indicate simulation
- production simulated completion is blocked where configured

#### Firestore side effects

- update `rentPayments/{paymentId}`:
  - `paymentStatus = "paid"`
  - `paymentMethod = selected method`
  - `providerReference = simulated reference`
  - `receiptId = generated receipt id`
- create `receipts/{receiptId}`

#### Response

```json
{
  "ok": true,
  "data": {
    "paymentId": "payment-id",
    "receiptId": "receipt-id",
    "paymentStatus": "paid",
    "simulated": true
  }
}
```

### `POST /v1/payments/{paymentId}/manual-confirm`

Confirms a tenant-declared manual payment, such as Bankily QR/code payment, after owner or agency review.

#### Request body

```json
{
  "paymentMethod": "Bankily",
  "providerReference": "BANKILY-DECLARED-REFERENCE",
  "note": "Confirmed from owner Bankily history."
}
```

#### Rules

- caller must be the payment owner or an agency admin scoped to the payment agency
- tenants cannot confirm their own manual payment declarations
- payment must currently be `pending` or `late`, unless it is already paid with an existing receipt
- tenant proof/reference submission alone does not call this endpoint and does not create a receipt
- Bankily app return alone must never mark rent paid
- no tenant fee, platform rent fee, owner access fee, or commission is added
- receipt wording must identify owner/agency confirmation, not provider confirmation

#### Receipt wording

Manual Bankily confirmation receipts use:

```text
Paiement déclaré par le locataire et confirmé par le propriétaire.
```

They must not be labelled as Bankily/API-confirmed unless a verified Bankily or provider confirmation exists.

### `POST /v1/payments/{paymentId}/manual-proof`

Tenant-only endpoint for submitting supporting evidence for a Bankily/manual direct payment.

#### Request body

```json
{
  "paymentMethod": "Bankily",
  "providerReference": "BANKILY-DECLARED-REFERENCE",
  "note": "Tenant-entered note",
  "submittedPaymentReference": "ATP-A1-AVR26-8K4",
  "submittedTransactionReference": "BANKILY-DECLARED-REFERENCE",
  "submittedAmount": 200000,
  "submittedCurrency": "MRU",
  "submittedPaymentDate": "2026-04-22",
  "submittedPaymentTime": "14:35",
  "submittedPaymentMethod": "bankily",
  "proofImageStoragePath": "paymentProofs/agency-id/payment-id/tenant-id/proof.jpg",
  "proofImageFileName": "proof.jpg",
  "proofImageOriginalFileName": "bankily-proof.jpg",
  "proofImageContentType": "image/jpeg",
  "proofImageSizeBytes": 256000
}
```

#### Rules

- caller must be the tenant assigned to the payment
- payment must be `pending` or `late`
- `submittedPaymentReference`, `submittedAmount`, `submittedCurrency`, and `submittedPaymentDate` are required
- at least one of `submittedTransactionReference`, note, or proof image metadata is required
- `submittedPaymentReference` is checked against immutable `rentPayments/{paymentId}.atouPayReference`
- amount, currency, and date are checked and stored in `proofCheckResult`
- high-risk proof can be submitted for review but cannot be owner-confirmed
- current manual proof support is for Bankily direct/manual mode
- owner Bankily/direct payment method must be agency-verified before tenant proof submission is accepted
- `moosyl_provider` and `not_configured` owner Bankily modes reject manual proof
- `deep_link_confirmed` requires backend/provider verification, not manual proof
- `deep_link_unverified` proof is blocked in production
- proof submission creates a support/proof record only
- proof submission does not mark rent paid
- proof submission does not create a receipt
- screenshot/photo proof is supporting evidence only and is not provider verification
- public proof image URLs are rejected; the app must submit a scoped Firebase Storage path
- proof image path must match `paymentProofs/{agencyId}/{paymentId}/{tenantId}/{fileName}`
- proof image content type must be `image/jpeg`, `image/png`, or `image/webp`
- proof image size must be 5 MB or less

Stored proof metadata includes:

- `expectedAtouPayReference`
- `expectedAmount`
- `submittedPaymentReference`
- `submittedTransactionReference`
- `submittedAmount`
- `submittedCurrency`
- `submittedPaymentDate`
- `submittedPaymentTime`
- `submittedPaymentMethod`
- `proofCheckResult`
- `ownerReviewStatus`
- `agencyEscalationAvailableAt`
- `proofImageStoragePath`
- `proofImageFileName`
- `proofImageOriginalFileName`
- `proofImageContentType`
- `proofImageSizeBytes`
- `proofSubmittedAt`

### `POST /v1/support/requests/{requestId}/manual-proof/review`

Owner or agency-admin endpoint for reviewing a manual payment proof after viewing the submitted reference and optional screenshot.

#### Request body

```json
{
  "decision": "confirmed",
  "note": "Confirmed against owner Bankily history.",
  "overrideReason": "Required for agency confirmation of high-risk proof.",
  "settlementNote": "Optional internal settlement note."
}
```

Allowed `decision` values:

- `confirmed`: confirms the manual payment and generates the rent receipt exactly once
- `rejected`: rejects the proof and does not create a receipt
- `disputed`: keeps the proof under review and does not create a receipt

Owner confirmation is allowed only for normal-risk proof for the owner’s unit. Agency confirmation is allowed when escalation is available, the owner is inactive/suspended, the proof is disputed, or high-risk proof includes an override reason.

Owner-confirmed receipts say:

```text
Paiement déclaré par le locataire et confirmé par le propriétaire.
```

Agency-confirmed receipts say:

```text
Paiement déclaré par le locataire et confirmé par l’agence après vérification.
```

Rejected or disputed proofs must leave the rent payment pending/late and must not create receipts.

### `POST /v1/tasks/manual-proof-reminders/run`

Internal task endpoint for owner review reminders.

Security:

- requires `x-internal-task-secret` matching backend `INTERNAL_TASK_SECRET`
- not publicly callable without the internal secret

Behavior:

- scans manual proofs waiting for owner review
- sends owner reminder notifications after `24` hours, up to `3` reminders
- marks agency escalation available after `48` hours
- does not mark rent paid
- does not create receipts
- writes audit logs for reminder/escalation activity

### `POST /v1/agency/owners/{ownerId}/payment-method/bankily/review`

Agency-admin endpoint for reviewing owner Bankily/direct payment information.

Request body:

```json
{
  "status": "verified",
  "note": "Bankily merchant code verified with owner."
}
```

Allowed statuses are `verified`, `rejected`, and `disabled`. Owners cannot self-verify. Tenant Bankily/direct payment details are shown only when the owner method status is `verified`.

## 8. Operational Read And Control Endpoints

The current production-readiness slice adds narrow backend read/control endpoints without moving every Firestore read behind the API.

### `GET /v1/agency/dashboard`

Agency-admin only. Optional query:

```json
{
  "period": "this_month"
}
```

Supported periods: `this_month`, `last_month`, `all`.

Returns active owner/tenant counts, property/unit counts, pending owner invites, support request status counts, payment status counts, rent paid amount, zero tenant/platform rent fee fields, and deprecated commission fields fixed at zero for new records.

### `GET /v1/owner/dashboard`

Owner only. Optional query:

```json
{
  "period": "this_month"
}
```

Returns property/unit/tenant counts, occupied/vacant units, payment status counts, rent paid amount, zero tenant/platform rent fee fields, and owner receivable amount.

## 9. Owner Account Fee Model

Owner account billing is a separate financial object from tenant rent.

Rules:

- tenants pay rent only
- ATouPay charges no tenant fee
- rent payments do not deduct agency commission
- owners pay `10 EUR` every `42` days to keep the owner account active
- owner billing has a `7` day grace period
- owner billing records are stored separately from `rentPayments` and `receipts`
- owner account fees never appear on tenant rent receipts
- real owner-fee payment provider integration is not enabled yet; current owner billing payment actions are simulated or manually recorded by an agency admin
- in local payment provider integrations, EUR may need to be charged as an MRU equivalent if the provider supports MRU only
- any future real owner-fee payment confirmation must come from backend/provider confirmation, not frontend success

Firestore collections:

- `ownerBillingAccounts/{ownerId}`
- `ownerBillingInvoices/{invoiceId}`
- `ownerBillingPayments/{billingPaymentId}`

### `GET /v1/owner/billing`

Owner only. Returns the current owner billing summary:

```json
{
  "ok": true,
  "data": {
    "account": {},
    "latestInvoice": null,
    "canManageProperties": true,
    "canCreateInvites": true,
    "feeAmount": 10,
    "feeCurrency": "EUR",
    "intervalDays": 42,
    "nextPaymentDueAt": "2026-06-03T10:00:00.000Z",
    "activeUntil": "2026-06-03T10:00:00.000Z",
    "statusMessage": "Votre compte propriétaire est actif."
  }
}
```

### `POST /v1/owner/billing/pay-simulated`

Owner only. Development/preview or simulated-provider only. Creates an open owner access invoice if needed, records a simulated payment, extends access by 42 days from the later of now or the current period end, and returns the updated summary.

### `GET /v1/agency/owners/billing`

Agency-admin only. Lists owners with billing account status, active-until date, next due date, latest invoice, and owner profile summary.

### `POST /v1/agency/owners/{ownerId}/billing/mark-paid`

Agency-admin only. Records a manual or simulated owner account fee payment.

```json
{
  "provider": "manual",
  "providerReference": "optional-reference",
  "note": "Paiement reçu hors app."
}
```

### `POST /v1/agency/owners/{ownerId}/billing/suspend`

Agency-admin only. Suspends owner billing access and creates audit/notification records.

```json
{
  "reason": "Contrôle agence."
}
```

### `POST /v1/agency/owners/{ownerId}/billing/reactivate`

Agency-admin only. Reactivates owner billing access and recalculates whether the account is active, in grace period, or past due based on the paid period.

### `GET /v1/agency/users`

Agency-admin only. Lists owner and tenant accounts inside the agency scope with account status.

### `PATCH /v1/agency/users/{uid}/status`

Agency-admin only. Supports:

```json
{
  "status": "suspended"
}
```

Allowed status transitions for this endpoint are `active` and `suspended`. Suspended users remain Firebase-authenticated but are blocked from normal app usage.

### `GET /v1/notifications`

Returns in-app notification records for the current user. Agency admins receive agency-level operational notifications.

### `POST /v1/notifications/{notificationId}/read`

Marks an accessible notification as read.

### `GET /v1/agency/audit-logs`

Agency-admin only. Returns a recent minimal audit history for operational traceability. This is not a full SIEM or financial ledger.

## 10. Future Read Endpoints

These are still optional because current app reads can remain on Firestore:

- `GET /v1/me`
- `GET /v1/owner/properties`
- `GET /v1/tenant/home`
- `GET /v1/payments`

If direct client reads become difficult to secure or cache, these can move behind the API later.

## Validation Rules Summary

The backend should validate at minimum:

- e-mail normalization to lowercase
- property and unit label length
- non-empty address
- positive rent amount
- invite type in `code | link`
- allowed payment method in `Bankily | Sedad | Masrvi | Carte bancaire`

## Suggested Audit Event Names

- `owner_invite_created`
- `owner_invite_revoked`
- `owner_activated`
- `tenant_invite_created`
- `tenant_invite_redeemed`
- `payment_completed`
- `support_request_created`
- `support_request_updated`
- `account_suspended`
- `account_reactivated`

## Suggested Error Mapping For Mobile

The mobile app should not parse backend text. It should rely on stable error codes.

Suggested mapping:

- `invite_invalid` -> `Code invalide`
- `invite_expired` -> `Invitation expirée`
- `invite_already_claimed` -> `Invitation déjà utilisée`
- `unit_already_occupied` -> `Unité déjà occupée`
- `tenant_already_attached` -> `Compte déjà rattaché`
- `forbidden_role` -> `Accès refusé`
- `email_verification_required` -> `Vérification requise`
- `provider_link_required` -> `Connexion avec le fournisseur existant requise`

## First Implementation Recommendation

If implementation starts next, build these pieces first:

1. Fastify server bootstrap
2. Firebase Admin initialization
3. auth middleware for Firebase ID tokens
4. `POST /v1/profile/bootstrap`
5. `POST /v1/invites`
6. `POST /v1/invites/redeem`

That sequence gives the biggest security improvement with the smallest amount of backend code.
