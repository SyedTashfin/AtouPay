# Payment Proof Storage Security

Manual Bankily/direct proof screenshots are supporting evidence only. They are
not provider verification, and submitting a screenshot must not mark rent paid
or create a receipt.

## Storage Path

Proof images are stored in Firebase Storage under:

```text
paymentProofs/{agencyId}/{paymentId}/{tenantId}/{fileName}
```

The app uploads the binary image to Firebase Storage, then sends path-scoped
metadata to the backend:

- `proofImageStoragePath`
- `proofImageFileName`
- `proofImageOriginalFileName`
- `proofImageContentType`
- `proofImageSizeBytes`
- `proofSubmittedAt`

The backend rejects public proof image URLs. Review screens resolve the image
from `proofImageStoragePath` using the authenticated Firebase Storage SDK.

The proof record also stores structured review fields:

- immutable expected `atouPayReference`
- submitted payment reference
- submitted amount and MRU currency
- submitted payment date/time and method
- `proofCheckResult` with risk level and warnings
- owner review reminder/escalation timestamps

## Access Model

Firebase Storage rules use Firestore documents as authorization anchors:

- `rentPayments/{paymentId}` confirms the payment agency, tenant, and owner.
- `users/{uid}` confirms the signed-in user role and agency/owner/tenant scope.

Allowed access:

- tenant can upload proof only for their own payment
- tenant can read their own proof
- owner can read proof only when the payment belongs to their owner account
- agency admin can read proof only when the payment belongs to their agency

Blocked access:

- public reads
- list access
- overwrite/update
- delete
- uploads outside `paymentProofs/...`
- arbitrary executable or non-image files

## File Limits

Allowed content types:

- `image/jpeg`
- `image/png`
- `image/webp`

Maximum size: 5 MB.

The app checks MIME type and size before upload when available. Firebase
Storage rules enforce the same constraints server-side. The backend also
validates submitted metadata so a tenant cannot point a proof record at another
payment, tenant, or agency path.

Current limitation: the backend validates the submitted Storage path and
metadata, but it does not fetch the Storage object during proof submission.
The binary upload itself is protected by Firebase Storage rules. A future
backend-admin check can verify object existence before accepting the proof if
that becomes necessary.

## Receipt Rule

Proof upload is never receipt issuance. A rent receipt is generated only after:

- owner/agency manual confirmation, or
- backend/provider-confirmed payment state.

High-risk proof requires agency review. Screenshot proof remains supporting
evidence only, even when a tenant enters the correct ATouPay reference and
amount.

Manual-confirmed receipts use:

```text
Paiement déclaré par le locataire et confirmé par le propriétaire.
```

Receipts must not embed the screenshot and must not claim Bankily/provider
confirmation unless ATouPay has verified provider confirmation.
