import { auth } from '@/src/lib/firebase';
import { appConfig, isBackendEnabled } from '@/src/config/env';
import {
  AgencyOwnerSummary,
  AgencyDashboardSummary,
  AgencySettingsState,
  AgencyUserSummary,
  AuditLogRecord,
  DashboardPeriod,
  InviteType,
  LegalTermsRecord,
  NotificationRecord,
  OwnerBackendDashboardSummary,
  OwnerAccessInviteSummary,
  PaymentProvider,
  ProfileContactState,
  RecoveryContactPreference,
  ReceiptRecord,
  ReceiptVerificationResult,
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
    paidAt: string | null;
    paymentMethod: string | null;
    paymentStatus: 'cancelled' | 'disputed' | 'failed' | 'late' | 'paid' | 'pending';
    propertyId: string;
    providerReference: string | null;
    receiptId: string | null;
    tenantId: string;
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
  headers.set('Content-Type', 'application/json');

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
  propertyId: string;
  rentAmount: number;
}) {
  return requestJson<CreateUnitResponse>('/v1/owner/units', {
    body: JSON.stringify({
      currency: input.currency.trim(),
      label: input.label.trim(),
      propertyId: input.propertyId,
      rentAmount: input.rentAmount,
    }),
    method: 'POST',
  });
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

export async function listAgencyOwnersViaBackend() {
  return requestJson<AgencyOwnerSummary[]>('/v1/agency/owners', {
    method: 'GET',
  });
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
  commissionRate: number;
}) {
  return requestJson<AgencySettingsState>('/v1/agency/settings', {
    body: JSON.stringify({
      commissionRate: input.commissionRate,
    }),
    method: 'PATCH',
  });
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
