import { createHmac, timingSafeEqual } from 'node:crypto';

import { AppError } from '../../lib/errors.js';
import { MOOSYL_PAYMENT_REQUEST_URL } from '../paymentConstants.js';
import type { PaymentProvider } from '../paymentProvider.js';
import type {
  CreateRentPaymentIntentInput,
  NormalizeWebhookInput,
  NormalizedWebhookEvent,
  RentPaymentProviderStatus,
  VerifyWebhookInput,
} from '../types.js';

export interface MoosylProviderConfig {
  httpClient?: MoosylHttpClient | undefined;
  publishableKey: string;
  secretKey: string;
  webhookSecret: string;
}

export interface MoosylHttpResponse {
  json: unknown;
  status: number;
}

export type MoosylHttpClient = (input: {
  body?: unknown;
  headers: Record<string, string>;
  method: 'GET' | 'POST';
  url: string;
}) => Promise<MoosylHttpResponse>;

type JsonObject = Record<string, unknown>;

export interface ParsedMoosylCreatePaymentResponse {
  checkoutUrl?: string;
  providerRequestId?: string;
  providerTransactionId: string;
}

function isRecord(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function defaultMoosylHttpClient(input: {
  body?: unknown;
  headers: Record<string, string>;
  method: 'GET' | 'POST';
  url: string;
}): Promise<MoosylHttpResponse> {
  const requestInit: RequestInit = {
    headers: input.headers,
    method: input.method,
    ...(input.body === undefined ? {} : { body: JSON.stringify(input.body) }),
  };
  const response = await fetch(input.url, requestInit);
  const text = await response.text();
  let json: unknown = null;

  if (text.trim().length > 0) {
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }
  }

  return {
    json,
    status: response.status,
  };
}

export function normalizeMoosylStatus(
  value: unknown,
  eventType?: string,
): RentPaymentProviderStatus | 'ignored' {
  const status = typeof value === 'string' ? value.trim().toLowerCase() : '';

  if (
    status === 'completed' ||
    status === 'complete' ||
    status === 'paid' ||
    status === 'success' ||
    status === 'succeeded'
  ) {
    return 'paid';
  }

  if (
    status === 'failed' ||
    status === 'failure' ||
    status === 'error' ||
    status === 'rejected' ||
    status === 'declined'
  ) {
    return 'failed';
  }

  if (status === 'cancelled' || status === 'canceled' || status === 'expired') {
    return 'cancelled';
  }

  if (status === 'disputed') {
    return 'disputed';
  }

  if (status === 'refunded') {
    return 'refunded';
  }

  if (eventType === 'payment-request-created' || eventType === 'payment-created') {
    return 'processing';
  }

  if (
    status === 'pending' ||
    status === 'processing' ||
    status === 'created' ||
    status === 'open' ||
    status === 'requires_payment'
  ) {
    return 'processing';
  }

  return 'ignored';
}

function readString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function readNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function providerParseError(input: {
  code?: string;
  message: string;
  statusCode?: number;
}) {
  return new AppError(
    input.statusCode ?? 502,
    input.code ?? 'payment_provider_response_invalid',
    input.message,
  );
}

function requireRecord(value: unknown, context: string): JsonObject {
  if (!isRecord(value)) {
    throw providerParseError({
      message: `La réponse Moosyl ${context} doit être un objet JSON.`,
    });
  }

  return value;
}

function extractRequest(data: JsonObject): JsonObject {
  return isRecord(data.request) ? data.request : {};
}

function compactCandidates(values: Array<JsonObject | undefined>) {
  return values.filter((value): value is JsonObject => Boolean(value));
}

function getEnvelopeData(raw: JsonObject) {
  return isRecord(raw.data) ? raw.data : undefined;
}

function getNestedEnvelopeData(data: JsonObject | undefined) {
  return data && isRecord(data.data) ? data.data : undefined;
}

function readFirstString(candidates: JsonObject[], fields: string[]) {
  for (const candidate of candidates) {
    for (const field of fields) {
      const value = readString(candidate[field]);

      if (value) {
        return value;
      }
    }
  }

  return undefined;
}

function readFirstNumber(candidates: JsonObject[], fields: string[]) {
  for (const candidate of candidates) {
    for (const field of fields) {
      const value = readNumber(candidate[field]);

      if (value !== undefined) {
        return value;
      }
    }
  }

  return undefined;
}

function createPaymentCandidates(raw: JsonObject) {
  const envelopeData = getEnvelopeData(raw);
  const nestedData = getNestedEnvelopeData(envelopeData);
  const request = extractRequest(envelopeData ?? raw);

  return compactCandidates([raw, envelopeData, nestedData, request]);
}

function webhookCandidates(raw: JsonObject) {
  const envelopeData = getEnvelopeData(raw);
  const data = getNestedEnvelopeData(envelopeData) ?? envelopeData ?? raw;
  const request = extractRequest(data);

  return {
    candidates: compactCandidates([data, request, envelopeData, raw]),
    data,
    request,
  };
}

export function parseMoosylCreatePaymentResponse(
  raw: unknown,
): ParsedMoosylCreatePaymentResponse {
  const body = requireRecord(raw, 'de création de paiement');
  const candidates = createPaymentCandidates(body);
  const providerTransactionId = readFirstString(candidates, [
    'transactionId',
    'transaction_id',
  ]);

  if (!providerTransactionId) {
    throw providerParseError({
      message:
        'La réponse Moosyl de création de paiement ne contient pas de transactionId.',
    });
  }

  const providerRequestId = readFirstString(candidates, [
    'paymentRequestId',
    'payment_request_id',
    'requestId',
    'id',
  ]);
  const checkoutUrl = readFirstString(candidates, [
    'checkoutUrl',
    'checkout_url',
    'paymentUrl',
    'payment_url',
    'url',
  ]);

  return {
    ...(checkoutUrl ? { checkoutUrl } : {}),
    ...(providerRequestId ? { providerRequestId } : {}),
    providerTransactionId,
  };
}

export function parseMoosylWebhookPayload(
  raw: unknown,
  eventType = 'unknown',
): NormalizedWebhookEvent {
  const body = requireRecord(raw, 'webhook');
  const { candidates } = webhookCandidates(body);
  const providerTransactionId = readFirstString(candidates, [
    'transactionId',
    'transaction_id',
  ]);

  if (!providerTransactionId) {
    throw providerParseError({
      code: 'payment_provider_payload_invalid',
      message: 'Le webhook Moosyl ne contient pas de transactionId.',
      statusCode: 409,
    });
  }

  const rawProviderStatus = readFirstString(candidates, ['status', 'paymentStatus']);
  const normalizedStatus = normalizeMoosylStatus(rawProviderStatus, eventType);
  const amount = readFirstNumber(candidates, ['amount', 'totalAmount', 'total_amount']);
  const currency =
    readFirstString(candidates, ['currency']) ?? (amount === undefined ? undefined : 'MRU');
  const providerEventId = readString(body.id) ?? readString(body.eventId);
  const providerReference = readFirstString(candidates, [
    'referenceId',
    'reference_id',
    'reference',
    'providerReference',
  ]);
  const providerRequestId = readFirstString(candidates, [
    'paymentRequestId',
    'payment_request_id',
    'requestId',
    'id',
  ]);

  return {
    ...(amount !== undefined ? { amount } : {}),
    ...(currency ? { currency } : {}),
    eventType,
    normalizedStatus,
    ...(providerEventId ? { providerEventId } : {}),
    ...(providerReference ? { providerReference } : {}),
    ...(providerRequestId ? { providerRequestId } : {}),
    providerTransactionId,
    ...(rawProviderStatus ? { rawProviderStatus } : {}),
  };
}

export class MoosylPaymentProvider implements PaymentProvider {
  readonly name = 'moosyl' as const;

  private readonly httpClient: MoosylHttpClient;
  private readonly publishableKey: string;
  private readonly secretKey: string;
  private readonly webhookSecret: string;

  constructor(config: MoosylProviderConfig) {
    this.httpClient = config.httpClient ?? defaultMoosylHttpClient;
    this.publishableKey = config.publishableKey;
    this.secretKey = config.secretKey;
    this.webhookSecret = config.webhookSecret;
  }

  async createRentPaymentIntent(input: CreateRentPaymentIntentInput) {
    const transactionId = `atp_${input.intentId.replace(/-/g, '').slice(0, 24)}`;
    const response = await this.httpClient({
      body: {
        amount: input.amount,
        metadata: {
          intentId: input.intentId,
          paymentId: input.paymentId,
        },
        transactionId,
      },
      headers: {
        Authorization: this.secretKey,
        'Content-Type': 'application/json',
      },
      method: 'POST',
      url: MOOSYL_PAYMENT_REQUEST_URL,
    });

    if (response.status < 200 || response.status >= 300) {
      throw new AppError(
        502,
        'payment_provider_request_failed',
        'La demande de paiement Moosyl a échoué côté prestataire.',
      );
    }

    const parsed = parseMoosylCreatePaymentResponse(response.json);

    return {
      ...(parsed.checkoutUrl ? { checkoutUrl: parsed.checkoutUrl } : {}),
      provider: this.name,
      ...(parsed.providerRequestId ? { providerRequestId: parsed.providerRequestId } : {}),
      providerTransactionId: parsed.providerTransactionId,
      publishableKey: this.publishableKey,
      status: 'processing' as const,
    };
  }

  async getPaymentStatus() {
    return {
      status: 'processing' as const,
    };
  }

  async verifyWebhook(input: VerifyWebhookInput) {
    const signature = input.signature?.trim();

    if (!signature) {
      return { signatureValid: false };
    }

    const receivedHex = signature.startsWith('sha256=')
      ? signature.slice('sha256='.length)
      : signature;

    if (!/^[a-f0-9]+$/i.test(receivedHex)) {
      return { signatureValid: false };
    }

    const expectedHex = createHmac('sha256', this.webhookSecret)
      .update(input.rawBody)
      .digest('hex');
    const received = Buffer.from(receivedHex, 'hex');
    const expected = Buffer.from(expectedHex, 'hex');

    if (received.length !== expected.length) {
      return { signatureValid: false };
    }

    return {
      signatureValid: timingSafeEqual(received, expected),
    };
  }

  async normalizeWebhookEvent(input: NormalizeWebhookInput) {
    return parseMoosylWebhookPayload(input.payload, input.eventType);
  }
}
