# ATouPay Backend API V1 Draft

This document defines the first backend slice to introduce on top of the current Firebase-based mobile app.

## Design Assumptions

- Firebase Authentication remains the login system
- the mobile app sends a Firebase ID token in `Authorization: Bearer <token>`
- the backend verifies the token with Firebase Admin SDK
- Firestore remains the primary data store
- payments are still simulated

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

## 6. Simulated Payment Settlement

### `POST /v1/payments/{paymentId}/simulate-complete`

Marks a rent payment as paid and creates a receipt.

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

## 7. Operational Read And Control Endpoints

The current production-readiness slice adds narrow backend read/control endpoints without moving every Firestore read behind the API.

### `GET /v1/agency/dashboard`

Agency-admin only. Optional query:

```json
{
  "period": "this_month"
}
```

Supported periods: `this_month`, `last_month`, `all`.

Returns active owner/tenant counts, property/unit counts, pending owner invites, support request status counts, payment status counts, gross paid amount, agency fee amount, owner net amount, and current commission rate.

### `GET /v1/owner/dashboard`

Owner only. Optional query:

```json
{
  "period": "this_month"
}
```

Returns property/unit/tenant counts, occupied/vacant units, payment status counts, gross paid amount, agency fee amount, and owner net amount.

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

## 8. Future Read Endpoints

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
