# ATouPay Client Demo

This demo is designed so the main client walkthrough does not depend on single-use invite redemption.

## Runtime

- Android app: `ATouPay Preview`
- Latest tested APK: `https://expo.dev/artifacts/eas/xnCz6kseHEpnrzKcUQ7Eqt.apk`
- Backend: `https://atoupay-backend-ev67wqijcq-ew.a.run.app`
- Payments: simulated only; no real debit or settlement happens.

## Lightweight Android Build

Use the optimized client-demo APK command before sharing a new Android file:

```bash
npm run android:client-demo:build
```

Expected output:

- APK path: `android/app/build/outputs/apk/release/app-release.apk`
- Target device ABI: `arm64-v8a`
- Current measured size: about `37M`
- Permissions: internet/network only; no contacts, SMS, camera, call-phone, or storage permissions.

Do not send the old universal APK as the client demo artifact. The universal APK bundles
multiple CPU architectures and was measured above the client’s `<50M` target.

## Demo Accounts

Use the shared demo password `AtouPayDemo2026`. The client-demo APK also includes a
role-specific **Remplir le compte démo** button that fills the correct e-mail and
password automatically.

| Account | Email | State | Purpose |
| --- | --- | --- | --- |
| Agency admin | `client.agency@example.com` | Active | Agency dashboard, owner invites, owner billing/support views |
| Owner | `client.owner@example.com` | Active | Main owner demo path |
| Tenant | `client.tenant@example.com` | Active and already attached to a unit | Main tenant demo path |
| Blocked owner | `client.blocked.owner@example.com` | Pending owner access | Optional blocked-owner activation demo only |
| New tenant | `client.newtenant@example.com` | Active but not attached | Optional negative/unassigned tenant demo only |

## Recommended Client Walkthrough

1. Install the Android APK.
2. If an older `ATouPay Preview` is already installed, uninstall it first, then install the latest APK.
3. Open the app normally.
4. For tenant testing, choose `Locataire`, tap `Remplir le compte démo locataire`, then `Se connecter`. View the assigned unit and pending simulated rent, then run the simulated payment flow.
5. For owner testing, choose `Propriétaire`, tap `Remplir le compte démo propriétaire`, then `Se connecter`. View the existing property, occupied unit, tenant/payment summaries, and optionally generate a new tenant invite without redeeming it.
6. For agency testing, choose either `Locataire` or `Propriétaire`, then sign in with `client.agency@example.com`. The backend profile resolves the account as `agency_admin` and opens the agency area automatically.
7. Confirm the public role picker only shows tenant and owner; agency access is credential/profile-driven, not a visible public role.

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
