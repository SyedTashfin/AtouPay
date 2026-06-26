# ATouPay QA test report

Last updated: 2026-05-07

## Scope

This QA pass covers:

- Authentication and role-scoped backend access.
- Owner billing/access fee rules.
- Zero-fee tenant rent ledger behavior.
- Manual Bankily/direct proof submission.
- Firebase Storage proof-image security model.
- Owner/agency proof review and receipt generation.
- Reminder and agency escalation task.
- Moosyl/provider safety controls.
- Receipt wording and tenant-safety constraints.
- Documentation coverage for manual QA.

## Automated coverage

Backend tests use Node's built-in test runner through `backend/package.json`:

```bash
cd backend
npm test
```

The suite covers:

- Tenant, owner, and agency profile/auth flows.
- Wrong-role endpoint rejection for protected backend routes.
- Owner billing account creation, grace period, simulated payment gating, manual agency mark-paid, suspend/reactivate, and owner write guards.
- Tenant rent payment safety while owner billing is active, grace period, past due, or suspended.
- Tenant rent payment intent creation with zero tenant fee and zero commission.
- Moosyl config validation, parser behavior, webhook signature checks, duplicate paid webhooks, amount/currency mismatch, and provider-confirmed receipt behavior.
- Bankily/manual proof submission with required ATouPay reference, amount, currency, date, payment method, proof image metadata, risk scoring, and no receipt on submission.
- Public proof URL rejection, invalid storage path rejection, non-image rejection, oversized proof rejection.
- Duplicate proof submissions remaining review-only.
- Owner notification/reminder task behavior, including secret enforcement and max reminder count.
- Agency escalation and agency fallback confirmation.
- Owner self-verification blocking for Bankily methods.
- Owner cross-scope proof review blocking.
- Owner/agency receipt wording and idempotent receipt generation.

## Latest local validation

Run on 2026-05-07:

- `npm run typecheck`: passed.
- `cd backend && npm run typecheck`: passed.
- `cd backend && npm test`: passed, 98/98 tests.
- `git diff --check`: passed.

## Frontend coverage

The root `package.json` does not define Jest, React Native Testing Library, Detox, Maestro, or another mobile E2E test runner. This pass does not add a large framework. Frontend validation remains manual using `docs/qa-manual-test-plan.md`.

Manual smoke areas:

- Tenant payment screen renders verified Bankily manual mode.
- Unverified/disabled owner payment methods render the safe message.
- Proof form requires reference, amount, date, payment method, and supporting reference/note/image.
- Mismatch warnings are visible before submission where implemented.
- Owner support UI shows proof image, expected/submitted fields, risk level, and warnings.
- Agency support UI exposes queue filters for waiting review, escalation, high risk, and disputed proofs.
- Owner billing card renders separately from rent payments.
- Production-only builds hide simulated payment controls.

## Firebase Storage coverage

Repository configuration includes:

- `firebase.json` with `storage.rules`.
- `storage.rules` scoped to `paymentProofs/{agencyId}/{paymentId}/{tenantId}/{fileName}`.
- Client upload code in `src/services/paymentProofUpload.ts`.
- Backend proof metadata validation in `backend/src/services/backend-service.ts`.

Automated backend tests validate stored metadata and path scope. Firebase Storage Rules are not currently run through an emulator test script in the repository, so rule execution remains manual/emulator-pending. Use the Firebase Storage checklist in `docs/qa-manual-test-plan.md` before client demo and before pilot.

## Security checks

Expected repository search results:

- `commission` and `agencyFee` should appear only in legacy compatibility fields, zero-fee tests, migration docs, or warnings.
- `owner access fee` should appear only in owner-billing docs/tests/UI, never tenant rent receipts.
- `MOOSYL_SECRET_KEY` and `MOOSYL_WEBHOOK_SECRET` should appear only in backend config, docs, test placeholders, and env examples.
- `sk_live`, StoreKit, Google Play Billing, RevenueCat, and production external payment links should not appear as active integrations.
- Proof images should use Storage paths, not public URLs or persisted download URLs.

## Known manual gaps

- Firebase Storage Rules are not automated with emulator tests yet.
- Expo UI flows are not covered by automated mobile E2E tests.
- Bankily deep-link/API/webhook behavior is not officially confirmed.
- Moosyl sandbox payload assumptions should be validated against real sandbox responses before pilot.
- PDF/share rendering should be manually checked on target Android devices.

## Readiness assessment

- Client demo: ready after running the validation commands and manual QA smoke plan on a demo build.
- Internal pilot: conditionally ready after Firebase Storage Rules are verified in emulator or a non-production Firebase project.
- Production: not ready. Live provider strategy, Bankily/BPM confirmation details, Moosyl sandbox validation, refund/dispute operations, app-store payment policy, and operational runbooks still require approval.
