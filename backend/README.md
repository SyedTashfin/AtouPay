# ATouPay Backend

This directory contains the first ATouPay application backend service. It is separate from the Expo app and currently exposes:

- `GET /health`
- `GET /v1/legal/terms`
- `GET /v1/legal/terms/status`
- `POST /v1/legal/terms/accept`
- `POST /v1/profile/bootstrap`
- `GET /v1/profile/contact`
- `PATCH /v1/profile/contact`
- `GET /v1/agency/owner-access-invites`
- `POST /v1/agency/owner-access-invites`
- `POST /v1/agency/owner-access-invites/:inviteId/revoke`
- `GET /v1/agency/dashboard`
- `GET /v1/agency/owners`
- `GET /v1/agency/users`
- `PATCH /v1/agency/users/:uid/status`
- `GET /v1/agency/audit-logs`
- `GET /v1/owner/dashboard`
- `GET /v1/agency/settings`
- `PATCH /v1/agency/settings`
- `GET /v1/support/requests`
- `POST /v1/support/requests`
- `POST /v1/support/recovery-request`
- `PATCH /v1/support/requests/:requestId`
- `GET /v1/notifications`
- `POST /v1/notifications/:notificationId/read`
- `POST /v1/owner-access/redeem`
- `POST /v1/owner/properties`
- `POST /v1/owner/units`
- `POST /v1/invites`
- `POST /v1/invites/redeem`
- `POST /v1/payments/:paymentId/simulate-complete`
- `GET /v1/receipts/:receiptId`
- `GET /v1/receipts/verify/:token`

The Expo mobile app can now route the minimum end-to-end write slice through this backend when `EXPO_PUBLIC_USE_BACKEND=true`. Current reads still use Firebase directly in the app for the lowest-risk local testing path.

Payments remain simulated. This backend does not integrate any real payment provider.

## Operational dashboards, notifications, and account controls

The backend now exposes the minimum operational read models needed by the current app:

- agency dashboard summary for active owners, tenants, properties, units, invites, support requests, payment status, and simulated commission totals
- owner dashboard summary for properties, units, occupancy, tenant count, payment status, gross amount, agency fee, and owner net
- in-app notification records in `notifications/{notificationId}`
- audit records in `auditLogs/{auditLogId}`
- agency-owned suspension/reactivation of owner and tenant user accounts

Suspension behavior is intentionally simple:

- agency admins can suspend/reactivate owner and tenant accounts in their agency
- suspended users remain Firebase-authenticated but are blocked from normal app usage
- suspension and reactivation create audit entries and in-app notifications

This is not push notification infrastructure. Push delivery is out of scope until Expo push tokens, provider credentials, opt-in UX, and delivery verification are implemented.

## Payment provider boundary

The backend contains a minimal provider abstraction surface in `src/services/payment-provider.ts`.

Current behavior:

- `finalizeSimulatedPaymentProvider` only returns a simulated provider reference
- no debit, mobile-money transfer, bank API call, webhook, or split disbursement is executed
- receipt and commission data remain backend-owned ledger records

Future real payment providers should plug in behind this boundary and must add verified credentials, webhook validation, idempotency, reconciliation, and failure-state handling before any real-money wording is used.

## Trust, recovery, and receipt hardening

This backend now owns the minimum operational trust layer for the live app:

- versioned legal terms delivery
- per-user terms acceptance tracking
- support, incident, dispute, and assisted recovery request storage
- backend-owned receipt issuance metadata and verification responses
- recovery-contact preference storage for agency follow-up

Important:

- phone recovery is only scaffolded at the product level unless Firebase Phone Auth is explicitly enabled in the target Firebase project
- this backend does not create a real phone-auth reset flow by itself
- receipts remain honest about simulated payments and do not imply bank-certified settlement

## Recommended local path for this repo

For the current ATouPay mobile app, the simplest real-app local workflow is:

- use one real Firebase DEV project for both app and backend
- run this backend locally in non-emulator mode
- set `GOOGLE_APPLICATION_CREDENTIALS` to an absolute path for a local Firebase Admin service-account JSON
- enable `EXPO_PUBLIC_USE_BACKEND=true` in the Expo app

Do not use Firebase emulators for this particular local happy-path test unless you are explicitly testing emulator behavior.

## Runtime modes

The backend now supports exactly three runtime modes.

### A. Full local emulator mode

Use this when you want the whole backend to run against local Firebase emulators.

Characteristics:

- Firestore emulator enabled
- Auth emulator enabled
- backend runs on its own port, recommended `3001`
- no `FIREBASE_CLIENT_EMAIL` required
- no `FIREBASE_PRIVATE_KEY` required
- no `GOOGLE_APPLICATION_CREDENTIALS` required

### B. Hybrid local mode

Use this when you want local Firestore writes but real Firebase Auth token verification.

Characteristics:

- Firestore emulator enabled
- Auth emulator disabled
- backend runs on its own port, recommended `3001`
- prefer ADC or `GOOGLE_APPLICATION_CREDENTIALS` if Admin SDK needs cloud credentials
- explicit private-key env vars are optional fallback only

### C. Cloud Run / production-like mode

Use this for deployed environments and production-like local runs.

Characteristics:

- no emulator env vars
- prefer Google Application Default Credentials or an attached Cloud Run service account
- do **not** rely on `FIREBASE_PRIVATE_KEY` in env by default
- explicit service-account env vars remain optional fallback only

## Local setup

```bash
cd backend
npm install
cp .env.example .env
```

## Exact `.env` examples

### Real Firebase DEV project local mode

Recommended for this repo when you want to run the mobile app and backend together without emulators.

```dotenv
HOST=0.0.0.0
PORT=3001
NODE_ENV=development
LOG_LEVEL=info
APP_INVITE_BASE_URL=atoupay://auth/login
FIREBASE_PROJECT_ID=your-firebase-project-id
GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/firebase-admin-service-account.json
```

Notes:

- this JSON is for **local backend testing only**
- keep it outside the repo
- use an absolute path
- for Cloud Run or production, prefer an attached service account / ADC instead of private key env blobs

### Full local emulator mode

```dotenv
HOST=0.0.0.0
PORT=3001
NODE_ENV=development
LOG_LEVEL=info
APP_INVITE_BASE_URL=atoupay://auth/login
FIREBASE_PROJECT_ID=atoupay-dev
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
```

### Hybrid local mode

```dotenv
HOST=0.0.0.0
PORT=3001
NODE_ENV=development
LOG_LEVEL=info
APP_INVITE_BASE_URL=atoupay://auth/login
FIREBASE_PROJECT_ID=atoupay-dev
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/service-account.json
```

Notes:

- Do not set `FIREBASE_AUTH_EMULATOR_HOST` in hybrid mode.
- If local ADC is already available, `GOOGLE_APPLICATION_CREDENTIALS` can be omitted.
- If you choose explicit fallback env credentials instead, provide both `FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY`.

### Cloud Run / production-like mode

```dotenv
HOST=0.0.0.0
PORT=3001
NODE_ENV=production
LOG_LEVEL=info
APP_INVITE_BASE_URL=atoupay://auth/login
FIREBASE_PROJECT_ID=your-firebase-project-id
```

Notes:

- Do not set emulator hosts in this mode.
- Prefer an attached Cloud Run service account.
- Do not inject `FIREBASE_PRIVATE_KEY` in env unless you are using it as a deliberate fallback.

## Credential strategy

Preferred order:

1. **Full local emulator mode**: no service-account secrets at all
2. **Hybrid local mode**: ADC or `GOOGLE_APPLICATION_CREDENTIALS` absolute path if needed
3. **Cloud Run**: attached service account through Google Application Default Credentials

Fallback only:

- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

Important rules:

- `GOOGLE_APPLICATION_CREDENTIALS` must be an **absolute path**
- `~` is rejected deliberately
- emulator hosts must be `host:port` only, never `http://host:port`
- backend `PORT` must not collide with emulator ports

## Start Firebase emulators

From the repo root:

```bash
npx firebase-tools emulators:start --only auth,firestore
```

Default ports expected by this backend documentation:

- Firestore emulator: `127.0.0.1:8080`
- Auth emulator: `127.0.0.1:9099`
- backend: `127.0.0.1:3001`

## Run the backend locally

Development watch mode:

```bash
cd backend
npm run dev
```

Generate a local owner-access invite for agency-gated owner testing:

```bash
cd backend
npm run owner-access:invite -- --agency agency-dev --email owner@example.com --rate 0.1
```

That command creates or updates `agencies/{agencyId}` with a percentage commission rate, then writes a pending `ownerAccessInvites/{inviteId}` record and prints a usable code plus `ownerInvite` deep link.

Bootstrap the first real agency admin:

```bash
cd backend
npm run agency-admin:bootstrap -- \
  --email admin@example.com \
  --agency-id agency-dev \
  --agency-name "Agence ATouPay" \
  --commission-rate 0.1
```

What this does:

- ensures `agencies/{agencyId}` exists
- seeds `agencyAdminBootstraps/{hash(email)}`
- allows that e-mail address to sign in and claim the `agency_admin` role through `POST /v1/profile/bootstrap`

This is a one-time bootstrap or emergency tool. Normal owner onboarding should then happen from the in-app agency area, not from CLI scripts.

Production build locally:

```bash
cd backend
npm run build
npm run start
```

## Deploy to Cloud Run

The cleanest cloud deployment for this backend is Cloud Run.

Important:

- Cloud Run requires a GCP project with billing enabled, even if usage stays inside the free tier
- if your Firebase project has no billing attached, deploy the backend into another billed GCP project and point it back to the Firebase project with `FIREBASE_PROJECT_ID`
- the app then uses the Cloud Run URL through `EXPO_PUBLIC_API_BASE_URL`

### Recommended approach

For production-like pilot deployments:

1. keep Firebase Auth and Firestore in the existing Firebase project
2. deploy this backend to a billed GCP project that already has Cloud Run enabled
3. attach a dedicated Cloud Run service account
4. grant that service account only the Firebase/Auth/Firestore permissions needed by this backend
5. set only non-secret runtime env vars on Cloud Run

The deployment script still supports the older env-secret fallback for local demos, but the preferred pilot path is attached service-account credentials. Do not inject `FIREBASE_PRIVATE_KEY` into Cloud Run unless you are deliberately using the fallback.

### Deploy command

From `/backend`:

```bash
npm run deploy:cloud-run -- \
  --project your-billed-gcp-project \
  --region europe-west1 \
  --service atoupay-backend \
  --credential-mode attached \
  --service-account atoupay-backend@your-billed-gcp-project.iam.gserviceaccount.com
```

What the script does:

- loads `backend/.env`
- deploys this backend to Cloud Run from source
- configures:
  - `FIREBASE_PROJECT_ID`
  - `APP_INVITE_BASE_URL`
  - `NODE_ENV=production`
- attaches the service account when `--service-account` is provided
- prints the deployed service URL

Fallback for local demos only:

```bash
npm run deploy:cloud-run -- \
  --project your-billed-gcp-project \
  --region europe-west1 \
  --service atoupay-backend \
  --credential-mode env
```

The fallback reads the Firebase Admin service-account JSON from `GOOGLE_APPLICATION_CREDENTIALS` and injects `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY` into Cloud Run env vars. Keep the JSON outside the repo and prefer the attached-service-account command above for pilot/production.

### Point the mobile app to Cloud Run

Set this in the app env:

```dotenv
EXPO_PUBLIC_USE_BACKEND=true
EXPO_PUBLIC_API_BASE_URL=https://your-cloud-run-url
```

Then restart Metro or rebuild the native dev client.

## Test `/health`

```bash
curl http://127.0.0.1:3001/health
```

Expected response:

```json
{
  "ok": true,
  "service": "@atoupay/backend",
  "status": "healthy"
}
```

## Test an authenticated route

### Option 1. Emulator auth token

Create a local test user and get an emulator ID token:

```bash
curl -s \
  -X POST "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key" \
  -H "Content-Type: application/json" \
  -d '{"email":"owner@example.com","password":"Password123!","returnSecureToken":true}'
```

Copy the returned `idToken`, then call:

```bash
curl -s \
  -X POST http://127.0.0.1:3001/v1/profile/bootstrap \
  -H "Authorization: Bearer <EMULATOR_ID_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"role":"owner"}'
```

### Option 2. Real Firebase ID token

Use a real Firebase ID token from a valid Firebase-authenticated user, then call:

```bash
curl -s \
  -X POST http://127.0.0.1:3001/v1/profile/bootstrap \
  -H "Authorization: Bearer <REAL_FIREBASE_ID_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"role":"owner"}'
```

For manual local testing outside the mobile app, that token can come from:

- a Firebase client script
- a live mobile session
- Firebase REST sign-in flow if you already have a web API key for that project

## Terms, support, recovery, and receipt behavior

### Terms of use

The backend serves the current legal document from `legalDocuments/terms-of-use` and records acceptance in `userTermsAcceptances/{uid}`.

If no legal document exists yet, the backend creates a safe default version that covers:

- payment errors
- tenant non-payment
- bugs or platform outages
- limits of responsibility
- escalation through the agency support path

### Support and disputes

Support-style requests are stored in `supportRequests/{requestId}` and currently cover:

- `general_help`
- `payment_problem`
- `tenant_nonpayment`
- `bug_or_outage`
- `account_recovery`

Access model:

- authenticated users can create requests for themselves
- agency admins can list and update requests tied to their agency
- public assisted-recovery requests can be submitted without prior authentication

### Account recovery

Supported now:

- Firebase password reset e-mail
- agency-assisted recovery request intake
- backend-owned storage of phone number and preferred recovery contact method

Not fully enabled by default:

- Firebase Phone Auth sign-in or recovery

If you want actual phone recovery, you must enable and configure Firebase Phone Auth separately in the Firebase project and then wire the mobile client flow deliberately.

### Receipt meaning

Receipt issuance is backend-owned and final issuance fields are not intended to be freely client-editable.

Current receipt wording is intentionally careful:

- `Quittance générée par AtouPay`
- `peut servir de justificatif de paiement selon les informations enregistrées dans le système`
- explicit simulated-payment wording when the payment was simulated

The verification endpoint confirms that the receipt token and recorded system data are valid. It does **not** imply banking certification, legal judgment, or government endorsement.

## Validation commands

```bash
cd backend
npm run typecheck
npm test
npm run build
```

## Docker

Build the container:

```bash
cd backend
docker build -t atoupay-backend:local .
```

Run it locally:

```bash
docker run --rm -p 3001:3001 --env-file .env atoupay-backend:local
```

## Cloud Run deployment notes

Minimum production approach:

1. build the container
2. deploy it to Cloud Run
3. attach a dedicated service account
4. set non-secret env vars at deploy time

Recommended service-account capabilities:

- verify Firebase ID tokens
- read and write the Firestore collections used by this backend slice

Avoid broad project-owner roles. Use least privilege.

Cloud Run should supply credentials through the attached service account. That is the preferred production model.

## Current limitations

- payment settlement remains simulated
- Expo still uses direct Firestore reads for the current low-risk local setup
- the app still depends on the backend for all sensitive writes in the operational flow
- no real banking, mobile money, or split disbursement provider is integrated here
- no CI pipeline in this backend directory yet
