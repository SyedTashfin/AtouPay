import { createHash, randomUUID } from 'node:crypto';

import type { AppConfig } from '../config/env.js';
import type {
  AgencyAdminBootstrapDoc,
  AuditEventType,
  AuditLogDoc,
  AuthContext,
  InviteType,
  LegalTermsDoc,
  ManualPaymentProofCheckResultDoc,
  ManualPaymentProofOwnerReviewStatus,
  ManualPaymentProofRiskLevel,
  ManualPaymentProofSubmittedMethod,
  NotificationDoc,
  NotificationType,
  OwnerDoc,
  OwnerAccessInviteDoc,
  OwnerPaymentMethodStatus,
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
import {
  OWNER_ACCOUNT_FEE_AMOUNT,
  OWNER_ACCOUNT_FEE_CURRENCY,
  OWNER_ACCOUNT_FEE_INTERVAL_DAYS,
} from '../billing/billingConstants.js';
import {
  OwnerBillingService,
  type AgencyOwnerBillingSummary,
  type OwnerBillingSummary,
} from '../billing/ownerBillingService.js';
import {
  getPaymentRuntimeConfig,
} from '../payments/paymentConfig.js';
import type { PaymentProvider } from '../payments/paymentProvider.js';
import { PaymentService } from '../payments/paymentService.js';
import { PaymentWebhookService } from '../payments/paymentWebhookService.js';
import { MoosylPaymentProvider, type MoosylHttpClient } from '../payments/providers/moosylPaymentProvider.js';
import type {
  PaymentProviderName,
  RentPaymentIntentOutput,
  RentPaymentStatusOutput,
} from '../payments/types.js';
import { noopInviteEmailService, type InviteEmailService } from './email-service.js';
import { finalizeSimulatedPaymentProvider } from './payment-provider.js';

interface BackendServiceOptions {
  config: AppConfig;
  emailService?: InviteEmailService;
  moosylHttpClient?: MoosylHttpClient | undefined;
  now?: () => Date;
  paymentProviders?: Partial<Record<PaymentProviderName, PaymentProvider>> | undefined;
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

export interface UpdatePropertyInput {
  address: string;
  label: string;
}

export interface UpdatePropertyOutput {
  id: string;
  ownerId: string;
}

export interface CreateUnitInput {
  currency: string;
  label: string;
  notes?: string | null;
  propertyId: string;
  rentAmount: number;
}

export interface CreateUnitOutput {
  id: string;
  ownerId: string;
  propertyId: string;
}

export interface UpdateUnitInput {
  label: string;
  notes?: string | null;
  rentAmount: number;
}

export interface UpdateUnitOutput {
  id: string;
  ownerId: string;
  propertyId: string;
}

export interface DeleteInventoryOutput {
  id: string;
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
  bankilyPaymentMethodStatus?: OwnerPaymentMethodStatus;
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
  ownerReceivableAmount: number;
  agencyFeeAmount: number;
  grossAmount: number;
  ownerNetAmount: number;
  platformRentFeeAmount: number;
  tenantFeeAmount: number;
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
  ownerAccountFeeAmount: number;
  ownerAccountFeeCurrency: 'EUR';
  ownerAccountFeeIntervalDays: number;
  legacyCommissionRate: number;
  commissionRate: number;
  commissionType: 'percentage';
  displayName: string;
}

export interface UpdateAgencySettingsInput {
  displayName?: string;
}

export interface AgencyManualOwnerBillingPaymentInput {
  note: string;
  provider?: 'manual' | 'simulated';
  providerReference?: string;
}

export interface AgencySuspendOwnerBillingInput {
  reason: string;
}

export interface RevokeOwnerAccessInviteInput {
  inviteId: string;
}

export interface DeleteOwnerAccessInviteInput {
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
  agencyEscalationAvailable?: boolean | null;
  agencyEscalationAvailableAt?: string | null;
  category: SupportRequestCategory;
  contactEmail: string;
  createdAt: string;
  description: string;
  expectedAmount?: number | null;
  expectedAtouPayReference?: string | null;
  expectedCurrency?: 'MRU' | null;
  id: string;
  manualPaymentMethod?: string | null;
  manualProofReviewNote?: string | null;
  manualProofReviewedAt?: string | null;
  manualProofReviewedByUserId?: string | null;
  manualProofStatus?: 'confirmed' | 'disputed' | 'rejected' | 'submitted' | null;
  ownerLastReminderAt?: string | null;
  ownerReminderCount?: number | null;
  ownerReviewRequestedAt?: string | null;
  ownerReviewStatus?: ManualPaymentProofOwnerReviewStatus | null;
  paymentId: string | null;
  phoneNumber: string | null;
  proofCheckResult?: ManualPaymentProofCheckResultDoc | null;
  proofImageContentType?: string | null;
  proofImageFileName?: string | null;
  proofImageOriginalFileName?: string | null;
  proofImageSizeBytes?: number | null;
  proofImageStoragePath?: string | null;
  proofImageUrl?: string | null;
  proofNote?: string | null;
  proofSubmittedAt?: string | null;
  proofTransactionReference?: string | null;
  recoveryContactPreference: RecoveryContactPreference | null;
  requestorDisplayName: string;
  requestorRole: Role | 'guest';
  resolutionNote: string | null;
  resolvedAt: string | null;
  status: SupportRequestStatus;
  submittedAmount?: number | null;
  submittedCurrency?: 'MRU' | null;
  submittedNote?: string | null;
  submittedPaymentDate?: string | null;
  submittedPaymentMethod?: ManualPaymentProofSubmittedMethod | null;
  submittedPaymentReference?: string | null;
  submittedPaymentTime?: string | null;
  submittedTransactionReference?: string | null;
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

export interface ConfirmManualRentPaymentInput {
  confirmationSource?: 'agency' | 'owner';
  note?: string | null;
  paymentId: string;
  paymentMethod?: string;
  providerReference?: string | null;
  settlementNote?: string | null;
}

export interface SubmitManualRentPaymentProofInput {
  note?: string | null;
  paymentMethod?: string;
  proofImageContentType?: string | null;
  proofImageFileName?: string | null;
  proofImageOriginalFileName?: string | null;
  proofImageSizeBytes?: number | null;
  proofImageStoragePath?: string | null;
  proofImageUrl?: string | null;
  providerReference?: string | null;
  submittedAmount?: number;
  submittedCurrency?: 'MRU';
  submittedNote?: string | null;
  submittedPaymentDate?: string;
  submittedPaymentMethod?: ManualPaymentProofSubmittedMethod;
  submittedPaymentReference?: string;
  submittedPaymentTime?: string | null;
  submittedProofImageContentType?: string | null;
  submittedProofImageFileName?: string | null;
  submittedProofImageOriginalFileName?: string | null;
  submittedProofImageSize?: number | null;
  submittedProofImageStoragePath?: string | null;
  submittedTransactionReference?: string | null;
}

export interface ReviewManualRentPaymentProofInput {
  decision: 'confirmed' | 'disputed' | 'rejected';
  note?: string | null;
  overrideReason?: string | null;
  settlementNote?: string | null;
}

export interface ReviewOwnerPaymentMethodInput {
  note?: string | null;
  status: Extract<OwnerPaymentMethodStatus, 'disabled' | 'rejected' | 'verified'>;
}

export interface ReceiptOutput {
  agencyFeeAmount: number;
  agencyDisplayName: string;
  agencyId: string | null;
  grossAmount: number;
  id: string;
  issuedAt: string;
  issuedBy: 'backend';
  issuanceSource: 'manual-confirmed' | 'provider-confirmed' | 'simulate-complete';
  ownerDisplayName: string;
  ownerEmail: string;
  ownerId: string;
  ownerNetAmount: number;
  paidAt: string;
  paymentId: string;
  paymentMethod: string;
  paymentStatus: PaymentStatus;
  provider?: string;
  providerConfirmationMessage?: string;
  providerReference?: string;
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
const MAX_MANUAL_PROOF_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const OWNER_PROOF_REVIEW_REMINDER_HOURS = 24;
const OWNER_PROOF_REVIEW_ESCALATION_HOURS = 48;
const OWNER_PROOF_REVIEW_MAX_REMINDERS = 3;
const ALLOWED_MANUAL_PROOF_IMAGE_CONTENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

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

function hasManualProofImageMetadata(input: SubmitManualRentPaymentProofInput) {
  return Boolean(
    normalizeNullableString(input.proofImageContentType) ||
      normalizeNullableString(input.proofImageFileName) ||
      normalizeNullableString(input.proofImageOriginalFileName) ||
      normalizeNullableString(input.proofImageStoragePath) ||
      normalizeNullableString(input.proofImageUrl) ||
      typeof input.proofImageSizeBytes === 'number' ||
      normalizeNullableString(input.submittedProofImageContentType) ||
      normalizeNullableString(input.submittedProofImageFileName) ||
      normalizeNullableString(input.submittedProofImageOriginalFileName) ||
      normalizeNullableString(input.submittedProofImageStoragePath) ||
      typeof input.submittedProofImageSize === 'number',
  );
}

function validateManualProofImageMetadata(input: {
  agencyId: string | null;
  contentType: string | null;
  fileName: string | null;
  paymentId: string;
  proofImageUrl: string | null;
  sizeBytes?: number | null;
  storagePath: string | null;
  tenantId: string;
}) {
  if (input.proofImageUrl) {
    throw new AppError(
      400,
      'manual_payment_proof_public_url_rejected',
      'La preuve image doit être référencée par chemin Firebase Storage, pas par URL publique.',
    );
  }

  if (!input.agencyId) {
    throw new AppError(
      409,
      'manual_payment_proof_agency_missing',
      'Le paiement doit être rattaché à une agence pour joindre une preuve image sécurisée.',
    );
  }

  if (!input.storagePath || !input.contentType || !input.fileName || typeof input.sizeBytes !== 'number') {
    throw new AppError(
      400,
      'manual_payment_proof_image_metadata_incomplete',
      'Le chemin, le type, le nom et la taille de la preuve image sont requis.',
    );
  }

  const normalizedContentType = input.contentType.toLowerCase();

  if (!ALLOWED_MANUAL_PROOF_IMAGE_CONTENT_TYPES.has(normalizedContentType)) {
    throw new AppError(
      400,
      'manual_payment_proof_invalid_image',
      'La preuve image doit être au format JPG, PNG ou WebP.',
    );
  }

  if (input.sizeBytes <= 0 || input.sizeBytes > MAX_MANUAL_PROOF_IMAGE_SIZE_BYTES) {
    throw new AppError(
      400,
      'manual_payment_proof_image_too_large',
      'La preuve image doit faire 5 Mo maximum.',
    );
  }

  const segments = input.storagePath.split('/');
  const expectedPrefix = ['paymentProofs', input.agencyId, input.paymentId, input.tenantId];

  if (
    segments.length !== 5 ||
    segments.slice(0, 4).some((segment, index) => segment !== expectedPrefix[index]) ||
    segments[4] !== input.fileName ||
    input.fileName.includes('/') ||
    input.fileName === '.' ||
    input.fileName === '..'
  ) {
    throw new AppError(
      400,
      'manual_payment_proof_invalid_storage_path',
      'Le chemin de preuve image ne correspond pas au paiement et au locataire.',
    );
  }
}

function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function sanitizeReferencePart(value: string, fallback: string) {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase();

  return normalized.length > 0 ? normalized.slice(0, 6) : fallback;
}

function periodCodeFromMonthKey(monthKey: string) {
  const monthCodes = [
    'JAN',
    'FEV',
    'MAR',
    'AVR',
    'MAI',
    'JUN',
    'JUL',
    'AOU',
    'SEP',
    'OCT',
    'NOV',
    'DEC',
  ];
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey);

  if (!match) {
    return sanitizeReferencePart(monthKey, 'PERIOD');
  }

  const monthIndex = Number.parseInt(match[2]!, 10) - 1;
  const yearSuffix = match[1]!.slice(2);

  return `${monthCodes[monthIndex] ?? 'PER'}${yearSuffix}`;
}

function buildAtouPayReference(input: {
  monthKey: string;
  randomSuffix?: string;
  unitLabel?: string | null;
  unitId: string;
}) {
  const unitPart = sanitizeReferencePart(input.unitLabel ?? input.unitId, 'UNIT');
  const periodPart = periodCodeFromMonthKey(input.monthKey);
  const suffix = sanitizeReferencePart(
    input.randomSuffix ?? randomUUID().replace(/-/g, '').slice(0, 3),
    'REF',
  ).slice(0, 3);

  return `ATP-${unitPart}-${periodPart}-${suffix}`;
}

function resolvePaymentAtouPayReference(payment: RentPaymentDoc) {
  return payment.atouPayReference ?? buildAtouPayReference({
    monthKey: payment.monthKey,
    randomSuffix: payment.providerReference ?? payment.tenantId.slice(-3),
    unitId: payment.unitId,
  });
}

function getPaymentExpectedAmount(payment: RentPaymentDoc) {
  return payment.rentAmount ?? payment.grossAmount;
}

function normalizeSubmittedPaymentMethod(value: unknown): ManualPaymentProofSubmittedMethod {
  return value === 'bankily' ||
    value === 'sedad' ||
    value === 'masrvi' ||
    value === 'bank_transfer' ||
    value === 'cash' ||
    value === 'cheque' ||
    value === 'other'
    ? value
    : 'bankily';
}

function evaluateManualPaymentProof(input: {
  expectedAmount: number;
  expectedCurrency: 'MRU';
  expectedReference: string;
  hasImageProof: boolean;
  now: Date;
  submittedAmount: number;
  submittedCurrency: 'MRU';
  submittedPaymentDate: string;
  submittedPaymentReference: string;
  submittedTransactionReference: string | null;
}) {
  const warnings: string[] = [];
  const referenceMatches =
    input.submittedPaymentReference.trim().toUpperCase() ===
    input.expectedReference.trim().toUpperCase();
  const amountMatches = input.submittedAmount === input.expectedAmount;
  const currencyMatches = input.submittedCurrency === input.expectedCurrency;
  const submittedDate = new Date(`${input.submittedPaymentDate}T00:00:00.000Z`);
  const dateLooksValid =
    /^\d{4}-\d{2}-\d{2}$/.test(input.submittedPaymentDate) &&
    !Number.isNaN(submittedDate.getTime()) &&
    submittedDate.getTime() <= input.now.getTime();

  if (!referenceMatches) {
    warnings.push('La référence ATouPay saisie ne correspond pas au paiement attendu.');
  }

  if (!amountMatches) {
    warnings.push('Le montant déclaré ne correspond pas au loyer attendu.');
  }

  if (!currencyMatches) {
    warnings.push('La devise déclarée ne correspond pas à la devise attendue.');
  }

  if (!dateLooksValid) {
    warnings.push('La date déclarée est invalide ou future.');
  }

  if (!input.submittedTransactionReference && !input.hasImageProof) {
    warnings.push('Aucune référence transactionnelle ni image de preuve n’a été fournie.');
  }

  let riskLevel: ManualPaymentProofRiskLevel = 'medium';

  if (
    referenceMatches &&
    amountMatches &&
    currencyMatches &&
    dateLooksValid &&
    (input.submittedTransactionReference || input.hasImageProof)
  ) {
    riskLevel = 'low';
  }

  if (
    !referenceMatches ||
    !amountMatches ||
    !currencyMatches ||
    !dateLooksValid ||
    (!input.submittedTransactionReference && !input.hasImageProof)
  ) {
    riskLevel = 'high';
  }

  return {
    amountMatches,
    currencyMatches,
    dateLooksValid,
    hasImageProof: input.hasImageProof,
    referenceMatches,
    riskLevel,
    warnings,
  } satisfies ManualPaymentProofCheckResultDoc;
}

function normalizePhoneNumber(value: string | null | undefined) {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().replace(/[\s().-]/g, '');

  return normalized.length > 0 ? normalized : null;
}

function resolvePhoneVerificationStatus(input: {
  identityPhoneNumber?: string | null;
  nextPhoneNumber: string | null;
  previousStatus?: 'unverified' | 'verified' | null;
  previousPhoneNumber?: string | null;
}) {
  if (!input.nextPhoneNumber) {
    return null;
  }

  if (input.identityPhoneNumber && input.identityPhoneNumber === input.nextPhoneNumber) {
    return 'verified' as const;
  }

  if (
    input.previousStatus === 'verified' &&
    input.previousPhoneNumber === input.nextPhoneNumber
  ) {
    return 'verified' as const;
  }

  return 'unverified' as const;
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
    phoneVerificationStatus: resolvePhoneVerificationStatus({
      identityPhoneNumber: identity.phoneNumber,
      nextPhoneNumber: phoneNumber !== undefined ? phoneNumber : existing?.phoneNumber ?? null,
      previousPhoneNumber: existing?.phoneNumber ?? null,
      previousStatus: existing?.phoneVerificationStatus ?? null,
    }),
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

function calculateRentLedger(rentAmount: number) {
  return {
    agencyFeeAmount: 0,
    commissionRate: 0,
    grossAmount: rentAmount,
    ownerNetAmount: rentAmount,
    ownerReceivableAmount: rentAmount,
    platformRentFeeAmount: 0,
    rentAmount,
    tenantFeeAmount: 0,
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
    ownerReceivableAmount: 0,
    ownerNetAmount: 0,
    platformRentFeeAmount: 0,
    tenantFeeAmount: 0,
  };

  for (const payment of payments) {
    if (!paymentMatchesPeriod(payment, period, now)) {
      continue;
    }

    byStatus[payment.paymentStatus] += 1;

    if (payment.paymentStatus === 'paid') {
      money.agencyFeeAmount += payment.agencyFeeAmount ?? 0;
      money.grossAmount += payment.grossAmount;
      money.ownerReceivableAmount += payment.ownerReceivableAmount ?? payment.ownerNetAmount;
      money.ownerNetAmount += payment.ownerNetAmount;
      money.platformRentFeeAmount += payment.platformRentFeeAmount ?? 0;
      money.tenantFeeAmount += payment.tenantFeeAmount ?? 0;
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
      runtimeDoc.issuanceSource === 'simulate-complete' ||
      runtimeDoc.issuanceSource === 'provider-confirmed' ||
      runtimeDoc.issuanceSource === 'manual-confirmed'
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
    ...(runtimeDoc.provider ? { provider: runtimeDoc.provider } : {}),
    ...(runtimeDoc.providerConfirmationMessage
      ? { providerConfirmationMessage: runtimeDoc.providerConfirmationMessage }
      : {}),
    ...(runtimeDoc.providerReference ? { providerReference: runtimeDoc.providerReference } : {}),
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
    ...(doc.agencyEscalationAvailable !== undefined
      ? { agencyEscalationAvailable: doc.agencyEscalationAvailable }
      : {}),
    ...(doc.agencyEscalationAvailableAt !== undefined
      ? { agencyEscalationAvailableAt: doc.agencyEscalationAvailableAt }
      : {}),
    category: doc.category,
    contactEmail: doc.contactEmail,
    createdAt: doc.createdAt,
    description: doc.description,
    ...(doc.expectedAmount !== undefined ? { expectedAmount: doc.expectedAmount } : {}),
    ...(doc.expectedAtouPayReference !== undefined
      ? { expectedAtouPayReference: doc.expectedAtouPayReference }
      : {}),
    ...(doc.expectedCurrency !== undefined ? { expectedCurrency: doc.expectedCurrency } : {}),
    id,
    ...(doc.manualPaymentMethod !== undefined
      ? { manualPaymentMethod: doc.manualPaymentMethod }
      : {}),
    ...(doc.manualProofReviewNote !== undefined
      ? { manualProofReviewNote: doc.manualProofReviewNote }
      : {}),
    ...(doc.manualProofReviewedAt !== undefined
      ? { manualProofReviewedAt: doc.manualProofReviewedAt }
      : {}),
    ...(doc.manualProofReviewedByUserId !== undefined
      ? { manualProofReviewedByUserId: doc.manualProofReviewedByUserId }
      : {}),
    ...(doc.manualProofStatus !== undefined
      ? { manualProofStatus: doc.manualProofStatus }
      : {}),
    ...(doc.ownerLastReminderAt !== undefined
      ? { ownerLastReminderAt: doc.ownerLastReminderAt }
      : {}),
    ...(doc.ownerReminderCount !== undefined
      ? { ownerReminderCount: doc.ownerReminderCount }
      : {}),
    ...(doc.ownerReviewRequestedAt !== undefined
      ? { ownerReviewRequestedAt: doc.ownerReviewRequestedAt }
      : {}),
    ...(doc.ownerReviewStatus !== undefined
      ? { ownerReviewStatus: doc.ownerReviewStatus }
      : {}),
    paymentId: doc.paymentId,
    phoneNumber: doc.phoneNumber,
    ...(doc.proofCheckResult !== undefined
      ? { proofCheckResult: doc.proofCheckResult }
      : {}),
    ...(doc.proofImageContentType !== undefined
      ? { proofImageContentType: doc.proofImageContentType }
      : {}),
    ...(doc.proofImageFileName !== undefined
      ? { proofImageFileName: doc.proofImageFileName }
      : {}),
    ...(doc.proofImageOriginalFileName !== undefined
      ? { proofImageOriginalFileName: doc.proofImageOriginalFileName }
      : {}),
    ...(doc.proofImageSizeBytes !== undefined
      ? { proofImageSizeBytes: doc.proofImageSizeBytes }
      : {}),
    ...(doc.proofImageStoragePath !== undefined
      ? { proofImageStoragePath: doc.proofImageStoragePath }
      : {}),
    ...(doc.proofImageUrl !== undefined
      ? { proofImageUrl: doc.proofImageUrl }
      : {}),
    ...(doc.proofNote !== undefined ? { proofNote: doc.proofNote } : {}),
    ...(doc.proofSubmittedAt !== undefined
      ? { proofSubmittedAt: doc.proofSubmittedAt }
      : {}),
    ...(doc.proofTransactionReference !== undefined
      ? { proofTransactionReference: doc.proofTransactionReference }
      : {}),
    recoveryContactPreference: doc.recoveryContactPreference,
    requestorDisplayName: doc.requestorDisplayName,
    requestorRole: doc.requestorRole,
    resolutionNote: doc.resolutionNote,
    resolvedAt: doc.resolvedAt,
    status: doc.status,
    ...(doc.submittedAmount !== undefined ? { submittedAmount: doc.submittedAmount } : {}),
    ...(doc.submittedCurrency !== undefined
      ? { submittedCurrency: doc.submittedCurrency }
      : {}),
    ...(doc.submittedNote !== undefined ? { submittedNote: doc.submittedNote } : {}),
    ...(doc.submittedPaymentDate !== undefined
      ? { submittedPaymentDate: doc.submittedPaymentDate }
      : {}),
    ...(doc.submittedPaymentMethod !== undefined
      ? { submittedPaymentMethod: doc.submittedPaymentMethod }
      : {}),
    ...(doc.submittedPaymentReference !== undefined
      ? { submittedPaymentReference: doc.submittedPaymentReference }
      : {}),
    ...(doc.submittedPaymentTime !== undefined
      ? { submittedPaymentTime: doc.submittedPaymentTime }
      : {}),
    ...(doc.submittedTransactionReference !== undefined
      ? { submittedTransactionReference: doc.submittedTransactionReference }
      : {}),
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

function isSimulatedOwnerBillingPaymentAllowed(config: AppConfig) {
  return config.appVariant === 'development' ||
    config.appVariant === 'preview';
}

export class BackendService {
  private readonly billingService: OwnerBillingService;

  private readonly config: AppConfig;

  private readonly paymentService: PaymentService;

  private readonly paymentWebhookService: PaymentWebhookService;

  private readonly now: () => Date;

  private readonly repository: DataRepository;

  private readonly emailService: InviteEmailService;

  constructor(options: BackendServiceOptions) {
    this.config = options.config;
    this.emailService = options.emailService ?? noopInviteEmailService;
    this.now = options.now ?? (() => new Date());
    this.repository = options.repository;
    this.billingService = new OwnerBillingService({
      now: this.now,
      repository: this.repository,
    });
    const paymentRuntimeConfig = getPaymentRuntimeConfig(this.config);
    this.paymentService = new PaymentService({
      config: this.config,
      ...(options.moosylHttpClient ? { moosylHttpClient: options.moosylHttpClient } : {}),
      now: this.now,
      ...(options.paymentProviders ? { providers: options.paymentProviders } : {}),
      repository: this.repository,
    });
    const moosylProvider =
      options.paymentProviders?.moosyl ??
      (paymentRuntimeConfig.moosyl
        ? new MoosylPaymentProvider({
            ...(options.moosylHttpClient ? { httpClient: options.moosylHttpClient } : {}),
            publishableKey: paymentRuntimeConfig.moosyl.publishableKey,
            secretKey: paymentRuntimeConfig.moosyl.secretKey,
            webhookSecret: paymentRuntimeConfig.moosyl.webhookSecret,
          })
        : {
            name: 'moosyl' as const,
            async createRentPaymentIntent() {
              throw new AppError(
                500,
                'payment_provider_config_missing',
                'La configuration Moosyl du backend est incomplète.',
              );
            },
            async getPaymentStatus() {
              return { status: 'failed' as const };
            },
            async verifyWebhook() {
              return { signatureValid: false };
            },
          });
    this.paymentWebhookService = new PaymentWebhookService({
      moosylProvider,
      now: this.now,
      paymentService: this.paymentService,
      repository: this.repository,
    });
  }

  private buildOwnerAccessLink(inviteCode: string) {
    return buildScopedInviteLink(this.config.inviteBaseUrl, 'ownerInvite', inviteCode);
  }

  private buildReceiptVerificationUrl(token: string) {
    const scheme = this.config.inviteBaseUrl.split('://')[0] ?? 'atoupay';

    return `${scheme}://receipt-verification?token=${encodeURIComponent(token)}`;
  }

  private async sendInviteEmailSafely(operation: () => Promise<void>) {
    try {
      await operation();
    } catch {
      // Invite writes are the source of truth; outbound email must not roll them back.
    }
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

      if (existingUser?.status === 'suspended') {
        throw new AppError(
          403,
          'account_suspended',
          'Ce compte ATouPay est suspendu. Contactez votre agence pour réactivation.',
        );
      }

      const agencyAdminBootstrap = await this.resolveAgencyAdminBootstrap(
        transaction,
        identity,
        existingUser,
      );

      // The public UI only exposes tenant/owner paths. Agency admins are resolved
      // from server-side authorization so credentials work from either login form.
      if (
        input.role === 'agency_admin' ||
        existingUser?.role === 'agency_admin' ||
        agencyAdminBootstrap.bootstrap
      ) {
        const { bootstrap, bootstrapId } = agencyAdminBootstrap;

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

      if (existingUser && existingUser.role !== input.role) {
        return {
          ownerId: existingUser.ownerId,
          role: existingUser.role,
          tenantId: existingUser.tenantId,
          uid: existingUser.uid,
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
              ownerId: existingUser?.role === 'tenant' ? existingUser.ownerId ?? null : null,
              role: 'tenant',
              status: 'active',
              updatedAt: createdAt,
            });

      transaction.setUser(identity.uid, nextUser);

      if (input.role === 'owner' && nextUser.status === 'active') {
        const ownerDoc: OwnerDoc = {
          agencyId: nextUser.agencyId ?? existingOwner?.agencyId ?? null,
          bankilyDeepLinkTemplate: existingOwner?.bankilyDeepLinkTemplate ?? null,
          bankilyIntegrationMode: existingOwner?.bankilyIntegrationMode ?? 'qr_or_code_manual',
          bankilyMerchantCode: existingOwner?.bankilyMerchantCode ?? null,
          bankilyPhoneNumber: existingOwner?.bankilyPhoneNumber ?? null,
          bankilyQrImageUrl: existingOwner?.bankilyQrImageUrl ?? null,
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
      phoneVerificationStatus: user.phoneVerificationStatus ?? null,
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
      const nextPhoneVerificationStatus = resolvePhoneVerificationStatus({
        identityPhoneNumber: identity.phoneNumber,
        nextPhoneNumber,
        previousPhoneNumber: user.phoneNumber ?? null,
        previousStatus: user.phoneVerificationStatus ?? null,
      });

      if (nextPreference === 'phone' && !nextPhoneNumber) {
        throw new AppError(
          400,
          'phone_number_required',
          'Un numéro de téléphone est requis pour préférer la récupération par téléphone.',
        );
      }

      transaction.updateUser(identity.uid, {
        phoneNumber: nextPhoneNumber,
        phoneVerificationStatus: nextPhoneVerificationStatus,
        recoveryContactPreference: nextPreference,
        updatedAt: timestamp,
      });

      return {
        phoneNumber: nextPhoneNumber,
        phoneVerificationStatus: nextPhoneVerificationStatus,
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

  async submitManualRentPaymentProof(
    identity: AuthContext,
    paymentId: string,
    input: SubmitManualRentPaymentProofInput,
  ): Promise<SupportRequestOutput> {
    const timestamp = this.now().toISOString();
    const submittedPaymentReference = normalizeNullableString(input.submittedPaymentReference);
    const submittedTransactionReference =
      normalizeNullableString(input.submittedTransactionReference) ??
      normalizeNullableString(input.providerReference);
    const proofNote =
      normalizeNullableString(input.submittedNote) ??
      normalizeNullableString(input.note);
    const proofImageUrl = normalizeNullableString(input.proofImageUrl);
    const proofImageStoragePath =
      normalizeNullableString(input.submittedProofImageStoragePath) ??
      normalizeNullableString(input.proofImageStoragePath);
    const proofImageFileName =
      normalizeNullableString(input.submittedProofImageFileName) ??
      normalizeNullableString(input.proofImageFileName);
    const proofImageOriginalFileName =
      normalizeNullableString(input.submittedProofImageOriginalFileName) ??
      normalizeNullableString(input.proofImageOriginalFileName);
    const proofImageSizeBytes = input.submittedProofImageSize ?? input.proofImageSizeBytes ?? null;
    const proofImageContentType =
      normalizeNullableString(input.submittedProofImageContentType) ??
      normalizeNullableString(input.proofImageContentType);
    const submittedPaymentDate = normalizeNullableString(input.submittedPaymentDate);
    const submittedPaymentTime = normalizeNullableString(input.submittedPaymentTime);
    const submittedPaymentMethod = normalizeSubmittedPaymentMethod(
      input.submittedPaymentMethod ?? input.paymentMethod,
    );
    const paymentMethod =
      submittedPaymentMethod === 'bankily'
        ? 'Bankily'
        : submittedPaymentMethod;
    const hasProofImageMetadata = hasManualProofImageMetadata(input);

    if (!submittedPaymentReference) {
      throw new AppError(
        400,
        'manual_payment_reference_required',
        'La référence ATouPay du paiement est requise pour transmettre une preuve.',
      );
    }

    if (typeof input.submittedAmount !== 'number' || !Number.isFinite(input.submittedAmount)) {
      throw new AppError(
        400,
        'manual_payment_amount_required',
        'Le montant payé déclaré est requis pour transmettre une preuve.',
      );
    }

    if (input.submittedCurrency !== 'MRU') {
      throw new AppError(
        400,
        'manual_payment_currency_required',
        'La devise MRU est requise pour transmettre une preuve de paiement direct.',
      );
    }

    if (!submittedPaymentDate) {
      throw new AppError(
        400,
        'manual_payment_date_required',
        'La date du paiement déclaré est requise pour transmettre une preuve.',
      );
    }

    const submittedAmount = input.submittedAmount;
    const submittedCurrency = input.submittedCurrency;

    if (!submittedTransactionReference && !proofNote && !hasProofImageMetadata) {
      throw new AppError(
        400,
        'manual_payment_proof_empty',
        'Ajoutez une référence transactionnelle, une note ou une preuve image avant de soumettre.',
      );
    }

    return this.repository.runTransaction(async (transaction) => {
      const tenantUser = assertActiveTenant(await transaction.getUser(identity.uid));
      const payment = await transaction.getPayment(paymentId);

      if (!payment) {
        throw new AppError(404, 'payment_not_found', 'Le paiement demandé est introuvable.');
      }

      if (tenantUser.tenantId !== payment.tenantId) {
        throw new AppError(
          403,
          'forbidden_payment_scope',
          'Ce paiement ne peut pas être déclaré depuis ce compte locataire.',
        );
      }

      if (payment.paymentStatus === 'paid' || payment.receiptId) {
        throw new AppError(
          409,
          'payment_already_paid',
          'Ce paiement dispose déjà d’un reçu et ne peut plus recevoir de preuve manuelle.',
        );
      }

      if (payment.paymentStatus !== 'pending' && payment.paymentStatus !== 'late') {
        throw new AppError(
          409,
          'payment_not_payable',
          'Ce paiement ne peut pas recevoir de preuve manuelle dans son état actuel.',
        );
      }

      const owner = await transaction.getOwner(payment.ownerId);
      const mode = owner?.bankilyIntegrationMode ?? 'qr_or_code_manual';
      const paymentMethodStatus = owner?.bankilyPaymentMethodStatus ?? 'draft';

      if (mode === 'not_configured' || mode === 'moosyl_provider') {
        throw new AppError(
          409,
          'manual_payment_mode_not_available',
          'Ce propriétaire n’accepte pas de preuve Bankily manuelle pour ce paiement.',
        );
      }

      if (mode === 'deep_link_confirmed') {
        throw new AppError(
          409,
          'manual_payment_requires_backend_verification',
          'Ce mode Bankily exige une vérification backend avant confirmation.',
        );
      }

      if (mode === 'deep_link_unverified' && this.config.appVariant === 'production') {
        throw new AppError(
          403,
          'manual_payment_experimental_blocked',
          'Le mode Bankily expérimental est bloqué en production.',
        );
      }

      if (submittedPaymentMethod === 'bankily' && paymentMethodStatus !== 'verified') {
        throw new AppError(
          409,
          'owner_payment_method_not_verified',
          'Le paiement direct n’est pas encore configuré pour ce logement. Contactez l’agence.',
        );
      }

      const agencyId = payment.agencyId ?? tenantUser.agencyId ?? null;

      if (hasProofImageMetadata) {
        validateManualProofImageMetadata({
          agencyId,
          contentType: proofImageContentType,
          fileName: proofImageFileName,
          paymentId,
          proofImageUrl,
          sizeBytes: proofImageSizeBytes,
          storagePath: proofImageStoragePath,
          tenantId: payment.tenantId,
        });
      }

      const expectedAtouPayReference = resolvePaymentAtouPayReference(payment);
      const expectedAmount = getPaymentExpectedAmount(payment);
      const proofCheckResult = evaluateManualPaymentProof({
        expectedAmount,
        expectedCurrency: 'MRU',
        expectedReference: expectedAtouPayReference,
        hasImageProof: Boolean(proofImageStoragePath),
        now: this.now(),
        submittedAmount,
        submittedCurrency,
        submittedPaymentDate,
        submittedPaymentReference,
        submittedTransactionReference,
      });
      const requestId = randomUUID();
      const agencyEscalationAvailableAt = addHours(
        this.now(),
        OWNER_PROOF_REVIEW_ESCALATION_HOURS,
      ).toISOString();
      const description = [
        'Preuve Bankily/direct déclarée par le locataire.',
        `Paiement ATouPay: ${paymentId}`,
        `Référence ATouPay attendue: ${expectedAtouPayReference}`,
        `Référence ATouPay saisie: ${submittedPaymentReference}`,
        submittedTransactionReference ? `Référence transactionnelle déclarée: ${submittedTransactionReference}` : null,
        `Montant déclaré: ${submittedAmount} MRU`,
        `Date déclarée: ${submittedPaymentDate}${submittedPaymentTime ? ` ${submittedPaymentTime}` : ''}`,
        `Niveau de risque: ${proofCheckResult.riskLevel}`,
        proofCheckResult.warnings.length > 0
          ? `Alertes: ${proofCheckResult.warnings.join(' | ')}`
          : null,
        proofNote ? `Note locataire: ${proofNote}` : null,
        proofImageFileName ? `Fichier preuve: ${proofImageFileName}` : null,
        proofImageOriginalFileName ? `Fichier original: ${proofImageOriginalFileName}` : null,
        proofImageSizeBytes ? `Taille preuve: ${proofImageSizeBytes}` : null,
        proofImageStoragePath ? `Chemin stockage: ${proofImageStoragePath}` : null,
        'Cette preuve est un support de revue, pas une confirmation prestataire.',
      ]
        .filter(Boolean)
        .join('\n');

      const supportRequest: SupportRequestDoc = {
        agencyId,
        agencyEscalationAvailable: false,
        agencyEscalationAvailableAt,
        category: 'payment_problem',
        contactEmail: tenantUser.email,
        createdAt: timestamp,
        description,
        expectedAmount,
        expectedAtouPayReference,
        expectedCurrency: 'MRU',
        manualPaymentMethod: paymentMethod,
        manualProofReviewNote: null,
        manualProofReviewedAt: null,
        manualProofReviewedByUserId: null,
        manualProofStatus: 'submitted',
        ownerLastReminderAt: null,
        ownerReminderCount: 0,
        ownerReviewRequestedAt: timestamp,
        ownerReviewStatus: 'waiting_owner_review',
        paymentId,
        phoneNumber: tenantUser.phoneNumber,
        proofCheckResult,
        proofImageContentType,
        proofImageFileName,
        proofImageOriginalFileName,
        proofImageSizeBytes,
        proofImageStoragePath,
        proofNote,
        proofSubmittedAt: timestamp,
        proofTransactionReference: submittedTransactionReference,
        recoveryContactPreference: tenantUser.recoveryContactPreference,
        requestorDisplayName: tenantUser.displayName,
        requestorRole: 'tenant',
        resolutionNote: null,
        resolvedAt: null,
        status: 'submitted',
        submittedAmount,
        submittedCurrency,
        submittedNote: proofNote,
        submittedPaymentDate,
        submittedPaymentMethod,
        submittedPaymentReference,
        submittedPaymentTime,
        submittedTransactionReference,
        subject: 'Preuve de paiement Bankily à confirmer',
        updatedAt: timestamp,
        userId: tenantUser.uid,
      };

      transaction.setSupportRequest(requestId, supportRequest);
      transaction.updateUser(tenantUser.uid, {
        updatedAt: timestamp,
      });
      this.recordAudit(transaction, {
        actor: tenantUser,
        agencyId,
        entityId: requestId,
        entityType: 'supportRequest',
        eventType: 'support_request_created',
        metadata: {
          category: 'payment_problem',
          hasProofImage: Boolean(proofImageUrl || proofImageStoragePath),
          paymentId,
          proofOnly: true,
          riskLevel: proofCheckResult.riskLevel,
        },
        targetUid: tenantUser.uid,
        timestamp,
      });

      this.createNotification(transaction, {
        agencyId,
        body: `${tenantUser.displayName} a soumis une preuve Bankily à vérifier.`,
        relatedEntityId: requestId,
        relatedEntityType: 'supportRequest',
        role: 'owner',
        timestamp,
        title: 'Preuve paiement à vérifier',
        type: 'support_request_status_changed',
        userId: payment.ownerId,
      });

      if (agencyId) {
        this.createNotification(transaction, {
          agencyId,
          body: `${tenantUser.displayName} a soumis une preuve Bankily à vérifier.`,
          relatedEntityId: requestId,
          relatedEntityType: 'supportRequest',
          role: 'agency_admin',
          timestamp,
          title: 'Preuve paiement à vérifier',
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

    if (user.role === 'owner' && user.ownerId && user.agencyId) {
      const requestsByAgency = await this.repository.listSupportRequestsByAgency(user.agencyId);
      const visibleRequests: Array<{ doc: SupportRequestDoc; id: string }> = [];

      for (const request of requestsByAgency) {
        if (request.doc.userId === user.uid) {
          visibleRequests.push(request);
          continue;
        }

        if (!request.doc.paymentId) {
          continue;
        }

        const payment = await this.repository.getPayment(request.doc.paymentId);

        if (payment?.ownerId === user.ownerId) {
          visibleRequests.push(request);
        }
      }

      return visibleRequests
        .map(({ doc, id }) => supportRequestOutputFromDoc(id, doc))
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
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

  async reviewManualRentPaymentProof(
    identity: AuthContext,
    requestId: string,
    input: ReviewManualRentPaymentProofInput,
  ): Promise<SupportRequestOutput> {
    const timestamp = this.now().toISOString();
    const reviewNote = normalizeNullableString(input.note);
    const overrideReason = normalizeNullableString(input.overrideReason);
    const settlementNote = normalizeNullableString(input.settlementNote);

    const preflight = await this.repository.runTransaction(async (transaction) => {
      const actor = await transaction.getUser(identity.uid);

      if (!actor) {
        throw new AppError(
          409,
          'profile_not_bootstrapped',
          'Le profil applicatif ATouPay doit être initialisé avant cette opération.',
        );
      }

      const supportRequest = await transaction.getSupportRequest(requestId);

      if (!supportRequest) {
        throw new AppError(404, 'support_request_not_found', 'La demande de support est introuvable.');
      }

      if (!supportRequest.paymentId || !supportRequest.manualProofStatus) {
        throw new AppError(
          409,
          'manual_payment_proof_missing',
          'Cette demande ne contient pas de preuve de paiement manuel à revoir.',
        );
      }

      const payment = await transaction.getPayment(supportRequest.paymentId);

      if (!payment) {
        throw new AppError(404, 'payment_not_found', 'Le paiement lié à la preuve est introuvable.');
      }

      if (
        input.decision !== 'confirmed' &&
        (payment.paymentStatus === 'paid' || payment.receiptId)
      ) {
        throw new AppError(
          409,
          'payment_already_paid',
          'Ce paiement est déjà confirmé et ne peut pas être rejeté ou contesté.',
        );
      }

      if (actor.role === 'owner') {
        const owner = assertActiveOwner(actor);
        if (owner.ownerId !== payment.ownerId) {
          throw new AppError(
            403,
            'forbidden_payment_scope',
            'Cette preuve ne vous est pas accessible.',
          );
        }
        if (input.decision === 'confirmed' && supportRequest.proofCheckResult?.riskLevel === 'high') {
          throw new AppError(
            403,
            'manual_payment_high_risk_requires_agency',
            'Cette preuve présente un risque élevé et doit être revue par l’agence.',
          );
        }
      } else if (actor.role === 'agency_admin') {
        const admin = assertAgencyAdmin(actor);
        if (admin.agencyId !== payment.agencyId) {
          throw new AppError(
            403,
            'forbidden_agency_scope',
            'Cette preuve n’appartient pas à votre agence.',
          );
        }
        if (input.decision === 'confirmed') {
          const ownerUser = await transaction.getUser(payment.ownerId);
          const highRisk = supportRequest.proofCheckResult?.riskLevel === 'high';
          const escalationAvailable =
            supportRequest.agencyEscalationAvailable === true ||
            (supportRequest.agencyEscalationAvailableAt
              ? new Date(supportRequest.agencyEscalationAvailableAt).getTime() <=
                this.now().getTime()
              : false);
          const ownerInactive = ownerUser?.status !== 'active';
          const proofDisputed =
            supportRequest.manualProofStatus === 'disputed' ||
            supportRequest.ownerReviewStatus === 'disputed';

          if (highRisk && !overrideReason) {
            throw new AppError(
              400,
              'manual_payment_high_risk_override_required',
              'Une raison de dérogation agence est requise pour confirmer une preuve à risque élevé.',
            );
          }

          if (!escalationAvailable && !ownerInactive && !proofDisputed && !highRisk) {
            throw new AppError(
              403,
              'manual_payment_agency_review_not_available',
              'La validation agence sera disponible après escalade, blocage propriétaire ou litige.',
            );
          }
        }
      } else {
        throw new AppError(
          403,
          'forbidden_role',
          'Seul le propriétaire ou l’agence peut revoir une preuve de paiement manuel.',
        );
      }

      return {
        actor,
        paymentId: supportRequest.paymentId,
        paymentMethod: supportRequest.manualPaymentMethod ?? 'Bankily',
        providerReference: supportRequest.proofTransactionReference ?? null,
      };
    });

    if (input.decision === 'confirmed') {
      await this.confirmManualRentPayment(identity, {
        confirmationSource: preflight.actor.role === 'agency_admin' ? 'agency' : 'owner',
        note: reviewNote,
        paymentId: preflight.paymentId,
        paymentMethod: preflight.paymentMethod,
        providerReference: preflight.providerReference,
        settlementNote,
      });
    }

    return this.repository.runTransaction(async (transaction) => {
      const actor = await transaction.getUser(identity.uid);
      const supportRequest = await transaction.getSupportRequest(requestId);

      if (!actor) {
        throw new AppError(
          409,
          'profile_not_bootstrapped',
          'Le profil applicatif ATouPay doit être initialisé avant cette opération.',
        );
      }

      if (!supportRequest) {
        throw new AppError(404, 'support_request_not_found', 'La demande de support est introuvable.');
      }

      const nextStatus = input.decision === 'rejected' ? 'resolved' : 'in_progress';
      const resolutionNote =
        reviewNote ??
        (input.decision === 'confirmed'
          ? preflight.actor.role === 'agency_admin'
            ? 'Paiement déclaré par le locataire et confirmé par l’agence après vérification.'
            : 'Paiement déclaré par le locataire et confirmé par le propriétaire.'
          : input.decision === 'rejected'
            ? 'Preuve de paiement rejetée après revue.'
            : 'Preuve de paiement contestée et maintenue en revue.');
      const resolvedAt =
        input.decision === 'confirmed' || input.decision === 'rejected' ? timestamp : null;
      const status =
        input.decision === 'confirmed'
          ? 'resolved'
          : nextStatus;
      const ownerReviewStatus =
        input.decision === 'confirmed'
          ? 'confirmed'
          : input.decision === 'rejected'
            ? 'rejected'
            : 'disputed';

      transaction.updateSupportRequest(requestId, {
        agencyEscalationAvailable:
          supportRequest.agencyEscalationAvailable ||
          preflight.actor.role === 'agency_admin' ||
          ownerReviewStatus === 'disputed',
        manualProofReviewNote: resolutionNote,
        manualProofReviewedAt: timestamp,
        manualProofReviewedByUserId: actor.uid,
        manualProofStatus: input.decision,
        ownerReviewStatus,
        resolutionNote,
        resolvedAt,
        status,
        updatedAt: timestamp,
      });
      this.recordAudit(transaction, {
        actor,
        agencyId: supportRequest.agencyId,
        entityId: requestId,
        entityType: 'supportRequest',
        eventType: 'support_request_updated',
        metadata: {
          decision: input.decision,
          overrideProvided: Boolean(overrideReason),
          paymentId: supportRequest.paymentId,
          proofOnly: true,
        },
        targetUid: supportRequest.userId,
        timestamp,
      });

      if (supportRequest.userId) {
        this.createNotification(transaction, {
          agencyId: supportRequest.agencyId,
          body:
            input.decision === 'rejected'
              ? 'Votre preuve de paiement a été rejetée après revue. Aucun reçu n’a été généré.'
              : input.decision === 'confirmed'
                ? 'Votre paiement manuel a été confirmé. Le reçu est disponible.'
                : 'Votre preuve de paiement est contestée et reste en revue. Aucun reçu n’a été généré.',
          relatedEntityId: requestId,
          relatedEntityType: 'supportRequest',
          role: 'tenant',
          timestamp,
          title:
            input.decision === 'rejected'
              ? 'Preuve paiement rejetée'
              : input.decision === 'confirmed'
                ? 'Paiement confirmé'
                : 'Preuve paiement contestée',
          type: 'support_request_status_changed',
          userId: supportRequest.userId,
        });
      }

      return supportRequestOutputFromDoc(requestId, {
        ...supportRequest,
        manualProofReviewNote: resolutionNote,
        manualProofReviewedAt: timestamp,
        manualProofReviewedByUserId: actor.uid,
        manualProofStatus: input.decision,
        ownerReviewStatus,
        resolutionNote,
        resolvedAt,
        status,
        updatedAt: timestamp,
      });
    });
  }

  async runManualProofReminderTask(): Promise<{
    escalationsMarked: number;
    remindersCreated: number;
    scanned: number;
  }> {
    const now = this.now();
    const timestamp = now.toISOString();
    const requests = await this.repository.listSupportRequests();
    let remindersCreated = 0;
    let escalationsMarked = 0;

    for (const { doc, id } of requests) {
      if (
        !doc.paymentId ||
        doc.manualProofStatus !== 'submitted' ||
        doc.status === 'resolved' ||
        (doc.ownerReviewStatus !== 'waiting_owner_review' &&
          doc.ownerReviewStatus !== 'agency_escalated')
      ) {
        continue;
      }

      await this.repository.runTransaction(async (transaction) => {
        const currentRequest = await transaction.getSupportRequest(id);

        if (
          !currentRequest ||
          !currentRequest.paymentId ||
          currentRequest.manualProofStatus !== 'submitted' ||
          currentRequest.status === 'resolved'
        ) {
          return;
        }

        const payment = await transaction.getPayment(currentRequest.paymentId);

        if (!payment) {
          return;
        }

        const ownerReviewRequestedAt =
          currentRequest.ownerReviewRequestedAt ?? currentRequest.proofSubmittedAt ?? currentRequest.createdAt;
        const lastReminderAt = currentRequest.ownerLastReminderAt ?? ownerReviewRequestedAt;
        const reminderDue =
          now.getTime() - new Date(lastReminderAt).getTime() >=
          OWNER_PROOF_REVIEW_REMINDER_HOURS * 60 * 60 * 1000;
        const currentReminderCount = currentRequest.ownerReminderCount ?? 0;
        const escalationDue =
          currentRequest.agencyEscalationAvailable !== true &&
          currentRequest.agencyEscalationAvailableAt != null &&
          new Date(currentRequest.agencyEscalationAvailableAt).getTime() <= now.getTime();
        const patch: Partial<SupportRequestDoc> = {
          updatedAt: timestamp,
        };

        if (reminderDue && currentReminderCount < OWNER_PROOF_REVIEW_MAX_REMINDERS) {
          patch.ownerLastReminderAt = timestamp;
          patch.ownerReminderCount = currentReminderCount + 1;
          remindersCreated += 1;
          this.createNotification(transaction, {
            agencyId: currentRequest.agencyId,
            body: 'Une preuve de paiement locataire attend votre validation. Aucun reçu n’a été généré.',
            relatedEntityId: id,
            relatedEntityType: 'supportRequest',
            role: 'owner',
            timestamp,
            title: 'Validation de preuve en attente',
            type: 'payment_proof_reminder',
            userId: payment.ownerId,
          });
        }

        if (escalationDue) {
          patch.agencyEscalationAvailable = true;
          patch.ownerReviewStatus = 'agency_escalated';
          escalationsMarked += 1;
          if (currentRequest.agencyId) {
            this.createNotification(transaction, {
              agencyId: currentRequest.agencyId,
              body: 'Une preuve de paiement peut maintenant être validée par l’agence si nécessaire.',
              relatedEntityId: id,
              relatedEntityType: 'supportRequest',
              role: 'agency_admin',
              timestamp,
              title: 'Validation agence disponible',
              type: 'support_request_status_changed',
            });
          }
        }

        if (
          patch.ownerLastReminderAt ||
          patch.agencyEscalationAvailable
        ) {
          transaction.updateSupportRequest(id, patch);
          this.recordAudit(transaction, {
            actor: null,
            agencyId: currentRequest.agencyId,
            entityId: id,
            entityType: 'supportRequest',
            eventType: 'support_request_updated',
            metadata: {
              escalationDue,
              paymentId: currentRequest.paymentId,
              reminderDue,
            },
            targetUid: payment.ownerId,
            timestamp,
          });
        }
      });
    }

    return {
      escalationsMarked,
      remindersCreated,
      scanned: requests.length,
    };
  }

  async reviewOwnerBankilyPaymentMethod(
    identity: AuthContext,
    ownerId: string,
    input: ReviewOwnerPaymentMethodInput,
  ): Promise<OwnerDoc & { ownerId: string }> {
    const timestamp = this.now().toISOString();
    const note = normalizeNullableString(input.note);

    return this.repository.runTransaction(async (transaction) => {
      const admin = assertAgencyAdmin(await transaction.getUser(identity.uid));
      const owner = await transaction.getOwner(ownerId);

      if (!owner) {
        throw new AppError(404, 'owner_not_found', 'Le propriétaire demandé est introuvable.');
      }

      if (owner.agencyId !== admin.agencyId) {
        throw new AppError(
          403,
          'forbidden_agency_scope',
          'Ce propriétaire n’appartient pas à votre agence.',
        );
      }

      const patch: Partial<OwnerDoc> = {
        bankilyPaymentMethodReviewedAt: timestamp,
        bankilyPaymentMethodReviewedByUserId: admin.uid,
        bankilyPaymentMethodReviewNote: note,
        bankilyPaymentMethodStatus: input.status,
        updatedAt: timestamp,
      };

      transaction.updateOwner(ownerId, patch);
      this.recordAudit(transaction, {
        actor: admin,
        agencyId: admin.agencyId,
        entityId: ownerId,
        entityType: 'owner',
        eventType: 'payment_method_updated',
        metadata: {
          status: input.status,
        },
        targetUid: owner.userId,
        timestamp,
      });

      return {
        ...owner,
        ...patch,
        ownerId,
      };
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
    const ownerAccessUser = assertActiveOwner(await this.repository.getUser(identity.uid));
    await this.billingService.assertOwnerCanPerformWriteOperation(
      ownerAccessUser.ownerId ?? identity.uid,
      'create_property',
    );

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

  async updateOwnerProperty(
    identity: AuthContext,
    propertyId: string,
    input: UpdatePropertyInput,
  ): Promise<UpdatePropertyOutput> {
    const label = input.label.trim();
    const address = input.address.trim();

    if (label.length === 0 || address.length === 0) {
      throw new AppError(400, 'invalid_request', 'Le nom et l’adresse du bien sont requis.');
    }

    const timestamp = this.now().toISOString();
    const currentTerms = await this.getOrCreateLegalTerms();
    const ownerAccessUser = assertActiveOwner(await this.repository.getUser(identity.uid));
    await this.billingService.assertOwnerCanPerformWriteOperation(
      ownerAccessUser.ownerId ?? identity.uid,
      'update_property',
    );

    return this.repository.runTransaction(async (transaction) => {
      const user = assertActiveOwner(await transaction.getUser(identity.uid));
      await this.ensureAcceptedTerms(transaction, user, currentTerms);
      const ownerId = user.ownerId ?? identity.uid;
      const property = await transaction.getProperty(propertyId);

      if (!property) {
        throw new AppError(404, 'property_not_found', 'Le bien est introuvable.');
      }

      if (property.ownerId !== ownerId) {
        throw new AppError(
          403,
          'forbidden_owner_scope',
          'Vous ne pouvez modifier que vos propres biens.',
        );
      }

      transaction.updateProperty(propertyId, {
        address,
        label,
        updatedAt: timestamp,
      });

      return {
        id: propertyId,
        ownerId,
      };
    });
  }

  async deleteOwnerProperty(
    identity: AuthContext,
    propertyId: string,
  ): Promise<DeleteInventoryOutput> {
    const currentTerms = await this.getOrCreateLegalTerms();
    const ownerAccessUser = assertActiveOwner(await this.repository.getUser(identity.uid));
    await this.billingService.assertOwnerCanPerformWriteOperation(
      ownerAccessUser.ownerId ?? identity.uid,
      'delete_property',
    );

    return this.repository.runTransaction(async (transaction) => {
      const user = assertActiveOwner(await transaction.getUser(identity.uid));
      await this.ensureAcceptedTerms(transaction, user, currentTerms);
      const ownerId = user.ownerId ?? identity.uid;
      const property = await transaction.getProperty(propertyId);
      const units = await transaction.listUnitsByProperty(propertyId);

      if (!property) {
        throw new AppError(404, 'property_not_found', 'Le bien est introuvable.');
      }

      if (property.ownerId !== ownerId) {
        throw new AppError(
          403,
          'forbidden_owner_scope',
          'Vous ne pouvez supprimer que vos propres biens.',
        );
      }

      if (units.length > 0) {
        throw new AppError(
          409,
          'property_has_units',
          'Supprimez d’abord les unités de ce bien avant de supprimer le bien.',
        );
      }

      transaction.deleteProperty(propertyId);

      return {
        id: propertyId,
      };
    });
  }

  async createOwnerUnit(identity: AuthContext, input: CreateUnitInput): Promise<CreateUnitOutput> {
    const label = input.label.trim();
    const currency = input.currency.trim().toUpperCase();
    const notes = input.notes?.trim() ? input.notes.trim() : null;
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
    const ownerAccessUser = assertActiveOwner(await this.repository.getUser(identity.uid));
    await this.billingService.assertOwnerCanPerformWriteOperation(
      ownerAccessUser.ownerId ?? identity.uid,
      'create_unit',
    );

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
        notes,
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

  async updateOwnerUnit(
    identity: AuthContext,
    unitId: string,
    input: UpdateUnitInput,
  ): Promise<UpdateUnitOutput> {
    const label = input.label.trim();
    const notes = input.notes?.trim() ? input.notes.trim() : null;
    const rentAmount = Number(input.rentAmount);

    if (label.length === 0) {
      throw new AppError(400, 'invalid_request', 'Le libellé de l’unité est requis.');
    }

    if (!Number.isFinite(rentAmount) || rentAmount <= 0) {
      throw new AppError(400, 'invalid_request', 'Le loyer mensuel doit être strictement positif.');
    }

    const timestamp = this.now().toISOString();
    const currentTerms = await this.getOrCreateLegalTerms();
    const ownerAccessUser = assertActiveOwner(await this.repository.getUser(identity.uid));
    await this.billingService.assertOwnerCanPerformWriteOperation(
      ownerAccessUser.ownerId ?? identity.uid,
      'update_unit',
    );

    return this.repository.runTransaction(async (transaction) => {
      const user = assertActiveOwner(await transaction.getUser(identity.uid));
      await this.ensureAcceptedTerms(transaction, user, currentTerms);
      const ownerId = user.ownerId ?? identity.uid;
      const unit = await transaction.getUnit(unitId);

      if (!unit) {
        throw new AppError(404, 'unit_not_found', 'L’unité est introuvable.');
      }

      if (unit.ownerId !== ownerId) {
        throw new AppError(
          403,
          'forbidden_owner_scope',
          'Vous ne pouvez modifier que vos propres unités.',
        );
      }

      if (unit.status === 'occupied' && unit.rentAmount !== rentAmount) {
        throw new AppError(
          409,
          'occupied_unit_rent_locked',
          'Le loyer d’une unité occupée ne peut pas être modifié depuis cette version. Les libellés et notes restent modifiables.',
        );
      }

      transaction.updateUnit(unitId, {
        label,
        notes,
        rentAmount,
        updatedAt: timestamp,
      });

      return {
        id: unitId,
        ownerId,
        propertyId: unit.propertyId,
      };
    });
  }

  async deleteOwnerUnit(identity: AuthContext, unitId: string): Promise<DeleteInventoryOutput> {
    const currentTerms = await this.getOrCreateLegalTerms();
    const ownerAccessUser = assertActiveOwner(await this.repository.getUser(identity.uid));
    await this.billingService.assertOwnerCanPerformWriteOperation(
      ownerAccessUser.ownerId ?? identity.uid,
      'delete_unit',
    );

    return this.repository.runTransaction(async (transaction) => {
      const user = assertActiveOwner(await transaction.getUser(identity.uid));
      await this.ensureAcceptedTerms(transaction, user, currentTerms);
      const ownerId = user.ownerId ?? identity.uid;
      const unit = await transaction.getUnit(unitId);
      const payments = await transaction.listPaymentsByUnit(unitId);

      if (!unit) {
        throw new AppError(404, 'unit_not_found', 'L’unité est introuvable.');
      }

      if (unit.ownerId !== ownerId) {
        throw new AppError(
          403,
          'forbidden_owner_scope',
          'Vous ne pouvez supprimer que vos propres unités.',
        );
      }

      if (unit.status !== 'vacant' || unit.tenantId || unit.activeInviteId) {
        throw new AppError(
          409,
          'unit_not_deletable',
          'Seule une unité vacante, sans invitation active ni locataire, peut être supprimée.',
        );
      }

      if (payments.length > 0) {
        throw new AppError(
          409,
          'unit_has_payments',
          'Cette unité possède déjà un historique de paiement et ne peut pas être supprimée.',
        );
      }

      transaction.deleteUnit(unitId);

      return {
        id: unitId,
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
    let ownerName = 'Propriétaire ATouPay';
    let propertyLabel = 'Logement ATouPay';
    let unitLabel = 'Unité';
    const ownerAccessUser = assertActiveOwner(await this.repository.getUser(identity.uid));
    await this.billingService.assertOwnerCanPerformWriteOperation(
      ownerAccessUser.ownerId ?? identity.uid,
      'create_tenant_invite',
    );

    const result: CreateInviteOutput = await this.repository.runTransaction(async (transaction) => {
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

      ownerName = user.displayName;
      propertyLabel = property.label;
      unitLabel = unit.label;

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

    await this.sendInviteEmailSafely(() =>
      this.emailService.sendTenantInvite({
        email: normalizedEmail,
        expiresAt: result.expiresAt,
        inviteCode: result.inviteCode,
        inviteLink: result.inviteLink,
        ownerName,
        propertyLabel,
        unitLabel,
      }),
    );

    return result;
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
    let agencyName = 'Agence ATouPay';

    const result: OwnerAccessInviteOutput = await this.repository.runTransaction(async (transaction) => {
      const admin = assertAgencyAdmin(await transaction.getUser(identity.uid));
      await this.ensureAcceptedTerms(transaction, admin, currentTerms);
      const agencyId = admin.agencyId!;
      const agency = await transaction.getAgency(agencyId);
      agencyName = agency?.displayName ?? agencyName;

      if (!agency) {
        transaction.setAgency(agencyId, {
          commissionRate: 0,
          commissionType: 'percentage',
          createdAt: nowIso,
          displayName: 'Agence ATouPay',
          ownerAccountFeeAmount: OWNER_ACCOUNT_FEE_AMOUNT,
          ownerAccountFeeCurrency: OWNER_ACCOUNT_FEE_CURRENCY,
          ownerAccountFeeIntervalDays: OWNER_ACCOUNT_FEE_INTERVAL_DAYS,
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

    await this.sendInviteEmailSafely(() =>
      this.emailService.sendOwnerAccessInvite({
        agencyName,
        email: normalizedEmail,
        expiresAt: result.expiresAt,
        inviteCode: result.ownerInviteCode!,
        inviteLink: result.inviteLink!,
      }),
    );

    return result;
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

  async deleteOwnerAccessInvite(
    identity: AuthContext,
    input: DeleteOwnerAccessInviteInput,
  ): Promise<DeleteInventoryOutput> {
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
          'Une invitation déjà utilisée doit rester conservée pour l’historique.',
        );
      }

      if (normalizedStatus === 'pending') {
        throw new AppError(
          409,
          'owner_access_revoke_required',
          'Révoquez cette invitation avant de la retirer de la liste.',
        );
      }

      transaction.deleteOwnerAccessInvite(input.inviteId);
      this.recordAudit(transaction, {
        actor: admin,
        agencyId: admin.agencyId,
        entityId: input.inviteId,
        entityType: 'ownerAccessInvite',
        eventType: 'owner_invite_deleted',
        metadata: {
          email: invite.email,
          previousStatus: normalizedStatus,
        },
        timestamp,
      });

      return {
        id: input.inviteId,
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

    const visibleOwners = owners
      .filter((owner) => owner.status === 'active' || owner.status === 'suspended')
      .sort((left, right) => left.displayName.localeCompare(right.displayName, 'fr'));

    const ownerDocs = await Promise.all(
      visibleOwners.map((owner) =>
        owner.ownerId ? this.repository.getOwner(owner.ownerId) : Promise.resolve(null),
      ),
    );

    return visibleOwners
      .map((owner, index) => ({
        agencyId: owner.agencyId,
        bankilyPaymentMethodStatus: ownerDocs[index]?.bankilyPaymentMethodStatus ?? 'draft',
        createdAt: owner.createdAt,
        displayName: owner.displayName,
        email: owner.email,
        ownerId: owner.ownerId,
        status: owner.status,
        uid: owner.uid,
        updatedAt: owner.updatedAt,
      }));
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
      commissionRate: 0,
      commissionSummary: {
        agencyFeeAmount: paymentSummary.money.agencyFeeAmount,
        grossAmount: paymentSummary.money.grossAmount,
        ownerReceivableAmount: paymentSummary.money.ownerReceivableAmount,
        ownerNetAmount: paymentSummary.money.ownerNetAmount,
        platformRentFeeAmount: paymentSummary.money.platformRentFeeAmount,
        tenantFeeAmount: paymentSummary.money.tenantFeeAmount,
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
      commissionRate: 0,
      commissionType: 'percentage',
      displayName: agency?.displayName ?? 'Agence ATouPay',
      legacyCommissionRate: agency?.commissionRate ?? 0,
      ownerAccountFeeAmount: agency?.ownerAccountFeeAmount ?? OWNER_ACCOUNT_FEE_AMOUNT,
      ownerAccountFeeCurrency: agency?.ownerAccountFeeCurrency ?? OWNER_ACCOUNT_FEE_CURRENCY,
      ownerAccountFeeIntervalDays: agency?.ownerAccountFeeIntervalDays ?? OWNER_ACCOUNT_FEE_INTERVAL_DAYS,
    };
  }

  async updateAgencySettings(
    identity: AuthContext,
    input: UpdateAgencySettingsInput,
  ): Promise<AgencySettingsOutput> {
    const displayName = input.displayName?.trim();
    const timestamp = this.now().toISOString();
    const currentTerms = await this.getOrCreateLegalTerms();

    if (input.displayName !== undefined && !displayName) {
      throw new AppError(
        400,
        'invalid_agency_name',
        'Le nom de l’agence doit contenir au moins un caractère.',
      );
    }

    return this.repository.runTransaction(async (transaction) => {
      const admin = assertAgencyAdmin(await transaction.getUser(identity.uid));
      await this.ensureAcceptedTerms(transaction, admin, currentTerms);
      const agencyId = admin.agencyId!;
      const existingAgency = await transaction.getAgency(agencyId);
      const nextDisplayName = displayName ?? existingAgency?.displayName ?? 'Agence ATouPay';

      if (!existingAgency) {
        transaction.setAgency(agencyId, {
          commissionRate: 0,
          commissionType: 'percentage',
          createdAt: timestamp,
          displayName: nextDisplayName,
          ownerAccountFeeAmount: OWNER_ACCOUNT_FEE_AMOUNT,
          ownerAccountFeeCurrency: OWNER_ACCOUNT_FEE_CURRENCY,
          ownerAccountFeeIntervalDays: OWNER_ACCOUNT_FEE_INTERVAL_DAYS,
          updatedAt: timestamp,
        });
      } else {
        transaction.updateAgency(agencyId, {
          commissionRate: 0,
          commissionType: 'percentage',
          displayName: nextDisplayName,
          ownerAccountFeeAmount:
            existingAgency.ownerAccountFeeAmount ?? OWNER_ACCOUNT_FEE_AMOUNT,
          ownerAccountFeeCurrency:
            existingAgency.ownerAccountFeeCurrency ?? OWNER_ACCOUNT_FEE_CURRENCY,
          ownerAccountFeeIntervalDays:
            existingAgency.ownerAccountFeeIntervalDays ?? OWNER_ACCOUNT_FEE_INTERVAL_DAYS,
          updatedAt: timestamp,
        });
      }

      return {
        agencyId,
        commissionRate: 0,
        commissionType: 'percentage',
        displayName: nextDisplayName,
        legacyCommissionRate: existingAgency?.commissionRate ?? 0,
        ownerAccountFeeAmount: existingAgency?.ownerAccountFeeAmount ?? OWNER_ACCOUNT_FEE_AMOUNT,
        ownerAccountFeeCurrency:
          existingAgency?.ownerAccountFeeCurrency ?? OWNER_ACCOUNT_FEE_CURRENCY,
        ownerAccountFeeIntervalDays:
          existingAgency?.ownerAccountFeeIntervalDays ?? OWNER_ACCOUNT_FEE_INTERVAL_DAYS,
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

    const result = await this.repository.runTransaction(async (transaction) => {
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
        bankilyDeepLinkTemplate: existingOwner?.bankilyDeepLinkTemplate ?? null,
        bankilyIntegrationMode: existingOwner?.bankilyIntegrationMode ?? 'qr_or_code_manual',
        bankilyMerchantCode: existingOwner?.bankilyMerchantCode ?? null,
        bankilyPhoneNumber: existingOwner?.bankilyPhoneNumber ?? null,
        bankilyQrImageUrl: existingOwner?.bankilyQrImageUrl ?? null,
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

    if (result.agencyId) {
      await this.billingService.getOrCreateOwnerBillingAccount(result.ownerId, result.agencyId);
    }

    return result;
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
      const rentLedger = calculateRentLedger(unit.rentAmount);
      const monthKey = currentMonthKey(timestamp);
      const atouPayReference = buildAtouPayReference({
        monthKey,
        unitId: invite.unitId,
        unitLabel: unit.label,
      });

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
          agencyFeeAmount: rentLedger.agencyFeeAmount,
          agencyId: ownerUser.agencyId ?? null,
          atouPayReference,
          commissionRate: rentLedger.commissionRate,
          createdAt: nowIso,
          dueDate: currentMonthDueDate(timestamp),
          grossAmount: rentLedger.grossAmount,
          monthKey,
          ownerId: invite.ownerId,
          ownerNetAmount: rentLedger.ownerNetAmount,
          ownerReceivableAmount: rentLedger.ownerReceivableAmount,
          paidAt: null,
          paymentMethod: null,
          paymentStatus: 'pending',
          platformRentFeeAmount: rentLedger.platformRentFeeAmount,
          propertyId: invite.propertyId,
          providerReference: null,
          receiptId: null,
          rentAmount: rentLedger.rentAmount,
          tenantId,
          tenantFeeAmount: rentLedger.tenantFeeAmount,
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

  async createRentPaymentIntent(
    identity: AuthContext,
    paymentId: string,
  ): Promise<RentPaymentIntentOutput> {
    const currentTerms = await this.getOrCreateLegalTerms();

    await this.repository.runTransaction(async (transaction) => {
      const tenantUser = assertActiveTenant(await transaction.getUser(identity.uid));
      await this.ensureAcceptedTerms(transaction, tenantUser, currentTerms);
      return null;
    });

    return this.paymentService.createRentPaymentIntent(identity, paymentId);
  }

  async getRentPaymentStatus(
    identity: AuthContext,
    paymentId: string,
  ): Promise<RentPaymentStatusOutput> {
    return this.paymentService.getRentPaymentStatus(identity, paymentId);
  }

  async cancelRentPaymentIntent(
    identity: AuthContext,
    paymentId: string,
  ): Promise<RentPaymentStatusOutput> {
    const currentTerms = await this.getOrCreateLegalTerms();

    await this.repository.runTransaction(async (transaction) => {
      const tenantUser = assertActiveTenant(await transaction.getUser(identity.uid));
      await this.ensureAcceptedTerms(transaction, tenantUser, currentTerms);
      return null;
    });

    return this.paymentService.cancelRentPaymentIntent(identity, paymentId);
  }

  async handleMoosylWebhook(input: {
    eventType?: string;
    payload: unknown;
    rawBody: Buffer;
    signature?: string;
  }) {
    return this.paymentWebhookService.handleMoosylWebhook(input);
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

    await this.paymentService.completeSimulatedIntent(identity, input.paymentId);

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
        body: `Loyer simulé reçu: ${payment.grossAmount}. Le montant enregistré correspond au loyer payé.`,
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
          body: `Loyer simulé finalisé: ${payment.grossAmount}. Le montant enregistré correspond au loyer payé.`,
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

  async confirmManualRentPayment(
    identity: AuthContext,
    input: ConfirmManualRentPaymentInput,
  ): Promise<CompleteSimulatedPaymentOutput> {
    const paidAt = this.now();
    const paidAtIso = paidAt.toISOString();
    const paymentMethod = input.paymentMethod?.trim() || 'Bankily';
    const providerReference =
      input.providerReference && input.providerReference.trim().length > 0
        ? input.providerReference.trim()
        : null;

    return this.repository.runTransaction(async (transaction) => {
      const actor = await transaction.getUser(identity.uid);

      if (!actor) {
        throw new AppError(
          409,
          'profile_not_bootstrapped',
          'Le profil applicatif ATouPay doit être initialisé avant cette opération.',
        );
      }

      const payment = await transaction.getPayment(input.paymentId);

      if (!payment) {
        throw new AppError(404, 'payment_not_found', 'Le paiement demandé est introuvable.');
      }

      if (actor.role === 'owner') {
        const owner = assertActiveOwner(actor);
        if (owner.ownerId !== payment.ownerId) {
          throw new AppError(
            403,
            'forbidden_payment_scope',
            'Ce paiement ne vous est pas accessible.',
          );
        }
      } else if (actor.role === 'agency_admin') {
        const admin = assertAgencyAdmin(actor);
        if (admin.agencyId !== payment.agencyId) {
          throw new AppError(
            403,
            'forbidden_payment_scope',
            'Ce paiement ne vous est pas accessible.',
          );
        }
      } else {
        throw new AppError(
          403,
          'forbidden_role',
          'Seul le propriétaire ou l’agence peut confirmer une preuve de paiement manuel.',
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
          'Ce paiement manuel ne peut pas être confirmé dans son état actuel.',
        );
      }

      const receiptId = randomUUID();
      const receiptNumber = buildReceiptNumber(paidAt);
      const qrVerificationToken = createHash('sha256')
        .update(`${input.paymentId}:${receiptId}:${paidAtIso}`)
        .digest('hex');
      const verificationUrl = this.buildReceiptVerificationUrl(qrVerificationToken);
      const rentLedger = calculateRentLedger(payment.rentAmount ?? payment.grossAmount);
      const confirmationSource =
        input.confirmationSource ?? (actor.role === 'agency_admin' ? 'agency' : 'owner');
      const providerConfirmationMessage =
        confirmationSource === 'agency'
          ? 'Paiement déclaré par le locataire et confirmé par l’agence après vérification.'
          : 'Paiement déclaré par le locataire et confirmé par le propriétaire.';
      const receipt: ReceiptDoc = {
        agencyFeeAmount: 0,
        agencyDisplayName: await this.resolveAgencyName(transaction, payment.agencyId),
        agencyId: payment.agencyId,
        grossAmount: rentLedger.rentAmount,
        id: receiptId,
        issuedAt: paidAtIso,
        issuedBy: 'backend',
        issuanceSource: 'manual-confirmed',
        ownerDisplayName: owner.displayName,
        ownerEmail: ownerUser.email,
        ownerId: payment.ownerId,
        ownerNetAmount: rentLedger.rentAmount,
        paidAt: paidAtIso,
        paymentId: input.paymentId,
        paymentMethod,
        paymentStatus: 'paid',
        providerConfirmationMessage,
        ...(providerReference ? { providerReference } : {}),
        propertyId: payment.propertyId,
        propertyLabel: property.label,
        qrVerificationToken,
        receiptNumber,
        simulated: false,
        tenantDisplayName: tenant.displayName,
        tenantEmail: tenant.email,
        tenantId: payment.tenantId,
        unitId: payment.unitId,
        unitLabel: unit.label,
        verificationUrl,
      };
      const nextPayment: RentPaymentDoc = {
        ...payment,
        ...rentLedger,
        paidAt: paidAtIso,
        paymentMethod,
        paymentStatus: 'paid',
        providerReference,
        receiptId,
        updatedAt: paidAtIso,
      };

      transaction.setReceipt(receiptId, receipt);
      transaction.updatePayment(input.paymentId, {
        ...rentLedger,
        paidAt: paidAtIso,
        paymentMethod,
        paymentStatus: 'paid',
        providerReference,
        receiptId,
        updatedAt: paidAtIso,
      });
      this.recordAudit(transaction, {
        actor,
        agencyId: payment.agencyId,
        entityId: input.paymentId,
        entityType: 'rentPayment',
        eventType: 'payment_completed',
        metadata: {
          confirmationMode: 'manual_bankily',
          confirmationSource,
          receiptId,
          referenceProvided: Boolean(providerReference),
          settlementNote: input.settlementNote ?? null,
        },
        targetUid: payment.tenantId,
        timestamp: paidAtIso,
      });
      this.createNotification(transaction, {
        agencyId: payment.agencyId,
        body: `Paiement manuel confirmé pour ${property.label} • ${unit.label}.`,
        relatedEntityId: input.paymentId,
        relatedEntityType: 'rentPayment',
        role: 'tenant',
        timestamp: paidAtIso,
        title: 'Paiement confirmé',
        type: 'payment_completed',
        userId: payment.tenantId,
      });
      this.createNotification(transaction, {
        agencyId: payment.agencyId,
        body: `Loyer confirmé manuellement: ${rentLedger.rentAmount}.`,
        relatedEntityId: input.paymentId,
        relatedEntityType: 'rentPayment',
        role: 'owner',
        timestamp: paidAtIso,
        title: 'Loyer payé',
        type: 'payment_completed',
        userId: payment.ownerId,
      });

      return {
        payment: {
          ...nextPayment,
          id: input.paymentId,
        },
        receipt: receiptOutputFromDoc(receipt),
      };
    });
  }

  async getOwnerBilling(identity: AuthContext): Promise<OwnerBillingSummary> {
    const user = assertActiveOwner(await this.repository.getUser(identity.uid));
    const currentTerms = await this.getOrCreateLegalTerms();
    await this.repository.runTransaction(async (transaction) => {
      const transactionalOwner = assertActiveOwner(await transaction.getUser(identity.uid));
      await this.ensureAcceptedTerms(transaction, transactionalOwner, currentTerms);
      return null;
    });

    return this.billingService.getOwnerBillingSummary(user.ownerId ?? identity.uid);
  }

  async payOwnerBillingSimulated(identity: AuthContext): Promise<OwnerBillingSummary> {
    if (!isSimulatedOwnerBillingPaymentAllowed(this.config)) {
      throw new AppError(
        403,
        'owner_billing_simulation_disabled',
        'Le paiement simulé des frais propriétaire est désactivé dans cette configuration.',
      );
    }

    const user = assertActiveOwner(await this.repository.getUser(identity.uid));
    const ownerId = user.ownerId ?? identity.uid;

    if (!user.agencyId) {
      throw new AppError(
        409,
        'owner_agency_missing',
        'Le propriétaire n’est rattaché à aucune agence.',
      );
    }

    return this.billingService.markOwnerBillingInvoicePaid({
      actorRole: 'owner',
      actorUserId: user.uid,
      agencyId: user.agencyId,
      note: 'Paiement simulé depuis l’espace propriétaire.',
      ownerId,
      provider: 'simulated',
      providerReference: `SIM-OWNER-FEE-${Date.now().toString(36).toUpperCase()}`,
    });
  }

  async markAgencyOwnerBillingPaid(
    identity: AuthContext,
    ownerId: string,
    input: AgencyManualOwnerBillingPaymentInput,
  ): Promise<OwnerBillingSummary> {
    const admin = assertAgencyAdmin(await this.repository.getUser(identity.uid));
    const note = input.note.trim();

    if (!note) {
      throw new AppError(
        400,
        'owner_billing_note_required',
        'Une note est requise pour enregistrer un paiement manuel.',
      );
    }

    const owner = await this.repository.getUser(ownerId);

    if (!owner || owner.role !== 'owner' || owner.ownerId !== ownerId || owner.agencyId !== admin.agencyId) {
      throw new AppError(
        404,
        'owner_not_found',
        'Ce propriétaire est introuvable dans votre agence.',
      );
    }

    return this.billingService.markOwnerBillingInvoicePaid({
      actorRole: 'agency_admin',
      actorUserId: admin.uid,
      agencyId: admin.agencyId!,
      note,
      ownerId,
      provider: input.provider ?? 'manual',
      ...(input.providerReference?.trim()
        ? { providerReference: input.providerReference.trim() }
        : {}),
    });
  }

  async suspendAgencyOwnerBilling(
    identity: AuthContext,
    ownerId: string,
    input: AgencySuspendOwnerBillingInput,
  ): Promise<OwnerBillingSummary> {
    const admin = assertAgencyAdmin(await this.repository.getUser(identity.uid));
    const reason = input.reason.trim();

    if (!reason) {
      throw new AppError(
        400,
        'owner_billing_suspend_reason_required',
        'Un motif est requis pour suspendre la facturation propriétaire.',
      );
    }

    const owner = await this.repository.getUser(ownerId);

    if (!owner || owner.role !== 'owner' || owner.ownerId !== ownerId || owner.agencyId !== admin.agencyId) {
      throw new AppError(
        404,
        'owner_not_found',
        'Ce propriétaire est introuvable dans votre agence.',
      );
    }

    await this.billingService.getOrCreateOwnerBillingAccount(ownerId, admin.agencyId!);
    return this.billingService.suspendOwnerBillingAccount(ownerId, reason, admin.uid);
  }

  async reactivateAgencyOwnerBilling(
    identity: AuthContext,
    ownerId: string,
  ): Promise<OwnerBillingSummary> {
    const admin = assertAgencyAdmin(await this.repository.getUser(identity.uid));
    const owner = await this.repository.getUser(ownerId);

    if (!owner || owner.role !== 'owner' || owner.ownerId !== ownerId || owner.agencyId !== admin.agencyId) {
      throw new AppError(
        404,
        'owner_not_found',
        'Ce propriétaire est introuvable dans votre agence.',
      );
    }

    await this.billingService.getOrCreateOwnerBillingAccount(ownerId, admin.agencyId!);
    return this.billingService.reactivateOwnerBillingAccount(ownerId, admin.uid);
  }

  async listAgencyOwnersBilling(identity: AuthContext): Promise<AgencyOwnerBillingSummary[]> {
    const admin = assertAgencyAdmin(await this.repository.getUser(identity.uid));
    const owners = await this.repository.listUsersByAgency(admin.agencyId!, 'owner');

    return this.billingService.listAgencyOwnerBilling(admin.agencyId!, owners);
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
