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

const providerSchema = Type.Union([Type.Literal('simulated'), Type.Literal('moosyl')]);

const providerStatusSchema = Type.Union([
  Type.Literal('requires_payment'),
  Type.Literal('processing'),
  Type.Literal('paid'),
  Type.Literal('failed'),
  Type.Literal('cancelled'),
  Type.Literal('disputed'),
  Type.Literal('refunded'),
]);

const paymentParamsSchema = Type.Object({
  paymentId: Type.String({ minLength: 1 }),
});

const paymentIntentResponseSchema = Type.Object({
  data: Type.Object({
    amount: Type.Number(),
    checkoutUrl: Type.Optional(Type.String()),
    currency: Type.Literal('MRU'),
    intentId: Type.String(),
    paymentId: Type.String(),
    provider: providerSchema,
    publishableKey: Type.Optional(Type.String()),
    status: providerStatusSchema,
    transactionId: Type.Optional(Type.String()),
  }),
  ok: Type.Literal(true),
});

const paymentStatusResponseSchema = Type.Object({
  data: Type.Object({
    amount: Type.Number(),
    currency: Type.Literal('MRU'),
    intentId: Type.Union([Type.String(), Type.Null()]),
    paymentId: Type.String(),
    paymentStatus: Type.String(),
    provider: Type.Union([providerSchema, Type.Null()]),
    providerReference: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    providerStatus: Type.Union([providerStatusSchema, Type.Null()]),
    receiptId: Type.Union([Type.String(), Type.Null()]),
  }),
  ok: Type.Literal(true),
});

const webhookResponseSchema = Type.Object({
  ignored: Type.Boolean(),
  ok: Type.Literal(true),
  processed: Type.Boolean(),
  receiptId: Type.Optional(Type.Union([Type.String(), Type.Null()])),
});

function firstHeader(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export const paymentRoutes: FastifyPluginAsyncTypebox = async (app) => {
  app.post(
    '/v1/payments/:paymentId/intent',
    {
      preHandler: app.authenticate,
      schema: {
        params: paymentParamsSchema,
        response: {
          200: paymentIntentResponseSchema,
          ...protectedErrorResponses,
        },
      },
    },
    async (request) => ({
      data: await app.services.createRentPaymentIntent(request.auth!, request.params.paymentId),
      ok: true as const,
    }),
  );

  app.get(
    '/v1/payments/:paymentId/status',
    {
      preHandler: app.authenticate,
      schema: {
        params: paymentParamsSchema,
        response: {
          200: paymentStatusResponseSchema,
          ...protectedErrorResponses,
        },
      },
    },
    async (request) => ({
      data: await app.services.getRentPaymentStatus(request.auth!, request.params.paymentId),
      ok: true as const,
    }),
  );

  app.post(
    '/v1/payments/:paymentId/cancel',
    {
      preHandler: app.authenticate,
      schema: {
        params: paymentParamsSchema,
        response: {
          200: paymentStatusResponseSchema,
          ...protectedErrorResponses,
        },
      },
    },
    async (request) => ({
      data: await app.services.cancelRentPaymentIntent(request.auth!, request.params.paymentId),
      ok: true as const,
    }),
  );

  app.post(
    '/v1/webhooks/moosyl',
    {
      schema: {
        body: Type.Any(),
        response: {
          200: webhookResponseSchema,
          ...protectedErrorResponses,
        },
      },
    },
    async (request) => {
      const eventType = firstHeader(request.headers['x-webhook-event']);
      const signature = firstHeader(request.headers['x-webhook-signature']);
      const rawBody =
        request.rawBody ??
        Buffer.from(JSON.stringify(request.body ?? {}), 'utf8');
      return {
        ...(await app.services.handleMoosylWebhook({
          payload: request.body,
          rawBody,
          ...(eventType ? { eventType } : {}),
          ...(signature ? { signature } : {}),
        })),
        ok: true as const,
      };
    },
  );
};
