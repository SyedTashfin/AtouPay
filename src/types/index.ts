export type Role = 'agency_admin' | 'tenant' | 'owner';
export type AuthProvider = 'demo' | 'google' | 'password' | 'phone';
export type SessionKind = 'demo' | 'firebase';

export type PaymentStatus = 'cancelled' | 'disputed' | 'failed' | 'late' | 'paid' | 'pending';
export type PaymentStatusFilter = 'all' | PaymentStatus;
export type OccupancyStatus = 'occupied' | 'vacant' | 'invited';
export type PaymentProvider = 'Bankily' | 'Sedad' | 'Masrvi' | 'Carte bancaire';

export type UserStatus = 'active' | 'pending_owner_access' | 'suspended';
export type TenantStatus = 'active' | 'suspended';
export type InviteStatus = 'pending' | 'claimed' | 'expired' | 'revoked';
export type InviteType = 'code' | 'link';
export type CommissionType = 'percentage';
export type RecoveryContactPreference = 'email' | 'phone';
export type SupportRequestCategory =
  | 'account_recovery'
  | 'payment_problem'
  | 'tenant_nonpayment'
  | 'bug_or_outage'
  | 'general_help';
export type SupportRequestStatus = 'submitted' | 'in_progress' | 'resolved';
export type DashboardPeriod = 'all' | 'last_month' | 'this_month';
export type NotificationType =
  | 'account_reactivated'
  | 'account_suspended'
  | 'owner_activated'
  | 'owner_billing_due'
  | 'owner_billing_grace_period'
  | 'owner_billing_paid'
  | 'owner_billing_past_due'
  | 'owner_billing_reactivated'
  | 'owner_billing_suspended'
  | 'owner_invite_created'
  | 'payment_completed'
  | 'payment_overdue'
  | 'payment_pending'
  | 'rent_due_reminder'
  | 'support_request_status_changed'
  | 'tenant_invite_created'
  | 'tenant_invite_redeemed';
export type AuditEventType =
  | 'account_reactivated'
  | 'account_suspended'
  | 'owner_activated'
  | 'owner_billing_paid'
  | 'owner_billing_reactivated'
  | 'owner_billing_suspended'
  | 'owner_invite_created'
  | 'owner_invite_deleted'
  | 'owner_invite_revoked'
  | 'payment_completed'
  | 'support_request_created'
  | 'support_request_updated'
  | 'tenant_invite_created'
  | 'tenant_invite_redeemed';

export type DismissedHintKey = 'payment-demo';
export type BannerTone = 'info' | 'success' | 'error';
export type DiagnosticScope = 'auth' | 'firestore' | 'invite' | 'payment' | 'storage';

export interface SessionUserProfile {
  agencyId?: string | null;
  authProviders?: AuthProvider[];
  displayName: string;
  email: string;
  emailVerified?: boolean;
  id: string;
  ownerId?: string | null;
  phoneNumber?: string | null;
  photoUrl?: string | null;
  recoveryContactPreference?: RecoveryContactPreference | null;
  status?: UserStatus;
  supportRecoveryStatus?: SupportRequestStatus | null;
  tenantId?: string | null;
}

export interface GoogleAuthPayload {
  accessToken?: string | null;
  idToken?: string | null;
  profile: SessionUserProfile;
  token: string;
}

export interface SessionState {
  authProvider: AuthProvider;
  authProviders?: AuthProvider[];
  firebaseUid?: string;
  kind: SessionKind;
  lastAuthenticatedAt: string;
  profile?: SessionUserProfile;
  role: Role;
  token: string;
}

export interface FirebaseUserProfileRecord {
  agencyId?: string | null;
  authProviders: AuthProvider[];
  createdAt?: string;
  displayName: string;
  email: string;
  emailVerified: boolean;
  ownerId?: string | null;
  phoneNumber?: string | null;
  photoURL?: string | null;
  recoveryContactPreference?: RecoveryContactPreference | null;
  role?: Role;
  status: UserStatus;
  supportRecoveryStatus?: SupportRequestStatus | null;
  tenantId?: string | null;
  uid: string;
  updatedAt?: string;
}

export interface OwnerRecord {
  agencyId?: string | null;
  createdAt?: string;
  displayName: string;
  id: string;
  updatedAt?: string;
  userId: string;
}

export interface AgencyRecord {
  // Deprecated: retained only for historical agency documents.
  // New tenant rent payments do not use agency commission settings.
  commissionRate: number;
  commissionType: CommissionType;
  createdAt?: string;
  displayName: string;
  id: string;
  updatedAt?: string;
}

export interface AgencyAdminBootstrapRecord {
  agencyId: string;
  claimedAt?: string | null;
  claimedByUid?: string | null;
  createdAt?: string;
  email: string;
  id: string;
  status: 'pending' | 'claimed' | 'revoked';
  updatedAt?: string;
}

export interface OwnerAccessInviteRecord {
  agencyId: string;
  claimedAt?: string | null;
  claimedByUid?: string | null;
  codeHash: string;
  createdAt?: string;
  email?: string | null;
  expiresAt: string;
  id: string;
  intendedRole: 'owner';
  inviteType: InviteType;
  status: InviteStatus;
}

export interface PropertyRecord {
  address: string;
  createdAt?: string;
  id: string;
  label: string;
  ownerId: string;
  updatedAt?: string;
}

export interface UnitRecord {
  activeInviteId?: string | null;
  createdAt?: string;
  currency: string;
  id: string;
  label: string;
  notes?: string | null;
  ownerId: string;
  propertyId: string;
  rentAmount: number;
  status: OccupancyStatus;
  tenantId?: string | null;
  updatedAt?: string;
}

export interface TenantRecord {
  createdAt?: string;
  displayName: string;
  email: string;
  id: string;
  ownerId: string;
  propertyId: string;
  status: TenantStatus;
  unitId: string;
  updatedAt?: string;
  userId: string;
}

export interface TenantInviteRecord {
  claimedAt?: string | null;
  claimedByUid?: string | null;
  codeHash: string;
  createdAt?: string;
  email?: string | null;
  expiresAt: string;
  id: string;
  inviteType: InviteType;
  ownerId: string;
  propertyId: string;
  status: InviteStatus;
  unitId: string;
}

export interface RentPaymentRecord {
  // Deprecated compatibility fields. New rent records keep commissionRate and
  // agencyFeeAmount at 0, with ownerNetAmount equal to rentAmount.
  agencyFeeAmount: number;
  agencyId?: string | null;
  commissionRate: number;
  createdAt?: string;
  dueDate: string;
  grossAmount: number;
  id: string;
  monthKey: string;
  ownerId: string;
  ownerReceivableAmount?: number;
  paidAt?: string | null;
  paymentMethod?: PaymentProvider | null;
  paymentStatus: PaymentStatus;
  ownerNetAmount: number;
  platformRentFeeAmount?: number;
  propertyId: string;
  providerReference?: string | null;
  receiptId?: string | null;
  rentAmount?: number;
  tenantId: string;
  tenantFeeAmount?: number;
  unitId: string;
  updatedAt?: string;
}

export interface ReceiptRecord {
  // Deprecated rent commission fields retained for historical receipts only.
  // Receipt UI/PDF must not present these as current charges.
  agencyFeeAmount: number;
  agencyDisplayName?: string;
  agencyId?: string | null;
  grossAmount: number;
  id: string;
  issuedAt: string;
  issuedBy?: 'backend';
  issuanceSource?: 'simulate-complete';
  ownerDisplayName?: string;
  ownerEmail?: string;
  ownerId: string;
  ownerNetAmount: number;
  paidAt?: string;
  paymentId: string;
  paymentMethod?: string;
  paymentStatus?: PaymentStatus;
  propertyId?: string;
  propertyLabel?: string;
  qrVerificationToken: string;
  receiptNumber: string;
  simulated?: boolean;
  tenantDisplayName?: string;
  tenantEmail?: string;
  tenantId: string;
  unitId: string;
  unitLabel?: string;
  verificationUrl?: string;
}

export interface PaymentFilterState {
  propertyId: string;
  status: PaymentStatusFilter;
}

export interface PersistedPaymentFilters {
  ownerPropertyId: string;
  ownerStatus: PaymentStatusFilter;
  tenantStatus: PaymentStatusFilter;
}

export type DismissedHintsState = Partial<Record<DismissedHintKey, true>>;

export interface MutationResult {
  message: string;
  ok: boolean;
  title: string;
}

export interface InviteGenerationResult extends MutationResult {
  expiresAt?: string;
  inviteCode?: string;
  inviteId?: string;
  inviteLink?: string;
}

export interface InviteRedemptionResult extends MutationResult {
  propertyId?: string;
  tenantId?: string;
  unitId?: string;
}

export interface PaymentAttemptResult extends MutationResult {
  payment?: PaymentRecord;
  receipt?: ReceiptRecord;
}

export interface TenantUser {
  email: string;
  fullName: string;
  id: string;
  initials: string;
  ownerId?: string | null;
  phone: string;
  propertyId?: string | null;
  role: 'tenant';
  status?: TenantStatus | 'unassigned';
  unitId?: string | null;
}

export interface OwnerUser {
  email: string;
  fullName: string;
  id: string;
  initials: string;
  ownerId?: string;
  phone: string;
  propertyIds: string[];
  role: 'owner';
}

export interface AgencyAdminUser {
  agencyId?: string | null;
  email: string;
  fullName: string;
  id: string;
  initials: string;
  role: 'agency_admin';
}

export interface TenantContact {
  email: string;
  fullName: string;
  id: string;
  initials: string;
  phone: string;
  propertyId?: string;
  status?: TenantStatus;
  unitId?: string;
}

export interface Property {
  activeInviteId?: string | null;
  address: string;
  firestorePropertyId?: string;
  id: string;
  monthlyRent: number;
  name: string;
  notes?: string | null;
  occupancyStatus: OccupancyStatus;
  ownerId: string;
  tenantIds: string[];
  unitLabel?: string;
}

export interface PaymentRecord {
  amount: number;
  // Deprecated compatibility fields. Current UI must not present these as an
  // active fee model.
  agencyFeeAmount?: number;
  agencyId?: string | null;
  commissionRate?: number;
  dueDate: string;
  grossAmount?: number;
  id: string;
  monthKey: string;
  ownerId: string;
  ownerNetAmount?: number;
  ownerReceivableAmount?: number;
  paidAt?: string;
  platformRentFeeAmount?: number;
  propertyId: string;
  provider?: PaymentProvider;
  receiptId?: string;
  referenceId: string;
  rentAmount?: number;
  status: PaymentStatus;
  tenantId: string;
  tenantFeeAmount?: number;
  unitId?: string;
}

export interface OwnerActionItem {
  amount: number;
  description: string;
  id: string;
  title: string;
}

export interface OwnerDashboardSummary {
  actionItems: OwnerActionItem[];
  agencyFeesThisMonth: number;
  collectedThisMonth: number;
  expectedThisMonth: number;
  grossCollectedThisMonth: number;
  lateCount: number;
  monthlyPotentialIncome: number;
  occupiedCount: number;
  pendingCount: number;
  progressPercentage: number;
  propertiesCount: number;
  tenantsCount: number;
  vacantImpact: number;
}

export interface AgencySettingsState {
  agencyId: string;
  commissionRate: number;
  commissionType: CommissionType;
  displayName: string;
  legacyCommissionRate: number;
  ownerAccountFeeAmount: number;
  ownerAccountFeeCurrency: 'EUR';
  ownerAccountFeeIntervalDays: number;
}

export type OwnerBillingStatus = 'active' | 'grace_period' | 'past_due' | 'suspended';
export type OwnerBillingInvoiceStatus = 'open' | 'paid' | 'overdue' | 'void';
export type OwnerBillingPaymentProvider = 'simulated' | 'manual' | 'moosyl' | 'stripe';

export interface OwnerBillingAccount {
  agencyId: string;
  createdAt: string;
  currentPeriodEnd: string;
  currentPeriodStart: string;
  feeAmount: number;
  feeCurrency: 'EUR';
  gracePeriodEndsAt?: string;
  intervalDays: number;
  lastPaidAt?: string;
  nextPaymentDueAt: string;
  ownerId: string;
  status: OwnerBillingStatus;
  updatedAt: string;
}

export interface OwnerBillingInvoice {
  agencyId: string;
  amount: number;
  createdAt: string;
  currency: 'EUR';
  dueAt: string;
  invoiceId: string;
  label: 'owner_account_access';
  note?: string;
  ownerId: string;
  paidAt?: string;
  periodEnd: string;
  periodStart: string;
  provider: OwnerBillingPaymentProvider;
  providerReference?: string;
  status: OwnerBillingInvoiceStatus;
  updatedAt: string;
}

export interface OwnerBillingSummary {
  account: OwnerBillingAccount;
  activeUntil: string;
  canCreateInvites: boolean;
  canManageProperties: boolean;
  feeAmount: number;
  feeCurrency: 'EUR';
  intervalDays: number;
  latestInvoice: OwnerBillingInvoice | null;
  nextPaymentDueAt: string;
  statusMessage: string;
}

export interface AgencyOwnerBillingSummary {
  account: OwnerBillingAccount;
  activeUntil: string;
  canCreateInvites: boolean;
  canManageProperties: boolean;
  latestInvoice: OwnerBillingInvoice | null;
  nextPaymentDueAt: string;
  owner: {
    displayName: string;
    email: string;
    ownerId: string;
    status: UserStatus;
    uid: string;
  };
  statusMessage: string;
}

export interface LegalTermsSectionRecord {
  body: string;
  title: string;
}

export interface LegalTermsRecord {
  locale: string;
  responsibilityStatement: string;
  sections: LegalTermsSectionRecord[];
  summary: string;
  supportPath: string;
  title: string;
  updatedAt: string;
  version: string;
}

export interface TermsAcceptanceStatus {
  acceptedAt: string | null;
  acceptedVersion: string | null;
  requiresAcceptance: boolean;
  termsVersion: string;
}

export interface ProfileContactState {
  phoneNumber: string | null;
  phoneVerificationStatus: 'unverified' | 'verified' | null;
  recoveryContactPreference: RecoveryContactPreference | null;
  supportRecoveryStatus: SupportRequestStatus | null;
}

export interface SupportRequestRecord {
  agencyId?: string | null;
  category: SupportRequestCategory;
  contactEmail: string;
  createdAt: string;
  description: string;
  id: string;
  paymentId?: string | null;
  phoneNumber?: string | null;
  recoveryContactPreference?: RecoveryContactPreference | null;
  requestorDisplayName: string;
  requestorRole: Role | 'guest';
  resolutionNote?: string | null;
  resolvedAt?: string | null;
  status: SupportRequestStatus;
  subject: string;
  updatedAt: string;
  userId?: string | null;
}

export interface AgencyOwnerSummary {
  agencyId?: string | null;
  createdAt: string;
  displayName: string;
  email: string;
  ownerId?: string | null;
  status: UserStatus;
  uid: string;
  updatedAt: string;
}

export interface AgencyUserSummary {
  agencyId?: string | null;
  createdAt: string;
  displayName: string;
  email: string;
  ownerId?: string | null;
  role: Role;
  status: UserStatus;
  tenantId?: string | null;
  uid: string;
  updatedAt: string;
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
  ownerReceivableAmount: number;
  ownerNetAmount: number;
  platformRentFeeAmount: number;
  tenantFeeAmount: number;
}

export interface AgencyDashboardSummary {
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

export interface OwnerBackendDashboardSummary {
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

export interface NotificationRecord {
  agencyId?: string | null;
  body: string;
  createdAt: string;
  id: string;
  readAt?: string | null;
  relatedEntityId?: string | null;
  relatedEntityType?: string | null;
  role: Role;
  title: string;
  type: NotificationType;
  userId?: string | null;
}

export interface AuditLogRecord {
  actorRole: Role | 'system';
  actorUid?: string | null;
  agencyId?: string | null;
  createdAt: string;
  entityId?: string | null;
  entityType: string;
  eventType: AuditEventType;
  id: string;
  metadata: Record<string, boolean | number | string | null>;
  targetUid?: string | null;
}

export interface OwnerAccessInviteSummary {
  agencyId: string;
  claimedAt?: string | null;
  claimedByUid?: string | null;
  createdAt: string;
  email?: string | null;
  expiresAt: string;
  id: string;
  inviteLink?: string;
  inviteType: InviteType;
  ownerInviteCode?: string;
  status: InviteStatus;
}

export interface ReceiptVerificationResult {
  receipt: ReceiptRecord | null;
  valid: boolean;
}

export interface ToastState {
  id: number;
  message: string;
  title: string;
  tone: BannerTone;
}

export interface DiagnosticEvent {
  action: string;
  message: string;
  scope: DiagnosticScope;
  status: BannerTone;
  timestamp: string;
  title: string;
}
