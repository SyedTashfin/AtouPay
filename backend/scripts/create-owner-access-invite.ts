import 'dotenv/config';

import { parseArgs } from 'node:util';

import { Timestamp } from 'firebase-admin/firestore';

import { loadConfig } from '../src/config/env.js';
import { initializeFirebaseAdmin, createFirestore } from '../src/lib/firebase-admin.js';
import { generateInviteCode, hashInviteCode } from '../src/lib/invite.js';
import {
  OWNER_ACCOUNT_FEE_AMOUNT,
  OWNER_ACCOUNT_FEE_CURRENCY,
  OWNER_ACCOUNT_FEE_INTERVAL_DAYS,
} from '../src/billing/billingConstants.js';

function buildOwnerAccessLink(baseUrl: string, inviteCode: string) {
  const separator = baseUrl.includes('?') ? '&' : '?';

  return `${baseUrl}${separator}ownerInvite=${encodeURIComponent(inviteCode)}`;
}

async function main() {
  const { values } = parseArgs({
    allowPositionals: false,
    options: {
      agency: {
        type: 'string',
      },
      days: {
        type: 'string',
      },
      email: {
        type: 'string',
      },
      rate: {
        type: 'string',
      },
    },
  });

  const agencyId = values.agency?.trim();

  if (!agencyId) {
    throw new Error('Missing --agency <agencyId>.');
  }

  const email = values.email?.trim().toLowerCase() ?? null;
  const days = values.days ? Number.parseInt(values.days, 10) : 7;

  if (!Number.isInteger(days) || days <= 0) {
    throw new Error('--days must be a positive integer.');
  }

  const legacyRateInput = values.rate ? Number.parseFloat(values.rate) : 0;

  if (!Number.isFinite(legacyRateInput) || legacyRateInput < 0 || legacyRateInput > 1) {
    throw new Error('--rate must be a decimal between 0 and 1.');
  }

  const config = loadConfig();
  const app = initializeFirebaseAdmin(config);
  const firestore = createFirestore(app);
  const now = Timestamp.now();
  const expiresAt = Timestamp.fromMillis(now.toMillis() + days * 24 * 60 * 60 * 1000);
  const inviteCode = generateInviteCode();
  const inviteId = hashInviteCode(inviteCode);
  const agencyRef = firestore.collection('agencies').doc(agencyId);
  const agencySnapshot = await agencyRef.get();

  if (!agencySnapshot.exists) {
    await agencyRef.set({
      commissionRate: 0,
      commissionType: 'percentage',
      createdAt: now,
      label: `Agence ${agencyId}`,
      ownerAccountFeeAmount: OWNER_ACCOUNT_FEE_AMOUNT,
      ownerAccountFeeCurrency: OWNER_ACCOUNT_FEE_CURRENCY,
      ownerAccountFeeIntervalDays: OWNER_ACCOUNT_FEE_INTERVAL_DAYS,
      updatedAt: now,
    });
  } else {
    await agencyRef.set(
      {
        commissionRate: 0,
        commissionType: 'percentage',
        ownerAccountFeeAmount: OWNER_ACCOUNT_FEE_AMOUNT,
        ownerAccountFeeCurrency: OWNER_ACCOUNT_FEE_CURRENCY,
        ownerAccountFeeIntervalDays: OWNER_ACCOUNT_FEE_INTERVAL_DAYS,
        updatedAt: now,
      },
      { merge: true },
    );
  }

  await firestore.collection('ownerAccessInvites').doc(inviteId).set({
    agencyId,
    claimedAt: null,
    claimedByUid: null,
    createdAt: now,
    email,
    expiresAt,
    intendedRole: 'owner',
    inviteType: 'code',
    status: 'pending',
  });

  const link = buildOwnerAccessLink(config.inviteBaseUrl, inviteCode);

  console.log(
    JSON.stringify(
      {
        agencyId,
        email,
        expiresAt: expiresAt.toDate().toISOString(),
        inviteCode,
        inviteId,
        legacyRateInputIgnored: legacyRateInput,
        link,
        ownerAccountFeeAmount: OWNER_ACCOUNT_FEE_AMOUNT,
        ownerAccountFeeCurrency: OWNER_ACCOUNT_FEE_CURRENCY,
        ownerAccountFeeIntervalDays: OWNER_ACCOUNT_FEE_INTERVAL_DAYS,
        projectId: config.firebaseProjectId,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
