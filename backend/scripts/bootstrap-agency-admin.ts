import 'dotenv/config';

import { getFirestore } from 'firebase-admin/firestore';

import { loadConfig } from '../src/config/env.js';
import { hashStableValue } from '../src/lib/invite.js';
import { initializeFirebaseAdmin } from '../src/lib/firebase-admin.js';
import {
  OWNER_ACCOUNT_FEE_AMOUNT,
  OWNER_ACCOUNT_FEE_CURRENCY,
  OWNER_ACCOUNT_FEE_INTERVAL_DAYS,
} from '../src/billing/billingConstants.js';

interface CliArgs {
  agencyId: string;
  agencyName: string;
  legacyCommissionRateInput: number;
  email: string;
}

function parseArgs(argv: string[]): CliArgs {
  const values = new Map<string, string>();

  for (let index = 0; index < argv.length; index += 1) {
    const entry = argv[index];

    if (!entry?.startsWith('--')) {
      continue;
    }

    const key = entry.slice(2);
    const next = argv[index + 1];

    if (!next || next.startsWith('--')) {
      throw new Error(`Missing value for --${key}`);
    }

    values.set(key, next);
    index += 1;
  }

  const email = values.get('email')?.trim().toLowerCase();
  const agencyId = values.get('agency-id')?.trim() ?? 'agency-dev';
  const agencyName = values.get('agency-name')?.trim() ?? 'Agence ATouPay';
  const legacyCommissionRateRaw = values.get('commission-rate')?.trim() ?? '0';
  const legacyCommissionRateInput = Number.parseFloat(legacyCommissionRateRaw);

  if (!email || !email.includes('@')) {
    throw new Error('Usage: npm run agency-admin:bootstrap -- --email admin@example.com [--agency-id agency-dev] [--agency-name "Agence ATouPay"]');
  }

  if (!Number.isFinite(legacyCommissionRateInput) || legacyCommissionRateInput < 0 || legacyCommissionRateInput > 1) {
    throw new Error('--commission-rate is deprecated and, when present, must be a number between 0 and 1.');
  }

  return {
    agencyId,
    agencyName,
    legacyCommissionRateInput,
    email,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = loadConfig();
  const app = initializeFirebaseAdmin(config);
  const db = getFirestore(app);
  const now = new Date().toISOString();
  const bootstrapId = hashStableValue(args.email);
  const bootstrapRef = db.collection('agencyAdminBootstraps').doc(bootstrapId);
  const agencyRef = db.collection('agencies').doc(args.agencyId);

  const [existingBootstrap, existingAgency] = await Promise.all([
    bootstrapRef.get(),
    agencyRef.get(),
  ]);

  if (existingBootstrap.exists) {
    const status = existingBootstrap.data()?.status ?? 'unknown';
    console.log(
      JSON.stringify(
        {
          bootstrapId,
          email: args.email,
          message: 'Agency admin bootstrap already exists.',
          status,
        },
        null,
        2,
      ),
    );
    return;
  }

  const batch = db.batch();

  if (!existingAgency.exists) {
    batch.set(agencyRef, {
      commissionRate: 0,
      commissionType: 'percentage',
      createdAt: now,
      displayName: args.agencyName,
      ownerAccountFeeAmount: OWNER_ACCOUNT_FEE_AMOUNT,
      ownerAccountFeeCurrency: OWNER_ACCOUNT_FEE_CURRENCY,
      ownerAccountFeeIntervalDays: OWNER_ACCOUNT_FEE_INTERVAL_DAYS,
      updatedAt: now,
    });
  } else {
    batch.set(
      agencyRef,
      {
        displayName: args.agencyName,
        ownerAccountFeeAmount: OWNER_ACCOUNT_FEE_AMOUNT,
        ownerAccountFeeCurrency: OWNER_ACCOUNT_FEE_CURRENCY,
        ownerAccountFeeIntervalDays: OWNER_ACCOUNT_FEE_INTERVAL_DAYS,
        updatedAt: now,
      },
      { merge: true },
    );
  }

  batch.set(bootstrapRef, {
    agencyId: args.agencyId,
    claimedAt: null,
    claimedByUid: null,
    createdAt: now,
    email: args.email,
    status: 'pending',
    updatedAt: now,
  });

  await batch.commit();

  console.log(
    JSON.stringify(
      {
        agencyId: args.agencyId,
        agencyName: args.agencyName,
        bootstrapId,
        legacyCommissionRateInputIgnored: args.legacyCommissionRateInput,
        ownerAccountFeeAmount: OWNER_ACCOUNT_FEE_AMOUNT,
        ownerAccountFeeCurrency: OWNER_ACCOUNT_FEE_CURRENCY,
        ownerAccountFeeIntervalDays: OWNER_ACCOUNT_FEE_INTERVAL_DAYS,
        email: args.email,
        message:
          'Agency admin bootstrap created. The user can now sign in and choose the Agence role to claim access.',
      },
      null,
      2,
    ),
  );
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
