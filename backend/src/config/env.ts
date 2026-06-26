import { existsSync } from 'node:fs';
import path from 'node:path';

import { ZodError, z } from 'zod';

export type AppVariant = 'development' | 'preview' | 'production';
export type PaymentProviderMode = 'moosyl' | 'simulated';
export type RuntimeMode = 'cloud-run' | 'full-local-emulator' | 'hybrid-local';
export type CredentialStrategy =
  | 'application-default'
  | 'google-application-credentials'
  | 'none-required'
  | 'service-account-env';

export const PAYMENT_PROVIDER_LIVE_ACK_VALUE = 'I_UNDERSTAND_LIVE_MONEY_MOVEMENT';

interface EmulatorEndpoint {
  host: string;
  port: number;
  raw: string;
}

const optionalEnvString = z.preprocess(
  (value) => (typeof value === 'string' && value.trim().length === 0 ? undefined : value),
  z.string().trim().min(1).optional(),
);

const envBoolean = z.preprocess((value) => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    return value.trim().toLowerCase() === 'true';
  }

  return value;
}, z.boolean());

const envSchema = z.object({
  APP_VARIANT: z.enum(['development', 'preview', 'production']).default('development'),
  APP_INVITE_BASE_URL: z.string().min(1).default('atoupay://auth/login'),
  FIREBASE_AUTH_EMULATOR_HOST: optionalEnvString,
  FIREBASE_CLIENT_EMAIL: optionalEnvString,
  FIREBASE_PRIVATE_KEY: optionalEnvString,
  FIREBASE_PROJECT_ID: z.string().trim().min(1, 'FIREBASE_PROJECT_ID is required'),
  FIRESTORE_EMULATOR_HOST: optionalEnvString,
  GOOGLE_APPLICATION_CREDENTIALS: optionalEnvString,
  HOST: z.string().trim().min(1).default('0.0.0.0'),
  INTERNAL_TASK_SECRET: optionalEnvString,
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PAYMENT_LIVE_MODE: envBoolean.default(false),
  PAYMENT_PROVIDER_LIVE_ACK: optionalEnvString,
  PAYMENT_PROVIDER: z.enum(['moosyl', 'simulated']).default('simulated'),
  PORT: z.coerce.number().int().positive().default(3001),
  EMAIL_FROM: optionalEnvString,
  EMAIL_REPLY_TO: optionalEnvString,
  MOOSYL_PUBLISHABLE_KEY: optionalEnvString,
  MOOSYL_SECRET_KEY: optionalEnvString,
  MOOSYL_WEBHOOK_SECRET: optionalEnvString,
  PUBLIC_API_URL: optionalEnvString,
  PUBLIC_APP_URL: optionalEnvString,
  RESEND_API_KEY: optionalEnvString,
});

export interface AppConfig {
  appVariant: AppVariant;
  authEmulator?: EmulatorEndpoint;
  credentialStrategy: CredentialStrategy;
  firebaseAuthEmulatorHost?: string;
  firebaseClientEmail?: string;
  firebasePrivateKey?: string;
  firebaseProjectId: string;
  firestoreEmulator?: EmulatorEndpoint;
  firestoreEmulatorHost?: string;
  googleApplicationCredentials?: string;
  host: string;
  internalTaskSecret?: string;
  inviteBaseUrl: string;
  emailFrom?: string;
  emailReplyTo?: string;
  isEmailEnabled: boolean;
  isAuthEmulatorEnabled: boolean;
  isFirestoreEmulatorEnabled: boolean;
  logLevel: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent';
  nodeEnv: 'development' | 'production' | 'test';
  paymentLiveMode: boolean;
  paymentProviderLiveAck?: string;
  paymentProvider: PaymentProviderMode;
  port: number;
  moosylPublishableKey?: string;
  moosylSecretKey?: string;
  moosylWebhookSecret?: string;
  publicApiUrl?: string;
  publicAppUrl?: string;
  resendApiKey?: string;
  runtimeMode: RuntimeMode;
}

function parseEmulatorHost(name: string, rawValue?: string): EmulatorEndpoint | undefined {
  if (!rawValue) {
    return undefined;
  }

  const value = rawValue.trim();

  if (value.startsWith('http://') || value.startsWith('https://')) {
    throw new Error(`${name} must be host:port only. Do not include http:// or https://.`);
  }

  const [host, portValue] = value.split(':');

  if (!host || !portValue || value.split(':').length !== 2) {
    throw new Error(`${name} must be formatted as host:port.`);
  }

  const port = Number.parseInt(portValue, 10);

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`${name} must use a valid positive port.`);
  }

  return {
    host,
    port,
    raw: value,
  };
}

function resolveRuntimeMode(input: {
  authEmulator: EmulatorEndpoint | undefined;
  firestoreEmulator: EmulatorEndpoint | undefined;
}): RuntimeMode {
  const { authEmulator, firestoreEmulator } = input;

  if (firestoreEmulator && authEmulator) {
    return 'full-local-emulator';
  }

  if (firestoreEmulator && !authEmulator) {
    return 'hybrid-local';
  }

  if (!firestoreEmulator && !authEmulator) {
    return 'cloud-run';
  }

  throw new Error(
    'Unsupported emulator combination: FIREBASE_AUTH_EMULATOR_HOST requires FIRESTORE_EMULATOR_HOST for this backend.',
  );
}

function resolveCredentialStrategy(input: {
  googleApplicationCredentials: string | undefined;
  hasExplicitServiceAccount: boolean;
  runtimeMode: RuntimeMode;
}): CredentialStrategy {
  if (input.runtimeMode === 'full-local-emulator') {
    return 'none-required';
  }

  if (input.hasExplicitServiceAccount) {
    return 'service-account-env';
  }

  if (input.googleApplicationCredentials) {
    return 'google-application-credentials';
  }

  return 'application-default';
}

function validateCredentialInputs(input: {
  authEmulator: EmulatorEndpoint | undefined;
  firebaseClientEmail: string | undefined;
  firebasePrivateKey: string | undefined;
  googleApplicationCredentials: string | undefined;
  runtimeMode: RuntimeMode;
}) {
  const hasClientEmail = Boolean(input.firebaseClientEmail);
  const hasPrivateKey = Boolean(input.firebasePrivateKey);

  if (hasClientEmail !== hasPrivateKey) {
    throw new Error(
      'FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY must be provided together when using explicit service-account credentials.',
    );
  }

  if (input.googleApplicationCredentials) {
    if (input.googleApplicationCredentials.startsWith('~')) {
      throw new Error(
        'GOOGLE_APPLICATION_CREDENTIALS must be an absolute path. The backend does not expand ~ in .env files.',
      );
    }

    if (!path.isAbsolute(input.googleApplicationCredentials)) {
      throw new Error(
        'GOOGLE_APPLICATION_CREDENTIALS must be an absolute path when set locally.',
      );
    }

    if (!existsSync(input.googleApplicationCredentials)) {
      throw new Error(
        `GOOGLE_APPLICATION_CREDENTIALS points to a file that does not exist: ${input.googleApplicationCredentials}`,
      );
    }
  }

  if (input.runtimeMode === 'full-local-emulator' && (hasClientEmail || hasPrivateKey)) {
    return;
  }

  if (input.runtimeMode === 'full-local-emulator' && input.googleApplicationCredentials) {
    return;
  }

  if (input.runtimeMode === 'cloud-run' && hasClientEmail && input.googleApplicationCredentials) {
    throw new Error(
      'Choose one credential strategy: either FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY or GOOGLE_APPLICATION_CREDENTIALS, not both.',
    );
  }

  if (input.runtimeMode === 'hybrid-local' && hasClientEmail && input.googleApplicationCredentials) {
    throw new Error(
      'Choose one credential strategy for hybrid-local mode: service-account env vars or GOOGLE_APPLICATION_CREDENTIALS, not both.',
    );
  }

  if (input.runtimeMode === 'cloud-run' && input.authEmulator) {
    throw new Error('Cloud Run mode must not set FIREBASE_AUTH_EMULATOR_HOST.');
  }
}

function validatePortCollisions(input: {
  authEmulator: EmulatorEndpoint | undefined;
  firestoreEmulator: EmulatorEndpoint | undefined;
  port: number;
}) {
  if (input.authEmulator && input.authEmulator.port === input.port) {
    throw new Error(
      `PORT ${input.port} collides with FIREBASE_AUTH_EMULATOR_HOST (${input.authEmulator.raw}). Use a different backend port such as 3001.`,
    );
  }

  if (input.firestoreEmulator && input.firestoreEmulator.port === input.port) {
    throw new Error(
      `PORT ${input.port} collides with FIRESTORE_EMULATOR_HOST (${input.firestoreEmulator.raw}). Use a different backend port such as 3001.`,
    );
  }
}

function validateEmailInputs(input: {
  emailFrom: string | undefined;
  resendApiKey: string | undefined;
}) {
  if (Boolean(input.emailFrom) !== Boolean(input.resendApiKey)) {
    throw new Error(
      'RESEND_API_KEY and EMAIL_FROM must be provided together to enable invite email delivery.',
    );
  }
}

function validatePaymentProviderInputs(input: {
  moosylPublishableKey: string | undefined;
  moosylSecretKey: string | undefined;
  moosylWebhookSecret: string | undefined;
  paymentLiveMode: boolean;
  paymentProvider: PaymentProviderMode;
  paymentProviderLiveAck: string | undefined;
  publicApiUrl: string | undefined;
  publicAppUrl: string | undefined;
}) {
  if (input.paymentProvider !== 'moosyl') {
    return;
  }

  const missing = [
    ['MOOSYL_SECRET_KEY', input.moosylSecretKey],
    ['MOOSYL_PUBLISHABLE_KEY', input.moosylPublishableKey],
    ['MOOSYL_WEBHOOK_SECRET', input.moosylWebhookSecret],
    ['PUBLIC_APP_URL', input.publicAppUrl],
    ['PUBLIC_API_URL', input.publicApiUrl],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length > 0) {
    throw new Error(
      `PAYMENT_PROVIDER=moosyl requires ${missing.join(', ')}. Keep real values in protected runtime config only.`,
    );
  }

  if (
    input.paymentLiveMode &&
    input.paymentProviderLiveAck !== PAYMENT_PROVIDER_LIVE_ACK_VALUE
  ) {
    throw new Error(
      `PAYMENT_PROVIDER=moosyl with PAYMENT_LIVE_MODE=true requires PAYMENT_PROVIDER_LIVE_ACK="${PAYMENT_PROVIDER_LIVE_ACK_VALUE}".`,
    );
  }
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  try {
    const parsed = envSchema.parse(env);
    const authEmulator = parseEmulatorHost(
      'FIREBASE_AUTH_EMULATOR_HOST',
      parsed.FIREBASE_AUTH_EMULATOR_HOST,
    );
    const firestoreEmulator = parseEmulatorHost(
      'FIRESTORE_EMULATOR_HOST',
      parsed.FIRESTORE_EMULATOR_HOST,
    );
    const runtimeMode = resolveRuntimeMode({
      authEmulator,
      firestoreEmulator,
    });

    validateCredentialInputs({
      authEmulator,
      firebaseClientEmail: parsed.FIREBASE_CLIENT_EMAIL,
      firebasePrivateKey: parsed.FIREBASE_PRIVATE_KEY,
      googleApplicationCredentials: parsed.GOOGLE_APPLICATION_CREDENTIALS,
      runtimeMode,
    });
    validatePortCollisions({
      authEmulator,
      firestoreEmulator,
      port: parsed.PORT,
    });
    validateEmailInputs({
      emailFrom: parsed.EMAIL_FROM,
      resendApiKey: parsed.RESEND_API_KEY,
    });
    validatePaymentProviderInputs({
      moosylPublishableKey: parsed.MOOSYL_PUBLISHABLE_KEY,
      moosylSecretKey: parsed.MOOSYL_SECRET_KEY,
      moosylWebhookSecret: parsed.MOOSYL_WEBHOOK_SECRET,
      paymentLiveMode: parsed.PAYMENT_LIVE_MODE,
      paymentProvider: parsed.PAYMENT_PROVIDER,
      paymentProviderLiveAck: parsed.PAYMENT_PROVIDER_LIVE_ACK,
      publicApiUrl: parsed.PUBLIC_API_URL,
      publicAppUrl: parsed.PUBLIC_APP_URL,
    });

    const credentialStrategy = resolveCredentialStrategy({
      googleApplicationCredentials: parsed.GOOGLE_APPLICATION_CREDENTIALS,
      hasExplicitServiceAccount:
        Boolean(parsed.FIREBASE_CLIENT_EMAIL) && Boolean(parsed.FIREBASE_PRIVATE_KEY),
      runtimeMode,
    });

    return {
      appVariant: parsed.APP_VARIANT,
      ...(authEmulator
        ? {
            authEmulator,
            firebaseAuthEmulatorHost: authEmulator.raw,
          }
        : {}),
      credentialStrategy,
      ...(parsed.FIREBASE_CLIENT_EMAIL
        ? {
            firebaseClientEmail: parsed.FIREBASE_CLIENT_EMAIL,
          }
        : {}),
      ...(parsed.FIREBASE_PRIVATE_KEY
        ? {
            firebasePrivateKey: parsed.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
          }
        : {}),
      firebaseProjectId: parsed.FIREBASE_PROJECT_ID,
      ...(firestoreEmulator
        ? {
            firestoreEmulator,
            firestoreEmulatorHost: firestoreEmulator.raw,
          }
        : {}),
      ...(parsed.GOOGLE_APPLICATION_CREDENTIALS
        ? {
            googleApplicationCredentials: parsed.GOOGLE_APPLICATION_CREDENTIALS,
          }
        : {}),
      host: parsed.HOST,
      ...(parsed.INTERNAL_TASK_SECRET ? { internalTaskSecret: parsed.INTERNAL_TASK_SECRET } : {}),
      inviteBaseUrl: parsed.APP_INVITE_BASE_URL,
      ...(parsed.EMAIL_FROM
        ? {
            emailFrom: parsed.EMAIL_FROM,
          }
        : {}),
      ...(parsed.EMAIL_REPLY_TO
        ? {
            emailReplyTo: parsed.EMAIL_REPLY_TO,
          }
        : {}),
      isEmailEnabled: Boolean(parsed.RESEND_API_KEY && parsed.EMAIL_FROM),
      isAuthEmulatorEnabled: Boolean(authEmulator),
      isFirestoreEmulatorEnabled: Boolean(firestoreEmulator),
      logLevel: parsed.LOG_LEVEL,
      nodeEnv: parsed.NODE_ENV,
      paymentLiveMode: parsed.PAYMENT_LIVE_MODE,
      ...(parsed.PAYMENT_PROVIDER_LIVE_ACK
        ? {
            paymentProviderLiveAck: parsed.PAYMENT_PROVIDER_LIVE_ACK,
          }
        : {}),
      paymentProvider: parsed.PAYMENT_PROVIDER,
      port: parsed.PORT,
      ...(parsed.MOOSYL_PUBLISHABLE_KEY
        ? {
            moosylPublishableKey: parsed.MOOSYL_PUBLISHABLE_KEY,
          }
        : {}),
      ...(parsed.MOOSYL_SECRET_KEY
        ? {
            moosylSecretKey: parsed.MOOSYL_SECRET_KEY,
          }
        : {}),
      ...(parsed.MOOSYL_WEBHOOK_SECRET
        ? {
            moosylWebhookSecret: parsed.MOOSYL_WEBHOOK_SECRET,
          }
        : {}),
      ...(parsed.PUBLIC_API_URL
        ? {
            publicApiUrl: parsed.PUBLIC_API_URL,
          }
        : {}),
      ...(parsed.PUBLIC_APP_URL
        ? {
            publicAppUrl: parsed.PUBLIC_APP_URL,
          }
        : {}),
      ...(parsed.RESEND_API_KEY
        ? {
            resendApiKey: parsed.RESEND_API_KEY,
          }
        : {}),
      runtimeMode,
    };
  } catch (error) {
    if (error instanceof ZodError) {
      const issues = error.issues.map((issue) => issue.message).join('; ');

      throw new Error(`Invalid backend configuration: ${issues}`);
    }

    if (error instanceof Error) {
      throw new Error(`Invalid backend configuration: ${error.message}`);
    }

    throw error;
  }
}
