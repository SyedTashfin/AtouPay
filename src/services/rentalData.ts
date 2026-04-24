import * as Crypto from 'expo-crypto';
import {
  collection,
  doc,
  DocumentData,
  getDoc,
  runTransaction,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';

import { isBackendEnabled } from '@/src/config/env';
import { requireFirestore } from '@/src/lib/firebase';
import {
  completeSimulatedPaymentViaBackend,
  createOwnerPropertyViaBackend,
  createOwnerUnitViaBackend,
  createTenantInviteViaBackend,
  mapBackendErrorToMessage,
  redeemTenantInviteViaBackend,
} from '@/src/services/backendApi';
import { buildInviteLink, generateInviteCode, hashInviteCode, normalizeInviteCode } from '@/src/services/inviteCode';
import {
  AgencyRecord,
  InviteGenerationResult,
  InviteRedemptionResult,
  MutationResult,
  OwnerRecord,
  PaymentAttemptResult,
  PaymentProvider,
  PaymentRecord,
  Property,
  PropertyRecord,
  ReceiptRecord,
  RentPaymentRecord,
  TenantContact,
  TenantRecord,
  UnitRecord,
} from '@/src/types';

function normalizeDateValue(value: unknown) {
  if (!value) {
    return undefined;
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    const candidate = value as { toDate?: () => Date };

    if (typeof candidate.toDate === 'function') {
      return candidate.toDate().toISOString();
    }
  }

  return undefined;
}

function normalizeNullableString(value: unknown) {
  return typeof value === 'string' || value === null ? value : undefined;
}

function generatePaymentReference(prefix: string) {
  return `${prefix}-${Date.now().toString().slice(-8)}`;
}

function resolveInviteGenerationFailure(error: unknown) {
  const message =
    error instanceof Error ? error.message : "L’invitation n'a pas pu être créée.";

  if (message.includes('déjà occupée')) {
    return { message, title: 'Unité occupée' as const };
  }

  if (message.includes('invitation active')) {
    return { message, title: 'Invitation déjà active' as const };
  }

  if (message.includes('collision')) {
    return { message, title: 'Collision d’invitation' as const };
  }

  if (message.includes('propres unités')) {
    return { message, title: 'Accès refusé' as const };
  }

  if (message.includes('n’existe plus')) {
    return { message, title: 'Bien indisponible' as const };
  }

  return { message, title: 'Invitation impossible' as const };
}

function resolveInviteClaimFailure(error: unknown) {
  const message =
    error instanceof Error ? error.message : "L’invitation n'a pas pu être réclamée.";

  if (message.includes('Aucune invitation active')) {
    return { message, title: 'Code invalide' as const };
  }

  if (message.includes('expiré')) {
    return { message, title: 'Invitation expirée' as const };
  }

  if (message.includes('déjà été utilisée') || message.includes('n’est plus active')) {
    return { message, title: 'Invitation déjà utilisée' as const };
  }

  if (message.includes('déjà attribuée')) {
    return { message, title: 'Unité déjà occupée' as const };
  }

  if (message.includes('réservée à une autre adresse')) {
    return { message, title: 'Invitation réservée' as const };
  }

  if (message.includes('déjà rattaché')) {
    return { message, title: 'Compte déjà rattaché' as const };
  }

  if (message.includes('Seul un compte locataire')) {
    return { message, title: 'Compte locataire requis' as const };
  }

  if (message.includes('profil Firebase')) {
    return { message, title: 'Profil indisponible' as const };
  }

  return { message, title: 'Réclamation impossible' as const };
}

function currentMonthKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');

  return `${year}-${month}`;
}

function currentMonthDueDate() {
  return `${currentMonthKey()}-05`;
}

function clampCommissionRate(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(value, 1));
}

function calculateCommissionLedger(grossAmount: number, commissionRate: number) {
  const normalizedRate = clampCommissionRate(commissionRate);
  const agencyFeeAmount = Math.round(grossAmount * normalizedRate);

  return {
    agencyFeeAmount,
    commissionRate: normalizedRate,
    ownerNetAmount: Math.max(0, grossAmount - agencyFeeAmount),
  };
}

export function mapOwnerRecordToUser(owner: OwnerRecord, propertyIds: string[]) {
  return {
    email: '',
    fullName: owner.displayName,
    id: owner.id,
    initials: owner.displayName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || 'AT',
    ownerId: owner.id,
    phone: 'Non renseigné',
    propertyIds,
    role: 'owner' as const,
  };
}

export function mapTenantRecordToContact(record: TenantRecord): TenantContact {
  return {
    email: record.email,
    fullName: record.displayName,
    id: record.id,
    initials:
      record.displayName
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? '')
        .join('') || 'AT',
    phone: 'Non renseigné',
    propertyId: record.propertyId,
    status: record.status,
    unitId: record.unitId,
  };
}

export function mapUnitToUiProperty(
  unit: UnitRecord,
  property: PropertyRecord | undefined,
): Property {
  return {
    activeInviteId: unit.activeInviteId ?? null,
    address: property?.address ?? 'Adresse indisponible',
    firestorePropertyId: property?.id,
    id: unit.id,
    monthlyRent: unit.rentAmount,
    name: property?.label ?? 'Bien ATouPay',
    occupancyStatus: unit.status,
    ownerId: unit.ownerId,
    tenantIds: unit.tenantId ? [unit.tenantId] : [],
    unitLabel: unit.label,
  };
}

export function mapRentPaymentToUiPayment(record: RentPaymentRecord): PaymentRecord {
  return {
    amount: record.grossAmount,
    agencyFeeAmount: record.agencyFeeAmount,
    agencyId: record.agencyId ?? null,
    commissionRate: record.commissionRate,
    dueDate: record.dueDate,
    grossAmount: record.grossAmount,
    id: record.id,
    monthKey: record.monthKey,
    ownerId: record.ownerId,
    ownerNetAmount: record.ownerNetAmount,
    paidAt: record.paidAt ?? undefined,
    propertyId: record.unitId,
    provider: record.paymentMethod ?? undefined,
    receiptId: record.receiptId ?? undefined,
    referenceId:
      record.providerReference && record.providerReference.trim().length > 0
        ? record.providerReference
        : generatePaymentReference('ATP'),
    status: record.paymentStatus,
    tenantId: record.tenantId,
    unitId: record.unitId,
  };
}

export function normalizeOwnerRecord(id: string, data: DocumentData): OwnerRecord {
  return {
    agencyId: normalizeNullableString(data.agencyId),
    createdAt: normalizeDateValue(data.createdAt),
    displayName:
      typeof data.displayName === 'string' && data.displayName.trim().length > 0
        ? data.displayName
        : 'Propriétaire ATouPay',
    id,
    updatedAt: normalizeDateValue(data.updatedAt),
    userId: typeof data.userId === 'string' ? data.userId : id,
  };
}

export function normalizePropertyRecord(id: string, data: DocumentData): PropertyRecord {
  return {
    address: typeof data.address === 'string' ? data.address : 'Adresse indisponible',
    createdAt: normalizeDateValue(data.createdAt),
    id,
    label: typeof data.label === 'string' ? data.label : 'Bien ATouPay',
    ownerId: typeof data.ownerId === 'string' ? data.ownerId : '',
    updatedAt: normalizeDateValue(data.updatedAt),
  };
}

export function normalizeUnitRecord(id: string, data: DocumentData): UnitRecord {
  return {
    activeInviteId: normalizeNullableString(data.activeInviteId),
    createdAt: normalizeDateValue(data.createdAt),
    currency: typeof data.currency === 'string' ? data.currency : 'MRU',
    id,
    label: typeof data.label === 'string' ? data.label : 'Unité',
    ownerId: typeof data.ownerId === 'string' ? data.ownerId : '',
    propertyId: typeof data.propertyId === 'string' ? data.propertyId : '',
    rentAmount: typeof data.rentAmount === 'number' ? data.rentAmount : 0,
    status:
      data.status === 'occupied' || data.status === 'invited' ? data.status : 'vacant',
    tenantId: normalizeNullableString(data.tenantId),
    updatedAt: normalizeDateValue(data.updatedAt),
  };
}

export function normalizeTenantRecord(id: string, data: DocumentData): TenantRecord {
  return {
    createdAt: normalizeDateValue(data.createdAt),
    displayName:
      typeof data.displayName === 'string' && data.displayName.trim().length > 0
        ? data.displayName
        : 'Locataire ATouPay',
    email: typeof data.email === 'string' ? data.email : 'email indisponible',
    id,
    ownerId: typeof data.ownerId === 'string' ? data.ownerId : '',
    propertyId: typeof data.propertyId === 'string' ? data.propertyId : '',
    status: data.status === 'suspended' ? 'suspended' : 'active',
    unitId: typeof data.unitId === 'string' ? data.unitId : '',
    updatedAt: normalizeDateValue(data.updatedAt),
    userId: typeof data.userId === 'string' ? data.userId : id,
  };
}

export function normalizeRentPaymentRecord(id: string, data: DocumentData): RentPaymentRecord {
  const grossAmount = typeof data.grossAmount === 'number' ? data.grossAmount : 0;
  const commissionRate =
    typeof data.commissionRate === 'number' ? clampCommissionRate(data.commissionRate) : 0;
  const agencyFeeAmount =
    typeof data.agencyFeeAmount === 'number'
      ? data.agencyFeeAmount
      : calculateCommissionLedger(grossAmount, commissionRate).agencyFeeAmount;
  const ownerNetAmount =
    typeof data.ownerNetAmount === 'number'
      ? data.ownerNetAmount
      : calculateCommissionLedger(grossAmount, commissionRate).ownerNetAmount;

  return {
    agencyFeeAmount,
    agencyId: normalizeNullableString(data.agencyId),
    commissionRate,
    createdAt: normalizeDateValue(data.createdAt),
    dueDate: typeof data.dueDate === 'string' ? data.dueDate : currentMonthDueDate(),
    grossAmount,
    id,
    monthKey: typeof data.monthKey === 'string' ? data.monthKey : currentMonthKey(),
    ownerId: typeof data.ownerId === 'string' ? data.ownerId : '',
    ownerNetAmount,
    paidAt: normalizeNullableString(data.paidAt),
    paymentMethod:
      data.paymentMethod === 'Bankily' ||
      data.paymentMethod === 'Sedad' ||
      data.paymentMethod === 'Masrvi' ||
      data.paymentMethod === 'Carte bancaire'
        ? data.paymentMethod
        : null,
    paymentStatus:
      data.paymentStatus === 'paid' ||
      data.paymentStatus === 'late' ||
      data.paymentStatus === 'failed' ||
      data.paymentStatus === 'cancelled' ||
      data.paymentStatus === 'disputed'
        ? data.paymentStatus
        : 'pending',
    propertyId: typeof data.propertyId === 'string' ? data.propertyId : '',
    providerReference: normalizeNullableString(data.providerReference),
    receiptId: normalizeNullableString(data.receiptId),
    tenantId: typeof data.tenantId === 'string' ? data.tenantId : '',
    unitId: typeof data.unitId === 'string' ? data.unitId : '',
    updatedAt: normalizeDateValue(data.updatedAt),
  };
}

export function normalizeReceiptRecord(id: string, data: DocumentData): ReceiptRecord {
  return {
    agencyFeeAmount:
      typeof data.agencyFeeAmount === 'number' ? data.agencyFeeAmount : 0,
    agencyDisplayName:
      typeof data.agencyDisplayName === 'string' ? data.agencyDisplayName : undefined,
    agencyId: normalizeNullableString(data.agencyId),
    grossAmount:
      typeof data.grossAmount === 'number' ? data.grossAmount : 0,
    id,
    issuedAt: normalizeDateValue(data.issuedAt) ?? new Date().toISOString(),
    issuedBy: data.issuedBy === 'backend' ? data.issuedBy : undefined,
    issuanceSource:
      data.issuanceSource === 'simulate-complete' ? data.issuanceSource : undefined,
    ownerDisplayName:
      typeof data.ownerDisplayName === 'string' ? data.ownerDisplayName : undefined,
    ownerEmail: typeof data.ownerEmail === 'string' ? data.ownerEmail : undefined,
    ownerId: typeof data.ownerId === 'string' ? data.ownerId : '',
    ownerNetAmount:
      typeof data.ownerNetAmount === 'number' ? data.ownerNetAmount : 0,
    paidAt: normalizeDateValue(data.paidAt),
    paymentId: typeof data.paymentId === 'string' ? data.paymentId : '',
    paymentMethod:
      typeof data.paymentMethod === 'string' ? data.paymentMethod : undefined,
    paymentStatus:
      data.paymentStatus === 'paid' ||
      data.paymentStatus === 'pending' ||
      data.paymentStatus === 'late' ||
      data.paymentStatus === 'failed' ||
      data.paymentStatus === 'cancelled' ||
      data.paymentStatus === 'disputed'
        ? data.paymentStatus
        : undefined,
    propertyId: typeof data.propertyId === 'string' ? data.propertyId : undefined,
    propertyLabel:
      typeof data.propertyLabel === 'string' ? data.propertyLabel : undefined,
    qrVerificationToken:
      typeof data.qrVerificationToken === 'string' ? data.qrVerificationToken : '',
    receiptNumber:
      typeof data.receiptNumber === 'string' ? data.receiptNumber : generatePaymentReference('RCP'),
    simulated: data.simulated === true,
    tenantDisplayName:
      typeof data.tenantDisplayName === 'string' ? data.tenantDisplayName : undefined,
    tenantEmail: typeof data.tenantEmail === 'string' ? data.tenantEmail : undefined,
    tenantId: typeof data.tenantId === 'string' ? data.tenantId : '',
    unitId: typeof data.unitId === 'string' ? data.unitId : '',
    unitLabel: typeof data.unitLabel === 'string' ? data.unitLabel : undefined,
    verificationUrl:
      typeof data.verificationUrl === 'string' ? data.verificationUrl : undefined,
  };
}

export async function createOwnerProperty(input: {
  address: string;
  label: string;
  ownerId: string;
}): Promise<MutationResult & { propertyId?: string }> {
  if (isBackendEnabled) {
    try {
      const result = await createOwnerPropertyViaBackend({
        address: input.address,
        label: input.label,
      });

      return {
        message: 'Le bien a été enregistré et peut maintenant accueillir des unités.',
        ok: true,
        propertyId: result.id,
        title: 'Bien créé',
      };
    } catch (error) {
      return {
        message: mapBackendErrorToMessage(error, "Le bien n'a pas pu être créé."),
        ok: false,
        title: 'Création impossible',
      };
    }
  }

  const db = requireFirestore();
  const propertyRef = doc(collection(db, 'properties'));

  try {
    await setDoc(propertyRef, {
      address: input.address.trim(),
      createdAt: serverTimestamp(),
      label: input.label.trim(),
      ownerId: input.ownerId,
      updatedAt: serverTimestamp(),
    });

    return {
      message: 'Le bien a été enregistré et peut maintenant accueillir des unités.',
      ok: true,
      propertyId: propertyRef.id,
      title: 'Bien créé',
    };
  } catch (error) {
    return {
      message:
        error instanceof Error
          ? error.message
          : "Le bien n'a pas pu être créé.",
      ok: false,
      title: 'Création impossible',
    };
  }
}

export async function createOwnerUnit(input: {
  currency: string;
  label: string;
  ownerId: string;
  propertyId: string;
  rentAmount: number;
}): Promise<MutationResult & { unitId?: string }> {
  if (isBackendEnabled) {
    try {
      const result = await createOwnerUnitViaBackend({
        currency: input.currency,
        label: input.label,
        propertyId: input.propertyId,
        rentAmount: input.rentAmount,
      });

      return {
        message: 'L’unité est disponible pour générer une invitation locataire.',
        ok: true,
        title: 'Unité créée',
        unitId: result.id,
      };
    } catch (error) {
      return {
        message: mapBackendErrorToMessage(error, "L’unité n'a pas pu être créée."),
        ok: false,
        title: 'Création impossible',
      };
    }
  }

  const db = requireFirestore();
  const propertyRef = doc(db, 'properties', input.propertyId);
  const unitRef = doc(collection(db, 'units'));

  try {
    const propertySnapshot = await getDoc(propertyRef);

    if (!propertySnapshot.exists()) {
      return {
        message: 'Le bien sélectionné est introuvable.',
        ok: false,
        title: 'Bien indisponible',
      };
    }

    if (propertySnapshot.data().ownerId !== input.ownerId) {
      return {
        message: 'Cette unité doit être créée sur un bien qui vous appartient.',
        ok: false,
        title: 'Accès refusé',
      };
    }

    await setDoc(unitRef, {
      activeInviteId: null,
      createdAt: serverTimestamp(),
      currency: input.currency,
      label: input.label.trim(),
      ownerId: input.ownerId,
      propertyId: input.propertyId,
      rentAmount: input.rentAmount,
      status: 'vacant',
      tenantId: null,
      updatedAt: serverTimestamp(),
    });

    return {
      message: 'L’unité est disponible pour générer une invitation locataire.',
      ok: true,
      title: 'Unité créée',
      unitId: unitRef.id,
    };
  } catch (error) {
    return {
      message:
        error instanceof Error
          ? error.message
          : "L’unité n'a pas pu être créée.",
      ok: false,
      title: 'Création impossible',
    };
  }
}

export async function generateTenantInvite(input: {
  email?: string;
  inviteType?: 'code' | 'link';
  ownerId: string;
  propertyId: string;
  unitId: string;
}): Promise<InviteGenerationResult> {
  if (isBackendEnabled) {
    try {
      const result = await createTenantInviteViaBackend({
        email: input.email,
        inviteType: input.inviteType,
        unitId: input.unitId,
      });

      return {
        expiresAt: result.expiresAt,
        inviteCode: result.inviteCode,
        inviteId: result.inviteId,
        inviteLink: result.inviteLink,
        message:
          'Invitation créée. Partagez le lien ou le code une seule fois pour rattacher le locataire à cette unité.',
        ok: true,
        title: 'Invitation prête',
      };
    } catch (error) {
      const failure = resolveInviteGenerationFailure(
        new Error(
          mapBackendErrorToMessage(error, "L’invitation n'a pas pu être créée."),
        ),
      );

      return {
        message: failure.message,
        ok: false,
        title: failure.title,
      };
    }
  }

  const db = requireFirestore();
  const unitRef = doc(db, 'units', input.unitId);
  const propertyRef = doc(db, 'properties', input.propertyId);
  const inviteCode = await generateInviteCode();
  const inviteId = await hashInviteCode(inviteCode);
  const inviteRef = doc(db, 'tenantInvites', inviteId);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const normalizedEmail = input.email?.trim().toLowerCase() || null;

  try {
    await runTransaction(db, async (transaction) => {
      const [unitSnapshot, propertySnapshot, inviteSnapshot] = await Promise.all([
        transaction.get(unitRef),
        transaction.get(propertyRef),
        transaction.get(inviteRef),
      ]);

      if (!unitSnapshot.exists() || !propertySnapshot.exists()) {
        throw new Error("Le bien ou l’unité n’existe plus.");
      }

      if (inviteSnapshot.exists()) {
        throw new Error('Une collision d’invitation est survenue. Réessayez.');
      }

      const unitData = unitSnapshot.data();
      const propertyData = propertySnapshot.data();

      if (propertyData.ownerId !== input.ownerId || unitData.ownerId !== input.ownerId) {
        throw new Error("Vous ne pouvez inviter un locataire que sur vos propres unités.");
      }

      if (unitData.tenantId) {
        throw new Error('Cette unité est déjà occupée.');
      }

      if (unitData.activeInviteId) {
        throw new Error('Une invitation active existe déjà pour cette unité.');
      }

      transaction.set(inviteRef, {
        claimedAt: null,
        claimedByUid: null,
        codeHash: inviteId,
        createdAt: serverTimestamp(),
        email: normalizedEmail,
        expiresAt,
        inviteType: input.inviteType ?? 'code',
        ownerId: input.ownerId,
        propertyId: input.propertyId,
        status: 'pending',
        unitId: input.unitId,
      });
      transaction.update(unitRef, {
        activeInviteId: inviteId,
        status: 'invited',
        updatedAt: serverTimestamp(),
      });
    });

    return {
      expiresAt,
      inviteCode,
      inviteId,
      inviteLink: buildInviteLink(inviteCode),
      message:
        'Invitation créée. Partagez le lien ou le code une seule fois pour rattacher le locataire à cette unité.',
      ok: true,
      title: 'Invitation prête',
    };
  } catch (error) {
    const failure = resolveInviteGenerationFailure(error);

    return {
      message: failure.message,
      ok: false,
      title: failure.title,
    };
  }
}

export async function redeemTenantInvite(input: {
  code: string;
  displayName: string;
  email: string;
  userId: string;
}): Promise<InviteRedemptionResult> {
  const normalizedCode = normalizeInviteCode(input.code);

  if (normalizedCode.length < 8) {
    return {
      message: 'Le code saisi est trop court pour être une invitation ATouPay valide.',
      ok: false,
      title: 'Code invalide',
    };
  }

  if (isBackendEnabled) {
    try {
      const result = await redeemTenantInviteViaBackend({
        inviteCode: normalizedCode,
      });

      return {
        message:
          'Invitation validée. Le logement est maintenant rattaché à ce compte locataire.',
        ok: true,
        propertyId: result.propertyId,
        tenantId: result.tenantId,
        title: 'Unité attribuée',
        unitId: result.unitId,
      };
    } catch (error) {
      const failure = resolveInviteClaimFailure(
        new Error(
          mapBackendErrorToMessage(error, "L’invitation n'a pas pu être réclamée."),
        ),
      );

      return {
        message: failure.message,
        ok: false,
        title: failure.title,
      };
    }
  }

  const db = requireFirestore();
  const inviteId = await hashInviteCode(normalizedCode);
  const inviteRef = doc(db, 'tenantInvites', inviteId);
  const tenantRef = doc(db, 'tenants', input.userId);
  const userRef = doc(db, 'users', input.userId);

  try {
    let claimedPropertyId = '';
    let claimedUnitId = '';
    await runTransaction(db, async (transaction) => {
      const [inviteSnapshot, userSnapshot, tenantSnapshot] = await Promise.all([
        transaction.get(inviteRef),
        transaction.get(userRef),
        transaction.get(tenantRef),
      ]);

      if (!inviteSnapshot.exists()) {
        throw new Error('Aucune invitation active ne correspond à ce code.');
      }

      if (!userSnapshot.exists()) {
        throw new Error("Le profil Firebase n'est pas prêt. Reconnectez-vous puis réessayez.");
      }

      if (tenantSnapshot.exists()) {
        throw new Error('Ce compte est déjà rattaché à une unité.');
      }

      const inviteData = inviteSnapshot.data();
      const userData = userSnapshot.data();

      if (userData.role !== 'tenant') {
        throw new Error('Seul un compte locataire peut réclamer cette invitation.');
      }

      if (userData.tenantId) {
        throw new Error('Ce compte locataire est déjà rattaché à une unité.');
      }

      if (inviteData.status !== 'pending') {
        throw new Error('Cette invitation a déjà été utilisée ou n’est plus active.');
      }

      if (new Date(inviteData.expiresAt).getTime() <= Date.now()) {
        throw new Error('Cette invitation a expiré. Demandez-en une nouvelle au propriétaire.');
      }

      if (
        typeof inviteData.email === 'string' &&
        inviteData.email.trim().length > 0 &&
        inviteData.email.trim().toLowerCase() !== input.email.trim().toLowerCase()
      ) {
        throw new Error('Cette invitation est réservée à une autre adresse e-mail.');
      }

      const unitRef = doc(db, 'units', inviteData.unitId);
      const propertyRef = doc(db, 'properties', inviteData.propertyId);
      const paymentRef = doc(db, 'rentPayments', `rent-${input.userId}-${currentMonthKey()}`);
      const ownerUserRef = doc(db, 'users', inviteData.ownerId);
      const [unitSnapshot, propertySnapshot, paymentSnapshot, ownerUserSnapshot] = await Promise.all([
        transaction.get(unitRef),
        transaction.get(propertyRef),
        transaction.get(paymentRef),
        transaction.get(ownerUserRef),
      ]);

      if (!unitSnapshot.exists() || !propertySnapshot.exists()) {
        throw new Error("Le bien ciblé par l’invitation n’est plus disponible.");
      }

      const unitData = unitSnapshot.data();
      const propertyData = propertySnapshot.data();

      if (unitData.activeInviteId !== inviteId) {
        throw new Error('Cette invitation ne correspond plus à l’unité ciblée.');
      }

      if (unitData.tenantId) {
        throw new Error('Cette unité a déjà été attribuée à un autre locataire.');
      }

      if (propertyData.ownerId !== inviteData.ownerId || unitData.ownerId !== inviteData.ownerId) {
        throw new Error("L’invitation ne correspond plus à un propriétaire valide.");
      }
      const ownerUserData = ownerUserSnapshot.exists() ? ownerUserSnapshot.data() : null;
      const agencyId =
        ownerUserData && typeof ownerUserData.agencyId === 'string'
          ? ownerUserData.agencyId
          : null;
      let commissionRate = 0;

      if (agencyId) {
        const agencyRef = doc(db, 'agencies', agencyId);
        const agencySnapshot = await transaction.get(agencyRef);
        const agencyData = agencySnapshot.exists()
          ? (agencySnapshot.data() as Partial<AgencyRecord>)
          : null;
        commissionRate =
          agencyData && typeof agencyData.commissionRate === 'number'
            ? clampCommissionRate(agencyData.commissionRate)
            : 0;
      }

      const commissionLedger = calculateCommissionLedger(unitData.rentAmount, commissionRate);

      claimedPropertyId = inviteData.propertyId;
      claimedUnitId = inviteData.unitId;

      transaction.set(tenantRef, {
        createdAt: serverTimestamp(),
        displayName: input.displayName,
        email: input.email.trim().toLowerCase(),
        ownerId: inviteData.ownerId,
        propertyId: inviteData.propertyId,
        status: 'active',
        unitId: inviteData.unitId,
        updatedAt: serverTimestamp(),
        userId: input.userId,
      });
      transaction.update(userRef, {
        ownerId: inviteData.ownerId,
        tenantId: input.userId,
        updatedAt: serverTimestamp(),
      });
      transaction.update(unitRef, {
        activeInviteId: null,
        status: 'occupied',
        tenantId: input.userId,
        updatedAt: serverTimestamp(),
      });
      transaction.update(inviteRef, {
        claimedAt: serverTimestamp(),
        claimedByUid: input.userId,
        status: 'claimed',
      });

      if (!paymentSnapshot.exists()) {
        transaction.set(paymentRef, {
          agencyFeeAmount: commissionLedger.agencyFeeAmount,
          agencyId,
          commissionRate: commissionLedger.commissionRate,
          createdAt: serverTimestamp(),
          dueDate: currentMonthDueDate(),
          grossAmount: unitData.rentAmount,
          monthKey: currentMonthKey(),
          ownerId: inviteData.ownerId,
          ownerNetAmount: commissionLedger.ownerNetAmount,
          paidAt: null,
          paymentMethod: null,
          paymentStatus: 'pending',
          propertyId: inviteData.propertyId,
          providerReference: null,
          receiptId: null,
          tenantId: input.userId,
          unitId: inviteData.unitId,
          updatedAt: serverTimestamp(),
        });
      }
    });

    return {
      message:
        'Invitation validée. Le logement est maintenant rattaché à ce compte locataire.',
      ok: true,
      propertyId: claimedPropertyId,
      tenantId: input.userId,
      title: 'Unité attribuée',
      unitId: claimedUnitId,
    };
  } catch (error) {
    const failure = resolveInviteClaimFailure(error);

    return {
      message: failure.message,
      ok: false,
      title: failure.title,
    };
  }
}

export async function submitSimulatedRentPayment(input: {
  paymentId: string;
  provider: PaymentProvider;
  tenantId: string;
}): Promise<PaymentAttemptResult> {
  if (isBackendEnabled) {
    try {
      const result = await completeSimulatedPaymentViaBackend({
        paymentId: input.paymentId,
        paymentMethod: input.provider,
      });

      return {
        message: 'Le règlement simulé a été enregistré avec son reçu ATouPay.',
        ok: true,
        payment: mapRentPaymentToUiPayment({
          ...result.payment,
          paidAt: result.payment.paidAt,
          paymentMethod:
            result.payment.paymentMethod === 'Bankily' ||
            result.payment.paymentMethod === 'Sedad' ||
            result.payment.paymentMethod === 'Masrvi' ||
            result.payment.paymentMethod === 'Carte bancaire'
              ? result.payment.paymentMethod
              : null,
          providerReference: result.payment.providerReference,
          receiptId: result.payment.receiptId,
          updatedAt: result.payment.updatedAt,
        }),
        receipt: result.receipt,
        title: 'Paiement simulé enregistré',
      };
    } catch (error) {
      return {
        message: mapBackendErrorToMessage(error, 'Le paiement simulé a échoué.'),
        ok: false,
        title: 'Paiement non abouti',
      };
    }
  }

  const db = requireFirestore();
  const paymentRef = doc(db, 'rentPayments', input.paymentId);
  const receiptRef = doc(collection(db, 'receipts'));
  const paidAt = new Date().toISOString();
  const providerReference = generatePaymentReference('SIM');
  const receiptNumber = generatePaymentReference('ATPR');
  const qrVerificationToken = Crypto.randomUUID();

  try {
    const updatedPayment = await runTransaction(db, async (transaction) => {
      const paymentSnapshot = await transaction.get(paymentRef);

      if (!paymentSnapshot.exists()) {
        throw new Error("Le paiement demandé n'a pas été retrouvé.");
      }

      const paymentData = normalizeRentPaymentRecord(paymentSnapshot.id, paymentSnapshot.data());

      if (paymentData.tenantId !== input.tenantId) {
        throw new Error('Ce paiement ne vous appartient pas.');
      }

      if (paymentData.paymentStatus === 'paid') {
        throw new Error('Ce loyer a déjà été enregistré comme payé.');
      }

      transaction.set(receiptRef, {
        agencyFeeAmount: paymentData.agencyFeeAmount,
        issuedAt: serverTimestamp(),
        ownerId: paymentData.ownerId,
        ownerNetAmount: paymentData.ownerNetAmount,
        paymentId: paymentData.id,
        qrVerificationToken,
        receiptNumber,
        tenantId: paymentData.tenantId,
        unitId: paymentData.unitId,
      });
      transaction.update(paymentRef, {
        paidAt,
        paymentMethod: input.provider,
        paymentStatus: 'paid',
        providerReference,
        receiptId: receiptRef.id,
        updatedAt: serverTimestamp(),
      });

      return mapRentPaymentToUiPayment({
        ...paymentData,
        paidAt,
        paymentMethod: input.provider,
        paymentStatus: 'paid',
        providerReference,
        receiptId: receiptRef.id,
      });
    });

    return {
      message: 'Le règlement simulé a été enregistré avec succès.',
      ok: true,
      payment: updatedPayment,
      receipt: {
        agencyFeeAmount: updatedPayment.agencyFeeAmount ?? 0,
        agencyId: updatedPayment.agencyId ?? null,
        grossAmount: updatedPayment.grossAmount ?? updatedPayment.amount,
        id: receiptRef.id,
        issuedAt: paidAt,
        ownerId: updatedPayment.ownerId,
        ownerNetAmount: updatedPayment.ownerNetAmount ?? updatedPayment.amount,
        paidAt,
        paymentId: updatedPayment.id,
        qrVerificationToken,
        receiptNumber,
        simulated: true,
        tenantId: updatedPayment.tenantId,
        unitId: updatedPayment.unitId ?? '',
      },
      title: 'Paiement simulé enregistré',
    };
  } catch (error) {
    return {
      message:
        error instanceof Error
          ? error.message
          : 'Le paiement simulé a échoué.',
      ok: false,
      title: 'Paiement non abouti',
    };
  }
}
