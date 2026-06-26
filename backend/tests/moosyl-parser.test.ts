import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  normalizeMoosylStatus,
  parseMoosylCreatePaymentResponse,
  parseMoosylWebhookPayload,
} from '../src/payments/providers/moosylPaymentProvider.js';

function fixture(name: string) {
  const raw = readFileSync(new URL(`./fixtures/moosyl/${name}`, import.meta.url), 'utf8');
  return JSON.parse(raw) as unknown;
}

test('parseMoosylCreatePaymentResponse maps success response safely', () => {
  const parsed = parseMoosylCreatePaymentResponse(fixture('create-payment-success.json'));

  assert.equal(parsed.providerTransactionId, 'moosyl-transaction-1');
  assert.equal(parsed.providerRequestId, 'mpr_test_001');
  assert.equal(
    parsed.checkoutUrl,
    'https://checkout.moosyl.test/pay/moosyl-transaction-1',
  );
});

test('parseMoosylCreatePaymentResponse accepts minimal pending response', () => {
  const parsed = parseMoosylCreatePaymentResponse(fixture('create-payment-minimal.json'));

  assert.equal(parsed.providerTransactionId, 'moosyl-transaction-minimal');
  assert.equal(parsed.providerRequestId, undefined);
  assert.equal(parsed.checkoutUrl, undefined);
});

test('parseMoosylCreatePaymentResponse rejects missing transactionId with structured error', () => {
  assert.throws(
    () => parseMoosylCreatePaymentResponse({ id: 'mpr_missing_transaction' }),
    (error) =>
      error instanceof Error &&
      'code' in error &&
      error.code === 'payment_provider_response_invalid' &&
      /transactionId/.test(error.message),
  );
});

test('parseMoosylWebhookPayload maps paid webhook', () => {
  const parsed = parseMoosylWebhookPayload(fixture('webhook-paid.json'), 'payment-updated');

  assert.equal(parsed.providerEventId, 'moosyl-event-paid-1');
  assert.equal(parsed.providerTransactionId, 'moosyl-transaction-1');
  assert.equal(parsed.providerReference, 'bankily-ref-884421');
  assert.equal(parsed.normalizedStatus, 'paid');
  assert.equal(parsed.amount, 200000);
  assert.equal(parsed.currency, 'MRU');
});

test('parseMoosylWebhookPayload maps failed webhook', () => {
  const parsed = parseMoosylWebhookPayload(fixture('webhook-failed.json'), 'payment-updated');

  assert.equal(parsed.providerTransactionId, 'moosyl-transaction-failed');
  assert.equal(parsed.normalizedStatus, 'failed');
});

test('parseMoosylWebhookPayload maps cancelled webhook', () => {
  const parsed = parseMoosylWebhookPayload(
    fixture('webhook-cancelled.json'),
    'payment-updated',
  );

  assert.equal(parsed.providerTransactionId, 'moosyl-transaction-cancelled');
  assert.equal(parsed.normalizedStatus, 'cancelled');
});

test('parseMoosylWebhookPayload ignores unknown status safely', () => {
  const parsed = parseMoosylWebhookPayload(
    fixture('webhook-unknown-status.json'),
    'payment-updated',
  );

  assert.equal(parsed.providerTransactionId, 'moosyl-transaction-unknown-status');
  assert.equal(parsed.rawProviderStatus, 'awaiting-user-action');
  assert.equal(parsed.normalizedStatus, 'ignored');
});

test('parseMoosylWebhookPayload exposes amount mismatch data for service rejection', () => {
  const parsed = parseMoosylWebhookPayload(
    fixture('webhook-amount-mismatch.json'),
    'payment-updated',
  );

  assert.equal(parsed.normalizedStatus, 'paid');
  assert.equal(parsed.providerTransactionId, 'moosyl-transaction-amount-mismatch');
  assert.equal(parsed.amount, 199999);
  assert.equal(parsed.currency, 'MRU');
});

test('parseMoosylWebhookPayload exposes currency mismatch data for service rejection', () => {
  const parsed = parseMoosylWebhookPayload(
    fixture('webhook-currency-mismatch.json'),
    'payment-updated',
  );

  assert.equal(parsed.normalizedStatus, 'paid');
  assert.equal(parsed.providerTransactionId, 'moosyl-transaction-currency-mismatch');
  assert.equal(parsed.amount, 200000);
  assert.equal(parsed.currency, 'EUR');
});

test('parseMoosylWebhookPayload rejects missing transactionId with structured error', () => {
  assert.throws(
    () =>
      parseMoosylWebhookPayload(
        {
          data: {
            amount: 200000,
            currency: 'MRU',
            status: 'completed',
          },
        },
        'payment-updated',
      ),
    (error) =>
      error instanceof Error &&
      'code' in error &&
      error.code === 'payment_provider_payload_invalid' &&
      /transactionId/.test(error.message),
  );
});

test('normalizeMoosylStatus does not promote unknown provider statuses to paid', () => {
  assert.equal(normalizeMoosylStatus('completed'), 'paid');
  assert.equal(normalizeMoosylStatus('awaiting-user-action'), 'ignored');
  assert.equal(normalizeMoosylStatus(undefined), 'ignored');
});
