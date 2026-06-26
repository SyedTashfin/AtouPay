# ATouPay manual QA test plan

Last updated: 2026-05-07

This plan covers product flows that are not fully covered by the backend Node test suite, especially Expo UI behavior and Firebase Storage Rules behavior. Use sandbox/demo data only. Do not use real Bankily or Moosyl credentials.

## Preconditions

- Backend runs against test or demo Firebase resources.
- App is launched in development or preview mode.
- `PAYMENT_PROVIDER` is unset or set to `simulated` unless a Moosyl sandbox test is explicitly planned.
- `PAYMENT_LIVE_MODE=false`.
- No production provider credentials are present in Expo public env vars.
- Firebase Storage rules are deployed or loaded in the Firebase Emulator Suite from `storage.rules`.
- Test users exist for `agency_admin`, `owner`, and `tenant`.

## 1. Agency verifies owner Bankily method

1. Sign in as owner.
2. Add Bankily/manual payment details: phone number, merchant code or QR image reference.
3. Confirm the method is not tenant-visible while status is `draft` or `pending_verification`.
4. Sign in as agency admin.
5. Open owner billing/payment-method management.
6. Verify the Bankily method.
7. Confirm an audit entry is created.
8. Sign in as tenant and open the rent payment screen.
9. Confirm the verified Bankily details are now visible.

Expected result:
- Owner cannot self-verify.
- Tenant only sees verified owner payment details.
- No rent payment status changes during setup.

## 2. Tenant submits valid Bankily proof

1. Sign in as tenant.
2. Open `app/(tenant)/pay-rent.tsx`.
3. Confirm the screen shows the rent amount, ATouPay reference, and zero tenant fee wording:
   `Aucun frais supplémentaire n’est facturé au locataire par ATouPay.`
4. Copy the ATouPay reference.
5. Open Bankily if available, or continue with manual proof entry.
6. Submit proof with:
   - Matching ATouPay reference.
   - Matching amount.
   - Currency `MRU`.
   - Valid payment date.
   - Payment method `bankily`.
   - Transaction reference or screenshot.
7. Confirm the UI does not show a receipt immediately.

Expected result:
- Proof is submitted for owner review.
- Payment remains pending.
- No receipt is generated until owner or agency confirmation.

## 3. Tenant uploads screenshot proof

1. Select a JPEG, PNG, or WebP screenshot smaller than 5 MB.
2. Confirm the app shows the selected proof metadata or preview.
3. Submit the proof.
4. In Firebase Storage, confirm the object path follows:
   `paymentProofs/{agencyId}/{paymentId}/{tenantId}/{fileName}`.
5. Confirm proof metadata stores `storagePath`, `contentType`, `size`, and `originalFileName`.
6. Confirm no public `downloadURL` is stored in the support request or payment record.

Expected result:
- Upload succeeds only for allowed image types and size.
- Proof remains path-scoped, not public.
- Proof submission does not mark rent paid.

## 4. Owner confirms valid proof

1. Sign in as owner.
2. Open support/review queue.
3. Confirm the proof appears only if it belongs to one of the owner’s units.
4. Inspect expected amount/reference and submitted amount/reference/date/time.
5. Confirm risk level is low.
6. Confirm received.
7. Sign in as tenant.
8. Open receipts.

Expected result:
- Payment becomes paid.
- Exactly one rent receipt is created.
- Receipt wording says:
  `Paiement déclaré par le locataire et confirmé par le propriétaire.`
- Receipt does not mention owner access fee, tenant fee, commission, platform fee, or screenshot proof.

## 5. Tenant submits wrong amount or reference

1. Sign in as tenant.
2. Submit proof with a wrong ATouPay reference or amount.
3. Confirm mismatch warnings appear before or after submission.
4. Sign in as owner.
5. Attempt to confirm the high-risk proof.

Expected result:
- Risk level is high.
- Owner confirmation is blocked.
- Payment remains pending.
- No receipt is generated.

## 6. Agency confirms high-risk proof with override

1. Sign in as agency admin.
2. Open the high-risk proof in the agency queue.
3. Try confirming without an override reason.
4. Confirm again with a clear override reason.
5. Open the tenant receipt.

Expected result:
- Confirmation without override is blocked.
- Confirmation with override succeeds only for agency admin.
- Receipt wording says:
  `Paiement déclaré par le locataire et confirmé par l’agence après vérification.`

## 7. Owner ignores proof and reminder task escalates

1. Submit a tenant proof.
2. Advance test time or seed the proof so owner review is older than 24 hours.
3. Run:

```bash
cd backend
INTERNAL_TASK_SECRET=local-task-secret npm run dev
```

4. Call:

```bash
curl -X POST http://localhost:8080/v1/tasks/manual-proof-reminders/run \
  -H 'x-internal-task-secret: local-task-secret'
```

5. Repeat too soon.
6. Seed or advance past 48 hours and run again.

Expected result:
- Missing or invalid secret is rejected.
- Reminder count increments no more than allowed.
- Repeated runs do not create duplicate reminders too soon.
- Agency escalation becomes available after 48 hours.
- Task never marks payment paid and never creates a receipt.

## 8. Suspended owner does not block tenant receipts

1. Confirm a rent payment and create a receipt.
2. Suspend or mark the owner billing account as past due/suspended.
3. Sign in as tenant.
4. Open receipts and receipt verification.

Expected result:
- Tenant can still view existing receipts.
- Tenant rent access is not blocked by owner billing/access status.
- Owner subscription fee is not shown on rent receipt.

## 9. Production simulated actions are hidden and blocked

1. Build or run with production app variant.
2. Confirm simulated owner billing payment buttons are hidden.
3. Call simulated owner billing payment route directly.
4. Confirm backend returns 403.
5. Confirm Bankily `deep_link_unverified` mode cannot be used in production.

Expected result:
- Development-only payment controls are not available in production UI.
- Backend blocks direct calls even if UI is bypassed.

## Firebase Storage Rules manual/emulator checklist

Use Firebase Emulator Suite if available. If not configured, verify against a non-production Firebase project.

- Tenant can upload only to `paymentProofs/{agencyId}/{paymentId}/{tenantId}/{fileName}` for their own payment.
- Tenant can read their own proof.
- Owner can read proof only when the payment belongs to one of their units.
- Agency admin can read proof only for their agency.
- `list`, `update`, and `delete` are denied.
- Uploads larger than 5 MB are denied.
- MIME types outside `image/jpeg`, `image/png`, and `image/webp` are denied.
- Public unauthenticated reads are denied.

## Moosyl sandbox smoke checklist

Only run when intentionally testing sandbox provider behavior.

- Set `PAYMENT_PROVIDER=moosyl`.
- Set test placeholder keys only.
- Keep `PAYMENT_LIVE_MODE=false`.
- Create a tenant payment intent.
- Confirm frontend does not mark paid from provider callback alone.
- Deliver a valid signed webhook.
- Confirm receipt is generated exactly once after backend confirmation.
- Replay the webhook and confirm no duplicate receipt.
- Test amount and currency mismatch fixtures and confirm no paid status.
