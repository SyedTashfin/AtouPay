import { createHash, randomUUID } from 'node:crypto';

import type { AppConfig } from '../config/env.js';
import type {
  AgencyAdminBootstrapDoc,
  AuditEventType,
  AuditLogDoc,
  AuthContext,
  InviteType,
  LegalTermsDoc,
  NotificationDoc,
  NotificationType,
  OwnerDoc,
  OwnerAccessInviteDoc,
  PaymentStatus,
  PropertyDoc,
  RecoveryContactPreference,
  ReceiptDoc,
  RentPaymentDoc,
  Role,
  SupportRequestCategory,
  SupportRequestDoc,
  SupportRequestStatus,
  TenantDoc,
  TenantInviteDoc,
  UnitDoc,
  UserTermsAcceptanceDoc,
  UserDoc,
  UserStatus,
} from '../domain/types.js';
import { AppError } from '../lib/errors.js';
import {
  buildInviteLink,
  buildScopedInviteLink,
  currentMonthDueDate,
  currentMonthKey,
  generateInviteCode,
  hashInviteCode,
  hashStableValue,
  normalizeInviteCode,
} from '../lib/invite.js';
import type { DataRepository, TransactionContext } from '../repositories/types.js';
import { finalizeSimulatedPaymentProvider } from './payment-provider.js';

interface BackendServiceOptions {
  config: AppConfig;
  now?: () => Date;
  repository: DataRepository;
}

export interface BootstrapProfileInput {
  role: Role;
}

export interface BootstrapProfileOutput {
  ownerId: string | null;
  role: Role;
  tenantId: string | null;
  uid: string;
}

export interface RedeemOwnerAccessInput {
  inviteCode: string;
}

export interface RedeemOwnerAccessOutput {
  agencyId: string | null;
  ownerId: string;
  uid: string;
}

export interface CreatePropertyInput {
  address: string;
  label: string;
}

export interface CreatePropertyOutput {
  id: string;
  ownerId: string;
}

export interface CreateUnitInput {
  currency: string;
  label: string;
  propertyId: string;
  rentAmount: number;
}

export interface CreateUnitOutput {
  id: string;
  ownerId: string;
  propertyId: string;
}

export interface CreateInviteInput {
  email?: string;
  inviteType: InviteType;
  unitId: string;
}

export interface CreateInviteOutput {
  expiresAt: string;
  inviteCode: string;
  inviteId: string;
  inviteLink: string;
  ownerId: string;
  propertyId: string;
  unitId: string;
}

export interface RedeemInviteInput {
  inviteCode: string;
}

export interface RedeemInviteOutput {
  ownerId: string;
  paymentId: string;
  propertyId: string;
  tenantId: string;
  unitId: string;
}

export interface CreateOwnerAccessInviteInput {
  email?: string;
  inviteType: InviteType;
}

export interface OwnerAccessInviteOutput {
  agencyId: string;
  claimedAt: string | null;
  claimedByUid: string | null;
  createdAt: string;
  email: string | null;
  expiresAt: string;
  id: string;
  inviteType: InviteType;
  inviteLink?: string;
  ownerInviteCode?: string;
  status: 'pending' | 'claimed' | 'expired' | 'revoked';
}

export interface ListAgencyOwnersOutputItem {
  agencyId: string | null;
  createdAt: string;
  displayName: string;
  email: string;
  ownerId: string | null;
  status: UserStatus;
  uid: string;
  updatedAt: string;
}

export interface AgencyUserOutputItem {
  agencyId: string | null;
  createdAt: string;
  displayName: string;
  email: string;
  ownerId: string | null;
  role: Role;
  status: UserStatus;
  tenantId: string | null;
  uid: string;
  updatedAt: string;
}

export interface UpdateAgencyUserStatusInput {
  status: Extract<UserStatus, 'active' | 'suspended'>;
}

export interface PaymentStatusBreakdown {
  cancelled: number;
  disputed: number;
  failed: number;
  late: number;
  paid: number;
  pending: number;
}

export interface SupportStatusBreakdown {
  in_progress: number;
  resolved: number;
  submitted: number;
}

export interface MoneySummary {
  agencyFeeAmount: number;
  grossAmount: number;
  ownerNetAmount: number;
}

export interface AgencyDashboardOutput {
  activeOwnersCount: number;
  activeTenantsCount: number;
  agencyId: string;
  commissionRate: number;
  commissionSummary: MoneySummary;
  displayName: string;
  occupiedUnitsCount: number;
  paymentsByStatus: PaymentStatusBreakdown;
  pendingInvitesCount: number;
  period: DashboardPeriod;
  rentSummary: MoneySummary;
  supportRequestsByStatus: SupportStatusBreakdown;
  suspendedUsersCount: number;
  totalPropertiesCount: number;
  totalUnitsCount: number;
  vacantUnitsCount: number;
}

export interface OwnerDashboardOutput {
  agencyFeeAmount: number;
  grossAmount: number;
  latePaymentsCount: number;
  occupiedUnitsCount: number;
  ownerId: string;
  ownerNetAmount: number;
  paidPaymentsCount: number;
  paymentsByStatus: PaymentStatusBreakdown;
  pendingPaymentsCount: number;
  period: DashboardPeriod;
  totalPropertiesCount: number;
  totalTenantsCount: number;
  totalUnitsCount: number;
  vacantUnitsCount: number;
}

export interface NotificationOutput {
  agencyId: string | null;
  body: string;
  createdAt: string;
  id: string;
  readAt: string | null;
  relatedEntityId: string | null;
  relatedEntityType: string | null;
  role: Role;
  title: string;
  type: NotificationType;
  userId: string | null;
}

export interface AuditLogOutput {
  actorRole: Role | 'system';
  actorUid: string | null;
  agencyId: string | null;
  createdAt: string;
  entityId: string | null;
  entityType: string;
  eventType: AuditEventType;
  id: string;
  metadata: Record<string, boolean | number | string | null>;
  targetUid: string | null;
}

export type DashboardPeriod = 'all' | 'last_month' | 'this_month';

export interface AgencySettingsOutput {
  agencyId: string;
  commissionRate: number;
  commissionType: 'percentage';
  displayName: string;
}

export interface UpdateAgencySettingsInput {
  commissionRate: number;
}

export interface RevokeOwnerAccessInviteInput {
  inviteId: string;
}

export interface LegalTermsOutput extends LegalTermsDoc {}

export interface TermsStatusOutput {
  acceptedAt: string | null;
  acceptedVersion: string | null;
  requiresAcceptance: boolean;
  termsVersion: string;
}

export interface AcceptTermsInput {
  appVersion?: string | null;
  locale?: string | null;
}

export interface ProfileContactOutput {
  phoneNumber: string | null;
  phoneVerificationStatus: 'unverified' | 'verified' | null;
  recoveryContactPreference: RecoveryContactPreference | null;
  supportRecoveryStatus: SupportRequestStatus | null;
}

export interface UpdateProfileContactInput {
  phoneNumber?: string | null;
  recoveryContactPreference?: RecoveryContactPreference | null;
}

export interface SupportRequestOutput {
  agencyId: string | null;
  category: SupportRequestCategory;
  contactEmail: string;
  createdAt: string;
  description: string;
  id: string;
  paymentId: string | null;
  phoneNumber: string | null;
  recoveryContactPreference: RecoveryContactPreference | null;
  requestorDisplayName: string;
  requestorRole: Role | 'guest';
  resolutionNote: string | null;
  resolvedAt: string | null;
  status: SupportRequestStatus;
  subject: string;
  updatedAt: string;
  userId: string | null;
}

export interface CreateSupportRequestInput {
  category: SupportRequestCategory;
  description: string;
  paymentId?: string;
  phoneNumber?: string | null;
  recoveryContactPreference?: RecoveryContactPreference | null;
  subject: string;
}

export interface CreateRecoverySupportRequestInput {
  description: string;
  email: string;
  locale?: string | null;
  phoneNumber?: string | null;
  recoveryContactPreference?: RecoveryContactPreference | null;
  subject: string;
}

export interface UpdateSupportRequestInput {
  resolutionNote?: string | null;
  status: Exclude<SupportRequestStatus, 'submitted'>;
}

export interface CompleteSimulatedPaymentInput {
  paymentId: string;
  paymentMethod: string;
}

export interface ReceiptOutput {
  agencyFeeAmount: number;
  agencyDisplayName: string;
  agencyId: string | null;
  grossAmount: number;
  id: string;
  issuedAt: string;
  issuedBy: 'backend';
  issuanceSource: 'simulate-complete';
  ownerDisplayName: string;
  ownerEmail: string;
  ownerId: string;
  ownerNetAmount: number;
  paidAt: string;
  paymentId: string;
  paymentMethod: string;
  paymentStatus: PaymentStatus;
  propertyId: string;
  propertyLabel: string;
  qrVerificationToken: string;
  receiptNumber: string;
  simulated: boolean;
  tenantDisplayName: string;
  tenantEmail: string;
  tenantId: string;
  unitId: string;
  unitLabel: string;
  verificationUrl: string;
}

export interface CompleteSimulatedPaymentOutput {
  payment: RentPaymentDoc & { id: string };
  receipt: ReceiptOutput;
}

export interface ReceiptVerificationOutput {
  receipt: ReceiptOutput | null;
  valid: boolean;
}

const LEGAL_TERMS_DOCUMENT_ID = 'terms-of-use';
const LEGAL_TERMS_VERSION = '2026-04-23.1';

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function normalizeNullableString(value: string | null | undefined) {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizePhoneNumber(value: string | null | undefined) {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeRecoveryContactPreference(
  value: RecoveryContactPreference | null | undefined,
): RecoveryContactPreference | null {
  return value === 'email' || value === 'phone' ? value : null;
}

function buildDefaultLegalTerms(updatedAt: string): LegalTermsDoc {
  return {
    locale: 'fr',
    responsibilityStatement:
      'AtouPay agit comme plateforme de gestion et de preuve interne selon les informations enregistrées dans le système. Les paiements restent simulés tant qu’aucun prestataire réel n’est intégré et vérifié. En cas d’erreur, de panne ou de litige, la coordination passe par l’agence.',
    sections: [
      {
        title: 'Erreur de paiement',
        body:
          'Si un paiement affiché dans AtouPay semble erroné, l’utilisateur doit immédiatement le signaler via le support agence. Tant que les paiements demeurent simulés, aucune écriture AtouPay ne prouve un débit bancaire réel.',
      },
      {
        title: 'Impayé locataire',
        body:
          'En cas de non-paiement, AtouPay fournit un suivi d’état, un historique et des quittances générées selon les données du système. Le recouvrement, la relance et toute décision contractuelle restent du ressort du propriétaire et de l’agence.',
      },
      {
        title: 'Bug ou indisponibilité',
        body:
          'En cas de bug applicatif, d’indisponibilité backend ou d’erreur d’affichage, l’utilisateur doit conserver les références disponibles puis contacter l’agence. AtouPay vise à faciliter la gestion et la traçabilité, sans garantir une disponibilité absolue.',
      },
      {
        title: 'Limites de responsabilité',
        body:
          'AtouPay ne remplace pas un établissement bancaire, un notaire, un huissier ni un conseil juridique. Les documents générés peuvent servir de justificatif selon les informations enregistrées dans le système, sans valoir certification bancaire ou gouvernementale automatique.',
      },
    ],
    summary:
      'Les utilisateurs acceptent que la plateforme centralise des données de gestion, des preuves internes et des reçus générés selon le système, avec une assistance qui transite par l’agence.',
    supportPath:
      'Contactez votre agence depuis l’écran Aide & support ou via un signalement associé au paiement concerné.',
    title: 'Conditions d’utilisation AtouPay',
    updatedAt,
    version: LEGAL_TERMS_VERSION,
  };
}

function uniqueProviders(values: string[]) {
  return Array.from(
    new Set(values.filter((value) => value === 'google' || value === 'password')),
  ) as Array<'google' | 'password'>;
}

function userDisplayName(identity: AuthContext, existing?: UserDoc | null) {
  if (identity.displayName && identity.displayName.trim().length > 0) {
    return identity.displayName.trim();
  }

  if (existing?.displayName && existing.displayName.trim().length > 0) {
    return existing.displayName.trim();
  }

  return identity.email ?? existing?.email ?? 'Compte ATouPay';
}

function requireEmail(identity: AuthContext, existing?: UserDoc | null) {
  const email = identity.email ?? existing?.email;

  if (!email) {
    throw new AppError(
      409,
      'email_required',
      'Le compte authentifié ne fournit pas d’adresse e-mail exploitable.',
    );
  }

  return normalizeEmail(email);
}

function assertRole(user: UserDoc | null, role: Role) {
  if (!user) {
    throw new AppError(
      409,
      'profile_not_bootstrapped',
      'Le profil applicatif ATouPay doit être initialisé avant cette opération.',
    );
  }

  if (user.role !== role) {
    throw new AppError(
      403,
      'forbidden_role',
      'Ce compte ne peut pas exécuter cette action avec son rôle actuel.',
    );
  }

  return user;
}

function assertActiveOwner(user: UserDoc | null) {
  const owner = assertRole(user, 'owner');

  if (owner.status !== 'active' || !owner.ownerId) {
    throw new AppError(
      403,
      'owner_access_required',
      'Ce compte propriétaire doit être activé par une invitation agence avant de gérer des biens.',
    );
  }

  return owner;
}

function assertAgencyAdmin(user: UserDoc | null) {
  const admin = assertRole(user, 'agency_admin');

  if (admin.status !== 'active' || !admin.agencyId) {
    throw new AppError(
      403,
      'agency_admin_required',
      'Ce compte agence n’est pas autorisé à gérer cette opération.',
    );
  }

  return admin;
}

function assertActiveTenant(user: UserDoc | null) {
  const tenant = assertRole(user, 'tenant');

  if (tenant.status !== 'active') {
    throw new AppError(
      403,
      'tenant_inactive',
      'Ce compte locataire n’est pas autorisé à poursuivre cette opération.',
    );
  }

  return tenant;
}

function buildUserDoc(input: {
  agencyId?: string | null;
  createdAt: string;
  existing: UserDoc | null;
  identity: AuthContext;
  ownerId?: string | null;
  phoneNumber?: string | null;
  recoveryContactPreference?: RecoveryContactPreference | null;
  role: Role;
  status?: UserStatus;
  supportRecoveryStatus?: SupportRequestStatus | null;
  tenantId?: string | null;
  updatedAt: string;
}): UserDoc {
  const {
    agencyId,
    createdAt,
    existing,
    identity,
    ownerId,
    phoneNumber,
    recoveryContactPreference,
    role,
    status,
    supportRecoveryStatus,
    tenantId,
    updatedAt,
  } =
    input;
  const email = requireEmail(identity, existing);
  const displayName = userDisplayName(identity, existing);
  const authProviders = uniqueProviders([
    ...(existing?.authProviders ?? []),
    ...identity.providers,
    ...(identity.primaryProvider ? [identity.primaryProvider] : []),
  ]);

  const resolvedOwnerId =
    ownerId !== undefined
      ? ownerId
      : role === 'owner'
        ? identity.uid
        : null;
  const resolvedTenantId =
    tenantId !== undefined
      ? tenantId
      : role === 'tenant'
        ? existing?.tenantId ?? null
        : null;

  return {
    authProviders,
    agencyId: agencyId ?? existing?.agencyId ?? null,
    createdAt: existing?.createdAt ?? createdAt,
    displayName,
    email,
    emailVerified: identity.emailVerified,
    ownerId: resolvedOwnerId,
    phoneNumber:
      phoneNumber !== undefined ? phoneNumber : existing?.phoneNumber ?? null,
    photoURL: identity.photoUrl ?? existing?.photoURL ?? null,
    recoveryContactPreference:
      recoveryContactPreference !== undefined
        ? recoveryContactPreference
        : existing?.recoveryContactPreference ?? null,
    role,
    status: status ?? existing?.status ?? 'active',
    supportRecoveryStatus:
      supportRecoveryStatus !== undefined
        ? supportRecoveryStatus
        : existing?.supportRecoveryStatus ?? null,
    tenantId: resolvedTenantId,
    uid: identity.uid,
    updatedAt,
  };
}

function clampRate(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(value, 1));
}

function calculateCommissionLedger(grossAmount: number, commissionRate: number) {
  const normalizedRate = clampRate(commissionRate);
  const agencyFeeAmount = Math.round(grossAmount * normalizedRate);
  const ownerNetAmount = Math.max(0, grossAmount - agencyFeeAmount);

  return {
    agencyFeeAmount,
    commissionRate: normalizedRate,
    ownerNetAmount,
  };
}

function emptyPaymentStatusBreakdown(): PaymentStatusBreakdown {
  return {
    cancelled: 0,
    disputed: 0,
    failed: 0,
    late: 0,
    paid: 0,
    pending: 0,
  };
}

function emptySupportStatusBreakdown(): SupportStatusBreakdown {
  return {
    in_progress: 0,
    resolved: 0,
    submitted: 0,
  };
}

function normalizeDashboardPeriod(value?: string | null): DashboardPeriod {
  return value === 'last_month' || value === 'all' ? value : 'this_month';
}

function monthKeyForDate(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');

  return `${year}-${month}`;
}

function previousMonthKey(date: Date) {
  return monthKeyForDate(new Date(date.getFullYear(), date.getMonth() - 1, 1));
}

function paymentMatchesPeriod(payment: RentPaymentDoc, period: DashboardPeriod, now: Date) {
  if (period === 'all') {
    return true;
  }

  const targetMonth = period === 'last_month' ? previousMonthKey(now) : monthKeyForDate(now);

  return payment.monthKey === targetMonth;
}

function summarizePayments(
  payments: RentPaymentDoc[],
  period: DashboardPeriod,
  now: Date,
) {
  const byStatus = emptyPaymentStatusBreakdown();
  const money: MoneySummary = {
    agencyFeeAmount: 0,
    grossAmount: 0,
    ownerNetAmount: 0,
  };

  for (const payment of payments) {
    if (!paymentMatchesPeriod(payment, period, now)) {
      continue;
    }

    byStatus[payment.paymentStatus] += 1;

    if (payment.paymentStatus === 'paid') {
      money.agencyFeeAmount += payment.agencyFeeAmount;
      money.grossAmount += payment.grossAmount;
      money.ownerNetAmount += payment.ownerNetAmount;
    }
  }

  return {
    byStatus,
    money,
  };
}

function notificationOutputFromDoc(id: string, doc: NotificationDoc): NotificationOutput {
  return {
    agencyId: doc.agencyId,
    body: doc.body,
    createdAt: doc.createdAt,
    id,
    readAt: doc.readAt,
    relatedEntityId: doc.relatedEntityId,
    relatedEntityType: doc.relatedEntityType,
    role: doc.role,
    title: doc.title,
    type: doc.type,
    userId: doc.userId,
  };
}

function auditLogOutputFromDoc(id: string, doc: AuditLogDoc): AuditLogOutput {
  return {
    actorRole: doc.actorRole,
    actorUid: doc.actorUid,
    agencyId: doc.agencyId,
    createdAt: doc.createdAt,
    entityId: doc.entityId,
    entityType: doc.entityType,
    eventType: doc.eventType,
    id,
    metadata: doc.metadata,
    targetUid: doc.targetUid,
  };
}

function buildReceiptNumber(now: Date) {
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  const suffix = randomUUID().replace(/-/g, '').toUpperCase().slice(0, 6);

  return `ATP-${year}${month}${day}-${suffix}`;
}

function normalizeInviteStatus<T extends { expiresAt: string; status: OwnerAccessInviteDoc['status'] }>(
  value: T,
  now: Date,
) {
  if (value.status === 'pending' && new Date(value.expiresAt).getTime() <= now.getTime()) {
    return 'expired' as const;
  }

  return value.status;
}

function receiptOutputFromDoc(doc: ReceiptDoc): ReceiptOutput {
  const runtimeDoc = doc as Partial<ReceiptDoc>;

  return {
    agencyFeeAmount: doc.agencyFeeAmount,
    agencyDisplayName:
      typeof runtimeDoc.agencyDisplayName === 'string' && runtimeDoc.agencyDisplayName.trim().length > 0
        ? runtimeDoc.agencyDisplayName
        : 'Agence ATouPay',
    agencyId: doc.agencyId,
    grossAmount: doc.grossAmount,
    id: doc.id,
    issuedAt: doc.issuedAt,
    issuedBy: runtimeDoc.issuedBy === 'backend' ? runtimeDoc.issuedBy : 'backend',
    issuanceSource:
      runtimeDoc.issuanceSource === 'simulate-complete'
        ? runtimeDoc.issuanceSource
        : 'simulate-complete',
    ownerDisplayName: doc.ownerDisplayName,
    ownerEmail: doc.ownerEmail,
    ownerId: doc.ownerId,
    ownerNetAmount: doc.ownerNetAmount,
    paidAt: doc.paidAt,
    paymentId: doc.paymentId,
    paymentMethod: doc.paymentMethod,
    paymentStatus:
      runtimeDoc.paymentStatus === 'pending' ||
      runtimeDoc.paymentStatus === 'paid' ||
      runtimeDoc.paymentStatus === 'late'
        ? runtimeDoc.paymentStatus
        : doc.paidAt
          ? 'paid'
          : 'pending',
    propertyId: doc.propertyId,
    propertyLabel: doc.propertyLabel,
    qrVerificationToken: doc.qrVerificationToken,
    receiptNumber: doc.receiptNumber,
    simulated: doc.simulated,
    tenantDisplayName: doc.tenantDisplayName,
    tenantEmail: doc.tenantEmail,
    tenantId: doc.tenantId,
    unitId: doc.unitId,
    unitLabel: doc.unitLabel,
    verificationUrl: doc.verificationUrl,
  };
}

function supportRequestOutputFromDoc(id: string, doc: SupportRequestDoc): SupportRequestOutput {
  return {
    agencyId: doc.agencyId,
    category: doc.category,
    contactEmail: doc.contactEmail,
    createdAt: doc.createdAt,
    description: doc.description,
    id,
    paymentId: doc.paymentId,
    phoneNumber: doc.phoneNumber,
    recoveryContactPreference: doc.recoveryContactPreference,
    requestorDisplayName: doc.requestorDisplayName,
    requestorRole: doc.requestorRole,
    resolutionNote: doc.resolutionNote,
    resolvedAt: doc.resolvedAt,
    status: doc.status,
    subject: doc.subject,
    updatedAt: doc.updatedAt,
    userId: doc.userId,
  };
}

function isReceiptAccessibleToUser(user: UserDoc, receipt: ReceiptDoc) {
  if (user.role === 'tenant') {
    return user.tenantId === receipt.tenantId;
  }

  if (user.role === 'owner') {
    return user.ownerId === receipt.ownerId && user.status === 'active';
  }

  if (user.role === 'agency_admin') {
    return user.agencyId != null && user.agencyId === receipt.agencyId && user.status === 'active';
  }

  return false;
}

function isSupportRequestAccessibleToUser(user: UserDoc, request: SupportRequestDoc) {
  if (user.role === 'agency_admin') {
    return user.agencyId != null && user.agencyId === request.agencyId && user.status === 'active';
  }

  return request.userId === user.uid;
}

export class BackendService {
  private readonly config: AppConfig;

  private readonly now: () => Date;

  private readonly repository: DataRepository;

  constructor(options: BackendServiceOptions) {
    this.config = options.config;
    this.now = options.now ?? (() => new Date());
    this.repository = options.repository;
  }

  private buildOwnerAccessLink(inviteCode: string) {
    return buildScopedInviteLink(this.config.inviteBaseUrl, 'ownerInvite', inviteCode);
  }

  private buildReceiptVerificationUrl(token: string) {
    const scheme = this.config.inviteBaseUrl.split('://')[0] ?? 'atoupay';

    return `${scheme}://receipt-verification?token=${encodeURIComponent(token)}`;
  }

  private recordAudit(
    transaction: TransactionContext,
    input: {
      actor: Pick<UserDoc, 'role' | 'uid'> | null;
      agencyId: string | null;
      entityId: string | null;
      entityType: string;
      eventType: AuditEventType;
      metadata?: Record<string, boolean | number | string | null>;
      targetUid?: string | null;
      timestamp: string;
    },
  ) {
    transaction.setAuditLog(randomUUID(), {
      actorRole: input.actor?.role ?? 'system',
      actorUid: input.actor?.uid ?? null,
      agencyId: input.agencyId,
      createdAt: input.timestamp,
      entityId: input.entityId,
      entityType: input.entityType,
      eventType: input.eventType,
      metadata: input.metadata ?? {},
      targetUid: input.targetUid ?? null,
    });
  }

  private createNotification(
    transaction: TransactionContext,
    input: {
      agencyId: string | null;
      body: string;
      relatedEntityId?: string | null;
      relatedEntityType?: string | null;
      role: Role;
      timestamp: string;
      title: string;
      type: NotificationType;
      userId?: string | null;
    },
  ) {
    transaction.setNotification(randomUUID(), {
      agencyId: input.agencyId,
      body: input.body,
      createdAt: input.timestamp,
      readAt: null,
      relatedEntityId: input.relatedEntityId ?? null,
      relatedEntityType: input.relatedEntityType ?? null,
      role: input.role,
      title: input.title,
      type: input.type,
      userId: input.userId ?? null,
    });
  }

  private async getOrCreateLegalTerms() {
    const existingTerms = await this.repository.getLegalTerms(LEGAL_TERMS_DOCUMENT_ID);

    if (existingTerms) {
      return existingTerms;
    }

    const defaultTerms = buildDefaultLegalTerms(this.now().toISOString());
    await this.repository.setLegalTerms(LEGAL_TERMS_DOCUMENT_ID, defaultTerms);

    return defaultTerms;
  }

  private async ensureAcceptedTerms(
    transaction: TransactionContext,
    user: UserDoc,
    currentTerms?: LegalTermsDoc,
  ) {
    const activeTerms = currentTerms ?? (await transaction.getLegalTerms(LEGAL_TERMS_DOCUMENT_ID));

    if (!activeTerms) {
      return;
    }

    const acceptance = await transaction.getUserTermsAcceptance(user.uid);

    if (!acceptance || acceptance.termsVersion !== activeTerms.version) {
      throw new AppError(
        403,
        'terms_acceptance_required',
        'Vous devez accepter les conditions d’utilisation AtouPay avant de continuer.',
      );
    }
  }

  private async resolveUserAgencyId(
    transaction: TransactionContext,
    user: UserDoc | null,
  ) {
    if (!user) {
      return null;
    }

    if (user.agencyId) {
      return user.agencyId;
    }

    if (user.role === 'tenant' && user.tenantId) {
      const tenant = await transaction.getTenant(user.tenantId);

      if (!tenant) {
        return null;
      }

      const ownerUser = await transaction.getUser(tenant.ownerId);
      return ownerUser?.agencyId ?? null;
    }

    return null;
  }

  private async resolveAgencyName(
    transaction: TransactionContext,
    agencyId: string | null,
  ) {
    if (!agencyId) {
      return 'Agence non renseignée';
    }

    const agency = await transaction.getAgency(agencyId);
    return agency?.displayName ?? 'Agence ATouPay';
  }

  private async resolveCommissionRate(
    transaction: TransactionContext,
    agencyId: string | null,
  ) {
    if (!agencyId) {
      return 0;
    }

    const agency = await transaction.getAgency(agencyId);

    if (!agency || agency.commissionType !== 'percentage') {
      return 0;
    }

    return clampRate(agency.commissionRate);
  }

  private async resolveAgencyAdminBootstrap(
    transaction: TransactionContext,
    identity: AuthContext,
    existingUser: UserDoc | null,
  ) {
    const email = requireEmail(identity, existingUser);
    const bootstrapId = hashStableValue(email);
    const bootstrap = await transaction.getAgencyAdminBootstrap(bootstrapId);

    return {
      bootstrap,
      bootstrapId,
      email,
    };
  }

  async bootstrapProfile(
    identity: AuthContext,
    input: BootstrapProfileInput,
  ): Promise<BootstrapProfileOutput> {
    const createdAt = this.now().toISOString();

    return this.repository.runTransaction(async (transaction) => {
      const existingUser = await transaction.getUser(identity.uid);
      const existingOwner =
        input.role === 'owner' && existingUser?.status === 'active'
          ? await transaction.getOwner(identity.uid)
          : null;

      if (existingUser && existingUser.role !== input.role) {
        throw new AppError(
          409,
          'role_locked',
          'Ce compte ATouPay a déjà un rôle applicatif différent.',
        );
      }

      if (existingUser?.status === 'suspended') {
        throw new AppError(
          403,
          'account_suspended',
          'Ce compte ATouPay est suspendu. Contactez votre agence pour réactivation.',
        );
      }

      if (input.role === 'agency_admin') {
        const { bootstrap, bootstrapId } = await this.resolveAgencyAdminBootstrap(
          transaction,
          identity,
          existingUser,
        );

        if (!bootstrap && !existingUser?.agencyId) {
          throw new AppError(
            403,
            'agency_admin_not_authorized',
            'Cette adresse e-mail n’est pas autorisée à ouvrir un espace agence.',
          );
        }

        if (bootstrap?.status === 'revoked') {
          throw new AppError(
            403,
            'agency_admin_revoked',
            'Cet accès agence a été révoqué.',
          );
        }

        if (bootstrap?.claimedByUid && bootstrap.claimedByUid !== identity.uid) {
          throw new AppError(
            409,
            'agency_admin_claimed',
            'Cette autorisation agence est déjà rattachée à un autre compte.',
          );
        }

        const agencyId = existingUser?.agencyId ?? bootstrap?.agencyId ?? null;

        if (!agencyId) {
          throw new AppError(
            409,
            'agency_missing',
            'Aucune agence n’est associée à cette autorisation administrateur.',
          );
        }

        const nextUser = buildUserDoc({
          agencyId,
          createdAt,
          existing: existingUser,
          identity,
          ownerId: null,
          role: 'agency_admin',
          status: 'active',
          tenantId: null,
          updatedAt: createdAt,
        });

        transaction.setUser(identity.uid, nextUser);

        if (bootstrap) {
          if (bootstrap.status === 'pending') {
            transaction.updateAgencyAdminBootstrap(bootstrapId, {
              claimedAt: createdAt,
              claimedByUid: identity.uid,
              status: 'claimed',
              updatedAt: createdAt,
            });
          } else if (bootstrap.status === 'claimed' && bootstrap.claimedByUid === identity.uid) {
            transaction.updateAgencyAdminBootstrap(bootstrapId, {
              updatedAt: createdAt,
            });
          }
        }

        return {
          ownerId: null,
          role: 'agency_admin',
          tenantId: null,
          uid: nextUser.uid,
        };
      }

      const nextUser =
        input.role === 'owner'
          ? buildUserDoc({
              createdAt,
              existing: existingUser,
              identity,
              ownerId:
                existingUser?.status === 'active' ? existingUser.ownerId ?? identity.uid : null,
              role: 'owner',
              status: existingUser?.status === 'active' ? 'active' : 'pending_owner_access',
              tenantId: null,
              updatedAt: createdAt,
            })
          : buildUserDoc({
              createdAt,
              existing: existingUser,
              identity,
              ownerId: null,
              role: 'tenant',
              status: 'active',
              updatedAt: createdAt,
            });

      transaction.setUser(identity.uid, nextUser);

      if (input.role === 'owner' && nextUser.status === 'active') {
        const ownerDoc: OwnerDoc = {
          agencyId: nextUser.agencyId ?? existingOwner?.agencyId ?? null,
          createdAt: existingOwner?.createdAt ?? createdAt,
          displayName: nextUser.displayName,
          updatedAt: createdAt,
          userId: identity.uid,
        };

        transaction.setOwner(identity.uid, ownerDoc);
      }

      return {
        ownerId: nextUser.ownerId,
        role: nextUser.role,
        tenantId: nextUser.tenantId,
        uid: nextUser.uid,
      };
    });
  }

  async getCurrentTerms(): Promise<LegalTermsOutput> {
    return this.getOrCreateLegalTerms();
  }

  async getTermsStatus(identity: AuthContext): Promise<TermsStatusOutput> {
    const user = await this.repository.getUser(identity.uid);

    if (!user) {
      throw new AppError(
        409,
        'profile_not_bootstrapped',
        'Le profil applicatif ATouPay doit être initialisé avant cette opération.',
      );
    }

    const terms = await this.getOrCreateLegalTerms();
    const acceptance = await this.repository.getUserTermsAcceptance(identity.uid);

    return {
      acceptedAt: acceptance?.acceptedAt ?? null,
      acceptedVersion: acceptance?.termsVersion ?? null,
      requiresAcceptance: acceptance?.termsVersion !== terms.version,
      termsVersion: terms.version,
    };
  }

  async acceptTerms(identity: AuthContext, input: AcceptTermsInput): Promise<TermsStatusOutput> {
    const terms = await this.getOrCreateLegalTerms();
    const timestamp = this.now().toISOString();

    return this.repository.runTransaction(async (transaction) => {
      const user = await transaction.getUser(identity.uid);

      if (!user) {
        throw new AppError(
          409,
          'profile_not_bootstrapped',
          'Le profil applicatif ATouPay doit être initialisé avant cette opération.',
        );
      }

      const acceptance: UserTermsAcceptanceDoc = {
        acceptedAt: timestamp,
        appVersion: normalizeNullableString(input.appVersion ?? null),
        locale: normalizeNullableString(input.locale ?? null) ?? terms.locale,
        termsVersion: terms.version,
        uid: identity.uid,
      };

      transaction.setUserTermsAcceptance(identity.uid, acceptance);

      return {
        acceptedAt: acceptance.acceptedAt,
        acceptedVersion: acceptance.termsVersion,
        requiresAcceptance: false,
        termsVersion: terms.version,
      };
    });
  }

  async getProfileContact(identity: AuthContext): Promise<ProfileContactOutput> {
    const user = await this.repository.getUser(identity.uid);

    if (!user) {
      throw new AppError(
        409,
        'profile_not_bootstrapped',
        'Le profil applicatif ATouPay doit être initialisé avant cette opération.',
      );
    }

    return {
      phoneNumber: user.phoneNumber ?? null,
      phoneVerificationStatus: user.phoneNumber ? 'unverified' : null,
      recoveryContactPreference: user.recoveryContactPreference ?? null,
      supportRecoveryStatus: user.supportRecoveryStatus ?? null,
    };
  }

  async updateProfileContact(
    identity: AuthContext,
    input: UpdateProfileContactInput,
  ): Promise<ProfileContactOutput> {
    const timestamp = this.now().toISOString();

    return this.repository.runTransaction(async (transaction) => {
      const user = await transaction.getUser(identity.uid);

      if (!user) {
        throw new AppError(
          409,
          'profile_not_bootstrapped',
          'Le profil applicatif ATouPay doit être initialisé avant cette opération.',
        );
      }

      const nextPhoneNumber =
        input.phoneNumber === undefined ? user.phoneNumber ?? null : normalizePhoneNumber(input.phoneNumber);
      const nextPreference =
        input.recoveryContactPreference === undefined
          ? user.recoveryContactPreference ?? null
          : normalizeRecoveryContactPreference(input.recoveryContactPreference);

      if (nextPreference === 'phone' && !nextPhoneNumber) {
        throw new AppError(
          400,
          'phone_number_required',
          'Un numéro de téléphone est requis pour préférer la récupération par téléphone.',
        );
      }

      transaction.updateUser(identity.uid, {
        phoneNumber: nextPhoneNumber,
        recoveryContactPreference: nextPreference,
        updatedAt: timestamp,
      });

      return {
        phoneNumber: nextPhoneNumber,
        phoneVerificationStatus: nextPhoneNumber ? 'unverified' : null,
        recoveryContactPreference: nextPreference,
        supportRecoveryStatus: user.supportRecoveryStatus ?? null,
      };
    });
  }

  async createSupportRequest(
    identity: AuthContext,
    input: CreateSupportRequestInput,
  ): Promise<SupportRequestOutput> {
    const subject = input.subject.trim();
    const description = input.description.trim();
    const timestamp = this.now().toISOString();
    const requestId = randomUUID();

    if (!subject || !description) {
      throw new AppError(
        400,
        'support_request_invalid',
        'Le sujet et la description de la demande de support sont requis.',
      );
    }

    return this.repository.runTransaction(async (transaction) => {
      const user = await transaction.getUser(identity.uid);

      if (!user) {
        throw new AppError(
          409,
          'profile_not_bootstrapped',
          'Le profil applicatif ATouPay doit être initialisé avant cette opération.',
        );
      }

      const agencyId = await this.resolveUserAgencyId(transaction, user);

      if (input.paymentId) {
        const payment = await transaction.getPayment(input.paymentId);

        if (!payment) {
          throw new AppError(404, 'payment_not_found', 'Le paiement signalé est introuvable.');
        }

        if (
          (user.role === 'tenant' && payment.tenantId !== user.uid) ||
          (user.role === 'owner' && payment.ownerId !== user.ownerId) ||
          (user.role === 'agency_admin' && user.agencyId !== payment.agencyId)
        ) {
          throw new AppError(
            403,
            'forbidden_payment_scope',
            'Ce paiement ne peut pas être signalé depuis ce compte.',
          );
        }
      }

      const supportRequest: SupportRequestDoc = {
        agencyId,
        category: input.category,
        contactEmail: user.email,
        createdAt: timestamp,
        description,
        paymentId: input.paymentId ?? null,
        phoneNumber:
          normalizePhoneNumber(input.phoneNumber) ??
          user.phoneNumber ??
          null,
        recoveryContactPreference:
          normalizeRecoveryContactPreference(input.recoveryContactPreference) ??
          user.recoveryContactPreference ??
          null,
        requestorDisplayName: user.displayName,
        requestorRole: user.role,
        resolutionNote: null,
        resolvedAt: null,
        status: 'submitted',
        subject,
        updatedAt: timestamp,
        userId: user.uid,
      };

      transaction.setSupportRequest(requestId, supportRequest);
      transaction.updateUser(identity.uid, {
        supportRecoveryStatus:
          input.category === 'account_recovery' ? 'submitted' : user.supportRecoveryStatus ?? null,
        updatedAt: timestamp,
      });
      this.recordAudit(transaction, {
        actor: user,
        agencyId,
        entityId: requestId,
        entityType: 'supportRequest',
        eventType: 'support_request_created',
        metadata: {
          category: input.category,
          paymentId: input.paymentId ?? null,
        },
        targetUid: user.uid,
        timestamp,
      });

      if (agencyId) {
        this.createNotification(transaction, {
          agencyId,
          body: `${user.displayName} a ouvert une demande: ${subject}`,
          relatedEntityId: requestId,
          relatedEntityType: 'supportRequest',
          role: 'agency_admin',
          timestamp,
          title: 'Nouvelle demande support',
          type: 'support_request_status_changed',
        });
      }

      return supportRequestOutputFromDoc(requestId, supportRequest);
    });
  }

  async createRecoverySupportRequest(
    input: CreateRecoverySupportRequestInput,
  ): Promise<SupportRequestOutput> {
    const subject = input.subject.trim();
    const description = input.description.trim();
    const email = normalizeEmail(input.email);
    const timestamp = this.now().toISOString();
    const requestId = randomUUID();

    if (!subject || !description) {
      throw new AppError(
        400,
        'support_request_invalid',
        'Le sujet et la description de la demande de récupération sont requis.',
      );
    }

    if (!email.includes('@')) {
      throw new AppError(
        400,
        'support_request_invalid',
        'Une adresse e-mail valide est requise pour la récupération assistée.',
      );
    }

    const matchedUser = await this.repository.findUserByEmail(email);

    return this.repository.runTransaction(async (transaction) => {
      const transactionalUser = matchedUser ? await transaction.getUser(matchedUser.uid) : null;
      const agencyId = await this.resolveUserAgencyId(transaction, transactionalUser);
      const supportRequest: SupportRequestDoc = {
        agencyId,
        category: 'account_recovery',
        contactEmail: email,
        createdAt: timestamp,
        description,
        paymentId: null,
        phoneNumber: normalizePhoneNumber(input.phoneNumber),
        recoveryContactPreference: normalizeRecoveryContactPreference(input.recoveryContactPreference),
        requestorDisplayName: email,
        requestorRole: transactionalUser?.role ?? 'guest',
        resolutionNote: null,
        resolvedAt: null,
        status: 'submitted',
        subject,
        updatedAt: timestamp,
        userId: transactionalUser?.uid ?? null,
      };

      transaction.setSupportRequest(requestId, supportRequest);

      if (transactionalUser) {
        transaction.updateUser(transactionalUser.uid, {
          supportRecoveryStatus: 'submitted',
          updatedAt: timestamp,
        });
      }
      this.recordAudit(transaction, {
        actor: null,
        agencyId,
        entityId: requestId,
        entityType: 'supportRequest',
        eventType: 'support_request_created',
        metadata: {
          category: 'account_recovery',
          email,
        },
        targetUid: transactionalUser?.uid ?? null,
        timestamp,
      });

      if (agencyId) {
        this.createNotification(transaction, {
          agencyId,
          body: `Une récupération assistée a été demandée pour ${email}.`,
          relatedEntityId: requestId,
          relatedEntityType: 'supportRequest',
          role: 'agency_admin',
          timestamp,
          title: 'Récupération assistée',
          type: 'support_request_status_changed',
        });
      }

      return supportRequestOutputFromDoc(requestId, supportRequest);
    });
  }

  async listSupportRequests(identity: AuthContext): Promise<SupportRequestOutput[]> {
    const user = await this.repository.getUser(identity.uid);

    if (!user) {
      throw new AppError(
        409,
        'profile_not_bootstrapped',
        'Le profil applicatif ATouPay doit être initialisé avant cette opération.',
      );
    }

    const requests =
      user.role === 'agency_admin' && user.agencyId
        ? await this.repository.listSupportRequestsByAgency(user.agencyId)
        : await this.repository.listSupportRequestsByUser(user.uid);

    return requests
      .filter(({ doc }) => isSupportRequestAccessibleToUser(user, doc))
      .map(({ doc, id }) => supportRequestOutputFromDoc(id, doc))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async updateSupportRequest(
    identity: AuthContext,
    requestId: string,
    input: UpdateSupportRequestInput,
  ): Promise<SupportRequestOutput> {
    const timestamp = this.now().toISOString();
    const nextStatus = input.status;

    return this.repository.runTransaction(async (transaction) => {
      const admin = assertAgencyAdmin(await transaction.getUser(identity.uid));
      const supportRequest = await transaction.getSupportRequest(requestId);

      if (!supportRequest) {
        throw new AppError(404, 'support_request_not_found', 'La demande de support est introuvable.');
      }

      if (supportRequest.agencyId !== admin.agencyId) {
        throw new AppError(
          403,
          'forbidden_agency_scope',
          'Cette demande de support n’appartient pas à votre agence.',
        );
      }

      const resolutionNote =
        input.resolutionNote === undefined
          ? supportRequest.resolutionNote
          : normalizeNullableString(input.resolutionNote);
      const resolvedAt = nextStatus === 'resolved' ? timestamp : null;

      transaction.updateSupportRequest(requestId, {
        resolutionNote,
        resolvedAt,
        status: nextStatus,
        updatedAt: timestamp,
      });

      if (supportRequest.userId) {
        if (supportRequest.category === 'account_recovery') {
          transaction.updateUser(supportRequest.userId, {
            supportRecoveryStatus: nextStatus,
            updatedAt: timestamp,
          });
        } else {
          transaction.updateUser(supportRequest.userId, {
            updatedAt: timestamp,
          });
        }
      }
      this.recordAudit(transaction, {
        actor: admin,
        agencyId: admin.agencyId,
        entityId: requestId,
        entityType: 'supportRequest',
        eventType: 'support_request_updated',
        metadata: {
          status: nextStatus,
        },
        targetUid: supportRequest.userId,
        timestamp,
      });

      if (supportRequest.userId) {
        this.createNotification(transaction, {
          agencyId: supportRequest.agencyId,
          body:
            nextStatus === 'resolved'
              ? 'Votre demande a été marquée comme résolue par l’agence.'
              : 'Votre demande est maintenant en cours de traitement par l’agence.',
          relatedEntityId: requestId,
          relatedEntityType: 'supportRequest',
          role: supportRequest.requestorRole === 'guest' ? 'tenant' : supportRequest.requestorRole,
          timestamp,
          title: nextStatus === 'resolved' ? 'Demande support résolue' : 'Demande support en cours',
          type: 'support_request_status_changed',
          userId: supportRequest.userId,
        });
      }

      return supportRequestOutputFromDoc(requestId, {
        ...supportRequest,
        resolutionNote,
        resolvedAt,
        status: nextStatus,
        updatedAt: timestamp,
      });
    });
  }

  async createOwnerProperty(
    identity: AuthContext,
    input: CreatePropertyInput,
  ): Promise<CreatePropertyOutput> {
    const label = input.label.trim();
    const address = input.address.trim();

    if (label.length === 0 || address.length === 0) {
      throw new AppError(400, 'invalid_request', 'Le nom et l’adresse du bien sont requis.');
    }

    const propertyId = randomUUID();
    const timestamp = this.now().toISOString();
    const currentTerms = await this.getOrCreateLegalTerms();

    return this.repository.runTransaction(async (transaction) => {
      const user = assertActiveOwner(await transaction.getUser(identity.uid));
      await this.ensureAcceptedTerms(transaction, user, currentTerms);
      const ownerId = user.ownerId ?? identity.uid;
      const ownerProfile = await transaction.getOwner(ownerId);

      if (!ownerProfile || ownerProfile.userId !== identity.uid) {
        throw new AppError(
          409,
          'owner_profile_missing',
          'Le profil propriétaire ATouPay est incomplet. Relancez le bootstrap du profil.',
        );
      }

      const propertyDoc: PropertyDoc = {
        address,
        createdAt: timestamp,
        label,
        ownerId,
        updatedAt: timestamp,
      };

      transaction.setProperty(propertyId, propertyDoc);

      return {
        id: propertyId,
        ownerId,
      };
    });
  }

  async createOwnerUnit(identity: AuthContext, input: CreateUnitInput): Promise<CreateUnitOutput> {
    const label = input.label.trim();
    const currency = input.currency.trim().toUpperCase();
    const rentAmount = Number(input.rentAmount);

    if (label.length === 0) {
      throw new AppError(400, 'invalid_request', 'Le libellé de l’unité est requis.');
    }

    if (!Number.isFinite(rentAmount) || rentAmount <= 0) {
      throw new AppError(400, 'invalid_request', 'Le loyer mensuel doit être strictement positif.');
    }

    if (currency.length === 0) {
      throw new AppError(400, 'invalid_request', 'La devise de l’unité est requise.');
    }

    const unitId = randomUUID();
    const timestamp = this.now().toISOString();
    const currentTerms = await this.getOrCreateLegalTerms();

    return this.repository.runTransaction(async (transaction) => {
      const user = assertActiveOwner(await transaction.getUser(identity.uid));
      await this.ensureAcceptedTerms(transaction, user, currentTerms);
      const ownerId = user.ownerId ?? identity.uid;
      const property = await transaction.getProperty(input.propertyId);

      if (!property) {
        throw new AppError(404, 'property_not_found', 'Le bien parent est introuvable.');
      }

      if (property.ownerId !== ownerId) {
        throw new AppError(
          403,
          'forbidden_owner_scope',
          'Vous ne pouvez créer une unité que sur vos propres biens.',
        );
      }

      const unitDoc: UnitDoc = {
        activeInviteId: null,
        createdAt: timestamp,
        currency,
        label,
        ownerId,
        propertyId: input.propertyId,
        rentAmount,
        status: 'vacant',
        tenantId: null,
        updatedAt: timestamp,
      };

      transaction.setUnit(unitId, unitDoc);

      return {
        id: unitId,
        ownerId,
        propertyId: input.propertyId,
      };
    });
  }

  async createInvite(identity: AuthContext, input: CreateInviteInput): Promise<CreateInviteOutput> {
    const timestamp = this.now();
    const nowIso = timestamp.toISOString();
    const inviteCode = generateInviteCode();
    const inviteId = hashInviteCode(inviteCode);
    const expiresAt = new Date(timestamp.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const inviteType = input.inviteType;
    const normalizedEmail = input.email?.trim() ? normalizeEmail(input.email) : null;
    const currentTerms = await this.getOrCreateLegalTerms();

    return this.repository.runTransaction(async (transaction) => {
      const user = assertActiveOwner(await transaction.getUser(identity.uid));
      await this.ensureAcceptedTerms(transaction, user, currentTerms);
      const ownerId = user.ownerId ?? identity.uid;
      const unit = await transaction.getUnit(input.unitId);

      if (!unit) {
        throw new AppError(404, 'unit_not_found', 'L’unité ciblée est introuvable.');
      }

      if (unit.ownerId !== ownerId) {
        throw new AppError(
          403,
          'forbidden_owner_scope',
          'Vous ne pouvez créer une invitation que pour vos propres unités.',
        );
      }

      const property = await transaction.getProperty(unit.propertyId);

      if (!property || property.ownerId !== ownerId) {
        throw new AppError(
          409,
          'property_not_found',
          'Le bien parent de cette unité est indisponible.',
        );
      }

      if (unit.tenantId || unit.status === 'occupied') {
        throw new AppError(409, 'unit_already_occupied', 'Cette unité est déjà occupée.');
      }

      if (unit.activeInviteId) {
        throw new AppError(
          409,
          'invite_already_active',
          'Une invitation active existe déjà pour cette unité.',
        );
      }

      if (await transaction.getInvite(inviteId)) {
        throw new AppError(
          409,
          'invite_code_collision',
          'Une collision d’invitation est survenue. Réessayez.',
        );
      }

      const inviteDoc: TenantInviteDoc = {
        claimedAt: null,
        claimedByUid: null,
        codeHash: inviteId,
        createdAt: nowIso,
        email: normalizedEmail,
        expiresAt,
        inviteType,
        ownerId,
        propertyId: unit.propertyId,
        status: 'pending',
        unitId: input.unitId,
      };

      transaction.setInvite(inviteId, inviteDoc);
      transaction.updateUnit(input.unitId, {
        activeInviteId: inviteId,
        status: 'invited',
        updatedAt: nowIso,
      });
      this.recordAudit(transaction, {
        actor: user,
        agencyId: user.agencyId,
        entityId: inviteId,
        entityType: 'tenantInvite',
        eventType: 'tenant_invite_created',
        metadata: {
          propertyId: unit.propertyId,
          unitId: input.unitId,
        },
        timestamp: nowIso,
      });
      this.createNotification(transaction, {
        agencyId: user.agencyId,
        body: `Invitation locataire créée pour l’unité ${unit.label}.`,
        relatedEntityId: inviteId,
        relatedEntityType: 'tenantInvite',
        role: 'owner',
        timestamp: nowIso,
        title: 'Invitation locataire créée',
        type: 'tenant_invite_created',
        userId: user.uid,
      });

      return {
        expiresAt,
        inviteCode,
        inviteId,
        inviteLink: buildInviteLink(this.config.inviteBaseUrl, inviteCode),
        ownerId,
        propertyId: unit.propertyId,
        unitId: input.unitId,
      };
    });
  }

  async listOwnerAccessInvites(identity: AuthContext): Promise<OwnerAccessInviteOutput[]> {
    const admin = assertAgencyAdmin(await this.repository.getUser(identity.uid));
    const currentTerms = await this.getOrCreateLegalTerms();
    await this.repository.runTransaction(async (transaction) => {
      const transactionalAdmin = assertAgencyAdmin(await transaction.getUser(identity.uid));
      await this.ensureAcceptedTerms(transaction, transactionalAdmin, currentTerms);
      return null;
    });
    const now = this.now();
    const invites = await this.repository.listOwnerAccessInvitesByAgency(admin.agencyId!);

    return invites
      .map(({ doc, id }) => ({
        agencyId: doc.agencyId,
        claimedAt: doc.claimedAt,
        claimedByUid: doc.claimedByUid,
        createdAt: doc.createdAt,
        email: doc.email,
        expiresAt: doc.expiresAt,
        id,
        inviteType: doc.inviteType,
        status: normalizeInviteStatus(doc, now),
      }))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async createOwnerAccessInvite(
    identity: AuthContext,
    input: CreateOwnerAccessInviteInput,
  ): Promise<OwnerAccessInviteOutput> {
    const timestamp = this.now();
    const nowIso = timestamp.toISOString();
    const inviteCode = generateInviteCode();
    const inviteId = hashInviteCode(inviteCode);
    const normalizedEmail = input.email?.trim() ? normalizeEmail(input.email) : null;
    const expiresAt = new Date(timestamp.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const currentTerms = await this.getOrCreateLegalTerms();

    return this.repository.runTransaction(async (transaction) => {
      const admin = assertAgencyAdmin(await transaction.getUser(identity.uid));
      await this.ensureAcceptedTerms(transaction, admin, currentTerms);
      const agencyId = admin.agencyId!;
      const agency = await transaction.getAgency(agencyId);

      if (!agency) {
        transaction.setAgency(agencyId, {
          commissionRate: 0,
          commissionType: 'percentage',
          createdAt: nowIso,
          displayName: 'Agence ATouPay',
          updatedAt: nowIso,
        });
      }

      if (await transaction.getOwnerAccessInvite(inviteId)) {
        throw new AppError(
          409,
          'owner_access_collision',
          'Une collision d’invitation propriétaire est survenue. Réessayez.',
        );
      }

      const inviteDoc: OwnerAccessInviteDoc = {
        agencyId,
        claimedAt: null,
        claimedByUid: null,
        codeHash: inviteId,
        createdAt: nowIso,
        email: normalizedEmail,
        expiresAt,
        intendedRole: 'owner',
        inviteType: input.inviteType,
        status: 'pending',
      };

      transaction.setOwnerAccessInvite(inviteId, inviteDoc);
      this.recordAudit(transaction, {
        actor: admin,
        agencyId,
        entityId: inviteId,
        entityType: 'ownerAccessInvite',
        eventType: 'owner_invite_created',
        metadata: {
          email: normalizedEmail,
          inviteType: input.inviteType,
        },
        timestamp: nowIso,
      });
      this.createNotification(transaction, {
        agencyId,
        body: normalizedEmail
          ? `Invitation propriétaire créée pour ${normalizedEmail}.`
          : 'Invitation propriétaire ouverte créée.',
        relatedEntityId: inviteId,
        relatedEntityType: 'ownerAccessInvite',
        role: 'agency_admin',
        timestamp: nowIso,
        title: 'Invitation propriétaire créée',
        type: 'owner_invite_created',
      });

      return {
        agencyId,
        claimedAt: null,
        claimedByUid: null,
        createdAt: nowIso,
        email: normalizedEmail,
        expiresAt,
        id: inviteId,
        inviteLink: this.buildOwnerAccessLink(inviteCode),
        inviteType: input.inviteType,
        ownerInviteCode: inviteCode,
        status: 'pending',
      };
    });
  }

  async revokeOwnerAccessInvite(
    identity: AuthContext,
    input: RevokeOwnerAccessInviteInput,
  ): Promise<OwnerAccessInviteOutput> {
    const timestamp = this.now().toISOString();
    const currentTerms = await this.getOrCreateLegalTerms();

    return this.repository.runTransaction(async (transaction) => {
      const admin = assertAgencyAdmin(await transaction.getUser(identity.uid));
      await this.ensureAcceptedTerms(transaction, admin, currentTerms);
      const invite = await transaction.getOwnerAccessInvite(input.inviteId);

      if (!invite) {
        throw new AppError(
          404,
          'owner_access_not_found',
          'Cette invitation propriétaire est introuvable.',
        );
      }

      if (invite.agencyId !== admin.agencyId) {
        throw new AppError(
          403,
          'forbidden_agency_scope',
          'Cette invitation n’appartient pas à votre agence.',
        );
      }

      const normalizedStatus = normalizeInviteStatus(invite, this.now());

      if (normalizedStatus === 'claimed') {
        throw new AppError(
          409,
          'owner_access_already_claimed',
          'Cette invitation a déjà été utilisée et ne peut plus être révoquée.',
        );
      }

      if (normalizedStatus === 'revoked') {
        return {
          agencyId: invite.agencyId,
          claimedAt: invite.claimedAt,
          claimedByUid: invite.claimedByUid,
          createdAt: invite.createdAt,
          email: invite.email,
          expiresAt: invite.expiresAt,
          id: input.inviteId,
          inviteType: invite.inviteType,
          status: 'revoked',
        };
      }

      transaction.updateOwnerAccessInvite(input.inviteId, {
        status: 'revoked',
      });
      this.recordAudit(transaction, {
        actor: admin,
        agencyId: admin.agencyId,
        entityId: input.inviteId,
        entityType: 'ownerAccessInvite',
        eventType: 'owner_invite_revoked',
        metadata: {
          email: invite.email,
        },
        timestamp,
      });

      return {
        agencyId: invite.agencyId,
        claimedAt: invite.claimedAt,
        claimedByUid: invite.claimedByUid,
        createdAt: invite.createdAt,
        email: invite.email,
        expiresAt: invite.expiresAt,
        id: input.inviteId,
        inviteType: invite.inviteType,
        status: 'revoked',
      };
    });
  }

  async listAgencyOwners(identity: AuthContext): Promise<ListAgencyOwnersOutputItem[]> {
    const admin = assertAgencyAdmin(await this.repository.getUser(identity.uid));
    const currentTerms = await this.getOrCreateLegalTerms();
    await this.repository.runTransaction(async (transaction) => {
      const transactionalAdmin = assertAgencyAdmin(await transaction.getUser(identity.uid));
      await this.ensureAcceptedTerms(transaction, transactionalAdmin, currentTerms);
      return null;
    });
    const owners = await this.repository.listUsersByAgency(admin.agencyId!, 'owner');

    return owners
      .filter((owner) => owner.status === 'active' || owner.status === 'suspended')
      .map((owner) => ({
        agencyId: owner.agencyId,
        createdAt: owner.createdAt,
        displayName: owner.displayName,
        email: owner.email,
        ownerId: owner.ownerId,
        status: owner.status,
        uid: owner.uid,
        updatedAt: owner.updatedAt,
      }))
      .sort((left, right) => left.displayName.localeCompare(right.displayName, 'fr'));
  }

  async listAgencyUsers(identity: AuthContext): Promise<AgencyUserOutputItem[]> {
    const admin = assertAgencyAdmin(await this.repository.getUser(identity.uid));
    const currentTerms = await this.getOrCreateLegalTerms();
    await this.repository.runTransaction(async (transaction) => {
      const transactionalAdmin = assertAgencyAdmin(await transaction.getUser(identity.uid));
      await this.ensureAcceptedTerms(transaction, transactionalAdmin, currentTerms);
      return null;
    });
    const users = await this.repository.listUsersByAgency(admin.agencyId!);

    return users
      .filter((user) => user.role === 'owner' || user.role === 'tenant')
      .map((user) => ({
        agencyId: user.agencyId,
        createdAt: user.createdAt,
        displayName: user.displayName,
        email: user.email,
        ownerId: user.ownerId,
        role: user.role,
        status: user.status,
        tenantId: user.tenantId,
        uid: user.uid,
        updatedAt: user.updatedAt,
      }))
      .sort((left, right) => {
        if (left.role !== right.role) {
          return left.role.localeCompare(right.role);
        }

        return left.displayName.localeCompare(right.displayName, 'fr');
      });
  }

  async updateAgencyUserStatus(
    identity: AuthContext,
    targetUid: string,
    input: UpdateAgencyUserStatusInput,
  ): Promise<AgencyUserOutputItem> {
    const timestamp = this.now().toISOString();
    const nextStatus = input.status;

    if (nextStatus !== 'active' && nextStatus !== 'suspended') {
      throw new AppError(400, 'invalid_user_status', 'Le statut demandé est invalide.');
    }

    return this.repository.runTransaction(async (transaction) => {
      const admin = assertAgencyAdmin(await transaction.getUser(identity.uid));
      const target = await transaction.getUser(targetUid);

      if (!target) {
        throw new AppError(404, 'user_not_found', 'Ce compte est introuvable.');
      }

      if (target.uid === admin.uid) {
        throw new AppError(
          409,
          'cannot_suspend_self',
          'Un administrateur agence ne peut pas suspendre son propre compte depuis l’application.',
        );
      }

      if (target.agencyId !== admin.agencyId || (target.role !== 'owner' && target.role !== 'tenant')) {
        throw new AppError(
          403,
          'forbidden_agency_scope',
          'Ce compte n’appartient pas au périmètre opérable de votre agence.',
        );
      }

      const tenant =
        target.role === 'tenant' && target.tenantId
          ? await transaction.getTenant(target.tenantId)
          : null;

      transaction.updateUser(target.uid, {
        status: nextStatus,
        updatedAt: timestamp,
      });

      if (target.role === 'tenant' && target.tenantId && tenant) {
        transaction.setTenant(target.tenantId, {
          ...tenant,
          status: nextStatus === 'suspended' ? 'suspended' : 'active',
          updatedAt: timestamp,
        });
      }

      this.recordAudit(transaction, {
        actor: admin,
        agencyId: admin.agencyId,
        entityId: target.uid,
        entityType: 'user',
        eventType: nextStatus === 'suspended' ? 'account_suspended' : 'account_reactivated',
        metadata: {
          role: target.role,
          previousStatus: target.status,
          status: nextStatus,
        },
        targetUid: target.uid,
        timestamp,
      });
      this.createNotification(transaction, {
        agencyId: admin.agencyId,
        body:
          nextStatus === 'suspended'
            ? 'Votre compte est suspendu. Contactez votre agence pour comprendre la situation ou demander une réactivation.'
            : 'Votre compte a été réactivé par votre agence.',
        relatedEntityId: target.uid,
        relatedEntityType: 'user',
        role: target.role,
        timestamp,
        title: nextStatus === 'suspended' ? 'Compte suspendu' : 'Compte réactivé',
        type: nextStatus === 'suspended' ? 'account_suspended' : 'account_reactivated',
        userId: target.uid,
      });

      return {
        agencyId: target.agencyId,
        createdAt: target.createdAt,
        displayName: target.displayName,
        email: target.email,
        ownerId: target.ownerId,
        role: target.role,
        status: nextStatus,
        tenantId: target.tenantId,
        uid: target.uid,
        updatedAt: timestamp,
      };
    });
  }

  async getAgencyDashboard(
    identity: AuthContext,
    periodInput?: string,
  ): Promise<AgencyDashboardOutput> {
    const admin = assertAgencyAdmin(await this.repository.getUser(identity.uid));
    const currentTerms = await this.getOrCreateLegalTerms();
    await this.repository.runTransaction(async (transaction) => {
      const transactionalAdmin = assertAgencyAdmin(await transaction.getUser(identity.uid));
      await this.ensureAcceptedTerms(transaction, transactionalAdmin, currentTerms);
      return null;
    });

    const agencyId = admin.agencyId!;
    const period = normalizeDashboardPeriod(periodInput);
    const now = this.now();
    const [agency, users, ownerInvites, supportRequests, payments, auditOwners] =
      await Promise.all([
        this.repository.getAgency(agencyId),
        this.repository.listUsersByAgency(agencyId),
        this.repository.listOwnerAccessInvitesByAgency(agencyId),
        this.repository.listSupportRequestsByAgency(agencyId),
        this.repository.listPaymentsByAgency(agencyId),
        this.repository.listUsersByAgency(agencyId, 'owner'),
      ]);
    const ownerIds = auditOwners
      .filter((owner) => owner.ownerId && (owner.status === 'active' || owner.status === 'suspended'))
      .map((owner) => owner.ownerId!);
    const [propertiesByOwner, unitsByOwner] = await Promise.all([
      Promise.all(ownerIds.map((ownerId) => this.repository.listPropertiesByOwner(ownerId))),
      Promise.all(ownerIds.map((ownerId) => this.repository.listUnitsByOwner(ownerId))),
    ]);
    const units = unitsByOwner.flat().map(({ doc }) => doc);
    const paymentSummary = summarizePayments(
      payments.map(({ doc }) => doc),
      period,
      now,
    );
    const supportBreakdown = emptySupportStatusBreakdown();

    for (const { doc } of supportRequests) {
      supportBreakdown[doc.status] += 1;
    }

    return {
      activeOwnersCount: users.filter((user) => user.role === 'owner' && user.status === 'active').length,
      activeTenantsCount: users.filter((user) => user.role === 'tenant' && user.status === 'active').length,
      agencyId,
      commissionRate: agency?.commissionRate ?? 0,
      commissionSummary: {
        agencyFeeAmount: paymentSummary.money.agencyFeeAmount,
        grossAmount: paymentSummary.money.grossAmount,
        ownerNetAmount: paymentSummary.money.ownerNetAmount,
      },
      displayName: agency?.displayName ?? 'Agence ATouPay',
      occupiedUnitsCount: units.filter((unit) => unit.status === 'occupied').length,
      paymentsByStatus: paymentSummary.byStatus,
      pendingInvitesCount: ownerInvites.filter(({ doc }) => normalizeInviteStatus(doc, now) === 'pending').length,
      period,
      rentSummary: paymentSummary.money,
      supportRequestsByStatus: supportBreakdown,
      suspendedUsersCount: users.filter((user) => user.status === 'suspended').length,
      totalPropertiesCount: propertiesByOwner.flat().length,
      totalUnitsCount: units.length,
      vacantUnitsCount: units.filter((unit) => unit.status === 'vacant').length,
    };
  }

  async getOwnerDashboard(
    identity: AuthContext,
    periodInput?: string,
  ): Promise<OwnerDashboardOutput> {
    const user = assertActiveOwner(await this.repository.getUser(identity.uid));
    const currentTerms = await this.getOrCreateLegalTerms();
    await this.repository.runTransaction(async (transaction) => {
      const transactionalOwner = assertActiveOwner(await transaction.getUser(identity.uid));
      await this.ensureAcceptedTerms(transaction, transactionalOwner, currentTerms);
      return null;
    });
    const ownerId = user.ownerId ?? identity.uid;
    const period = normalizeDashboardPeriod(periodInput);
    const now = this.now();
    const [properties, units, tenants, payments] = await Promise.all([
      this.repository.listPropertiesByOwner(ownerId),
      this.repository.listUnitsByOwner(ownerId),
      this.repository.listTenantsByOwner(ownerId),
      this.repository.listPaymentsByOwner(ownerId),
    ]);
    const paymentSummary = summarizePayments(
      payments.map(({ doc }) => doc),
      period,
      now,
    );

    return {
      agencyFeeAmount: paymentSummary.money.agencyFeeAmount,
      grossAmount: paymentSummary.money.grossAmount,
      latePaymentsCount: paymentSummary.byStatus.late,
      occupiedUnitsCount: units.filter(({ doc }) => doc.status === 'occupied').length,
      ownerId,
      ownerNetAmount: paymentSummary.money.ownerNetAmount,
      paidPaymentsCount: paymentSummary.byStatus.paid,
      paymentsByStatus: paymentSummary.byStatus,
      pendingPaymentsCount: paymentSummary.byStatus.pending,
      period,
      totalPropertiesCount: properties.length,
      totalTenantsCount: tenants.filter(({ doc }) => doc.status === 'active').length,
      totalUnitsCount: units.length,
      vacantUnitsCount: units.filter(({ doc }) => doc.status === 'vacant').length,
    };
  }

  async listNotifications(identity: AuthContext): Promise<NotificationOutput[]> {
    const user = await this.repository.getUser(identity.uid);

    if (!user) {
      throw new AppError(
        409,
        'profile_not_bootstrapped',
        'Le profil applicatif ATouPay doit être initialisé avant cette opération.',
      );
    }

    const notifications =
      user.role === 'agency_admin' && user.agencyId
        ? await this.repository.listNotificationsByAgency(user.agencyId)
        : await this.repository.listNotificationsByUser(user.uid);

    return notifications
      .filter(({ doc }) =>
        user.role === 'agency_admin'
          ? doc.role === 'agency_admin' && doc.agencyId === user.agencyId
          : doc.userId === user.uid,
      )
      .map(({ doc, id }) => notificationOutputFromDoc(id, doc))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async markNotificationRead(
    identity: AuthContext,
    notificationId: string,
  ): Promise<NotificationOutput> {
    const timestamp = this.now().toISOString();

    return this.repository.runTransaction(async (transaction) => {
      const user = await transaction.getUser(identity.uid);

      if (!user) {
        throw new AppError(
          409,
          'profile_not_bootstrapped',
          'Le profil applicatif ATouPay doit être initialisé avant cette opération.',
        );
      }

      const notification = await transaction.getNotification(notificationId);

      if (!notification) {
        throw new AppError(404, 'notification_not_found', 'Cette notification est introuvable.');
      }

      if (
        user.role === 'agency_admin'
          ? notification.role !== 'agency_admin' || notification.agencyId !== user.agencyId
          : notification.userId !== user.uid
      ) {
        throw new AppError(
          403,
          'forbidden_notification_scope',
          'Cette notification ne vous appartient pas.',
        );
      }

      transaction.updateNotification(notificationId, {
        readAt: notification.readAt ?? timestamp,
      });

      return notificationOutputFromDoc(notificationId, {
        ...notification,
        readAt: notification.readAt ?? timestamp,
      });
    });
  }

  async listAgencyAuditLogs(identity: AuthContext): Promise<AuditLogOutput[]> {
    const admin = assertAgencyAdmin(await this.repository.getUser(identity.uid));
    const currentTerms = await this.getOrCreateLegalTerms();
    await this.repository.runTransaction(async (transaction) => {
      const transactionalAdmin = assertAgencyAdmin(await transaction.getUser(identity.uid));
      await this.ensureAcceptedTerms(transaction, transactionalAdmin, currentTerms);
      return null;
    });
    const logs = await this.repository.listAuditLogsByAgency(admin.agencyId!);

    return logs
      .map(({ doc, id }) => auditLogOutputFromDoc(id, doc))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, 100);
  }

  async getAgencySettings(identity: AuthContext): Promise<AgencySettingsOutput> {
    const admin = assertAgencyAdmin(await this.repository.getUser(identity.uid));
    const currentTerms = await this.getOrCreateLegalTerms();
    await this.repository.runTransaction(async (transaction) => {
      const transactionalAdmin = assertAgencyAdmin(await transaction.getUser(identity.uid));
      await this.ensureAcceptedTerms(transaction, transactionalAdmin, currentTerms);
      return null;
    });
    const agencyId = admin.agencyId!;
    const agency = await this.repository.getAgency(agencyId);

    return {
      agencyId,
      commissionRate: agency?.commissionRate ?? 0,
      commissionType: 'percentage',
      displayName: agency?.displayName ?? 'Agence ATouPay',
    };
  }

  async updateAgencySettings(
    identity: AuthContext,
    input: UpdateAgencySettingsInput,
  ): Promise<AgencySettingsOutput> {
    const commissionRate = clampRate(input.commissionRate);
    const timestamp = this.now().toISOString();
    const currentTerms = await this.getOrCreateLegalTerms();

    return this.repository.runTransaction(async (transaction) => {
      const admin = assertAgencyAdmin(await transaction.getUser(identity.uid));
      await this.ensureAcceptedTerms(transaction, admin, currentTerms);
      const agencyId = admin.agencyId!;
      const existingAgency = await transaction.getAgency(agencyId);

      if (!existingAgency) {
        transaction.setAgency(agencyId, {
          commissionRate,
          commissionType: 'percentage',
          createdAt: timestamp,
          displayName: 'Agence ATouPay',
          updatedAt: timestamp,
        });
      } else {
        transaction.updateAgency(agencyId, {
          commissionRate,
          commissionType: 'percentage',
          updatedAt: timestamp,
        });
      }

      return {
        agencyId,
        commissionRate,
        commissionType: 'percentage',
        displayName: existingAgency?.displayName ?? 'Agence ATouPay',
      };
    });
  }

  async redeemOwnerAccess(
    identity: AuthContext,
    input: RedeemOwnerAccessInput,
  ): Promise<RedeemOwnerAccessOutput> {
    const normalizedCode = normalizeInviteCode(input.inviteCode);

    if (normalizedCode.length < 8) {
      throw new AppError(
        400,
        'owner_access_invalid',
        'Le code saisi n’est pas une invitation propriétaire ATouPay valide.',
      );
    }

    const inviteId = hashInviteCode(normalizedCode);
    const timestamp = this.now().toISOString();

    return this.repository.runTransaction(async (transaction) => {
      const existingUser = await transaction.getUser(identity.uid);

      if (existingUser?.role === 'tenant') {
        throw new AppError(
          409,
          'role_locked',
          'Ce compte locataire ne peut pas être converti en compte propriétaire.',
        );
      }

      if (existingUser?.role === 'agency_admin') {
        throw new AppError(
          409,
          'role_locked',
          'Ce compte agence ne peut pas être converti en compte propriétaire.',
        );
      }

      const invite = await transaction.getOwnerAccessInvite(inviteId);

      if (!invite) {
        throw new AppError(
          404,
          'owner_access_invalid',
          'Aucune invitation agence active ne correspond à ce code.',
        );
      }

      if (invite.intendedRole !== 'owner') {
        throw new AppError(
          409,
          'owner_access_invalid',
          'Cette invitation ne permet pas d’activer un accès propriétaire.',
        );
      }

      const inviteStatus = normalizeInviteStatus(invite, this.now());

      if (inviteStatus === 'claimed') {
        throw new AppError(
          409,
          'owner_access_already_claimed',
          'Cette invitation propriétaire a déjà été utilisée ou n’est plus active.',
        );
      }

      if (inviteStatus === 'revoked') {
        throw new AppError(
          409,
          'owner_access_revoked',
          'Cette invitation propriétaire a été révoquée par l’agence.',
        );
      }

      if (inviteStatus === 'expired') {
        throw new AppError(
          409,
          'owner_access_expired',
          'Cette invitation propriétaire a expiré. Demandez-en une nouvelle à l’agence.',
        );
      }

      const email = requireEmail(identity, existingUser);

      if (invite.email && normalizeEmail(invite.email) !== email) {
        throw new AppError(
          409,
          'owner_access_email_mismatch',
          'Cette invitation propriétaire est réservée à une autre adresse e-mail.',
        );
      }

      if (invite.claimedByUid && invite.claimedByUid !== identity.uid) {
        throw new AppError(
          409,
          'owner_access_already_claimed',
          'Cette invitation propriétaire est déjà utilisée par un autre compte.',
        );
      }

      const nextUser = buildUserDoc({
        agencyId: invite.agencyId,
        createdAt: timestamp,
        existing: existingUser,
        identity,
        ownerId: identity.uid,
        role: 'owner',
        status: 'active',
        tenantId: null,
        updatedAt: timestamp,
      });

      const existingOwner = await transaction.getOwner(identity.uid);
      const ownerDoc: OwnerDoc = {
        agencyId: invite.agencyId,
        createdAt: existingOwner?.createdAt ?? timestamp,
        displayName: nextUser.displayName,
        updatedAt: timestamp,
        userId: identity.uid,
      };

      transaction.setUser(identity.uid, nextUser);
      transaction.setOwner(identity.uid, ownerDoc);
      transaction.updateOwnerAccessInvite(inviteId, {
        claimedAt: timestamp,
        claimedByUid: identity.uid,
        status: 'claimed',
      });
      this.recordAudit(transaction, {
        actor: nextUser,
        agencyId: invite.agencyId,
        entityId: identity.uid,
        entityType: 'owner',
        eventType: 'owner_activated',
        metadata: {
          inviteId,
        },
        targetUid: identity.uid,
        timestamp,
      });
      this.createNotification(transaction, {
        agencyId: invite.agencyId,
        body: 'Votre accès propriétaire est maintenant actif.',
        relatedEntityId: identity.uid,
        relatedEntityType: 'owner',
        role: 'owner',
        timestamp,
        title: 'Accès propriétaire activé',
        type: 'owner_activated',
        userId: identity.uid,
      });

      return {
        agencyId: invite.agencyId,
        ownerId: identity.uid,
        uid: identity.uid,
      };
    });
  }

  async redeemInvite(
    identity: AuthContext,
    input: RedeemInviteInput,
  ): Promise<RedeemInviteOutput> {
    const normalizedCode = normalizeInviteCode(input.inviteCode);

    if (normalizedCode.length < 8) {
      throw new AppError(
        400,
        'invite_invalid',
        'Le code saisi n’est pas une invitation ATouPay valide.',
      );
    }

    const inviteId = hashInviteCode(normalizedCode);
    const timestamp = this.now();
    const nowIso = timestamp.toISOString();
    const currentTerms = await this.getOrCreateLegalTerms();

    return this.repository.runTransaction(async (transaction) => {
      const user = assertActiveTenant(await transaction.getUser(identity.uid));
      await this.ensureAcceptedTerms(transaction, user, currentTerms);
      const tenantId = identity.uid;

      if (user.tenantId) {
        throw new AppError(
          409,
          'tenant_already_attached',
          'Ce compte locataire est déjà rattaché à une unité.',
        );
      }

      if (await transaction.getTenant(tenantId)) {
        throw new AppError(
          409,
          'tenant_already_attached',
          'Ce compte locataire est déjà rattaché à une unité.',
        );
      }

      const invite = await transaction.getInvite(inviteId);

      if (!invite) {
        throw new AppError(
          404,
          'invite_invalid',
          'Aucune invitation active ne correspond à ce code.',
        );
      }

      const inviteStatus = normalizeInviteStatus(invite, timestamp);

      if (inviteStatus !== 'pending') {
        throw new AppError(
          409,
          inviteStatus === 'expired' ? 'invite_expired' : 'invite_already_claimed',
          inviteStatus === 'expired'
            ? 'Cette invitation a expiré. Demandez-en une nouvelle au propriétaire.'
            : 'Cette invitation a déjà été utilisée ou n’est plus active.',
        );
      }

      const email = requireEmail(identity, user);

      if (invite.email && normalizeEmail(invite.email) !== email) {
        throw new AppError(
          409,
          'invite_email_mismatch',
          'Cette invitation est réservée à une autre adresse e-mail.',
        );
      }

      const unit = await transaction.getUnit(invite.unitId);
      const property = await transaction.getProperty(invite.propertyId);
      const ownerUser = await transaction.getUser(invite.ownerId);

      if (!unit || !property) {
        throw new AppError(
          409,
          'invite_target_unavailable',
          'Le bien ciblé par cette invitation n’est plus disponible.',
        );
      }

      if (!ownerUser || ownerUser.role !== 'owner' || ownerUser.status !== 'active') {
        throw new AppError(
          409,
          'owner_inactive',
          'Le propriétaire rattaché à cette invitation n’est plus actif.',
        );
      }

      if (unit.activeInviteId !== inviteId) {
        throw new AppError(
          409,
          'invite_invalid',
          'Cette invitation ne correspond plus à l’unité ciblée.',
        );
      }

      if (unit.tenantId || unit.status === 'occupied') {
        throw new AppError(
          409,
          'unit_already_occupied',
          'Cette unité a déjà été attribuée à un autre locataire.',
        );
      }

      if (unit.ownerId !== invite.ownerId || property.ownerId !== invite.ownerId) {
        throw new AppError(
          409,
          'invite_invalid',
          'Cette invitation ne correspond plus à un propriétaire valide.',
        );
      }

      const paymentId = `rent-${tenantId}-${currentMonthKey(timestamp)}`;
      const existingPayment = await transaction.getPayment(paymentId);
      const commissionRate = await this.resolveCommissionRate(transaction, ownerUser.agencyId ?? null);
      const commissionLedger = calculateCommissionLedger(unit.rentAmount, commissionRate);

      const tenantDoc: TenantDoc = {
        createdAt: nowIso,
        displayName: user.displayName,
        email,
        ownerId: invite.ownerId,
        propertyId: invite.propertyId,
        status: 'active',
        unitId: invite.unitId,
        updatedAt: nowIso,
        userId: tenantId,
      };

      transaction.setTenant(tenantId, tenantDoc);
      transaction.updateUser(tenantId, {
        agencyId: ownerUser.agencyId ?? null,
        ownerId: invite.ownerId,
        tenantId,
        updatedAt: nowIso,
      });
      transaction.updateUnit(invite.unitId, {
        activeInviteId: null,
        status: 'occupied',
        tenantId,
        updatedAt: nowIso,
      });
      transaction.updateInvite(inviteId, {
        claimedAt: nowIso,
        claimedByUid: tenantId,
        status: 'claimed',
      });

      if (!existingPayment) {
        transaction.setPayment(paymentId, {
          agencyFeeAmount: commissionLedger.agencyFeeAmount,
          agencyId: ownerUser.agencyId ?? null,
          commissionRate: commissionLedger.commissionRate,
          createdAt: nowIso,
          dueDate: currentMonthDueDate(timestamp),
          grossAmount: unit.rentAmount,
          monthKey: currentMonthKey(timestamp),
          ownerId: invite.ownerId,
          ownerNetAmount: commissionLedger.ownerNetAmount,
          paidAt: null,
          paymentMethod: null,
          paymentStatus: 'pending',
          propertyId: invite.propertyId,
          providerReference: null,
          receiptId: null,
          tenantId,
          unitId: invite.unitId,
          updatedAt: nowIso,
        });
      }
      this.recordAudit(transaction, {
        actor: user,
        agencyId: ownerUser.agencyId ?? null,
        entityId: tenantId,
        entityType: 'tenant',
        eventType: 'tenant_invite_redeemed',
        metadata: {
          inviteId,
          paymentId,
          propertyId: invite.propertyId,
          unitId: invite.unitId,
        },
        targetUid: tenantId,
        timestamp: nowIso,
      });
      this.createNotification(transaction, {
        agencyId: ownerUser.agencyId ?? null,
        body: `Le locataire ${user.displayName} a rejoint l’unité ${unit.label}.`,
        relatedEntityId: inviteId,
        relatedEntityType: 'tenantInvite',
        role: 'owner',
        timestamp: nowIso,
        title: 'Invitation locataire utilisée',
        type: 'tenant_invite_redeemed',
        userId: invite.ownerId,
      });
      this.createNotification(transaction, {
        agencyId: ownerUser.agencyId ?? null,
        body: `Votre logement ${property.label} • ${unit.label} est maintenant rattaché à ce compte.`,
        relatedEntityId: tenantId,
        relatedEntityType: 'tenant',
        role: 'tenant',
        timestamp: nowIso,
        title: 'Logement attribué',
        type: 'tenant_invite_redeemed',
        userId: tenantId,
      });
      if (ownerUser.agencyId) {
        this.createNotification(transaction, {
          agencyId: ownerUser.agencyId,
          body: `${user.displayName} a rejoint une unité de ${ownerUser.displayName}.`,
          relatedEntityId: tenantId,
          relatedEntityType: 'tenant',
          role: 'agency_admin',
          timestamp: nowIso,
          title: 'Locataire rattaché',
          type: 'tenant_invite_redeemed',
        });
      }

      return {
        ownerId: invite.ownerId,
        paymentId,
        propertyId: invite.propertyId,
        tenantId,
        unitId: invite.unitId,
      };
    });
  }

  async completeSimulatedPayment(
    identity: AuthContext,
    input: CompleteSimulatedPaymentInput,
  ): Promise<CompleteSimulatedPaymentOutput> {
    const paidAt = this.now();
    const paidAtIso = paidAt.toISOString();
    const paymentMethod = input.paymentMethod.trim();
    const currentTerms = await this.getOrCreateLegalTerms();

    if (!paymentMethod) {
      throw new AppError(
        400,
        'payment_method_required',
        'Le moyen de paiement simulé est requis.',
      );
    }

    return this.repository.runTransaction(async (transaction) => {
      const tenantUser = assertActiveTenant(await transaction.getUser(identity.uid));
      await this.ensureAcceptedTerms(transaction, tenantUser, currentTerms);
      const payment = await transaction.getPayment(input.paymentId);

      if (!payment) {
        throw new AppError(404, 'payment_not_found', 'Le paiement demandé est introuvable.');
      }

      if (payment.tenantId !== identity.uid) {
        throw new AppError(
          403,
          'forbidden_payment_scope',
          'Ce paiement ne vous appartient pas.',
        );
      }

      const tenant = await transaction.getTenant(payment.tenantId);
      const owner = await transaction.getOwner(payment.ownerId);
      const ownerUser = await transaction.getUser(payment.ownerId);
      const property = await transaction.getProperty(payment.propertyId);
      const unit = await transaction.getUnit(payment.unitId);

      if (!tenant || !owner || !ownerUser || !property || !unit) {
        throw new AppError(
          409,
          'payment_context_missing',
          'Le contexte du paiement est incomplet. Vérifiez le rattachement du logement avant de réessayer.',
        );
      }

      if (payment.paymentStatus === 'paid' && payment.receiptId) {
        const existingReceipt = await transaction.getReceipt(payment.receiptId);

        if (!existingReceipt) {
          throw new AppError(
            409,
            'receipt_missing',
            'Le reçu associé à ce paiement est introuvable.',
          );
        }

        return {
          payment: {
            ...payment,
            id: input.paymentId,
          },
          receipt: receiptOutputFromDoc(existingReceipt),
        };
      }

      if (payment.paymentStatus !== 'pending' && payment.paymentStatus !== 'late') {
        throw new AppError(
          409,
          'payment_not_payable',
          'Ce paiement simulé ne peut pas être finalisé dans son état actuel.',
        );
      }

      const receiptId = randomUUID();
      const receiptNumber = buildReceiptNumber(paidAt);
      const qrVerificationToken = createHash('sha256')
        .update(`${input.paymentId}:${receiptId}:${paidAtIso}`)
        .digest('hex');
      const verificationUrl = this.buildReceiptVerificationUrl(qrVerificationToken);
      const providerResult = finalizeSimulatedPaymentProvider({
        paymentMethod,
        receiptNumber,
      });
      const providerReference = providerResult.providerReference;
      const receipt: ReceiptDoc = {
        agencyFeeAmount: payment.agencyFeeAmount,
        agencyDisplayName: await this.resolveAgencyName(transaction, payment.agencyId),
        agencyId: payment.agencyId,
        grossAmount: payment.grossAmount,
        id: receiptId,
        issuedAt: paidAtIso,
        issuedBy: 'backend',
        issuanceSource: 'simulate-complete',
        ownerDisplayName: owner.displayName,
        ownerEmail: ownerUser.email,
        ownerId: payment.ownerId,
        ownerNetAmount: payment.ownerNetAmount,
        paidAt: paidAtIso,
        paymentId: input.paymentId,
        paymentMethod,
        paymentStatus: 'paid',
        propertyId: payment.propertyId,
        propertyLabel: property.label,
        qrVerificationToken,
        receiptNumber,
        simulated: providerResult.simulated,
        tenantDisplayName: tenant.displayName,
        tenantEmail: tenant.email,
        tenantId: payment.tenantId,
        unitId: payment.unitId,
        unitLabel: unit.label,
        verificationUrl,
      };

      const nextPayment: RentPaymentDoc = {
        ...payment,
        paidAt: paidAtIso,
        paymentMethod,
        paymentStatus: 'paid',
        providerReference,
        receiptId,
        updatedAt: paidAtIso,
      };

      transaction.setReceipt(receiptId, receipt);
      transaction.updatePayment(input.paymentId, {
        paidAt: paidAtIso,
        paymentMethod,
        paymentStatus: 'paid',
        providerReference,
        receiptId,
        updatedAt: paidAtIso,
      });
      this.recordAudit(transaction, {
        actor: tenantUser,
        agencyId: payment.agencyId,
        entityId: input.paymentId,
        entityType: 'rentPayment',
        eventType: 'payment_completed',
        metadata: {
          agencyFeeAmount: payment.agencyFeeAmount,
          grossAmount: payment.grossAmount,
          ownerNetAmount: payment.ownerNetAmount,
          receiptId,
          simulated: true,
        },
        targetUid: payment.tenantId,
        timestamp: paidAtIso,
      });
      this.createNotification(transaction, {
        agencyId: payment.agencyId,
        body: `Paiement simulé enregistré pour ${property.label} • ${unit.label}.`,
        relatedEntityId: input.paymentId,
        relatedEntityType: 'rentPayment',
        role: 'tenant',
        timestamp: paidAtIso,
        title: 'Paiement simulé confirmé',
        type: 'payment_completed',
        userId: payment.tenantId,
      });
      this.createNotification(transaction, {
        agencyId: payment.agencyId,
        body: `Paiement simulé reçu: brut ${payment.grossAmount}, net propriétaire ${payment.ownerNetAmount}.`,
        relatedEntityId: input.paymentId,
        relatedEntityType: 'rentPayment',
        role: 'owner',
        timestamp: paidAtIso,
        title: 'Loyer simulé payé',
        type: 'payment_completed',
        userId: payment.ownerId,
      });
      if (payment.agencyId) {
        this.createNotification(transaction, {
          agencyId: payment.agencyId,
          body: `Commission ledger calculée: ${payment.agencyFeeAmount}. Aucun split réel n’a été exécuté.`,
          relatedEntityId: input.paymentId,
          relatedEntityType: 'rentPayment',
          role: 'agency_admin',
          timestamp: paidAtIso,
          title: 'Paiement simulé finalisé',
          type: 'payment_completed',
        });
      }

      return {
        payment: {
          ...nextPayment,
          id: input.paymentId,
        },
        receipt: receiptOutputFromDoc(receipt),
      };
    });
  }

  async getReceipt(identity: AuthContext, receiptId: string): Promise<ReceiptOutput> {
    const user = await this.repository.getUser(identity.uid);

    if (!user) {
      throw new AppError(
        409,
        'profile_not_bootstrapped',
        'Le profil applicatif ATouPay doit être initialisé avant cette opération.',
      );
    }

    const receipt = await this.repository.getReceipt(receiptId);
    const terms = await this.getOrCreateLegalTerms();

    if (!receipt) {
      throw new AppError(404, 'receipt_not_found', 'Le reçu demandé est introuvable.');
    }

    if (!isReceiptAccessibleToUser(user, receipt)) {
      throw new AppError(
        403,
        'forbidden_receipt_scope',
        'Ce reçu ne vous est pas accessible.',
      );
    }

    await this.repository.runTransaction(async (transaction) => {
      const transactionalUser = await transaction.getUser(identity.uid);

      if (!transactionalUser) {
        throw new AppError(
          409,
          'profile_not_bootstrapped',
          'Le profil applicatif ATouPay doit être initialisé avant cette opération.',
        );
      }

      await this.ensureAcceptedTerms(transaction, transactionalUser, terms);
      return null;
    });

    return receiptOutputFromDoc(receipt);
  }

  async verifyReceipt(token: string): Promise<ReceiptVerificationOutput> {
    const normalizedToken = token.trim();

    if (normalizedToken.length < 8) {
      return {
        receipt: null,
        valid: false,
      };
    }

    const receipt = await this.repository.findReceiptByVerificationToken(normalizedToken);

    if (!receipt) {
      return {
        receipt: null,
        valid: false,
      };
    }

    return {
      receipt: receiptOutputFromDoc(receipt.doc),
      valid: true,
    };
  }
}
