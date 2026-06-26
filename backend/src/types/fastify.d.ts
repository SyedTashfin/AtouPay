import 'fastify';

import type { AppConfig } from '../config/env.js';
import type { AuthContext } from '../domain/types.js';
import type { BackendService } from '../services/backend-service.js';

declare module 'fastify' {
  interface FastifyRequest {
    auth: AuthContext | null;
    rawBody?: Buffer;
  }

  interface FastifyInstance {
    config: AppConfig;
    services: BackendService;
    authenticate: (request: FastifyRequest) => Promise<void>;
  }
}
