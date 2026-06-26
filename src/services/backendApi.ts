import { auth } from '@/src/lib/firebase';
import { appConfig, isBackendEnabled } from '@/src/config/env';
import {
  AgencyOwnerSummary,
  AgencyOwnerBillingSummary,
  AgencyDashboardSummary,
  AgencySettingsState,
  AgencyUserSummary,
  AuditLogRecord,
  DashboardPeriod,
  InviteType,
  LegalTermsRecord,
  NotificationRecord,
  OwnerBackendDashboardSummary,
  OwnerBillingSummary,
  OwnerAccessInviteSummary,
  PaymentProvider,
  ProfileContactState,
  RecoveryContactPreference,
  ReceiptRecord,
  ReceiptVerificationResult,
  RentPaymentIntentSummary,
  RentPaymentStatusSummary,
  Role,
  SupportRequestCategory,
  SupportRequestRecord,
  TermsAcceptanceStatus,
} from '@/src/types';

interface BackendErrorPayload {
  ok: false;
  error: {
    code: string;
    message: string;
  };
}

interface BackendSuccessPayload<T> {
  ok: true;
  data: T;
}

interface BackendHealthPayload {
  ok: true;
  service: string;
  status: 'healthy';
}

interface BootstrapProfileResponse {
  ownerId: string | null;
  role: Role;
  tenantId: string | null;
  uid: string;
}

interface CreatePropertyResponse {
  id: string;
  ownerId: string;
}

interface CreateUnitResponse {
  id: string;
  ownerId: string;
  propertyId: string;
}

interface DeleteInventoryResponse {
  id: string;
}

interface CreateInviteResponse {
  expiresAt: string;
  inviteCode: string;
  inviteId: string;
  inviteLink: string;
  ownerId: string;
  propertyId: string;
  unitId: string;
}

interface RedeemOwnerAccessResponse {
  agencyId: string | null;
  ownerId: string;
  uid: string;
}

interface RedeemInviteResponse {
  ownerId: string;
  paymentId: string;
  propertyId: string;
  tenantId: string;
  unitId: string;
}

interface CompleteSimulatedPaymentResponse {
  payment: {
    agencyFeeAmount: number;
    agencyId: string | null;
    commissionRate: number;
    createdAt: string;
    dueDate: string;
    grossAmount: number;
    id: string;
    monthKey: string;
    ownerId: string;
    ownerNetAmount: number;
    ownerReceivableAmount?: number;
    paidAt: string | null;
    paymentMethod: string | null;
    paymentStatus: 'cancelled' | 'disputed' | 'failed' | 'late' | 'paid' | 'pending';
    platformRentFeeAmount?: number;
    propertyId: string;
    providerReference: string | null;
    receiptId: string | null;
    rentAmount?: number;
    tenantId: string;
    tenantFeeAmount?: number;
    unitId: string;
    updatedAt: string;
  };
  receipt: ReceiptRecord;
}

interface CreateSupportRequestInput {
  category: SupportRequestCategory;
  description: string;
  paymentId?: string;
  phoneNumber?: string | null;
  recoveryContactPreference?: RecoveryContactPreference | null;
  subject: string;
}

interface SubmitManualPaymentProofInput {
  note?: string | null;
  paymentId: string;
  paymentMethod?: PaymentProvider;
  proofImageContentType?: string | null;
  proofImageFileName?: string | null;
  proofImageOriginalFileName?: string | null;
  proofImageSizeBytes?: number | null;
  proofImageStoragePath?: string | null;
  providerReference?: string | null;
  submittedAmount: number;
  submittedCurrency: 'MRU';
  submittedNote?: string | null;
  submittedPaymentDate: string;
  submittedPaymentMethod: 'bankily' | 'sedad' | 'masrvi' | 'bank_transfer' | 'cash' | 'cheque' | 'other';
  submittedPaymentReference: string;
  submittedPaymentTime?: string | null;
  submittedTransactionReference?: string | null;
}

export class BackendApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'BackendApiError';
  }
}

function getApiBaseUrl() {
  const value = appConfig.apiBaseUrl?.trim();

  if (!value) {
    throw new BackendApiError(
      'backend_base_url_missing',
      'Aucune URL backend locale n’a été résolue pour cette plateforme.',
    );
  }

  return value.replace(/\/$/, '');
}

async function getFirebaseIdToken() {
  if (!auth?.currentUser) {
    throw new BackendApiError(
      'auth_required',
      'Une session Firebase est requise pour appeler le backend ATouPay.',
      401,
    );
  }

  return auth.currentUser.getIdToken();
}

async function parseJson<T>(response: Response) {
  const text = await response.text();

  if (!text) {
    return null as T | null;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    return null as T | null;
  }
}

async function requestJson<T>(
  path: string,
  init?: RequestInit,
  options?: {
    requireAuth?: boolean;
  },
) {
  if (!isBackendEnabled) {
    throw new BackendApiError(
      'backend_disabled',
      'Les appels backend sont désactivés dans cette build.',
    );
  }

  const headers = new Headers(init?.headers);
  if (init?.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (options?.requireAuth !== false) {
    headers.set('Authorization', `Bearer ${await getFirebaseIdToken()}`);
  }

  let response: Response;

  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, {
      ...init,
      headers,
    });
  } catch (error) {
    throw new BackendApiError(
      'backend_unreachable',
      error instanceof Error
        ? `Le backend ATouPay est indisponible: ${error.message}`
        : 'Le backend ATouPay est indisponible.',
    );
  }

  const payload = await parseJson<BackendSuccessPayload<T> | BackendErrorPayload | BackendHealthPayload>(
    response,
  );

  if (!response.ok) {
    const errorPayload =
      payload && 'ok' in payload && payload.ok === false ? payload.error : null;

    throw new BackendApiError(
      errorPayload?.code ?? 'backend_request_failed',
      errorPayload?.message ?? 'La requête backend a échoué.',
      response.status,
    );
  }

  if (payload && 'data' in payload) {
    return payload.data as T;
  }

  return payload as T;
}

export async function checkBackendHealth() {
  return requestJson<BackendHealthPayload>('/health', { method: 'GET' }, { requireAuth: false });
}

export async function getLegalTermsViaBackend() {
  return requestJson<LegalTermsRecord>('/v1/legal/terms', { method: 'GET' }, { requireAuth: false });
}

export async function bootstrapProfileViaBackend(role: Role) {
  return requestJson<BootstrapProfileResponse>('/v1/profile/bootstrap', {
    body: JSON.stringify({ role }),
    method: 'POST',
  });
}

export async function getTermsStatusViaBackend() {
  return requestJson<TermsAcceptanceStatus>('/v1/legal/terms/status', {
    method: 'GET',
  });
}

export async function acceptTermsViaBackend(input: {
  appVersion?: string | null;
  locale?: string | null;
}) {
  return requestJson<TermsAcceptanceStatus>('/v1/legal/terms/accept', {
    body: JSON.stringify({
      appVersion: input.appVersion ?? null,
      locale: input.locale ?? null,
    }),
    method: 'POST',
  });
}

export async function getProfileContactViaBackend() {
  return requestJson<ProfileContactState>('/v1/profile/contact', {
    method: 'GET',
  });
}

export async function updateProfileContactViaBackend(input: {
  phoneNumber?: string | null;
  recoveryContactPreference?: RecoveryContactPreference | null;
}) {
  return requestJson<ProfileContactState>('/v1/profile/contact', {
    body: JSON.stringify({
      ...(input.phoneNumber !== undefined ? { phoneNumber: input.phoneNumber } : {}),
      ...(input.recoveryContactPreference !== undefined
        ? { recoveryContactPreference: input.recoveryContactPreference }
        : {}),
    }),
    method: 'PATCH',
  });
}

export async function listSupportRequestsViaBackend() {
  return requestJson<SupportRequestRecord[]>('/v1/support/requests', {
    method: 'GET',
  });
}

export async function createSupportRequestViaBackend(input: CreateSupportRequestInput) {
  return requestJson<SupportRequestRecord>('/v1/support/requests', {
    body: JSON.stringify({
      category: input.category,
      description: input.description.trim(),
      ...(input.paymentId ? { paymentId: input.paymentId } : {}),
      ...(input.phoneNumber !== undefined ? { phoneNumber: input.phoneNumber } : {}),
      ...(input.recoveryContactPreference !== undefined
        ? { recoveryContactPreference: input.recoveryContactPreference }
        : {}),
      subject: input.subject.trim(),
    }),
    method: 'POST',
  });
}

export async function createRecoverySupportRequestViaBackend(input: {
  description: string;
  email: string;
  locale?: string | null;
  phoneNumber?: string | null;
  recoveryContactPreference?: RecoveryContactPreference | null;
  subject: string;
}) {
  return requestJson<SupportRequestRecord>(
    '/v1/support/recovery-request',
    {
      body: JSON.stringify({
        description: input.description.trim(),
        email: input.email.trim().toLowerCase(),
        locale: input.locale ?? null,
        ...(input.phoneNumber !== undefined ? { phoneNumber: input.phoneNumber } : {}),
        ...(input.recoveryContactPreference !== undefined
          ? { recoveryContactPreference: input.recoveryContactPreference }
          : {}),
        subject: input.subject.trim(),
      }),
      method: 'POST',
    },
    {
      requireAuth: false,
    },
  );
}

export async function updateSupportRequestViaBackend(input: {
  requestId: string;
  resolutionNote?: string | null;
  status: 'in_progress' | 'resolved';
}) {
  return requestJson<SupportRequestRecord>(
    `/v1/support/requests/${encodeURIComponent(input.requestId)}`,
    {
      body: JSON.stringify({
        ...(input.resolutionNote !== undefined ? { resolutionNote: input.resolutionNote } : {}),
        status: input.status,
      }),
      method: 'PATCH',
    },
  );
}

export async function reviewManualPaymentProofViaBackend(input: {
  decision: 'confirmed' | 'disputed' | 'rejected';
  note?: string | null;
  overrideReason?: string | null;
  requestId: string;
  settlementNote?: string | null;
}) {
  return requestJson<SupportRequestRecord>(
    `/v1/support/requests/${encodeURIComponent(input.requestId)}/manual-proof/review`,
    {
      body: JSON.stringify({
        decision: input.decision,
        ...(input.note?.trim() ? { note: input.note.trim() } : {}),
        ...(input.overrideReason?.trim() ? { overrideReason: input.overrideReason.trim() } : {}),
        ...(input.settlementNote?.trim() ? { settlementNote: input.settlementNote.trim() } : {}),
      }),
      method: 'POST',
    },
  );
}

export async function createOwnerPropertyViaBackend(input: {
  address: string;
  label: string;
}) {
  return requestJson<CreatePropertyResponse>('/v1/owner/properties', {
    body: JSON.stringify({
      address: input.address.trim(),
      label: input.label.trim(),
    }),
    method: 'POST',
  });
}

export async function createOwnerUnitViaBackend(input: {
  currency: string;
  label: string;
  notes?: string | null;
  propertyId: string;
  rentAmount: number;
}) {
  return requestJson<CreateUnitResponse>('/v1/owner/units', {
    body: JSON.stringify({
      currency: input.currency.trim(),
      label: input.label.trim(),
      ...(input.notes?.trim() ? { notes: input.notes.trim() } : {}),
      propertyId: input.propertyId,
      rentAmount: input.rentAmount,
    }),
    method: 'POST',
  });
}

export async function updateOwnerPropertyViaBackend(input: {
  address: string;
  label: string;
  propertyId: string;
}) {
  return requestJson<CreatePropertyResponse>(
    `/v1/owner/properties/${encodeURIComponent(input.propertyId)}`,
    {
      body: JSON.stringify({
        address: input.address.trim(),
        label: input.label.trim(),
      }),
      method: 'PATCH',
    },
  );
}

export async function deleteOwnerPropertyViaBackend(propertyId: string) {
  return requestJson<DeleteInventoryResponse>(
    `/v1/owner/properties/${encodeURIComponent(propertyId)}`,
    {
      method: 'DELETE',
    },
  );
}

export async function updateOwnerUnitViaBackend(input: {
  label: string;
  notes?: string | null;
  rentAmount: number;
  unitId: string;
}) {
  return requestJson<CreateUnitResponse>(
    `/v1/owner/units/${encodeURIComponent(input.unitId)}`,
    {
      body: JSON.stringify({
        label: input.label.trim(),
        notes: input.notes?.trim() ? input.notes.trim() : null,
        rentAmount: input.rentAmount,
      }),
      method: 'PATCH',
    },
  );
}

export async function deleteOwnerUnitViaBackend(unitId: string) {
  return requestJson<DeleteInventoryResponse>(
    `/v1/owner/units/${encodeURIComponent(unitId)}`,
    {
      method: 'DELETE',
    },
  );
}

export async function createTenantInviteViaBackend(input: {
  email?: string;
  inviteType?: InviteType;
  unitId: string;
}) {
  return requestJson<CreateInviteResponse>('/v1/invites', {
    body: JSON.stringify({
      ...(input.email?.trim() ? { email: input.email.trim().toLowerCase() } : {}),
      inviteType: input.inviteType ?? 'code',
      unitId: input.unitId,
    }),
    method: 'POST',
  });
}

export async function redeemOwnerAccessViaBackend(input: { inviteCode: string }) {
  return requestJson<RedeemOwnerAccessResponse>('/v1/owner-access/redeem', {
    body: JSON.stringify({
      inviteCode: input.inviteCode,
    }),
    method: 'POST',
  });
}

export async function redeemTenantInviteViaBackend(input: { inviteCode: string }) {
  return requestJson<RedeemInviteResponse>('/v1/invites/redeem', {
    body: JSON.stringify({
      inviteCode: input.inviteCode,
    }),
    method: 'POST',
  });
}

export async function listOwnerAccessInvitesViaBackend() {
  return requestJson<OwnerAccessInviteSummary[]>('/v1/agency/owner-access-invites', {
    method: 'GET',
  });
}

export async function createOwnerAccessInviteViaBackend(input: {
  email?: string;
  inviteType?: InviteType;
}) {
  return requestJson<OwnerAccessInviteSummary>('/v1/agency/owner-access-invites', {
    body: JSON.stringify({
      ...(input.email?.trim() ? { email: input.email.trim().toLowerCase() } : {}),
      inviteType: input.inviteType ?? 'code',
    }),
    method: 'POST',
  });
}

export async function revokeOwnerAccessInviteViaBackend(inviteId: string) {
  return requestJson<OwnerAccessInviteSummary>(
    `/v1/agency/owner-access-invites/${encodeURIComponent(inviteId)}/revoke`,
    {
      method: 'POST',
    },
  );
}

export async function deleteOwnerAccessInviteViaBackend(inviteId: string) {
  return requestJson<{ id: string }>(
    `/v1/agency/owner-access-invites/${encodeURIComponent(inviteId)}`,
    {
      method: 'DELETE',
    },
  );
}

export async function listAgencyOwnersViaBackend() {
  return requestJson<AgencyOwnerSummary[]>('/v1/agency/owners', {
    method: 'GET',
  });
}

export async function reviewOwnerBankilyPaymentMethodViaBackend(input: {
  note?: string | null;
  ownerId: string;
  status: 'verified' | 'rejected' | 'disabled';
}) {
  return requestJson<{
    agencyId: string | null;
    bankilyPaymentMethodStatus?: string;
    displayName: string;
    ownerId: string;
    userId: string;
  }>(
    `/v1/agency/owners/${encodeURIComponent(input.ownerId)}/payment-method/bankily/review`,
    {
      body: JSON.stringify({
        ...(input.note?.trim() ? { note: input.note.trim() } : {}),
        status: input.status,
      }),
      method: 'POST',
    },
  );
}

export async function getAgencyDashboardViaBackend(period: DashboardPeriod = 'this_month') {
  return requestJson<AgencyDashboardSummary>(
    `/v1/agency/dashboard?period=${encodeURIComponent(period)}`,
    {
      method: 'GET',
    },
  );
}

export async function getOwnerDashboardViaBackend(period: DashboardPeriod = 'this_month') {
  return requestJson<OwnerBackendDashboardSummary>(
    `/v1/owner/dashboard?period=${encodeURIComponent(period)}`,
    {
      method: 'GET',
    },
  );
}

export async function listAgencyUsersViaBackend() {
  return requestJson<AgencyUserSummary[]>('/v1/agency/users', {
    method: 'GET',
  });
}

export async function updateAgencyUserStatusViaBackend(input: {
  status: 'active' | 'suspended';
  uid: string;
}) {
  return requestJson<AgencyUserSummary>(
    `/v1/agency/users/${encodeURIComponent(input.uid)}/status`,
    {
      body: JSON.stringify({
        status: input.status,
      }),
      method: 'PATCH',
    },
  );
}

export async function listAgencyAuditLogsViaBackend() {
  return requestJson<AuditLogRecord[]>('/v1/agency/audit-logs', {
    method: 'GET',
  });
}

export async function listNotificationsViaBackend() {
  return requestJson<NotificationRecord[]>('/v1/notifications', {
    method: 'GET',
  });
}

export async function markNotificationReadViaBackend(notificationId: string) {
  return requestJson<NotificationRecord>(
    `/v1/notifications/${encodeURIComponent(notificationId)}/read`,
    {
      method: 'POST',
    },
  );
}

export async function getAgencySettingsViaBackend() {
  return requestJson<AgencySettingsState>('/v1/agency/settings', {
    method: 'GET',
  });
}

export async function updateAgencySettingsViaBackend(input: {
  displayName?: string;
}) {
  return requestJson<AgencySettingsState>('/v1/agency/settings', {
    body: JSON.stringify({
      ...(input.displayName?.trim() ? { displayName: input.displayName.trim() } : {}),
    }),
    method: 'PATCH',
  });
}

export async function getOwnerBillingViaBackend() {
  return requestJson<OwnerBillingSummary>('/v1/owner/billing', {
    method: 'GET',
  });
}

export async function payOwnerBillingSimulatedViaBackend() {
  return requestJson<OwnerBillingSummary>('/v1/owner/billing/pay-simulated', {
    method: 'POST',
  });
}

export async function listAgencyOwnerBillingViaBackend() {
  return requestJson<AgencyOwnerBillingSummary[]>('/v1/agency/owners/billing', {
    method: 'GET',
  });
}

export async function markAgencyOwnerBillingPaidViaBackend(input: {
  note: string;
  ownerId: string;
  provider?: 'manual' | 'simulated';
  providerReference?: string;
}) {
  return requestJson<OwnerBillingSummary>(
    `/v1/agency/owners/${encodeURIComponent(input.ownerId)}/billing/mark-paid`,
    {
      body: JSON.stringify({
        note: input.note,
        ...(input.provider ? { provider: input.provider } : {}),
        ...(input.providerReference?.trim()
          ? { providerReference: input.providerReference.trim() }
          : {}),
      }),
      method: 'POST',
    },
  );
}

export async function suspendAgencyOwnerBillingViaBackend(input: {
  ownerId: string;
  reason: string;
}) {
  return requestJson<OwnerBillingSummary>(
    `/v1/agency/owners/${encodeURIComponent(input.ownerId)}/billing/suspend`,
    {
      body: JSON.stringify({
        reason: input.reason,
      }),
      method: 'POST',
    },
  );
}

export async function reactivateAgencyOwnerBillingViaBackend(ownerId: string) {
  return requestJson<OwnerBillingSummary>(
    `/v1/agency/owners/${encodeURIComponent(ownerId)}/billing/reactivate`,
    {
      method: 'POST',
    },
  );
}

export async function completeSimulatedPaymentViaBackend(input: {
  paymentId: string;
  paymentMethod: PaymentProvider;
}) {
  return requestJson<CompleteSimulatedPaymentResponse>(
    `/v1/payments/${encodeURIComponent(input.paymentId)}/simulate-complete`,
    {
      body: JSON.stringify({
        paymentMethod: input.paymentMethod,
      }),
      method: 'POST',
    },
  );
}

export async function confirmManualRentPaymentViaBackend(input: {
  note?: string | null;
  paymentId: string;
  paymentMethod?: PaymentProvider;
  providerReference?: string | null;
}) {
  return requestJson<CompleteSimulatedPaymentResponse>(
    `/v1/payments/${encodeURIComponent(input.paymentId)}/manual-confirm`,
    {
      body: JSON.stringify({
        ...(input.note?.trim() ? { note: input.note.trim() } : {}),
        ...(input.paymentMethod ? { paymentMethod: input.paymentMethod } : {}),
        ...(input.providerReference?.trim()
          ? { providerReference: input.providerReference.trim() }
          : {}),
      }),
      method: 'POST',
    },
  );
}

export async function submitManualPaymentProofViaBackend(input: SubmitManualPaymentProofInput) {
  return requestJson<SupportRequestRecord>(
    `/v1/payments/${encodeURIComponent(input.paymentId)}/manual-proof`,
    {
      body: JSON.stringify({
        ...(input.note?.trim() ? { note: input.note.trim() } : {}),
        ...(input.paymentMethod ? { paymentMethod: input.paymentMethod } : {}),
        ...(input.proofImageContentType
          ? { proofImageContentType: input.proofImageContentType }
          : {}),
        ...(input.proofImageFileName ? { proofImageFileName: input.proofImageFileName } : {}),
        ...(input.proofImageOriginalFileName
          ? { proofImageOriginalFileName: input.proofImageOriginalFileName }
          : {}),
        ...(typeof input.proofImageSizeBytes === 'number'
          ? { proofImageSizeBytes: input.proofImageSizeBytes }
          : {}),
        ...(input.proofImageStoragePath
          ? { proofImageStoragePath: input.proofImageStoragePath }
          : {}),
        ...(input.providerReference?.trim()
          ? { providerReference: input.providerReference.trim() }
          : {}),
        submittedAmount: input.submittedAmount,
        submittedCurrency: input.submittedCurrency,
        ...(input.submittedNote?.trim() ? { submittedNote: input.submittedNote.trim() } : {}),
        submittedPaymentDate: input.submittedPaymentDate,
        submittedPaymentMethod: input.submittedPaymentMethod,
        submittedPaymentReference: input.submittedPaymentReference.trim(),
        ...(input.submittedPaymentTime?.trim()
          ? { submittedPaymentTime: input.submittedPaymentTime.trim() }
          : {}),
        ...(input.submittedTransactionReference?.trim()
          ? { submittedTransactionReference: input.submittedTransactionReference.trim() }
          : {}),
      }),
      method: 'POST',
    },
  );
}

export async function createRentPaymentIntentViaBackend(paymentId: string) {
  return requestJson<RentPaymentIntentSummary>(
    `/v1/payments/${encodeURIComponent(paymentId)}/intent`,
    {
      method: 'POST',
    },
  );
}

export async function getRentPaymentStatusViaBackend(paymentId: string) {
  return requestJson<RentPaymentStatusSummary>(
    `/v1/payments/${encodeURIComponent(paymentId)}/status`,
    {
      method: 'GET',
    },
  );
}

export async function cancelRentPaymentIntentViaBackend(paymentId: string) {
  return requestJson<RentPaymentStatusSummary>(
    `/v1/payments/${encodeURIComponent(paymentId)}/cancel`,
    {
      method: 'POST',
    },
  );
}

export async function getReceiptViaBackend(receiptId: string) {
  return requestJson<ReceiptRecord>(`/v1/receipts/${encodeURIComponent(receiptId)}`, {
    method: 'GET',
  });
}

export async function verifyReceiptViaBackend(token: string) {
  return requestJson<ReceiptVerificationResult>(
    `/v1/receipts/verify/${encodeURIComponent(token)}`,
    {
      method: 'GET',
    },
    {
      requireAuth: false,
    },
  );
}

export function mapBackendErrorToMessage(error: unknown, fallback: string) {
  if (error instanceof BackendApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}
