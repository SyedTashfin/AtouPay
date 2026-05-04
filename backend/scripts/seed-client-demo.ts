import 'dotenv/config';

import { getAuth, type UserRecord } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

import { loadConfig } from '../src/config/env.js';
import { initializeFirebaseAdmin } from '../src/lib/firebase-admin.js';
import { currentMonthDueDate, currentMonthKey, hashInviteCode, hashStableValue } from '../src/lib/invite.js';
import type { AuthProvider, Role, UserStatus } from '../src/domain/types.js';
import {
  OWNER_ACCOUNT_FEE_AMOUNT,
  OWNER_ACCOUNT_FEE_CURRENCY,
  OWNER_ACCOUNT_FEE_INTERVAL_DAYS,
} from '../src/billing/billingConstants.js';

const agencyId = 'agency-client-demo';
const propertyId = 'property-client-demo-main';
const occupiedUnitId = 'unit-client-demo-a1';
const spareUnitId = 'unit-client-demo-b1';
const ownerAccessCode = 'OWNR-DEMO-2026-0001';
const ownerAccessInviteId = hashInviteCode(ownerAccessCode);
const tenantInviteCode = 'TENT-DEMO-2026-0001';
const tenantInviteId = hashInviteCode(tenantInviteCode);

const demoUsers = {
  agency: {
    displayName: 'Agence Client Démo',
    email: 'client.agency@example.com',
  },
  blockedOwner: {
    displayName: 'Propriétaire Bloqué Démo',
    email: 'client.blocked.owner@example.com',
  },
  newTenant: {
    displayName: 'Nouveau Locataire Démo',
    email: 'client.newtenant@example.com',
  },
  owner: {
    displayName: 'Propriétaire Client Démo',
    email: 'client.owner@example.com',
  },
  tenant: {
    displayName: 'Locataire Client Démo',
    email: 'client.tenant@example.com',
  },
} as const;

function resolveDemoPassword() {
  const password = process.env.CLIENT_DEMO_PASSWORD;

  if (password && password.length < 8) {
    throw new Error('CLIENT_DEMO_PASSWORD must be at least 8 characters when provided.');
  }

  return password;
}

function mapAuthProviders(user: UserRecord): AuthProvider[] {
  const providers = new Set<AuthProvider>();

  for (const provider of user.providerData) {
    if (provider.providerId === 'password') {
      providers.add('password');
    }

    if (provider.providerId === 'google.com') {
      providers.add('google');
    }
  }

  providers.add('password');

  return Array.from(providers);
}

async function upsertAuthUser(input: {
  displayName: string;
  email: string;
  password?: string;
}) {
  const auth = getAuth();

  try {
    const existing = await auth.getUserByEmail(input.email);
    await auth.updateUser(existing.uid, {
      disabled: false,
      displayName: input.displayName,
      emailVerified: true,
      ...(input.password ? { password: input.password } : {}),
    });

    return auth.getUser(existing.uid);
  } catch (error) {
    const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : null;

    if (code !== 'auth/user-not-found') {
      throw error;
    }

    if (!input.password) {
      throw new Error(
        `Demo user ${input.email} does not exist. Set CLIENT_DEMO_PASSWORD to create it.`,
      );
    }

    return auth.createUser({
      disabled: false,
      displayName: input.displayName,
      email: input.email,
      emailVerified: true,
      password: input.password,
    });
  }
}

function buildUserDoc(input: {
  agencyId: string | null;
  createdAt: string;
  displayName: string;
  email: string;
  ownerId: string | null;
  providers: AuthProvider[];
  role: Role;
  status: UserStatus;
  tenantId: string | null;
  uid: string;
}) {
  return {
    agencyId: input.agencyId,
    authProviders: input.providers,
    createdAt: input.createdAt,
    displayName: input.displayName,
    email: input.email,
    emailVerified: true,
    ownerId: input.ownerId,
    phoneNumber: null,
    photoURL: null,
    recoveryContactPreference: null,
    role: input.role,
    status: input.status,
    supportRecoveryStatus: null,
    tenantId: input.tenantId,
    uid: input.uid,
    updatedAt: input.createdAt,
  };
}

function calculateZeroRentLedger(grossAmount: number) {
  return {
    agencyFeeAmount: 0,
    commissionRate: 0,
    ownerNetAmount: grossAmount,
    ownerReceivableAmount: grossAmount,
    platformRentFeeAmount: 0,
    rentAmount: grossAmount,
    tenantFeeAmount: 0,
  };
}

async function ensureTermsAcceptance(uid: string, now: string) {
  const db = getFirestore();
  const termsRef = db.collection('legalTerms').doc('terms-of-use');
  const termsSnapshot = await termsRef.get();
  let termsVersion = termsSnapshot.get('version') as string | undefined;

  if (!termsSnapshot.exists || !termsVersion) {
    termsVersion = '2026-04-demo-terms';
    await termsRef.set(
      {
        locale: 'fr',
        responsibilityStatement:
          'ATouPay reste un outil de gestion et de preuve interne tant que les paiements sont simulés.',
        sections: [
          {
            body: 'Les paiements de cette démo sont simulés et ne déclenchent aucun débit réel.',
            title: 'Paiements simulés',
          },
        ],
        summary: 'Conditions de démonstration ATouPay.',
        supportPath: 'Contactez l’agence depuis l’écran Aide & support.',
        title: 'Conditions d’utilisation ATouPay',
        updatedAt: now,
        version: termsVersion,
      },
      { merge: true },
    );
  }

  await db.collection('userTermsAcceptances').doc(uid).set({
    acceptedAt: now,
    appVersion: 'client-demo',
    locale: 'fr',
    termsVersion,
    uid,
  });
}

async function main() {
  const password = resolveDemoPassword();
  const config = loadConfig();
  const app = initializeFirebaseAdmin(config);
  const auth = getAuth(app);
  const db = getFirestore(app);
  const now = new Date();
  const nowIso = now.toISOString();
  const monthKey = currentMonthKey(now);
  const dueDate = currentMonthDueDate(now);
  const rentAmount = 150000;
  const rentLedger = calculateZeroRentLedger(rentAmount);
  const passwordInput = password ? { password } : {};

  const [agencyAuth, ownerAuth, tenantAuth, blockedOwnerAuth, newTenantAuth] = await Promise.all([
    upsertAuthUser({ ...demoUsers.agency, ...passwordInput }),
    upsertAuthUser({ ...demoUsers.owner, ...passwordInput }),
    upsertAuthUser({ ...demoUsers.tenant, ...passwordInput }),
    upsertAuthUser({ ...demoUsers.blockedOwner, ...passwordInput }),
    upsertAuthUser({ ...demoUsers.newTenant, ...passwordInput }),
  ]);
  const paymentId = `rent-${tenantAuth.uid}-${monthKey}`;

  const receiptSnapshot = await db.collection('receipts').where('paymentId', '==', paymentId).get();
  const newTenantPayments = await db.collection('rentPayments').where('tenantId', '==', newTenantAuth.uid).get();
  const demoTenantInvites = await db.collection('tenantInvites').where('propertyId', '==', propertyId).get();
  const batch = db.batch();

  for (const doc of receiptSnapshot.docs) {
    batch.delete(doc.ref);
  }

  for (const doc of newTenantPayments.docs) {
    batch.delete(doc.ref);
  }

  for (const doc of demoTenantInvites.docs) {
    batch.delete(doc.ref);
  }

  batch.delete(db.collection('tenantInvites').doc(tenantInviteId));
  batch.delete(db.collection('tenants').doc(newTenantAuth.uid));
  batch.delete(db.collection('owners').doc(blockedOwnerAuth.uid));

  batch.set(db.collection('agencies').doc(agencyId), {
    commissionRate: 0,
    commissionType: 'percentage',
    createdAt: nowIso,
    displayName: 'Agence Client Démo',
    ownerAccountFeeAmount: OWNER_ACCOUNT_FEE_AMOUNT,
    ownerAccountFeeCurrency: OWNER_ACCOUNT_FEE_CURRENCY,
    ownerAccountFeeIntervalDays: OWNER_ACCOUNT_FEE_INTERVAL_DAYS,
    updatedAt: nowIso,
  });

  batch.set(db.collection('agencyAdminBootstraps').doc(hashStableValue(demoUsers.agency.email)), {
    agencyId,
    claimedAt: nowIso,
    claimedByUid: agencyAuth.uid,
    createdAt: nowIso,
    email: demoUsers.agency.email,
    status: 'claimed',
    updatedAt: nowIso,
  });

  batch.set(
    db.collection('users').doc(agencyAuth.uid),
    buildUserDoc({
      agencyId,
      createdAt: nowIso,
      displayName: demoUsers.agency.displayName,
      email: demoUsers.agency.email,
      ownerId: null,
      providers: mapAuthProviders(agencyAuth),
      role: 'agency_admin',
      status: 'active',
      tenantId: null,
      uid: agencyAuth.uid,
    }),
  );

  batch.set(
    db.collection('users').doc(ownerAuth.uid),
    buildUserDoc({
      agencyId,
      createdAt: nowIso,
      displayName: demoUsers.owner.displayName,
      email: demoUsers.owner.email,
      ownerId: ownerAuth.uid,
      providers: mapAuthProviders(ownerAuth),
      role: 'owner',
      status: 'active',
      tenantId: null,
      uid: ownerAuth.uid,
    }),
  );

  batch.set(db.collection('owners').doc(ownerAuth.uid), {
    agencyId,
    createdAt: nowIso,
    displayName: demoUsers.owner.displayName,
    updatedAt: nowIso,
    userId: ownerAuth.uid,
  });

  batch.set(
    db.collection('users').doc(tenantAuth.uid),
    buildUserDoc({
      agencyId,
      createdAt: nowIso,
      displayName: demoUsers.tenant.displayName,
      email: demoUsers.tenant.email,
      ownerId: ownerAuth.uid,
      providers: mapAuthProviders(tenantAuth),
      role: 'tenant',
      status: 'active',
      tenantId: tenantAuth.uid,
      uid: tenantAuth.uid,
    }),
  );

  batch.set(
    db.collection('users').doc(blockedOwnerAuth.uid),
    buildUserDoc({
      agencyId: null,
      createdAt: nowIso,
      displayName: demoUsers.blockedOwner.displayName,
      email: demoUsers.blockedOwner.email,
      ownerId: null,
      providers: mapAuthProviders(blockedOwnerAuth),
      role: 'owner',
      status: 'pending_owner_access',
      tenantId: null,
      uid: blockedOwnerAuth.uid,
    }),
  );

  batch.set(
    db.collection('users').doc(newTenantAuth.uid),
    buildUserDoc({
      agencyId: null,
      createdAt: nowIso,
      displayName: demoUsers.newTenant.displayName,
      email: demoUsers.newTenant.email,
      ownerId: null,
      providers: mapAuthProviders(newTenantAuth),
      role: 'tenant',
      status: 'active',
      tenantId: null,
      uid: newTenantAuth.uid,
    }),
  );

  batch.set(db.collection('properties').doc(propertyId), {
    address: 'Tevragh-Zeina, Nouakchott',
    createdAt: nowIso,
    label: 'Résidence Client Démo',
    ownerId: ownerAuth.uid,
    updatedAt: nowIso,
  });

  batch.set(db.collection('units').doc(occupiedUnitId), {
    activeInviteId: null,
    createdAt: nowIso,
    currency: 'MRU',
    label: 'Appartement A1',
    ownerId: ownerAuth.uid,
    propertyId,
    rentAmount,
    status: 'occupied',
    tenantId: tenantAuth.uid,
    updatedAt: nowIso,
  });

  batch.set(db.collection('units').doc(spareUnitId), {
    activeInviteId: null,
    createdAt: nowIso,
    currency: 'MRU',
    label: 'Appartement B1',
    ownerId: ownerAuth.uid,
    propertyId,
    rentAmount: 125000,
    status: 'vacant',
    tenantId: null,
    updatedAt: nowIso,
  });

  batch.set(db.collection('tenants').doc(tenantAuth.uid), {
    createdAt: nowIso,
    displayName: demoUsers.tenant.displayName,
    email: demoUsers.tenant.email,
    ownerId: ownerAuth.uid,
    propertyId,
    status: 'active',
    unitId: occupiedUnitId,
    updatedAt: nowIso,
    userId: tenantAuth.uid,
  });

  batch.set(db.collection('rentPayments').doc(paymentId), {
    agencyFeeAmount: rentLedger.agencyFeeAmount,
    agencyId,
    commissionRate: rentLedger.commissionRate,
    createdAt: nowIso,
    dueDate,
    grossAmount: rentLedger.rentAmount,
    monthKey,
    ownerId: ownerAuth.uid,
    ownerNetAmount: rentLedger.ownerNetAmount,
    ownerReceivableAmount: rentLedger.ownerReceivableAmount,
    paidAt: null,
    paymentMethod: null,
    paymentStatus: 'pending',
    platformRentFeeAmount: rentLedger.platformRentFeeAmount,
    propertyId,
    providerReference: null,
    receiptId: null,
    rentAmount: rentLedger.rentAmount,
    tenantId: tenantAuth.uid,
    tenantFeeAmount: rentLedger.tenantFeeAmount,
    unitId: occupiedUnitId,
    updatedAt: nowIso,
  });

  batch.set(db.collection('ownerAccessInvites').doc(ownerAccessInviteId), {
    agencyId,
    claimedAt: null,
    claimedByUid: null,
    codeHash: ownerAccessInviteId,
    createdAt: nowIso,
    email: demoUsers.blockedOwner.email,
    expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    intendedRole: 'owner',
    inviteType: 'code',
    status: 'pending',
  });

  batch.set(db.collection('notifications').doc('client-demo-agency-ready'), {
    agencyId,
    body: 'La démo client est prête: un propriétaire actif, un locataire rattaché et un loyer simulé en attente.',
    createdAt: nowIso,
    readAt: null,
    relatedEntityId: propertyId,
    relatedEntityType: 'property',
    role: 'agency_admin',
    title: 'Démo client prête',
    type: 'payment_pending',
    userId: agencyAuth.uid,
  });

  batch.set(db.collection('notifications').doc('client-demo-owner-ready'), {
    agencyId,
    body: 'Le locataire de démonstration est déjà rattaché à Appartement A1.',
    createdAt: nowIso,
    readAt: null,
    relatedEntityId: occupiedUnitId,
    relatedEntityType: 'unit',
    role: 'owner',
    title: 'Logement occupé prêt',
    type: 'tenant_invite_redeemed',
    userId: ownerAuth.uid,
  });

  batch.set(db.collection('notifications').doc('client-demo-tenant-ready'), {
    agencyId,
    body: 'Votre loyer de démonstration est prêt pour un paiement simulé.',
    createdAt: nowIso,
    readAt: null,
    relatedEntityId: paymentId,
    relatedEntityType: 'rentPayment',
    role: 'tenant',
    title: 'Loyer simulé en attente',
    type: 'payment_pending',
    userId: tenantAuth.uid,
  });

  await batch.commit();

  await Promise.all([
    ensureTermsAcceptance(agencyAuth.uid, nowIso),
    ensureTermsAcceptance(ownerAuth.uid, nowIso),
    ensureTermsAcceptance(tenantAuth.uid, nowIso),
    ensureTermsAcceptance(blockedOwnerAuth.uid, nowIso),
    ensureTermsAcceptance(newTenantAuth.uid, nowIso),
  ]);

  const removedExtraPayments = newTenantPayments.size;
  const removedTenantInvites = demoTenantInvites.size;
  const removedReceipts = receiptSnapshot.size;

  console.log(
    JSON.stringify(
      {
        agency: {
          email: demoUsers.agency.email,
          role: 'agency_admin',
          status: 'active',
        },
        blockedOwner: {
          email: demoUsers.blockedOwner.email,
          optionalOwnerAccessCode: ownerAccessCode,
          role: 'owner',
          status: 'pending_owner_access',
        },
        mainOwner: {
          email: demoUsers.owner.email,
          ownerId: ownerAuth.uid,
          role: 'owner',
          status: 'active',
        },
        mainTenant: {
          email: demoUsers.tenant.email,
          paymentId,
          role: 'tenant',
          status: 'active',
          unitId: occupiedUnitId,
        },
        reset: {
          removedExtraPayments,
          removedReceipts,
          removedTenantInvites,
          spareUnitStatus: 'vacant',
          tenantInviteRequiredForMainDemo: false,
        },
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
