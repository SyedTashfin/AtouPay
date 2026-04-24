# ATouPay Client Demo

This demo is designed so the main client walkthrough does not depend on single-use invite redemption.

## Runtime

- Android app: `ATouPay Preview`
- Backend: `https://atoupay-backend-ev67wqijcq-ew.a.run.app`
- Payments: simulated only; no real debit or settlement happens.

## Demo Accounts

Use the shared demo password provided out-of-band.

| Account | Email | State | Purpose |
| --- | --- | --- | --- |
| Agency admin | `client.agency@example.com` | Active | Agency dashboard, owner invites, commission/support views |
| Owner | `client.owner@example.com` | Active | Main owner demo path |
| Tenant | `client.tenant@example.com` | Active and already attached to a unit | Main tenant demo path |
| Blocked owner | `client.blocked.owner@example.com` | Pending owner access | Optional blocked-owner activation demo only |
| New tenant | `client.newtenant@example.com` | Active but not attached | Optional negative/unassigned tenant demo only |

## Recommended Client Walkthrough

1. Install the Android APK.
2. Open the app normally.
3. For tenant testing, choose `Locataire`, sign in as `client.tenant@example.com`, view the assigned unit and pending simulated rent, then run the simulated payment flow.
4. For owner testing, choose `Propriétaire`, sign in as `client.owner@example.com`, view the existing property, occupied unit, tenant/payment summaries, and optionally generate a new tenant invite without redeeming it.
5. For agency testing, open `atoupay://auth/agency` after installing the APK, then sign in as `client.agency@example.com`.
6. Confirm the public role picker only shows tenant and owner; agency access is a dedicated admin entry.

## Optional Invite Tests

These are not part of the main client path because invite codes are intentionally single-use.

- Optional blocked-owner activation code: `OWNR-DEMO-2026-0001`
- Tenant invite redemption should be treated as an operator/QA test, not the main client demo. The primary tenant account is already attached to a unit.

If an optional invite is consumed, reseed the demo data before the next demo.

## Operator Reseed

Run from the backend directory with local Firebase Admin credentials configured in `backend/.env`:

```bash
CLIENT_DEMO_PASSWORD='<shared-demo-password>' npm run client-demo:seed
```

The reseed is idempotent for the demo core:

- Keeps the agency admin active.
- Keeps the owner active.
- Keeps the tenant attached to `Appartement A1`.
- Resets the current-month rent payment to pending simulated state.
- Resets `Appartement B1` to vacant.
- Removes demo tenant invites for the seeded demo property.
- Resets the optional blocked-owner invite.

Do not use this against production data.
