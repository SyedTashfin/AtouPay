import { Readable } from 'node:stream';

import Fastify from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import type { FastifyBaseLogger } from 'fastify';

import { loadConfig, type AppConfig } from './config/env.js';
import { AuthContext } from './domain/types.js';
import { AppError, isAppError } from './lib/errors.js';
import { createAuthVerifier, createFirestore, initializeFirebaseAdmin, type AuthVerifier } from './lib/firebase-admin.js';
import { createFirestoreRepository } from './repositories/firestore.js';
import type { DataRepository } from './repositories/types.js';
import { healthRoutes } from './routes/health.js';
import { v1Routes } from './routes/v1.js';
import { BackendService } from './services/backend-service.js';
import { createInviteEmailService } from './services/email-service.js';
import { ownerBillingRoutes } from './billing/ownerBillingRoutes.js';
import { paymentRoutes } from './payments/paymentRoutes.js';

export interface BuildAppOptions {
  authVerifier?: AuthVerifier;
  config?: AppConfig;
  logger?: boolean | FastifyBaseLogger;
  repository?: DataRepository;
  services?: BackendService;
}

function parseBearerToken(header?: string) {
  if (!header) {
    return null;
  }

  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return null;
  }

  return token;
}

export async function buildApp(options: BuildAppOptions = {}) {
  const config = options.config ?? loadConfig();
  const app = Fastify({
    logger:
      options.logger ??
      {
        level: config.logLevel,
      },
  }).withTypeProvider<TypeBoxTypeProvider>();

  const repository =
    options.repository ??
    createFirestoreRepository(createFirestore(initializeFirebaseAdmin(config)));
  const authVerifier =
    options.authVerifier ??
    createAuthVerifier(initializeFirebaseAdmin(config));
  const services =
    options.services ??
    new BackendService({
      config,
      emailService: createInviteEmailService(config, app.log),
      repository,
    });

  app.decorate('config', config);
  app.decorate('services', services);
  app.decorateRequest('auth', null);
  app.decorateRequest('rawBody', undefined);
  app.addHook('preParsing', async (request, _reply, payload) => {
    if (request.method !== 'POST' || request.url.split('?')[0] !== '/v1/webhooks/moosyl') {
      return payload;
    }

    const chunks: Buffer[] = [];

    for await (const chunk of payload) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    const rawBody = Buffer.concat(chunks);
    request.rawBody = rawBody;

    return Readable.from(rawBody);
  });
  app.decorate('authenticate', async function authenticate(request) {
    const token = parseBearerToken(request.headers.authorization);

    if (!token) {
      throw new AppError(401, 'auth_required', 'Un jeton Firebase est requis pour cette route.');
    }

    try {
      const identity = await authVerifier.verifyBearerToken(token);
      request.auth = identity as AuthContext;
    } catch (error) {
      request.log.warn(
        {
          err: error,
        },
        'firebase-auth-verification-failed',
      );
      throw new AppError(401, 'invalid_token', 'Le jeton Firebase fourni est invalide ou expiré.');
    }
  });

  app.setErrorHandler((error, request, reply) => {
    if (isAppError(error)) {
      request.log.info(
        {
          code: error.code,
          message: error.message,
          statusCode: error.statusCode,
        },
        'app-error',
      );
      return reply.status(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
        },
        ok: false,
      });
    }

    if (typeof error === 'object' && error !== null && 'validation' in error) {
      request.log.info(
        {
          err: error,
        },
        'request-validation-failed',
      );
      return reply.status(400).send({
        error: {
          code: 'invalid_request',
          message: 'La requête ne respecte pas le schéma attendu.',
        },
        ok: false,
      });
    }

    if (
      typeof error === 'object' &&
      error !== null &&
      'statusCode' in error &&
      typeof error.statusCode === 'number' &&
      error.statusCode >= 400 &&
      error.statusCode < 500
    ) {
      request.log.info(
        {
          err: error,
          statusCode: error.statusCode,
        },
        'request-parse-failed',
      );
      return reply.status(error.statusCode).send({
        error: {
          code: 'invalid_request',
          message: 'La requête ne respecte pas le format attendu.',
        },
        ok: false,
      });
    }

    request.log.error(
      {
        err: error,
      },
      'unhandled-error',
    );
    return reply.status(500).send({
      error: {
        code: 'internal_error',
        message: 'Une erreur interne est survenue.',
      },
      ok: false,
    });
  });

  app.setNotFoundHandler((request, reply) =>
    reply.status(404).send({
      error: {
        code: 'not_found',
        message: `Aucune route ne correspond à ${request.method} ${request.url}.`,
      },
      ok: false,
    }),
  );

  await app.register(healthRoutes);
  await app.register(v1Routes);
  await app.register(ownerBillingRoutes);
  await app.register(paymentRoutes);

  return app;
}
