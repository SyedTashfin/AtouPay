import 'dotenv/config';

import { parseArgs } from 'node:util';

import { Timestamp } from 'firebase-admin/firestore';

import { loadConfig } from '../src/config/env.js';
import { initializeFirebaseAdmin, createFirestore } from '../src/lib/firebase-admin.js';
import { generateInviteCode, hashInviteCode } from '../src/lib/invite.js';

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

  const commissionRate = values.rate ? Number.parseFloat(values.rate) : 0.1;

  if (!Number.isFinite(commissionRate) || commissionRate < 0 || commissionRate > 1) {
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
      commissionRate,
      commissionType: 'percentage',
      createdAt: now,
      label: `Agence ${agencyId}`,
      updatedAt: now,
    });
  } else {
    await agencyRef.set(
      {
        commissionRate,
        commissionType: 'percentage',
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
        commissionRate,
        email,
        expiresAt: expiresAt.toDate().toISOString(),
        inviteCode,
        inviteId,
        link,
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
