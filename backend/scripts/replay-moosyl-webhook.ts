import 'dotenv/config';

import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

function readOption(args: string[], name: string) {
  const inline = args.find((arg) => arg.startsWith(`${name}=`));

  if (inline) {
    return inline.slice(name.length + 1);
  }

  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function usage() {
  console.error(
    [
      'Usage:',
      '  npm run webhook:replay:moosyl -- <fixture-path> [--event-type payment-updated] [--url http://127.0.0.1:3001/v1/webhooks/moosyl]',
      '',
      'Requires MOOSYL_WEBHOOK_SECRET in the environment. The secret is never printed.',
    ].join('\n'),
  );
}

const args = process.argv.slice(2);
const fixturePath = args.find((arg) => !arg.startsWith('--'));
const eventType = readOption(args, '--event-type') ?? 'payment-updated';
const apiBaseUrl = process.env.PUBLIC_API_URL?.replace(/\/+$/, '') ?? 'http://127.0.0.1:3001';
const defaultWebhookUrl = apiBaseUrl.endsWith('/v1/webhooks/moosyl')
  ? apiBaseUrl
  : `${apiBaseUrl}/v1/webhooks/moosyl`;
const webhookUrl = readOption(args, '--url') ?? defaultWebhookUrl;
const webhookSecret = process.env.MOOSYL_WEBHOOK_SECRET;

if (!fixturePath) {
  usage();
  process.exitCode = 1;
} else if (!webhookSecret) {
  console.error('MOOSYL_WEBHOOK_SECRET is required.');
  process.exitCode = 1;
} else {
  const resolvedFixturePath = path.resolve(process.cwd(), fixturePath);
  const rawBody = readFileSync(resolvedFixturePath);
  const signature = `sha256=${createHmac('sha256', webhookSecret).update(rawBody).digest('hex')}`;

  const response = await fetch(webhookUrl, {
    body: rawBody,
    headers: {
      'Content-Type': 'application/json',
      'x-webhook-event': eventType,
      'x-webhook-signature': signature,
    },
    method: 'POST',
  });

  const body = await response.text();
  console.log(`status=${response.status}`);
  console.log(body);
}
