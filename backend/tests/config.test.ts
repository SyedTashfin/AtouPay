import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { loadConfig } from '../src/config/env.js';

function createCredentialsFile() {
  const directory = mkdtempSync(path.join(tmpdir(), 'atoupay-backend-'));
  const file = path.join(directory, 'service-account.json');
  writeFileSync(file, '{}', 'utf8');

  return file;
}

test('loadConfig resolves full-local-emulator mode without credentials', () => {
  const config = loadConfig({
    FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
    FIREBASE_PROJECT_ID: 'atoupay-dev',
    FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
    PORT: '3001',
  });

  assert.equal(config.runtimeMode, 'full-local-emulator');
  assert.equal(config.credentialStrategy, 'none-required');
  assert.equal(config.port, 3001);
});

test('loadConfig resolves hybrid-local mode with absolute GOOGLE_APPLICATION_CREDENTIALS', () => {
  const credentialsPath = createCredentialsFile();
  const config = loadConfig({
    FIREBASE_PROJECT_ID: 'atoupay-dev',
    FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
    GOOGLE_APPLICATION_CREDENTIALS: credentialsPath,
    PORT: '3001',
  });

  assert.equal(config.runtimeMode, 'hybrid-local');
  assert.equal(config.credentialStrategy, 'google-application-credentials');
  assert.equal(config.googleApplicationCredentials, credentialsPath);
});

test('loadConfig resolves cloud-run mode with application default credentials strategy', () => {
  const config = loadConfig({
    FIREBASE_PROJECT_ID: 'atoupay-prod',
    PORT: '3001',
  });

  assert.equal(config.runtimeMode, 'cloud-run');
  assert.equal(config.credentialStrategy, 'application-default');
  assert.equal(config.isEmailEnabled, false);
});

test('loadConfig enables Resend invite email delivery when configured', () => {
  const config = loadConfig({
    EMAIL_FROM: 'ATouPay <invites@example.com>',
    EMAIL_REPLY_TO: 'support@example.com',
    FIREBASE_PROJECT_ID: 'atoupay-prod',
    PORT: '3001',
    RESEND_API_KEY: 're_test_key',
  });

  assert.equal(config.isEmailEnabled, true);
  assert.equal(config.emailFrom, 'ATouPay <invites@example.com>');
  assert.equal(config.emailReplyTo, 'support@example.com');
  assert.equal(config.resendApiKey, 're_test_key');
});

test('loadConfig rejects emulator hosts with protocols', () => {
  assert.throws(
    () =>
      loadConfig({
        FIREBASE_PROJECT_ID: 'atoupay-dev',
        FIRESTORE_EMULATOR_HOST: 'http://127.0.0.1:8080',
      }),
    /host:port only/,
  );
});

test('loadConfig rejects port collisions with emulator ports', () => {
  assert.throws(
    () =>
      loadConfig({
        FIREBASE_PROJECT_ID: 'atoupay-dev',
        FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
        PORT: '8080',
      }),
    /collides with FIRESTORE_EMULATOR_HOST/,
  );
});

test('loadConfig rejects auth-emulator-only mode', () => {
  assert.throws(
    () =>
      loadConfig({
        FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
        FIREBASE_PROJECT_ID: 'atoupay-dev',
      }),
    /requires FIRESTORE_EMULATOR_HOST/,
  );
});

test('loadConfig rejects partial explicit service-account env', () => {
  assert.throws(
    () =>
      loadConfig({
        FIREBASE_CLIENT_EMAIL: 'service-account@example.com',
        FIREBASE_PROJECT_ID: 'atoupay-dev',
      }),
    /must be provided together/,
  );
});

test('loadConfig rejects partial Resend email config', () => {
  assert.throws(
    () =>
      loadConfig({
        EMAIL_FROM: 'ATouPay <invites@example.com>',
        FIREBASE_PROJECT_ID: 'atoupay-dev',
      }),
    /RESEND_API_KEY and EMAIL_FROM/,
  );

  assert.throws(
    () =>
      loadConfig({
        FIREBASE_PROJECT_ID: 'atoupay-dev',
        RESEND_API_KEY: 're_test_key',
      }),
    /RESEND_API_KEY and EMAIL_FROM/,
  );
});

test('loadConfig treats blank optional env vars as unset', () => {
  const config = loadConfig({
    EMAIL_FROM: '',
    EMAIL_REPLY_TO: '',
    FIREBASE_CLIENT_EMAIL: '',
    FIREBASE_PRIVATE_KEY: '',
    FIREBASE_PROJECT_ID: 'atoupay-dev',
    RESEND_API_KEY: '',
  });

  assert.equal(config.isEmailEnabled, false);
  assert.equal(config.emailFrom, undefined);
  assert.equal(config.resendApiKey, undefined);
  assert.equal(config.credentialStrategy, 'application-default');
});

test('loadConfig rejects GOOGLE_APPLICATION_CREDENTIALS with tilde path', () => {
  assert.throws(
    () =>
      loadConfig({
        FIREBASE_PROJECT_ID: 'atoupay-dev',
        GOOGLE_APPLICATION_CREDENTIALS: '~/service-account.json',
      }),
    /does not expand ~/,
  );
});
