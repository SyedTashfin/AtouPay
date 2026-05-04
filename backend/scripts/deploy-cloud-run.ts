import 'dotenv/config';

import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { loadConfig } from '../src/config/env.js';

interface ServiceAccountJson {
  client_email?: string;
  private_key?: string;
}

type CredentialMode = 'attached' | 'env';

function quoteYamlScalar(value: string) {
  return JSON.stringify(value);
}

function blockYaml(value: string) {
  const normalized = value.endsWith('\n') ? value.slice(0, -1) : value;
  const lines = normalized.split('\n');

  return ['|-', ...lines.map((line) => `  ${line}`)].join('\n');
}

function runCommand(command: string, args: string[], cwd: string) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: 'pipe',
  });

  if (result.status !== 0) {
    throw new Error(
      [
        `Command failed: ${command} ${args.join(' ')}`,
        result.stdout?.trim(),
        result.stderr?.trim(),
      ]
        .filter(Boolean)
        .join('\n'),
    );
  }

  return result.stdout.trim();
}

function resolveCredentialMaterial(config: ReturnType<typeof loadConfig>) {
  if (config.firebaseClientEmail && config.firebasePrivateKey) {
    return {
      clientEmail: config.firebaseClientEmail,
      privateKey: config.firebasePrivateKey,
      source: 'service-account-env' as const,
    };
  }

  if (!config.googleApplicationCredentials) {
    throw new Error(
      'Cloud Run deployment requires GOOGLE_APPLICATION_CREDENTIALS locally or explicit FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY in backend/.env.',
    );
  }

  const parsed = JSON.parse(
    readFileSync(config.googleApplicationCredentials, 'utf8'),
  ) as ServiceAccountJson;

  if (!parsed.client_email || !parsed.private_key) {
    throw new Error(
      `Service account JSON is missing client_email/private_key: ${config.googleApplicationCredentials}`,
    );
  }

  return {
    clientEmail: parsed.client_email,
    privateKey: parsed.private_key,
    source: 'google-application-credentials' as const,
  };
}

async function main() {
  const { values } = parseArgs({
    allowPositionals: false,
    options: {
      project: {
        type: 'string',
      },
      region: {
        type: 'string',
      },
      service: {
        type: 'string',
      },
      'credential-mode': {
        type: 'string',
      },
      'service-account': {
        type: 'string',
      },
    },
  });

  const backendRoot = path.resolve(import.meta.dirname, '..');
  const config = loadConfig();
  const deployProject =
    values.project?.trim() ||
    runCommand('gcloud', ['config', 'get-value', 'core/project'], backendRoot);
  const region = values.region?.trim() ?? 'europe-west1';
  const serviceName = values.service?.trim() ?? 'atoupay-backend';
  const credentialModeRaw = values['credential-mode']?.trim() ?? 'env';
  const credentialMode = credentialModeRaw as CredentialMode;
  const serviceAccount = values['service-account']?.trim();

  if (credentialMode !== 'attached' && credentialMode !== 'env') {
    throw new Error('--credential-mode must be either "attached" or "env".');
  }

  const credentials =
    credentialMode === 'env' ? resolveCredentialMaterial(config) : null;
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'atoupay-cloudrun-'));
  const envFile = path.join(tempDir, 'cloud-run-env.yaml');

  const envYaml = [
    `APP_INVITE_BASE_URL: ${quoteYamlScalar(config.inviteBaseUrl)}`,
    `FIREBASE_PROJECT_ID: ${quoteYamlScalar(config.firebaseProjectId)}`,
    `HOST: ${quoteYamlScalar('0.0.0.0')}`,
    `LOG_LEVEL: ${quoteYamlScalar('info')}`,
    `NODE_ENV: ${quoteYamlScalar('production')}`,
    ...(config.isEmailEnabled && config.resendApiKey && config.emailFrom
      ? [
          `EMAIL_FROM: ${quoteYamlScalar(config.emailFrom)}`,
          ...(config.emailReplyTo ? [`EMAIL_REPLY_TO: ${quoteYamlScalar(config.emailReplyTo)}`] : []),
          `RESEND_API_KEY: ${quoteYamlScalar(config.resendApiKey)}`,
        ]
      : []),
    ...(credentials
      ? [
          `FIREBASE_CLIENT_EMAIL: ${quoteYamlScalar(credentials.clientEmail)}`,
          `FIREBASE_PRIVATE_KEY: ${blockYaml(credentials.privateKey)}`,
        ]
      : []),
  ].join('\n');

  writeFileSync(envFile, `${envYaml}\n`, 'utf8');

  try {
    const deployArgs = [
        'run',
        'deploy',
        serviceName,
        '--source',
        '.',
        '--project',
        deployProject,
        '--region',
        region,
        '--allow-unauthenticated',
        '--memory',
        '512Mi',
        '--cpu',
        '1',
        '--min-instances',
        '0',
        '--max-instances',
        '1',
        '--concurrency',
        '40',
        '--timeout',
        '300',
        '--env-vars-file',
        envFile,
        '--quiet',
      ];

    if (serviceAccount) {
      deployArgs.push('--service-account', serviceAccount);
    }

    runCommand('gcloud', deployArgs, backendRoot);

    const url = runCommand(
      'gcloud',
      [
        'run',
        'services',
        'describe',
        serviceName,
        '--project',
        deployProject,
        '--region',
        region,
        '--format=value(status.url)',
      ],
      backendRoot,
    );

    console.log(
      JSON.stringify(
        {
          credentialSource: credentials?.source ?? 'attached-service-account',
          firebaseProjectId: config.firebaseProjectId,
          project: deployProject,
          region,
          ...(serviceAccount ? { serviceAccount } : {}),
          service: serviceName,
          url,
        },
        null,
        2,
      ),
    );
  } finally {
    rmSync(tempDir, { force: true, recursive: true });
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
