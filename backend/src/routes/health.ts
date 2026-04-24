import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';

const healthResponseSchema = Type.Object({
  ok: Type.Literal(true),
  service: Type.String(),
  status: Type.Literal('healthy'),
});

export const healthRoutes: FastifyPluginAsyncTypebox = async (app) => {
  app.get(
    '/health',
    {
      schema: {
        response: {
          200: healthResponseSchema,
        },
      },
    },
    async () => ({
      ok: true as const,
      service: '@atoupay/backend',
      status: 'healthy' as const,
    }),
  );
};
