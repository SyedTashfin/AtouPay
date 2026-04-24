import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';

const errorResponseSchema = Type.Object({
  error: Type.Object({
    code: Type.String(),
    message: Type.String(),
  }),
  ok: Type.Literal(false),
});

const roleSchema = Type.Union([
  Type.Literal('agency_admin'),
  Type.Literal('owner'),
  Type.Literal('tenant'),
]);

const userStatusSchema = Type.Union([
  Type.Literal('active'),
  Type.Literal('pending_owner_access'),
  Type.Literal('suspended'),
]);

const paymentStatusSchema = Type.Union([
  Type.Literal('cancelled'),
  Type.Literal('disputed'),
  Type.Literal('failed'),
  Type.Literal('late'),
  Type.Literal('paid'),
  Type.Literal('pending'),
]);

const dashboardPeriodSchema = Type.Union([
  Type.Literal('all'),
  Type.Literal('last_month'),
  Type.Literal('this_month'),
]);

const bootstrapBodySchema = Type.Object({
  role: roleSchema,
});

const bootstrapResponseSchema = Type.Object({
  data: Type.Object({
    ownerId: Type.Union([Type.String(), Type.Null()]),
    role: roleSchema,
    tenantId: Type.Union([Type.String(), Type.Null()]),
    uid: Type.String(),
  }),
  ok: Type.Literal(true),
});

const createPropertyBodySchema = Type.Object({
  address: Type.String({ minLength: 1, maxLength: 240 }),
  label: Type.String({ minLength: 1, maxLength: 120 }),
});

const createPropertyResponseSchema = Type.Object({
  data: Type.Object({
    id: Type.String(),
    ownerId: Type.String(),
  }),
  ok: Type.Literal(true),
});

const createUnitBodySchema = Type.Object({
  currency: Type.String({ minLength: 1, maxLength: 8 }),
  label: Type.String({ minLength: 1, maxLength: 120 }),
  propertyId: Type.String({ minLength: 1 }),
  rentAmount: Type.Number({ exclusiveMinimum: 0 }),
});

const createUnitResponseSchema = Type.Object({
  data: Type.Object({
    id: Type.String(),
    ownerId: Type.String(),
    propertyId: Type.String(),
  }),
  ok: Type.Literal(true),
});

const createInviteBodySchema = Type.Object({
  email: Type.Optional(Type.String({ format: 'email' })),
  inviteType: Type.Union([Type.Literal('code'), Type.Literal('link')]),
  unitId: Type.String({ minLength: 1 }),
});

const createInviteResponseSchema = Type.Object({
  data: Type.Object({
    expiresAt: Type.String(),
    inviteCode: Type.String(),
    inviteId: Type.String(),
    inviteLink: Type.String(),
    ownerId: Type.String(),
    propertyId: Type.String(),
    unitId: Type.String(),
  }),
  ok: Type.Literal(true),
});

const ownerAccessInviteSchema = Type.Object({
  agencyId: Type.String(),
  claimedAt: Type.Union([Type.String(), Type.Null()]),
  claimedByUid: Type.Union([Type.String(), Type.Null()]),
  createdAt: Type.String(),
  email: Type.Union([Type.String(), Type.Null()]),
  expiresAt: Type.String(),
  id: Type.String(),
  inviteLink: Type.Optional(Type.String()),
  inviteType: Type.Union([Type.Literal('code'), Type.Literal('link')]),
  ownerInviteCode: Type.Optional(Type.String()),
  status: Type.Union([
    Type.Literal('pending'),
    Type.Literal('claimed'),
    Type.Literal('expired'),
    Type.Literal('revoked'),
  ]),
});

const createOwnerAccessInviteBodySchema = Type.Object({
  email: Type.Optional(Type.String({ format: 'email' })),
  inviteType: Type.Union([Type.Literal('code'), Type.Literal('link')]),
});

const listOwnerAccessInvitesResponseSchema = Type.Object({
  data: Type.Array(ownerAccessInviteSchema),
  ok: Type.Literal(true),
});

const createOwnerAccessInviteResponseSchema = Type.Object({
  data: ownerAccessInviteSchema,
  ok: Type.Literal(true),
});

const revokeOwnerAccessInviteParamsSchema = Type.Object({
  inviteId: Type.String({ minLength: 1 }),
});

const agencyOwnerSchema = Type.Object({
  agencyId: Type.Union([Type.String(), Type.Null()]),
  createdAt: Type.String(),
  displayName: Type.String(),
  email: Type.String(),
  ownerId: Type.Union([Type.String(), Type.Null()]),
  status: userStatusSchema,
  uid: Type.String(),
  updatedAt: Type.String(),
});

const agencyOwnersResponseSchema = Type.Object({
  data: Type.Array(agencyOwnerSchema),
  ok: Type.Literal(true),
});

const agencyUserSchema = Type.Object({
  agencyId: Type.Union([Type.String(), Type.Null()]),
  createdAt: Type.String(),
  displayName: Type.String(),
  email: Type.String(),
  ownerId: Type.Union([Type.String(), Type.Null()]),
  role: roleSchema,
  status: userStatusSchema,
  tenantId: Type.Union([Type.String(), Type.Null()]),
  uid: Type.String(),
  updatedAt: Type.String(),
});

const agencyUsersResponseSchema = Type.Object({
  data: Type.Array(agencyUserSchema),
  ok: Type.Literal(true),
});

const updateAgencyUserStatusParamsSchema = Type.Object({
  uid: Type.String({ minLength: 1 }),
});

const updateAgencyUserStatusBodySchema = Type.Object({
  status: Type.Union([Type.Literal('active'), Type.Literal('suspended')]),
});

const paymentStatusBreakdownSchema = Type.Object({
  cancelled: Type.Number(),
  disputed: Type.Number(),
  failed: Type.Number(),
  late: Type.Number(),
  paid: Type.Number(),
  pending: Type.Number(),
});

const supportStatusBreakdownSchema = Type.Object({
  in_progress: Type.Number(),
  resolved: Type.Number(),
  submitted: Type.Number(),
});

const moneySummarySchema = Type.Object({
  agencyFeeAmount: Type.Number(),
  grossAmount: Type.Number(),
  ownerNetAmount: Type.Number(),
});

const dashboardQuerySchema = Type.Object({
  period: Type.Optional(dashboardPeriodSchema),
});

const agencyDashboardResponseSchema = Type.Object({
  data: Type.Object({
    activeOwnersCount: Type.Number(),
    activeTenantsCount: Type.Number(),
    agencyId: Type.String(),
    commissionRate: Type.Number(),
    commissionSummary: moneySummarySchema,
    displayName: Type.String(),
    occupiedUnitsCount: Type.Number(),
    paymentsByStatus: paymentStatusBreakdownSchema,
    pendingInvitesCount: Type.Number(),
    period: dashboardPeriodSchema,
    rentSummary: moneySummarySchema,
    supportRequestsByStatus: supportStatusBreakdownSchema,
    suspendedUsersCount: Type.Number(),
    totalPropertiesCount: Type.Number(),
    totalUnitsCount: Type.Number(),
    vacantUnitsCount: Type.Number(),
  }),
  ok: Type.Literal(true),
});

const ownerDashboardResponseSchema = Type.Object({
  data: Type.Object({
    agencyFeeAmount: Type.Number(),
    grossAmount: Type.Number(),
    latePaymentsCount: Type.Number(),
    occupiedUnitsCount: Type.Number(),
    ownerId: Type.String(),
    ownerNetAmount: Type.Number(),
    paidPaymentsCount: Type.Number(),
    paymentsByStatus: paymentStatusBreakdownSchema,
    pendingPaymentsCount: Type.Number(),
    period: dashboardPeriodSchema,
    totalPropertiesCount: Type.Number(),
    totalTenantsCount: Type.Number(),
    totalUnitsCount: Type.Number(),
    vacantUnitsCount: Type.Number(),
  }),
  ok: Type.Literal(true),
});

const notificationTypeSchema = Type.Union([
  Type.Literal('account_reactivated'),
  Type.Literal('account_suspended'),
  Type.Literal('owner_activated'),
  Type.Literal('owner_invite_created'),
  Type.Literal('payment_completed'),
  Type.Literal('payment_overdue'),
  Type.Literal('payment_pending'),
  Type.Literal('rent_due_reminder'),
  Type.Literal('support_request_status_changed'),
  Type.Literal('tenant_invite_created'),
  Type.Literal('tenant_invite_redeemed'),
]);

const notificationSchema = Type.Object({
  agencyId: Type.Union([Type.String(), Type.Null()]),
  body: Type.String(),
  createdAt: Type.String(),
  id: Type.String(),
  readAt: Type.Union([Type.String(), Type.Null()]),
  relatedEntityId: Type.Union([Type.String(), Type.Null()]),
  relatedEntityType: Type.Union([Type.String(), Type.Null()]),
  role: roleSchema,
  title: Type.String(),
  type: notificationTypeSchema,
  userId: Type.Union([Type.String(), Type.Null()]),
});

const notificationsResponseSchema = Type.Object({
  data: Type.Array(notificationSchema),
  ok: Type.Literal(true),
});

const notificationParamsSchema = Type.Object({
  notificationId: Type.String({ minLength: 1 }),
});

const notificationResponseSchema = Type.Object({
  data: notificationSchema,
  ok: Type.Literal(true),
});

const auditEventTypeSchema = Type.Union([
  Type.Literal('account_reactivated'),
  Type.Literal('account_suspended'),
  Type.Literal('owner_activated'),
  Type.Literal('owner_invite_created'),
  Type.Literal('owner_invite_revoked'),
  Type.Literal('payment_completed'),
  Type.Literal('support_request_created'),
  Type.Literal('support_request_updated'),
  Type.Literal('tenant_invite_created'),
  Type.Literal('tenant_invite_redeemed'),
]);

const auditLogSchema = Type.Object({
  actorRole: Type.Union([roleSchema, Type.Literal('system')]),
  actorUid: Type.Union([Type.String(), Type.Null()]),
  agencyId: Type.Union([Type.String(), Type.Null()]),
  createdAt: Type.String(),
  entityId: Type.Union([Type.String(), Type.Null()]),
  entityType: Type.String(),
  eventType: auditEventTypeSchema,
  id: Type.String(),
  metadata: Type.Record(
    Type.String(),
    Type.Union([Type.Boolean(), Type.Number(), Type.String(), Type.Null()]),
  ),
  targetUid: Type.Union([Type.String(), Type.Null()]),
});

const auditLogsResponseSchema = Type.Object({
  data: Type.Array(auditLogSchema),
  ok: Type.Literal(true),
});

const agencySettingsSchema = Type.Object({
  agencyId: Type.String(),
  commissionRate: Type.Number(),
  commissionType: Type.Literal('percentage'),
  displayName: Type.String(),
});

const agencySettingsResponseSchema = Type.Object({
  data: agencySettingsSchema,
  ok: Type.Literal(true),
});

const updateAgencySettingsBodySchema = Type.Object({
  commissionRate: Type.Number({ minimum: 0, maximum: 1 }),
});

const legalTermsSchema = Type.Object({
  locale: Type.String(),
  responsibilityStatement: Type.String(),
  sections: Type.Array(
    Type.Object({
      body: Type.String(),
      title: Type.String(),
    }),
  ),
  summary: Type.String(),
  supportPath: Type.String(),
  title: Type.String(),
  updatedAt: Type.String(),
  version: Type.String(),
});

const legalTermsResponseSchema = Type.Object({
  data: legalTermsSchema,
  ok: Type.Literal(true),
});

const termsStatusSchema = Type.Object({
  acceptedAt: Type.Union([Type.String(), Type.Null()]),
  acceptedVersion: Type.Union([Type.String(), Type.Null()]),
  requiresAcceptance: Type.Boolean(),
  termsVersion: Type.String(),
});

const termsStatusResponseSchema = Type.Object({
  data: termsStatusSchema,
  ok: Type.Literal(true),
});

const acceptTermsBodySchema = Type.Object({
  appVersion: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  locale: Type.Optional(Type.Union([Type.String(), Type.Null()])),
});

const recoveryContactPreferenceSchema = Type.Union([
  Type.Literal('email'),
  Type.Literal('phone'),
]);

const profileContactSchema = Type.Object({
  phoneNumber: Type.Union([Type.String(), Type.Null()]),
  phoneVerificationStatus: Type.Union([
    Type.Literal('unverified'),
    Type.Literal('verified'),
    Type.Null(),
  ]),
  recoveryContactPreference: Type.Union([recoveryContactPreferenceSchema, Type.Null()]),
  supportRecoveryStatus: Type.Union([
    Type.Literal('submitted'),
    Type.Literal('in_progress'),
    Type.Literal('resolved'),
    Type.Null(),
  ]),
});

const profileContactResponseSchema = Type.Object({
  data: profileContactSchema,
  ok: Type.Literal(true),
});

const updateProfileContactBodySchema = Type.Object({
  phoneNumber: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  recoveryContactPreference: Type.Optional(
    Type.Union([recoveryContactPreferenceSchema, Type.Null()]),
  ),
});

const supportRequestCategorySchema = Type.Union([
  Type.Literal('account_recovery'),
  Type.Literal('payment_problem'),
  Type.Literal('tenant_nonpayment'),
  Type.Literal('bug_or_outage'),
  Type.Literal('general_help'),
]);

const supportRequestStatusSchema = Type.Union([
  Type.Literal('submitted'),
  Type.Literal('in_progress'),
  Type.Literal('resolved'),
]);

const supportRequestSchema = Type.Object({
  agencyId: Type.Union([Type.String(), Type.Null()]),
  category: supportRequestCategorySchema,
  contactEmail: Type.String(),
  createdAt: Type.String(),
  description: Type.String(),
  id: Type.String(),
  paymentId: Type.Union([Type.String(), Type.Null()]),
  phoneNumber: Type.Union([Type.String(), Type.Null()]),
  recoveryContactPreference: Type.Union([recoveryContactPreferenceSchema, Type.Null()]),
  requestorDisplayName: Type.String(),
  requestorRole: Type.Union([roleSchema, Type.Literal('guest')]),
  resolutionNote: Type.Union([Type.String(), Type.Null()]),
  resolvedAt: Type.Union([Type.String(), Type.Null()]),
  status: supportRequestStatusSchema,
  subject: Type.String(),
  updatedAt: Type.String(),
  userId: Type.Union([Type.String(), Type.Null()]),
});

const supportRequestResponseSchema = Type.Object({
  data: supportRequestSchema,
  ok: Type.Literal(true),
});

const supportRequestsResponseSchema = Type.Object({
  data: Type.Array(supportRequestSchema),
  ok: Type.Literal(true),
});

const createSupportRequestBodySchema = Type.Object({
  category: supportRequestCategorySchema,
  description: Type.String({ minLength: 1, maxLength: 2000 }),
  paymentId: Type.Optional(Type.String({ minLength: 1 })),
  phoneNumber: Type.Optional(Type.Union([Type.String({ minLength: 1, maxLength: 40 }), Type.Null()])),
  recoveryContactPreference: Type.Optional(
    Type.Union([recoveryContactPreferenceSchema, Type.Null()]),
  ),
  subject: Type.String({ minLength: 1, maxLength: 160 }),
});

const createRecoverySupportRequestBodySchema = Type.Object({
  description: Type.String({ minLength: 1, maxLength: 2000 }),
  email: Type.String({ format: 'email' }),
  locale: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  phoneNumber: Type.Optional(Type.Union([Type.String({ minLength: 1, maxLength: 40 }), Type.Null()])),
  recoveryContactPreference: Type.Optional(
    Type.Union([recoveryContactPreferenceSchema, Type.Null()]),
  ),
  subject: Type.String({ minLength: 1, maxLength: 160 }),
});

const updateSupportRequestParamsSchema = Type.Object({
  requestId: Type.String({ minLength: 1 }),
});

const updateSupportRequestBodySchema = Type.Object({
  resolutionNote: Type.Optional(Type.Union([Type.String({ maxLength: 2000 }), Type.Null()])),
  status: Type.Union([Type.Literal('in_progress'), Type.Literal('resolved')]),
});

const redeemOwnerAccessBodySchema = Type.Object({
  inviteCode: Type.String({ minLength: 1 }),
});

const redeemOwnerAccessResponseSchema = Type.Object({
  data: Type.Object({
    agencyId: Type.Union([Type.String(), Type.Null()]),
    ownerId: Type.String(),
    uid: Type.String(),
  }),
  ok: Type.Literal(true),
});

const redeemInviteBodySchema = Type.Object({
  inviteCode: Type.String({ minLength: 1 }),
});

const redeemInviteResponseSchema = Type.Object({
  data: Type.Object({
    ownerId: Type.String(),
    paymentId: Type.String(),
    propertyId: Type.String(),
    tenantId: Type.String(),
    unitId: Type.String(),
  }),
  ok: Type.Literal(true),
});

const receiptSchema = Type.Object({
  agencyFeeAmount: Type.Number(),
  agencyDisplayName: Type.String(),
  agencyId: Type.Union([Type.String(), Type.Null()]),
  grossAmount: Type.Number(),
  id: Type.String(),
  issuedAt: Type.String(),
  issuedBy: Type.Literal('backend'),
  issuanceSource: Type.Literal('simulate-complete'),
  ownerDisplayName: Type.String(),
  ownerEmail: Type.String(),
  ownerId: Type.String(),
  ownerNetAmount: Type.Number(),
  paidAt: Type.String(),
  paymentId: Type.String(),
  paymentMethod: Type.String(),
  paymentStatus: paymentStatusSchema,
  propertyId: Type.String(),
  propertyLabel: Type.String(),
  qrVerificationToken: Type.String(),
  receiptNumber: Type.String(),
  simulated: Type.Boolean(),
  tenantDisplayName: Type.String(),
  tenantEmail: Type.String(),
  tenantId: Type.String(),
  unitId: Type.String(),
  unitLabel: Type.String(),
  verificationUrl: Type.String(),
});

const completeSimulatedPaymentParamsSchema = Type.Object({
  paymentId: Type.String({ minLength: 1 }),
});

const completeSimulatedPaymentBodySchema = Type.Object({
  paymentMethod: Type.String({ minLength: 1, maxLength: 40 }),
});

const completeSimulatedPaymentResponseSchema = Type.Object({
  data: Type.Object({
    payment: Type.Object({
      agencyFeeAmount: Type.Number(),
      agencyId: Type.Union([Type.String(), Type.Null()]),
      commissionRate: Type.Number(),
      createdAt: Type.String(),
      dueDate: Type.String(),
      grossAmount: Type.Number(),
      id: Type.String(),
      monthKey: Type.String(),
      ownerId: Type.String(),
      ownerNetAmount: Type.Number(),
      paidAt: Type.Union([Type.String(), Type.Null()]),
      paymentMethod: Type.Union([Type.String(), Type.Null()]),
      paymentStatus: paymentStatusSchema,
      propertyId: Type.String(),
      providerReference: Type.Union([Type.String(), Type.Null()]),
      receiptId: Type.Union([Type.String(), Type.Null()]),
      tenantId: Type.String(),
      unitId: Type.String(),
      updatedAt: Type.String(),
    }),
    receipt: receiptSchema,
  }),
  ok: Type.Literal(true),
});

const receiptParamsSchema = Type.Object({
  receiptId: Type.String({ minLength: 1 }),
});

const receiptResponseSchema = Type.Object({
  data: receiptSchema,
  ok: Type.Literal(true),
});

const verifyReceiptParamsSchema = Type.Object({
  token: Type.String({ minLength: 1 }),
});

const verifyReceiptResponseSchema = Type.Object({
  data: Type.Object({
    receipt: Type.Union([receiptSchema, Type.Null()]),
    valid: Type.Boolean(),
  }),
  ok: Type.Literal(true),
});

const protectedErrorResponses = {
  400: errorResponseSchema,
  401: errorResponseSchema,
  403: errorResponseSchema,
  404: errorResponseSchema,
  409: errorResponseSchema,
  500: errorResponseSchema,
};

export const v1Routes: FastifyPluginAsyncTypebox = async (app) => {
  app.get(
    '/v1/legal/terms',
    {
      schema: {
        response: {
          200: legalTermsResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async () => ({
      data: await app.services.getCurrentTerms(),
      ok: true as const,
    }),
  );

  app.post(
    '/v1/profile/bootstrap',
    {
      preHandler: app.authenticate,
      schema: {
        body: bootstrapBodySchema,
        response: {
          200: bootstrapResponseSchema,
          ...protectedErrorResponses,
        },
      },
    },
    async (request) => ({
      data: await app.services.bootstrapProfile(request.auth!, request.body),
      ok: true as const,
    }),
  );

  app.get(
    '/v1/legal/terms/status',
    {
      preHandler: app.authenticate,
      schema: {
        response: {
          200: termsStatusResponseSchema,
          ...protectedErrorResponses,
        },
      },
    },
    async (request) => ({
      data: await app.services.getTermsStatus(request.auth!),
      ok: true as const,
    }),
  );

  app.post(
    '/v1/legal/terms/accept',
    {
      preHandler: app.authenticate,
      schema: {
        body: acceptTermsBodySchema,
        response: {
          200: termsStatusResponseSchema,
          ...protectedErrorResponses,
        },
      },
    },
    async (request) => ({
      data: await app.services.acceptTerms(request.auth!, request.body),
      ok: true as const,
    }),
  );

  app.get(
    '/v1/profile/contact',
    {
      preHandler: app.authenticate,
      schema: {
        response: {
          200: profileContactResponseSchema,
          ...protectedErrorResponses,
        },
      },
    },
    async (request) => ({
      data: await app.services.getProfileContact(request.auth!),
      ok: true as const,
    }),
  );

  app.patch(
    '/v1/profile/contact',
    {
      preHandler: app.authenticate,
      schema: {
        body: updateProfileContactBodySchema,
        response: {
          200: profileContactResponseSchema,
          ...protectedErrorResponses,
        },
      },
    },
    async (request) => ({
      data: await app.services.updateProfileContact(request.auth!, request.body),
      ok: true as const,
    }),
  );

  app.get(
    '/v1/support/requests',
    {
      preHandler: app.authenticate,
      schema: {
        response: {
          200: supportRequestsResponseSchema,
          ...protectedErrorResponses,
        },
      },
    },
    async (request) => ({
      data: await app.services.listSupportRequests(request.auth!),
      ok: true as const,
    }),
  );

  app.post(
    '/v1/support/requests',
    {
      preHandler: app.authenticate,
      schema: {
        body: createSupportRequestBodySchema,
        response: {
          201: supportRequestResponseSchema,
          ...protectedErrorResponses,
        },
      },
    },
    async (request, reply) =>
      reply.status(201).send({
        data: await app.services.createSupportRequest(request.auth!, request.body),
        ok: true as const,
      }),
  );

  app.post(
    '/v1/support/recovery-request',
    {
      schema: {
        body: createRecoverySupportRequestBodySchema,
        response: {
          201: supportRequestResponseSchema,
          400: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (request, reply) =>
      reply.status(201).send({
        data: await app.services.createRecoverySupportRequest(request.body),
        ok: true as const,
      }),
  );

  app.patch(
    '/v1/support/requests/:requestId',
    {
      preHandler: app.authenticate,
      schema: {
        body: updateSupportRequestBodySchema,
        params: updateSupportRequestParamsSchema,
        response: {
          200: supportRequestResponseSchema,
          ...protectedErrorResponses,
        },
      },
    },
    async (request) => ({
      data: await app.services.updateSupportRequest(
        request.auth!,
        request.params.requestId,
        request.body,
      ),
      ok: true as const,
    }),
  );

  app.get(
    '/v1/notifications',
    {
      preHandler: app.authenticate,
      schema: {
        response: {
          200: notificationsResponseSchema,
          ...protectedErrorResponses,
        },
      },
    },
    async (request) => ({
      data: await app.services.listNotifications(request.auth!),
      ok: true as const,
    }),
  );

  app.post(
    '/v1/notifications/:notificationId/read',
    {
      preHandler: app.authenticate,
      schema: {
        params: notificationParamsSchema,
        response: {
          200: notificationResponseSchema,
          ...protectedErrorResponses,
        },
      },
    },
    async (request) => ({
      data: await app.services.markNotificationRead(
        request.auth!,
        request.params.notificationId,
      ),
      ok: true as const,
    }),
  );

  app.get(
    '/v1/agency/owner-access-invites',
    {
      preHandler: app.authenticate,
      schema: {
        response: {
          200: listOwnerAccessInvitesResponseSchema,
          ...protectedErrorResponses,
        },
      },
    },
    async (request) => ({
      data: await app.services.listOwnerAccessInvites(request.auth!),
      ok: true as const,
    }),
  );

  app.post(
    '/v1/agency/owner-access-invites',
    {
      preHandler: app.authenticate,
      schema: {
        body: createOwnerAccessInviteBodySchema,
        response: {
          201: createOwnerAccessInviteResponseSchema,
          ...protectedErrorResponses,
        },
      },
    },
    async (request, reply) =>
      reply.status(201).send({
        data: await app.services.createOwnerAccessInvite(request.auth!, request.body),
        ok: true as const,
      }),
  );

  app.post(
    '/v1/agency/owner-access-invites/:inviteId/revoke',
    {
      preHandler: app.authenticate,
      schema: {
        params: revokeOwnerAccessInviteParamsSchema,
        response: {
          200: createOwnerAccessInviteResponseSchema,
          ...protectedErrorResponses,
        },
      },
    },
    async (request) => ({
      data: await app.services.revokeOwnerAccessInvite(request.auth!, request.params),
      ok: true as const,
    }),
  );

  app.get(
    '/v1/agency/dashboard',
    {
      preHandler: app.authenticate,
      schema: {
        querystring: dashboardQuerySchema,
        response: {
          200: agencyDashboardResponseSchema,
          ...protectedErrorResponses,
        },
      },
    },
    async (request) => ({
      data: await app.services.getAgencyDashboard(request.auth!, request.query.period),
      ok: true as const,
    }),
  );

  app.get(
    '/v1/owner/dashboard',
    {
      preHandler: app.authenticate,
      schema: {
        querystring: dashboardQuerySchema,
        response: {
          200: ownerDashboardResponseSchema,
          ...protectedErrorResponses,
        },
      },
    },
    async (request) => ({
      data: await app.services.getOwnerDashboard(request.auth!, request.query.period),
      ok: true as const,
    }),
  );

  app.get(
    '/v1/agency/owners',
    {
      preHandler: app.authenticate,
      schema: {
        response: {
          200: agencyOwnersResponseSchema,
          ...protectedErrorResponses,
        },
      },
    },
    async (request) => ({
      data: await app.services.listAgencyOwners(request.auth!),
      ok: true as const,
    }),
  );

  app.get(
    '/v1/agency/users',
    {
      preHandler: app.authenticate,
      schema: {
        response: {
          200: agencyUsersResponseSchema,
          ...protectedErrorResponses,
        },
      },
    },
    async (request) => ({
      data: await app.services.listAgencyUsers(request.auth!),
      ok: true as const,
    }),
  );

  app.patch(
    '/v1/agency/users/:uid/status',
    {
      preHandler: app.authenticate,
      schema: {
        body: updateAgencyUserStatusBodySchema,
        params: updateAgencyUserStatusParamsSchema,
        response: {
          200: Type.Object({
            data: agencyUserSchema,
            ok: Type.Literal(true),
          }),
          ...protectedErrorResponses,
        },
      },
    },
    async (request) => ({
      data: await app.services.updateAgencyUserStatus(
        request.auth!,
        request.params.uid,
        request.body,
      ),
      ok: true as const,
    }),
  );

  app.get(
    '/v1/agency/audit-logs',
    {
      preHandler: app.authenticate,
      schema: {
        response: {
          200: auditLogsResponseSchema,
          ...protectedErrorResponses,
        },
      },
    },
    async (request) => ({
      data: await app.services.listAgencyAuditLogs(request.auth!),
      ok: true as const,
    }),
  );

  app.get(
    '/v1/agency/settings',
    {
      preHandler: app.authenticate,
      schema: {
        response: {
          200: agencySettingsResponseSchema,
          ...protectedErrorResponses,
        },
      },
    },
    async (request) => ({
      data: await app.services.getAgencySettings(request.auth!),
      ok: true as const,
    }),
  );

  app.patch(
    '/v1/agency/settings',
    {
      preHandler: app.authenticate,
      schema: {
        body: updateAgencySettingsBodySchema,
        response: {
          200: agencySettingsResponseSchema,
          ...protectedErrorResponses,
        },
      },
    },
    async (request) => ({
      data: await app.services.updateAgencySettings(request.auth!, request.body),
      ok: true as const,
    }),
  );

  app.post(
    '/v1/owner/properties',
    {
      preHandler: app.authenticate,
      schema: {
        body: createPropertyBodySchema,
        response: {
          201: createPropertyResponseSchema,
          ...protectedErrorResponses,
        },
      },
    },
    async (request, reply) =>
      reply.status(201).send({
        data: await app.services.createOwnerProperty(request.auth!, request.body),
        ok: true as const,
      }),
  );

  app.post(
    '/v1/owner/units',
    {
      preHandler: app.authenticate,
      schema: {
        body: createUnitBodySchema,
        response: {
          201: createUnitResponseSchema,
          ...protectedErrorResponses,
        },
      },
    },
    async (request, reply) =>
      reply.status(201).send({
        data: await app.services.createOwnerUnit(request.auth!, request.body),
        ok: true as const,
      }),
  );

  app.post(
    '/v1/invites',
    {
      preHandler: app.authenticate,
      schema: {
        body: createInviteBodySchema,
        response: {
          201: createInviteResponseSchema,
          ...protectedErrorResponses,
        },
      },
    },
    async (request, reply) =>
      reply.status(201).send({
        data: await app.services.createInvite(request.auth!, request.body),
        ok: true as const,
      }),
  );

  app.post(
    '/v1/owner-access/redeem',
    {
      preHandler: app.authenticate,
      schema: {
        body: redeemOwnerAccessBodySchema,
        response: {
          200: redeemOwnerAccessResponseSchema,
          ...protectedErrorResponses,
        },
      },
    },
    async (request) => ({
      data: await app.services.redeemOwnerAccess(request.auth!, request.body),
      ok: true as const,
    }),
  );

  app.post(
    '/v1/invites/redeem',
    {
      preHandler: app.authenticate,
      schema: {
        body: redeemInviteBodySchema,
        response: {
          200: redeemInviteResponseSchema,
          ...protectedErrorResponses,
        },
      },
    },
    async (request) => ({
      data: await app.services.redeemInvite(request.auth!, request.body),
      ok: true as const,
    }),
  );

  app.post(
    '/v1/payments/:paymentId/simulate-complete',
    {
      preHandler: app.authenticate,
      schema: {
        body: completeSimulatedPaymentBodySchema,
        params: completeSimulatedPaymentParamsSchema,
        response: {
          200: completeSimulatedPaymentResponseSchema,
          ...protectedErrorResponses,
        },
      },
    },
    async (request) => ({
      data: await app.services.completeSimulatedPayment(request.auth!, {
        paymentId: request.params.paymentId,
        paymentMethod: request.body.paymentMethod,
      }),
      ok: true as const,
    }),
  );

  app.get(
    '/v1/receipts/:receiptId',
    {
      preHandler: app.authenticate,
      schema: {
        params: receiptParamsSchema,
        response: {
          200: receiptResponseSchema,
          ...protectedErrorResponses,
        },
      },
    },
    async (request) => ({
      data: await app.services.getReceipt(request.auth!, request.params.receiptId),
      ok: true as const,
    }),
  );

  app.get(
    '/v1/receipts/verify/:token',
    {
      schema: {
        params: verifyReceiptParamsSchema,
        response: {
          200: verifyReceiptResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (request) => ({
      data: await app.services.verifyReceipt(request.params.token),
      ok: true as const,
    }),
  );
};
