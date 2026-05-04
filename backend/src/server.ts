import 'dotenv/config';

import { buildApp } from './app.js';

const app = await buildApp();

try {
  app.log.info(
    {
      authEmulator: app.config.firebaseAuthEmulatorHost ?? null,
      credentialStrategy: app.config.credentialStrategy,
      emailEnabled: app.config.isEmailEnabled,
      firestoreEmulator: app.config.firestoreEmulatorHost ?? null,
      port: app.config.port,
      runtimeMode: app.config.runtimeMode,
    },
    'backend-runtime-config',
  );
  await app.listen({
    host: app.config.host,
    port: app.config.port,
  });
} catch (error) {
  app.log.error(
    {
      err: error,
    },
    'server-start-failed',
  );
  process.exit(1);
}
