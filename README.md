# ATouPay

[![CI](https://github.com/SyedTashfin/AtouPay/actions/workflows/ci.yml/badge.svg)](https://github.com/SyedTashfin/AtouPay/actions/workflows/ci.yml)

ATouPay is an Expo Router mobile MVP focused only on payment-first rental workflows for tenants and owners.

## Recruiter snapshot
- Mobile product with a real business workflow, not a UI demo
- Expo Router React Native front end paired with a Fastify backend and Firebase auth/data
- Strong evidence of production thinking: receipt generation, role-based flows, recovery, notifications, and backend write protection

## Repository status

- Public source repository for the ATouPay mobile app and backend service
- Expo Router React Native app with native iOS and Android projects
- Fastify backend for critical write flows, receipt issuance, support, and agency operations
- Firebase Auth and Firestore integration
- Tenant rent payments use a provider boundary with `simulated` as the default provider and a Moosyl test-mode adapter available behind backend env config

## Backend status

This repository now has two backend layers:

- Firebase Authentication for identity
- Cloud Firestore for application data and reads
- Firestore Security Rules for access control
- a separate Fastify backend under `/backend` for the first critical write flows

The mobile app can route the minimum end-to-end write slice through the backend when `EXPO_PUBLIC_USE_BACKEND=true`:

- profile bootstrap
- owner access activation
- owner property creation
- owner unit creation
- tenant invite generation
- tenant invite redemption

Current reads remain on Firestore in the Expo app for the lowest-risk local test setup. Tenant rent payments can now create backend payment intents; simulated remains the default provider.

## Trust, recovery, and receipt hardening

The current app now includes a minimum operational trust layer on top of the existing owner/tenant/payment flow:

- versioned terms of use served by the backend
- per-user terms acceptance tracking
- a responsibility/help screen with clear support guidance
- self-service password recovery by e-mail
- assisted recovery requests routed to the agency
- support, incident, and dispute requests stored in the backend
- strengthened receipt metadata and wording
- receipt QR codes, PDF export, and native share flow
- in-app notifications/event feed for payment, invite, support, and account-status events
- agency and owner dashboard summaries
- agency account suspension/reactivation and minimal audit history
- French, Arabic, and English language selector with initial core-string coverage
- public receipt verification that confirms recorded system data only

Important:

- phone recovery is **not** fully enabled at this stage
- the app stores a phone number and recovery preference for agency callback/support handling
- actual phone-based sign-in or recovery still requires Firebase Phone Auth enablement and verification setup
- tenant rent payment settlement remains simulated by default; the Moosyl adapter is available for test/sandbox rent intents only

## Current operational product slice

ATouPay now supports three operational roles:

- `agency_admin`
- `owner`
- `tenant`

Normal owner onboarding no longer depends on CLI-only invite issuance:

- an agency admin logs into the app
- the agency admin creates or revokes owner access invites in the app
- an owner authenticates with Google or e-mail/password
- the owner activates access with an agency invite code or link
- the active owner creates properties, units, and tenant invites
- a tenant authenticates and redeems the unit invite
- rent payments use the backend payment module, with simulated as the default provider, and the ledger records:
  - `rentAmount`
  - `grossAmount`
  - `tenantFeeAmount: 0`
  - `platformRentFeeAmount: 0`
  - `agencyFeeAmount: 0` for backward compatibility
  - `commissionRate: 0` for backward compatibility
  - `ownerReceivableAmount`
  - `agencyId`
- the backend now generates receipts and verification tokens for simulated payments and backend-confirmed provider payments

Important:

- there is no agency commission on tenant rent payments
- tenants pay rent only and ATouPay charges no tenant fee
- owners pay a separate 10 EUR account access fee every 6 weeks
- owner access fees are separate from rent payments, rent receipts, and tenant payment screens
- receipt generation is real
- receipt QR/PDF/share are implemented for backend-issued receipts
- notifications are in-app records only; push notifications are not configured yet
- invite e-mail delivery is available through Resend when `RESEND_API_KEY` and `EMAIL_FROM` are configured on the backend
- live payment settlement is not enabled by default; Moosyl is wired for tenant rent test-mode integration only
- no real banking or mobile money split disbursement is implied

The backend design documents remain here:

- [Backend architecture](./docs/backend-architecture.md)
- [Backend API v1 draft](./docs/backend-api-v1.md)

## Simplest real DEV project local setup

The simplest production-like local path for ATouPay right now is:

- one real Firebase DEV project
- Expo app using that project for Firebase Auth and Firestore reads
- local Fastify backend using Firebase Admin SDK against the same project
- `EXPO_PUBLIC_USE_BACKEND=true` so critical writes go through the backend
- simulated payments by default, with optional Moosyl test-mode tenant rent intents when backend env vars are configured

This path does **not** use Firebase emulators.

### What lives where

- App Firebase config goes in `.env.local`
- Backend Admin SDK config goes in `backend/.env`
- The Firebase Admin service-account JSON is for **local backend testing only**
- Keep that JSON outside the repo and reference it with an absolute path through `GOOGLE_APPLICATION_CREDENTIALS`
- For Cloud Run or production, prefer an attached service account / ADC instead of private key blobs in env

## Local native development on Mac

This project is configured for laptop-first Expo native development on macOS with:

- iOS Simulator
- Android Emulator
- Expo development builds via `expo-dev-client`
- local Metro bundling
- local native compilation with `npx expo run:ios` and `npx expo run:android`

### Prerequisites

Make sure the laptop has the following installed and working:

- Node.js and npm
- Xcode
- Xcode Command Line Tools
- at least one installed iOS Simulator runtime
- Watchman
- Android Studio
- Android SDK
- Android SDK command-line tools
- Java 17
- at least one bootable Android Virtual Device (AVD)

Recommended shell environment variables:

```bash
export ANDROID_SDK_ROOT="$HOME/Library/Android/sdk"
export ANDROID_HOME="$ANDROID_SDK_ROOT"
export JAVA_HOME="/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home"
export PATH="$ANDROID_SDK_ROOT/cmdline-tools/latest/bin:$ANDROID_SDK_ROOT/platform-tools:$ANDROID_SDK_ROOT/emulator:$PATH"
```

### Install dependencies

```bash
git clone https://github.com/SyedTashfin/AtouPay.git
cd AtouPay
npm install
```

### How to start Metro

Run Metro in one terminal and leave it running:

```bash
npm run start
```

Equivalent direct Expo command:

```bash
npx expo start --dev-client --scheme atoupay
```

### Agency-gated owner testing

Owner access is now agency-gated. For local testing, seed an owner access invite from the backend instead of creating an open owner account:

```bash
cd backend
npm run owner-access:invite -- --agency agency-dev --email owner@example.com
```

Use the printed code in the app’s `Code d’accès agence` field, or open the printed `ownerInvite` deep link.

### Cloud backend instead of localhost

If you do not want to run the backend on localhost, deploy `/backend` to Cloud Run in any billed GCP project and point the app to that URL.

Example app env:

```dotenv
EXPO_PUBLIC_USE_BACKEND=true
EXPO_PUBLIC_API_BASE_URL=https://your-cloud-run-url
```

Notes:

- the Firebase project can stay `atoupay-dev-20260422`
- the Cloud Run project can be different from the Firebase project
- the backend README documents the deployment command and credential model

### First agency admin bootstrap

For a real operator flow, bootstrap the first agency admin once, then manage owner access in-app:

```bash
cd backend
npm run agency-admin:bootstrap -- \
  --email admin@example.com \
  --agency-id agency-dev \
  --agency-name "Agence ATouPay"
```

Then:

1. sign in with that e-mail in the app
2. choose the `Agence` role
3. open the agency area
4. create owner access invites in-app from the `Invitations` tab

The older CLI owner-invite script remains available for emergency/bootstrap use only. It is no longer the normal business workflow.

### Owner account fee model

The current business model separates tenant rent from owner account access:

- tenants pay rent only
- ATouPay charges no tenant fee
- rent payments are not commission-split
- new rent ledger records keep legacy `agencyFeeAmount` and `commissionRate` fields only for compatibility, with both values set to `0`
- owners/landowners pay a separate account access fee of `10 EUR`
- the owner access cycle is every `42` days, with a `7` day grace period
- owner billing records live in `ownerBillingAccounts`, `ownerBillingInvoices`, and `ownerBillingPayments`
- owner account fees never appear on tenant rent receipts
- real owner-fee payment provider integration is not enabled yet; only simulated owner payment and agency manual mark-paid are implemented
- in local payment provider integrations, the 10 EUR fee may need to be charged as an MRU equivalent if the provider supports MRU only
- real payment confirmation must come from backend/provider confirmation, not a frontend success state

The old agency commission setting is deprecated and hidden from normal agency UI. Existing historical simulated records may still contain old commission fields, but new rent payments must not use them.

### Manual Bankily fraud-reduction controls

Manual Bankily/direct rent payments are a proof-and-review workflow, not a bank-confirmed provider workflow:

- each rent payment has an immutable `atouPayReference` like `ATP-A1-AVR26-8K4`
- tenants must submit the ATouPay reference, amount, MRU currency, payment date, method, and a transaction reference, screenshot, or note
- the backend records `proofCheckResult` for reference, amount, currency, date, image presence, warnings, and `low | medium | high` risk level
- screenshot proof is supporting evidence only and does not mark rent paid
- high-risk proof requires agency review; agency confirmation of high-risk proof requires an override reason
- owner Bankily payment details must be agency-verified before tenants can see/use direct payment details
- owner reminders run through `POST /v1/tasks/manual-proof-reminders/run` with `INTERNAL_TASK_SECRET`
- receipts are generated only after owner or agency confirmation and never claim Bankily/provider confirmation for manual proof

### Tenant rent payment provider module

ATouPay now has the first provider-agnostic backend module for tenant rent payments only:

- `PAYMENT_PROVIDER=simulated` is the default and keeps the existing simulated rent payment flow working
- `PAYMENT_PROVIDER=moosyl` enables the Moosyl adapter for tenant rent payment intents when required Moosyl env vars are present
- `PAYMENT_LIVE_MODE=false` is the default
- production blocks real-provider calls while `PAYMENT_LIVE_MODE=false`
- Moosyl currently targets MRU rent amounts
- Moosyl webhook handling verifies the raw body HMAC signature, stores webhook attempts, and handles duplicate paid callbacks idempotently
- rent receipts are generated once after backend-confirmed payment completion
- frontend checkout or SDK success is never enough to mark rent paid
- provider secrets stay backend-only; the Expo app can receive only safe fields such as the Moosyl publishable key, transaction ID, and checkout URL

Owner account access fee payment is intentionally not live-provider-enabled in this module.

See [Tenant Rent Payment Module: Moosyl](./docs/payment-module-moosyl.md) and [Payment Provider Readiness](./docs/payment-provider-readiness.md).

### Terms of use and responsibility

ATouPay now serves a backend-owned, versioned terms document. Users must accept the currently active version before full app usage when backend mode is enabled.

The default current wording states, in substance:

- AtouPay acts as a management and internal proof platform according to the information recorded in the system
- payments remain simulated until a real provider is integrated and verified
- payment errors, non-payment, bugs, outages, and disputes must be escalated through the agency support path
- generated documents may serve as justification according to recorded system data, without automatically becoming bank-certified or government-certified proof

Operational behavior:

- new users are prompted to accept before entering the protected role areas
- existing users are prompted again when the terms version changes
- the current public screens are:
  - `/terms`
  - `/help`
  - `/support`

### Account recovery

Two recovery layers now exist:

1. **Self-service**
   - password reset by e-mail through Firebase Authentication
   - entry point from the unified auth flow and verification screens

2. **Agency-assisted recovery**
   - the user can submit a recovery request with e-mail, phone number, and preferred contact channel
   - the agency admin can review and resolve that request from the in-app agency support area

Phone recovery status:

- storing a phone number and recovery preference is implemented
- Firebase Phone Auth recovery is **not enabled by default in this repo**
- do not present phone recovery as an active sign-in or reset method unless Firebase Phone Auth is actually configured in the target project

### Support, incidents, and disputes

The app now provides a minimal operational support flow:

- authenticated users can create support requests
- payment screens can open support prefilled for payment problems
- unauthenticated users can submit account recovery requests
- agency admins can list requests for their agency and mark them `in_progress` or `resolved`

This is intentionally not a full ticketing suite. It is the minimum viable operational support layer.

### Dashboards, notifications, and account control

The app now has lightweight operational views without becoming a BI/admin suite:

- agency dashboard: active owners/tenants, properties, units, pending owner invites, support status, payment status, and owner billing status
- owner dashboard: properties, units, occupancy, tenant count, pending/paid/late rent payments, rent collected, and owner account access status
- notification feed: in-app records only, visible from the bell icon and `/notifications`
- invite emails: owner access invites and tenant unit invites can be sent through Resend when backend email env vars are configured
- agency user registry: owners and tenants can be suspended or reactivated by agency admins
- agency audit tab: recent operational events for invites, owner activation, support, payment completion, and account status changes

Suspended accounts remain Firebase accounts, but normal app usage is blocked until the agency reactivates the account. This is product access control, not deletion.

### Language support

The current multilingual layer supports a persisted language selector for:

- French
- Arabic
- English

The first pass covers core operational strings, notification/error/support wording, and new production-readiness surfaces. It does not yet guarantee every historical string in the app is translated. Arabic RTL is allowed at the app layer, but a full RTL visual QA pass remains required before treating Arabic as production-polished.

### Receipts and verification

When a tenant completes a simulated payment through the backend-enabled app flow:

- the backend finalizes the simulated payment
- the backend generates a receipt number
- the backend stores a receipt record in `receipts/{receiptId}`
- the backend generates a verification token and verification URL
- the app can open the receipt detail screen
- the app can export/share a PDF version of the receipt
- the receipt detail and PDF include a QR code pointing to the public verification URL
- the public receipt verification screen confirms whether the receipt token is valid

Receipt wording is intentionally careful. The current app uses wording along these lines:

- `Quittance générée par AtouPay`
- `peut servir de justificatif de paiement selon les informations enregistrées dans le système`
- when applicable, an explicit marker that the payment is simulated and no real debit occurred

Simulated receipts state clearly that the payment is simulated and no real debit occurred.
Provider-confirmed rent receipts use separate wording: `Paiement confirmé par le prestataire de paiement.` and may show a safe provider reference.
The product does **not** claim automatic banking certification, government certification, or real settlement when those things are not actually in place.

### Provider readiness

The backend now has provider-agnostic tenant rent payment records, simulated and Moosyl adapters, webhook event storage, HMAC verification, duplicate webhook handling, and mismatch reconciliation records.

Before live money movement is enabled, the system still needs:

- provider credentials stored in protected runtime configuration or a secret manager
- approved merchant-of-record and settlement model
- pilot reconciliation against provider statements
- documented refund and dispute process
- production monitoring and operator runbooks
- approved store/distribution policy for any paid account-access features

### Payment module next-stage decision guide

The next payment-development stage should validate Moosyl test mode end to end with a pilot workflow while keeping the current simulated flow working.

Current confirmed state:

- tenants can complete a backend-owned simulated payment flow
- tenants can create backend-owned Moosyl test-mode rent payment intents when backend env vars are configured
- the backend writes the paid payment state, provider reference, receipt number, receipt record, verification token, and audit log
- the rent ledger stores rent amount, zero tenant fee, zero platform rent fee, zero legacy agency commission fields, agency ID, owner ID, tenant ID, property ID, and unit ID
- owner account access billing is stored separately from rent in owner billing collections
- supported payment labels in the app are `Bankily`, `Sedad`, `Masrvi`, and `Carte bancaire`
- no live debit, wallet transfer, card authorization, bank settlement, payout, refund automation, or split disbursement is enabled by default

Decisions to make before live provider rollout:

| Decision area | Options to settle | Required outcome |
| --- | --- | --- |
| First provider | Moosyl test mode is implemented first; Stripe or another provider remains a later decision | Validate Moosyl sandbox behavior before any live credentials |
| Merchant model | ATouPay as merchant, agency as merchant, owner as merchant, or provider-managed merchant | Define who receives funds, who signs provider/KYC agreements, and who handles payment support |
| Settlement model | Direct owner rent payout, agency collection, platform collection, or separate owner access billing | Approve how rent movement stays separate from the 10 EUR owner account fee |
| Receipt wording | Simulated receipt, provider-confirmed receipt, or settlement-confirmed receipt | Approve when a receipt can say payment is completed and what it legally proves |
| Payment states | `pending`, `processing`, `paid`, `failed`, `cancelled`, `disputed`, `refunded` | Define status transitions, retry behavior, and user-facing messages |
| Reconciliation | Manual CSV import, provider statement API, scheduled job, or admin review queue | Define how provider totals are matched to ATouPay payments and receipts |
| Disputes/refunds | Provider-native flow, support-ticket workflow, or admin-only action | Define who can trigger reversals and what happens to receipts and ledger records |
| Launch scope | Internal demo, one pilot agency, selected units, or all tenants | Pick a controlled rollout scope before production money movement |

Recommended implementation sequence:

1. Run Moosyl test-mode intent creation and webhook confirmation through a tunnel.
2. Verify duplicate, failed, cancelled, amount-mismatch, and currency-mismatch callbacks against real sandbox payloads.
3. Decide merchant of record, fee ownership, payout timing, reconciliation process, and support ownership.
4. Store provider secrets in protected runtime configuration before deployment.
5. Run a limited production pilot only after reconciliation, failure handling, support escalation, and receipt wording are approved.

Do not start production payment integration until these inputs are available:

- provider sandbox access, API documentation, webhook documentation, fee schedule, payout timing, and test credentials
- legal/compliance decision for merchant of record, KYC ownership, data retention, refund handling, and dispute responsibility
- approved settlement model for rent movement and separate owner account access fees, including what happens when a local provider only supports MRU
- approved receipt wording for provider-confirmed payments and any settlement-not-yet-paid state
- reconciliation plan covering duplicate callbacks, missing callbacks, partial failures, provider outages, chargebacks, refunds, and manual corrections
- security plan for secrets, webhook verification, idempotency, audit logs, monitoring alerts, and incident response

Suggested development acceptance gates:

- existing simulated payment, receipt, QR verification, and PDF export still pass unchanged
- duplicate provider callbacks cannot create duplicate receipts or double-mark a payment
- failed, cancelled, disputed, and refunded states are visible to tenants and owners without implying a completed payment
- provider secrets are never exposed to the Expo app, logs, README examples, or committed env files
- provider reconciliation can prove that ATouPay ledger totals match provider totals for the pilot period
- support/admin users can trace a payment from app payment ID to provider transaction ID, receipt ID, webhook event, and audit event

### Operational readiness notes

Current health/readiness:

- backend health check: `GET /health`
- backend Dockerfile and Cloud Run deployment script exist under `/backend`
- Firestore remains the source of truth for app data

Recommended production operations still to configure outside this app code:

- Firestore scheduled exports/backups for users, invites, payments, receipts, support, notifications, and audit logs
- retention policy for receipts/support/audit records
- Cloud Logging alerting on backend 5xx/error-rate spikes
- Cloud Run min/max instance settings appropriate to traffic and free-tier budget
- least-privilege service account for backend Firestore/Auth access

### How to open iOS Simulator

```bash
open -a Simulator
```

If no simulator is booted yet, Xcode or Expo will usually boot one automatically. You can also keep the currently booted simulator open while running local builds.

### How to run on iOS locally

Use the local native compile workflow:

```bash
npm run ios
```

Equivalent direct Expo command:

```bash
npx expo run:ios --no-bundler
```

Notes:
- Keep Metro running first with `npm run start` because the iOS script is configured with `--no-bundler`.
- The first local run may generate the `ios/` folder and install CocoaPods.
- The first native build can take several minutes.

### How to open Android Emulator

Start the default emulator from the terminal:

```bash
emulator -avd Pixel_8_API_34
```

Or open it from Android Studio > Device Manager.

Verify the emulator is connected:

```bash
adb devices
```

### How to run on Android locally

Use the local native compile workflow:

```bash
npm run android
```

Equivalent direct Expo command:

```bash
npx expo run:android --no-bundler
```

Notes:
- Keep Metro running first with `npm run start` because the Android script is configured with `--no-bundler`.
- `npm run android` prepends the default macOS Android SDK paths automatically. If your SDK lives elsewhere, export `ANDROID_SDK_ROOT` first.
- `npm run android` also falls back to Java 17 from `JAVA_HOME`, `java_home -v 17`, or the default Homebrew OpenJDK 17 path.
- The first local run may generate the `android/` folder and download missing native toolchain pieces such as NDK/build tools.
- The first native Android build can take several minutes.

### How to clear Metro cache

```bash
npm run start:clear
```

Equivalent direct Expo command:

```bash
npx expo start --dev-client --clear --scheme atoupay
```

### How to recover from stale native builds

If native folders or generated native state get out of sync, rebuild from a clean Expo prebuild:

```bash
npm run prebuild:clean
```

Then rerun Metro and the platform build:

```bash
npm run start
npm run ios
# or
npm run android
```

Additional cleanup commands:

```bash
rm -rf ~/Library/Developer/Xcode/DerivedData
cd android && ./gradlew clean
```

### How to rerun Expo Doctor

```bash
npm run doctor
```

Equivalent direct Expo command:

```bash
npx expo-doctor
```

### Any environment variables that matter

This app reads a small set of environment variables for local configuration:

```bash
export APP_VARIANT=development
export EXPO_PUBLIC_ENABLE_DEV_TOOLS=true
export EXPO_PUBLIC_EAS_PROJECT_ID=<your-eas-project-id>
export EXPO_PUBLIC_FIREBASE_API_KEY=<your-firebase-api-key>
export EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=<your-firebase-auth-domain>
export EXPO_PUBLIC_FIREBASE_PROJECT_ID=<your-firebase-project-id>
export EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=<your-firebase-storage-bucket>
export EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=<your-firebase-messaging-sender-id>
export EXPO_PUBLIC_FIREBASE_APP_ID=<your-firebase-app-id>
export EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=<your-web-client-id>
export EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=<your-ios-client-id>
export EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME=<your-reversed-ios-client-id>
export EXPO_PUBLIC_USE_BACKEND=false
```

For backend-enabled local testing:

- set `EXPO_PUBLIC_USE_BACKEND=true`
- leave `EXPO_PUBLIC_API_BASE_URL` unset on simulators unless you need a non-default host
- the app resolves local defaults automatically:
  - iOS Simulator and web: `http://127.0.0.1:3001`
  - Android Emulator: `http://10.0.2.2:3001`
- on a physical device, set an explicit reachable URL with `EXPO_PUBLIC_API_BASE_URL`

Example local app env for backend testing:

```bash
export APP_VARIANT=development
export EXPO_PUBLIC_ENABLE_DEV_TOOLS=true
export EXPO_PUBLIC_USE_BACKEND=true
export EXPO_PUBLIC_FIREBASE_API_KEY=<your-firebase-api-key>
export EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=<your-firebase-auth-domain>
export EXPO_PUBLIC_FIREBASE_PROJECT_ID=<your-firebase-project-id>
export EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=<your-firebase-storage-bucket>
export EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=<your-firebase-messaging-sender-id>
export EXPO_PUBLIC_FIREBASE_APP_ID=<your-firebase-app-id>
export EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=<your-web-client-id>
export EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=<your-ios-client-id>
export EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME=<your-reversed-ios-client-id>
```

There is also a ready-to-copy example file in [.env.local.example](./.env.local.example).

Native toolchain environment variables that matter:

```bash
export ANDROID_SDK_ROOT="$HOME/Library/Android/sdk"
export ANDROID_HOME="$ANDROID_SDK_ROOT"
export JAVA_HOME="/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home"
```

## Firebase manual authentication

ATouPay now uses the Firebase JavaScript SDK for:

- email/password sign up
- email/password sign in
- password reset
- email verification
- Firestore profile storage in `users/{uid}`
- owner, property, unit, invite, payment, and receipt storage in Firestore
- bridging the native Google sign-in flow into Firebase Auth when Firebase is configured

Required local env values:

```bash
export EXPO_PUBLIC_FIREBASE_API_KEY=<your-firebase-api-key>
export EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=<your-firebase-auth-domain>
export EXPO_PUBLIC_FIREBASE_PROJECT_ID=<your-firebase-project-id>
export EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=<your-firebase-storage-bucket>
export EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=<your-firebase-messaging-sender-id>
export EXPO_PUBLIC_FIREBASE_APP_ID=<your-firebase-app-id>
```

Recommended local placement:

- Put them in `.env.local` for development builds.
- Mirror them into the relevant EAS environment for preview and production builds.

Important implementation notes:

- This repo uses the Firebase JS SDK, not React Native Firebase.
- `GoogleService-Info.plist` is not required for the current email/password + Firestore JS SDK flow.
- `google-services.json` is not required for the current email/password + Firestore JS SDK flow.
- If Firebase env values are missing, the app stays runnable, manual auth is disabled with an explanatory notice, and internal demo shortcuts remain available in development/preview builds.
- Tenant rent payments default to simulated mode. Moosyl test-mode rent intents require backend env config and do not enable live money movement by default.

### Tenant assignment and invite flow

The V1 tenant-assignment model is:

- owners can sign up freely
- owners create properties, then units
- owners generate a single-use invite code or deep link for one specific unit
- tenants sign up or log in, then redeem that invite to be attached to the unit
- tenants cannot freely type an apartment name to self-assign a unit

## Local end-to-end backend testing

This is the smallest coherent local test path currently supported:

1. Firebase Auth signs the user in against one real Firebase DEV project
2. the Expo app gets a Firebase ID token
3. critical writes go through the local Fastify backend when `EXPO_PUBLIC_USE_BACKEND=true`
4. Firestore remains the read source for owner, tenant, unit, invite, and simulated payment screens

### Start the real-project local stack

Do not start Firebase emulators for this path. The app and backend should both point at the same real Firebase DEV project.

Start the backend:

```bash
cd backend
npm install
npm run dev
```

Check backend health:

```bash
curl http://127.0.0.1:3001/health
```

Start the Expo app:

```bash
cd AtouPay
npm install
EXPO_PUBLIC_USE_BACKEND=true npm run start
```

Open a simulator or emulator in a second terminal:

```bash
EXPO_PUBLIC_USE_BACKEND=true npm run ios
# or
EXPO_PUBLIC_USE_BACKEND=true npm run android
```

### Manual owner flow

1. On the first screen, choose `Propriétaire`.
2. Create an account or sign in.
3. Confirm the dev-only backend notice says the backend is reachable.
4. Open `Biens et unités`.
5. Create a property.
6. Create a unit under that property.
7. Generate an invite for the unit and copy the code or link.

Expected result:

- the profile bootstrap succeeds through the backend
- the property appears in the owner list
- the unit appears with status `Invité` after invite generation
- the invite card exposes a code and link that can be copied

### Manual tenant flow

1. Sign out.
2. Return to the first screen and choose `Locataire`, or open the invite deep link so the tenant path locks automatically.
3. Create a tenant account or sign in.
4. Paste or enter the invite code on the tenant home screen.
5. Redeem the invite.
6. Confirm the tenant now sees the linked rental/unit data.
7. Open the rent payment screen and complete the existing simulated payment flow, or create a Moosyl test intent when the backend is configured for Moosyl.

Expected result:

- the invite redemption succeeds through the backend
- the tenant is bound to the invited unit only
- the owner side reflects the tenant and unit assignment
- the default payment UI remains simulated; Moosyl test mode still waits for backend/provider confirmation before a receipt is created

Security notes for this flow:

- invite claim is enforced through an atomic Firestore transaction
- Firestore Security Rules validate that the invite, unit, tenant profile, user profile, and seeded pending rent payment are committed together
- the raw invite code is not stored in Firestore; the app stores a SHA-256 hash and uses the hash as the invite document ID
- payments remain simulated even after tenant assignment

### Firestore rules in this repo

The repo includes:

- `firestore.rules`
- `firebase.json`

Deploy the rules explicitly after creating the Firebase project:

```bash
npx firebase-tools login
npx firebase-tools deploy --only firestore:rules --project <your-firebase-project-id>
```

After changing the invite, unit, or payment-ownership rules, redeploy them before testing native builds again.

### Firebase console checklist

1. Create or select the Firebase project for ATouPay.
2. Add a Web app in Firebase and copy its config values into `.env.local`.
3. In Authentication > Sign-in method:
   - enable `Email/Password`
   - enable `Google`
4. In Firestore Database:
   - create the database in production mode or locked-down mode
   - deploy the rules from `firestore.rules`
5. In Authentication settings, ensure the required domains are authorized if your workflow needs them.
6. Keep the existing Google OAuth client IDs configured for the native Google sign-in module:
   - `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`
   - `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`
   - `EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME`
7. For Android Google sign-in, make sure Google Cloud contains OAuth clients for the exact package name and SHA-1 fingerprints used by your local debug and preview builds.

## Google sign-in configuration

ATouPay now uses `@react-native-google-signin/google-signin` for mobile Google login in development and preview builds.

Required env values:

```bash
export EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=<your-web-client-id>
export EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=<your-ios-client-id>
export EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME=<your-reversed-ios-client-id>
```

Android note:

- Keep an Android OAuth client configured in Google Cloud for the app package and signing certificate fingerprints.
- Do not add `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` to this repo. The installed `@react-native-google-signin/google-signin` library does not accept `androidClientId` in `GoogleSignin.configure(...)`.
- For the current Android client-demo APK, register these exact values in Firebase / Google Cloud:
  - package name: `com.atoupay.mobile.preview`
  - current client-demo APK SHA-1: `18:91:A4:40:DD:B2:1A:73:A8:FC:B4:55:37:13:1B:4A:D3:CB:34:11`
  - current client-demo APK SHA-256: `FC:7D:3C:9F:59:A6:D6:60:D0:15:43:65:8A:4B:2B:D3:21:DF:E9:8F:ED:2E:3A:0A:53:D6:A7:84:6B:D4:FF:53`
  - SHA-1: `CC:B3:54:CD:30:6C:73:B6:62:9A:94:98:58:3F:9C:4E:E7:DB:B9:B6`
  - SHA-256: `7F:38:4A:48:99:45:74:0A:6C:11:4A:D4:40:F8:68:27:F2:A9:5F:32:8F:7F:A0:E6:AE:1A:F6:74:EE:7F:E4:EF`

Firebase Console fix for Android `DEVELOPER_ERROR` / Google login failure:

1. Open Firebase Console > Project settings > General > Your apps.
2. Select the Android app for `com.atoupay.mobile.preview`; if it does not exist, add a new Android app with that package name.
3. Add the SHA-1 and SHA-256 fingerprints listed above to that Android app.
4. Open Authentication > Sign-in method and confirm Google is enabled.
5. Open Google Cloud Console > APIs & Services > Credentials and confirm there is an Android OAuth client for package `com.atoupay.mobile.preview` with the same SHA-1.
6. Confirm the Web OAuth client used by Firebase is the value configured as `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` in the EAS preview environment.
7. Wait a few minutes for OAuth propagation, then force close and reopen the installed app.

Adding SHA fingerprints is server-side; it usually does not require rebuilding the APK. Rebuild only if the package name, signing key, or native Google Sign-In plugin configuration changes.

Current tested Android client-demo APK:

- Direct APK: `https://expo.dev/artifacts/eas/xnCz6kseHEpnrzKcUQ7Eqt.apk`
- Build page: `https://expo.dev/accounts/tashfin101/projects/atoupay/builds/fe10747d-07e0-42d7-9ad7-74abbc196c93`
- Native Android `versionCode`: `3`
- The client-demo build shows a role-specific `Remplir le compte démo` button so testers do not have to type demo credentials manually.

To verify a future APK before sending it to a tester:

```bash
APK=/path/to/atoupay.apk
"$ANDROID_HOME/build-tools/36.0.0/aapt" dump badging "$APK" | head -1
"$ANDROID_HOME/build-tools/36.0.0/apksigner" verify --print-certs "$APK"
```

Recommended local placement:

- Put them in a local `.env.local` file for development builds.
- Mirror them into the relevant EAS environment for preview or production builds.

This repo is wired for the Expo config-plugin path without Firebase:

- `GoogleService-Info.plist` is not required in the current setup.
- `google-services.json` is not required in the current setup.
- The dynamic config adds the Google Sign-In config plugin only when `EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME` is present.

Important behavior:

- Google login requires development builds or EAS preview/production builds. It does not work in Expo Go.
- After adding the Google Sign-In plugin or changing its iOS URL scheme, rebuild the native apps:

```bash
npm run ios
npm run android
```

- If the OAuth values are missing, the app keeps rendering and the Google button stays disabled with an explanatory notice in development/preview builds.
- Payments default to the simulated provider. ATouPay does not enable live provider money movement until production provider configuration, reconciliation, and launch approvals are in place.

## Internal preview builds

This repo is configured for EAS preview builds that keep the current payment-first MVP intact while switching the app variant to `preview` for internal sharing.

Before publishing preview builds or updates, make sure the repo is linked to an Expo project and that the EAS project ID is available locally:

```bash
export EXPO_PUBLIC_EAS_PROJECT_ID=<your-eas-project-id>
```

If this repository is not linked yet, log in and initialize EAS once:

```bash
npx eas-cli login
npx eas-cli init
```

### Preview build commands

Android internal preview:

```bash
npx eas-cli build --profile preview --platform android
```

iOS internal preview:

```bash
npx eas-cli build --profile preview --platform ios
```

Equivalent npm scripts:

```bash
npm run eas:build:android:preview
npm run eas:build:ios:preview
```

Development build commands:

```bash
npm run eas:build:android:development
npm run eas:build:ios:development
```

Production build commands:

```bash
npm run eas:build:android:production
npm run eas:build:ios:production
```

Profile behavior:

- `development` creates a dev-client build for active local testing.
- `preview` creates an internal-distribution build with the `preview` app variant for shareable QA installs.
- `production` creates the production app variant and disables debug-only surfaces.

### Install or share a preview build

Run one of the preview build commands above. When EAS finishes, the CLI prints the build details URL and the install page.

- Share the install page URL directly with reviewers.
- For iOS, reviewers can open the install page on-device or install through Orbit/TestFlight, depending on the configured distribution path.
- For Android, reviewers can install the generated `.apk` or use the EAS install page.

To retrieve the latest completed preview builds later:

```bash
npx eas-cli build:list --platform ios --status finished --limit 3
npx eas-cli build:list --platform android --status finished --limit 3
```

### Publish a preview update

Preview and production are isolated by EAS Update channel:

- preview builds use the `preview` channel
- production builds use the `production` channel
- development builds use the `development` channel

The app uses a manual `runtimeVersion` equal to the app version (`1.0.0` today), which is compatible with the current native-project workflow and allows compatible JS-only preview iterations until the app version changes.

Publish a preview update with an explicit message:

```bash
export EXPO_PUBLIC_EAS_PROJECT_ID=<your-eas-project-id>
npm run eas:update:preview -- --message "Client review: build info and receipt confirmation"
```

Equivalent direct EAS command:

```bash
APP_VARIANT=preview EXPO_PUBLIC_ENABLE_DEV_TOOLS=true EXPO_PUBLIC_EAS_PROJECT_ID=<your-eas-project-id> \
  npx eas-cli update --channel preview --message "Client review: build info and receipt confirmation"
```

Publish a production update only from the production variant:

```bash
export EXPO_PUBLIC_EAS_PROJECT_ID=<your-eas-project-id>
npm run eas:update:production -- --message "Production hotfix message"
```

### Reset demo data in preview builds

In preview and development builds:

1. Open `Profil`
2. Open `Build info`
3. Tap `Outils de validation`
4. Use one of the preview-only helpers:
   - `Restaurer les données seed`
   - `Réinitialiser la démo`
   - `Vider la session`
   - `Passer en locataire` / `Passer en propriétaire`

These tools are hidden automatically in production builds.

### How to tell preview vs production inside the app

- Preview builds show a subtle `Preview` badge in screen headers.
- Development builds show a subtle `Build interne` badge in screen headers.
- Profile screens include a `Build info` block with app name, variant, version, native build version, runtime, update channel, platform, and current route.
- Production hides the preview-only validation tools.

## Troubleshooting

### Xcode installed but simulator not opening

```bash
open -a Simulator
```

If that still fails:

```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
xcrun simctl list devices
```

If Expo built successfully but did not bring the Simulator window to the front, open it manually and relaunch the installed app:

```bash
open -a Simulator
xcrun simctl launch booted com.atoupay.mobile.dev
```

If the Expo development client opens its launcher instead of the ATouPay app after a stale recent URL, reopen the app via its custom scheme:

```bash
xcrun simctl openurl booted atoupay://
```

### Xcode license issues

Check Xcode first-launch status:

```bash
xcodebuild -checkFirstLaunchStatus
```

If Xcode asks for license acceptance or first-launch components, open Xcode once and complete the prompts, or run:

```bash
sudo xcodebuild -license
sudo xcodebuild -runFirstLaunch
```

### watchman missing

Install with Homebrew:

```bash
brew install watchman
```

Verify:

```bash
watchman --version
```

### Android emulator not detected

Start an emulator and confirm ADB can see it:

```bash
adb devices
```

If needed, launch the default emulator manually:

```bash
emulator -avd Pixel_8_API_34
```

### adb not found

Add Android SDK tools to your shell profile:

```bash
export ANDROID_SDK_ROOT="$HOME/Library/Android/sdk"
export ANDROID_HOME="$ANDROID_SDK_ROOT"
export PATH="$ANDROID_SDK_ROOT/platform-tools:$ANDROID_SDK_ROOT/emulator:$ANDROID_SDK_ROOT/cmdline-tools/latest/bin:$PATH"
```

Then open a new terminal and verify:

```bash
adb version
```

### JAVA_HOME issues

Set Java 17 explicitly:

```bash
export JAVA_HOME="/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home"
java -version
```

If Gradle or `sdkmanager` cannot find Java, re-open the shell after updating your shell profile.

### Metro port conflicts

Check what is using port 8081:

```bash
lsof -nP -iTCP:8081
```

Stop the conflicting process and restart Metro cleanly:

```bash
kill -9 <PID>
npm run start:clear
```

### stale native cache

Reset generated native state and local build caches:

```bash
npm run prebuild:clean
rm -rf ~/Library/Developer/Xcode/DerivedData
cd android && ./gradlew clean
```

Then rerun Metro and the platform build.

### project builds on web but not on native

Run the native sanity checks first:

```bash
npm run doctor
npm run typecheck
```

Then rebuild the native projects:

```bash
npm run prebuild:clean
npm run ios
# or
npm run android
```

If the issue is native-only, inspect `ios/` and `android/` build output rather than assuming the web bundle is representative.

### simulator/emulator boots but app does not install

Confirm the target device is visible:

```bash
xcrun simctl list devices available
adb devices
```

Then rerun the local native build:

```bash
npx expo run:ios --no-bundler
npx expo run:android --no-bundler
```

If the build succeeds but the app does not open automatically, launch it manually:

```bash
xcrun simctl launch booted com.atoupay.mobile.dev
adb shell monkey -p com.atoupay.mobile.dev -c android.intent.category.LAUNCHER 1
```

If the development client lands on its launcher instead of the app content, force the app deep link directly:

```bash
xcrun simctl openurl booted atoupay://
adb shell am start -W -a android.intent.action.VIEW -d "atoupay://" com.atoupay.mobile.dev
```
