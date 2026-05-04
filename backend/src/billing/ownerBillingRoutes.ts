import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';

const errorResponseSchema = Type.Object({
  error: Type.Object({
    code: Type.String(),
    message: Type.String(),
  }),
  ok: Type.Literal(false),
});

const protectedErrorResponses = {
  400: errorResponseSchema,
  401: errorResponseSchema,
  402: errorResponseSchema,
  403: errorResponseSchema,
  404: errorResponseSchema,
  409: errorResponseSchema,
  500: errorResponseSchema,
};

const ownerBillingStatusSchema = Type.Union([
  Type.Literal('active'),
  Type.Literal('grace_period'),
  Type.Literal('past_due'),
  Type.Literal('suspended'),
]);

const ownerBillingInvoiceStatusSchema = Type.Union([
  Type.Literal('open'),
  Type.Literal('paid'),
  Type.Literal('overdue'),
  Type.Literal('void'),
]);

const ownerBillingPaymentProviderSchema = Type.Union([
  Type.Literal('simulated'),
  Type.Literal('manual'),
  Type.Literal('moosyl'),
  Type.Literal('stripe'),
]);

const ownerBillingAccountSchema = Type.Object({
  agencyId: Type.String(),
  createdAt: Type.String(),
  currentPeriodEnd: Type.String(),
  currentPeriodStart: Type.String(),
  feeAmount: Type.Number(),
  feeCurrency: Type.Literal('EUR'),
  gracePeriodEndsAt: Type.Optional(Type.String()),
  intervalDays: Type.Number(),
  lastPaidAt: Type.Optional(Type.String()),
  nextPaymentDueAt: Type.String(),
  ownerId: Type.String(),
  status: ownerBillingStatusSchema,
  updatedAt: Type.String(),
});

const ownerBillingInvoiceSchema = Type.Object({
  agencyId: Type.String(),
  amount: Type.Number(),
  createdAt: Type.String(),
  currency: Type.Literal('EUR'),
  dueAt: Type.String(),
  invoiceId: Type.String(),
  label: Type.Literal('owner_account_access'),
  note: Type.Optional(Type.String()),
  ownerId: Type.String(),
  paidAt: Type.Optional(Type.String()),
  periodEnd: Type.String(),
  periodStart: Type.String(),
  provider: ownerBillingPaymentProviderSchema,
  providerReference: Type.Optional(Type.String()),
  status: ownerBillingInvoiceStatusSchema,
  updatedAt: Type.String(),
});

const ownerBillingSummarySchema = Type.Object({
  account: ownerBillingAccountSchema,
  activeUntil: Type.String(),
  canCreateInvites: Type.Boolean(),
  canManageProperties: Type.Boolean(),
  feeAmount: Type.Number(),
  feeCurrency: Type.Literal('EUR'),
  intervalDays: Type.Number(),
  latestInvoice: Type.Union([ownerBillingInvoiceSchema, Type.Null()]),
  nextPaymentDueAt: Type.String(),
  statusMessage: Type.String(),
});

const ownerBillingSummaryResponseSchema = Type.Object({
  data: ownerBillingSummarySchema,
  ok: Type.Literal(true),
});

const agencyOwnerBillingSummarySchema = Type.Object({
  account: ownerBillingAccountSchema,
  activeUntil: Type.String(),
  canCreateInvites: Type.Boolean(),
  canManageProperties: Type.Boolean(),
  latestInvoice: Type.Union([ownerBillingInvoiceSchema, Type.Null()]),
  nextPaymentDueAt: Type.String(),
  owner: Type.Object({
    displayName: Type.String(),
    email: Type.String(),
    ownerId: Type.String(),
    status: Type.Union([
      Type.Literal('active'),
      Type.Literal('pending_owner_access'),
      Type.Literal('suspended'),
    ]),
    uid: Type.String(),
  }),
  statusMessage: Type.String(),
});

const agencyOwnerBillingListResponseSchema = Type.Object({
  data: Type.Array(agencyOwnerBillingSummarySchema),
  ok: Type.Literal(true),
});

const agencyOwnerBillingParamsSchema = Type.Object({
  ownerId: Type.String({ minLength: 1 }),
});

const markPaidBodySchema = Type.Object({
  note: Type.String({ minLength: 1, maxLength: 500 }),
  provider: Type.Optional(Type.Union([Type.Literal('manual'), Type.Literal('simulated')])),
  providerReference: Type.Optional(Type.String({ maxLength: 120 })),
});

const suspendBodySchema = Type.Object({
  reason: Type.String({ minLength: 1, maxLength: 500 }),
});

export const ownerBillingRoutes: FastifyPluginAsyncTypebox = async (app) => {
  app.get(
    '/v1/owner/billing',
    {
      preHandler: app.authenticate,
      schema: {
        response: {
          200: ownerBillingSummaryResponseSchema,
          ...protectedErrorResponses,
        },
      },
    },
    async (request) => ({
      data: await app.services.getOwnerBilling(request.auth!),
      ok: true as const,
    }),
  );

  app.post(
    '/v1/owner/billing/pay-simulated',
    {
      preHandler: app.authenticate,
      schema: {
        response: {
          200: ownerBillingSummaryResponseSchema,
          ...protectedErrorResponses,
        },
      },
    },
    async (request) => ({
      data: await app.services.payOwnerBillingSimulated(request.auth!),
      ok: true as const,
    }),
  );

  app.get(
    '/v1/agency/owners/billing',
    {
      preHandler: app.authenticate,
      schema: {
        response: {
          200: agencyOwnerBillingListResponseSchema,
          ...protectedErrorResponses,
        },
      },
    },
    async (request) => ({
      data: await app.services.listAgencyOwnersBilling(request.auth!),
      ok: true as const,
    }),
  );

  app.post(
    '/v1/agency/owners/:ownerId/billing/mark-paid',
    {
      preHandler: app.authenticate,
      schema: {
        body: markPaidBodySchema,
        params: agencyOwnerBillingParamsSchema,
        response: {
          200: ownerBillingSummaryResponseSchema,
          ...protectedErrorResponses,
        },
      },
    },
    async (request) => ({
      data: await app.services.markAgencyOwnerBillingPaid(
        request.auth!,
        request.params.ownerId,
        request.body,
      ),
      ok: true as const,
    }),
  );

  app.post(
    '/v1/agency/owners/:ownerId/billing/suspend',
    {
      preHandler: app.authenticate,
      schema: {
        body: suspendBodySchema,
        params: agencyOwnerBillingParamsSchema,
        response: {
          200: ownerBillingSummaryResponseSchema,
          ...protectedErrorResponses,
        },
      },
    },
    async (request) => ({
      data: await app.services.suspendAgencyOwnerBilling(
        request.auth!,
        request.params.ownerId,
        request.body,
      ),
      ok: true as const,
    }),
  );

  app.post(
    '/v1/agency/owners/:ownerId/billing/reactivate',
    {
      preHandler: app.authenticate,
      schema: {
        params: agencyOwnerBillingParamsSchema,
        response: {
          200: ownerBillingSummaryResponseSchema,
          ...protectedErrorResponses,
        },
      },
    },
    async (request) => ({
      data: await app.services.reactivateAgencyOwnerBilling(
        request.auth!,
        request.params.ownerId,
      ),
      ok: true as const,
    }),
  );
};
