export type Role = 'agency_admin' | 'owner' | 'tenant';
export type UserStatus = 'active' | 'pending_owner_access' | 'suspended';
export type TenantStatus = 'active' | 'suspended';
export type OccupancyStatus = 'vacant' | 'invited' | 'occupied';
export type InviteStatus = 'pending' | 'claimed' | 'expired' | 'revoked';
export type InviteType = 'code' | 'link';
export type CommissionType = 'percentage';
export type AgencyAdminBootstrapStatus = 'pending' | 'claimed' | 'revoked';
export type PaymentStatus = 'cancelled' | 'disputed' | 'failed' | 'late' | 'paid' | 'pending';
export type BankilyIntegrationMode =
  | 'deep_link_confirmed'
  | 'deep_link_unverified'
  | 'moosyl_provider'
  | 'not_configured'
  | 'qr_or_code_manual';
export type OwnerPaymentMethodStatus =
  | 'disabled'
  | 'draft'
  | 'pending_verification'
  | 'rejected'
  | 'verified';
export type ManualPaymentProofSubmittedMethod =
  | 'bank_transfer'
  | 'bankily'
  | 'cash'
  | 'cheque'
  | 'masrvi'
  | 'other'
  | 'sedad';
export type ManualPaymentProofRiskLevel = 'high' | 'low' | 'medium';
export type ManualPaymentProofOwnerReviewStatus =
  | 'agency_escalated'
  | 'confirmed'
  | 'disputed'
  | 'rejected'
  | 'waiting_owner_review';
export type RecoveryContactPreference = 'email' | 'phone';
export type SupportRequestCategory =
  | 'account_recovery'
  | 'payment_problem'
  | 'tenant_nonpayment'
  | 'bug_or_outage'
  | 'general_help';
export type SupportRequestStatus = 'in_progress' | 'resolved' | 'submitted';
export type ManualPaymentProofStatus = 'confirmed' | 'disputed' | 'rejected' | 'submitted';
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
  | 'payment_proof_reminder'
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
  | 'payment_method_updated'
  | 'support_request_created'
  | 'support_request_updated'
  | 'tenant_invite_created'
  | 'tenant_invite_redeemed';

export type AuthProvider = 'google' | 'password' | 'phone';
export type PhoneVerificationStatus = 'unverified' | 'verified';

export interface AuthContext {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  displayName: string | null;
  photoUrl: string | null;
  phoneNumber: string | null;
  providers: AuthProvider[];
  primaryProvider: AuthProvider | null;
}

export interface UserDoc {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  authProviders: AuthProvider[];
  role: Role;
  status: UserStatus;
  agencyId: string | null;
  ownerId: string | null;
  tenantId: string | null;
  phoneNumber: string | null;
  phoneVerificationStatus: PhoneVerificationStatus | null;
  recoveryContactPreference: RecoveryContactPreference | null;
  supportRecoveryStatus: SupportRequestStatus | null;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OwnerDoc {
  userId: string;
  displayName: string;
  agencyId: string | null;
  bankilyDeepLinkTemplate?: string | null;
  bankilyIntegrationMode?: BankilyIntegrationMode;
  bankilyMerchantCode?: string | null;
  bankilyPaymentMethodReviewedAt?: string | null;
  bankilyPaymentMethodReviewedByUserId?: string | null;
  bankilyPaymentMethodReviewNote?: string | null;
  bankilyPaymentMethodStatus?: OwnerPaymentMethodStatus;
  bankilyPhoneNumber?: string | null;
  bankilyQrImageUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AgencyDoc {
  // Deprecated: kept only so historical agency documents still deserialize.
  // New tenant rent payments must not use agency commission settings.
  commissionType: CommissionType;
  commissionRate: number;
  createdAt: string;
  displayName: string;
  ownerAccountFeeAmount?: number;
  ownerAccountFeeCurrency?: 'EUR';
  ownerAccountFeeIntervalDays?: number;
  updatedAt: string;
}

export interface LegalTermsSectionDoc {
  body: string;
  title: string;
}

export interface LegalTermsDoc {
  locale: string;
  responsibilityStatement: string;
  sections: LegalTermsSectionDoc[];
  summary: string;
  supportPath: string;
  title: string;
  updatedAt: string;
  version: string;
}

export interface UserTermsAcceptanceDoc {
  acceptedAt: string;
  appVersion: string | null;
  locale: string;
  termsVersion: string;
  uid: string;
}

export interface AgencyAdminBootstrapDoc {
  agencyId: string;
  claimedAt: string | null;
  claimedByUid: string | null;
  createdAt: string;
  email: string;
  status: AgencyAdminBootstrapStatus;
  updatedAt: string;
}

export interface OwnerAccessInviteDoc {
  agencyId: string;
  email: string | null;
  codeHash: string;
  inviteType: InviteType;
  intendedRole: 'owner';
  status: InviteStatus;
  expiresAt: string;
  createdAt: string;
  claimedAt: string | null;
  claimedByUid: string | null;
}

export interface PropertyDoc {
  ownerId: string;
  label: string;
  address: string;
  createdAt: string;
  updatedAt: string;
}

export interface UnitDoc {
  propertyId: string;
  ownerId: string;
  label: string;
  notes?: string | null;
  rentAmount: number;
  currency: string;
  tenantId: string | null;
  activeInviteId: string | null;
  status: OccupancyStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TenantDoc {
  userId: string;
  ownerId: string;
  propertyId: string;
  unitId: string;
  displayName: string;
  email: string;
  status: TenantStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TenantInviteDoc {
  ownerId: string;
  propertyId: string;
  unitId: string;
  email: string | null;
  codeHash: string;
  inviteType: InviteType;
  status: InviteStatus;
  expiresAt: string;
  createdAt: string;
  claimedAt: string | null;
  claimedByUid: string | null;
}

export interface RentPaymentDoc {
  tenantId: string;
  ownerId: string;
  agencyId: string | null;
  atouPayReference?: string;
  propertyId: string;
  unitId: string;
  dueDate: string;
  monthKey: string;
  grossAmount: number;
  rentAmount?: number;
  tenantFeeAmount?: number;
  platformRentFeeAmount?: number;
  // Deprecated compatibility ledger fields. New rent payments must store
  // commissionRate/agencyFeeAmount as 0 and ownerNetAmount as rentAmount.
  commissionRate: number;
  agencyFeeAmount: number;
  ownerNetAmount: number;
  ownerReceivableAmount?: number;
  paymentMethod: string | null;
  paymentStatus: PaymentStatus;
  providerReference: string | null;
  receiptId: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReceiptDoc {
  // Deprecated rent commission fields retained for old receipt documents.
  // Current rent receipts must not display these fields to users.
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

export interface ManualPaymentProofCheckResultDoc {
  amountMatches: boolean;
  currencyMatches: boolean;
  dateLooksValid: boolean;
  hasImageProof: boolean;
  referenceMatches: boolean;
  riskLevel: ManualPaymentProofRiskLevel;
  warnings: string[];
}

export interface SupportRequestDoc {
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
  manualPaymentMethod?: string | null;
  manualProofReviewNote?: string | null;
  manualProofReviewedAt?: string | null;
  manualProofReviewedByUserId?: string | null;
  manualProofStatus?: ManualPaymentProofStatus | null;
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

export interface NotificationDoc {
  agencyId: string | null;
  body: string;
  createdAt: string;
  readAt: string | null;
  relatedEntityId: string | null;
  relatedEntityType: string | null;
  role: Role;
  title: string;
  type: NotificationType;
  userId: string | null;
}

export interface AuditLogDoc {
  actorRole: Role | 'system';
  actorUid: string | null;
  agencyId: string | null;
  createdAt: string;
  entityId: string | null;
  entityType: string;
  eventType: AuditEventType;
  metadata: Record<string, boolean | number | string | null>;
  targetUid: string | null;
}
