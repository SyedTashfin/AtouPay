import { createHash, randomUUID } from 'node:crypto';

import type { DataRepository } from '../repositories/types.js';
import { AppError } from '../lib/errors.js';
import { MOOSYL_WEBHOOK_EVENTS } from './paymentConstants.js';
import type { PaymentProvider } from './paymentProvider.js';
import type { PaymentService } from './paymentService.js';
import type { NormalizedWebhookEvent, ProviderWebhookEvent } from './types.js';

interface PaymentWebhookServiceOptions {
  moosylProvider: PaymentProvider;
  now?: () => Date;
  paymentService: PaymentService;
  repository: DataRepository;
}

interface HandleMoosylWebhookInput {
  eventType?: string;
  payload: unknown;
  rawBody: Buffer;
  signature?: string;
}

function hashBody(rawBody: Buffer) {
  return createHash('sha256').update(rawBody).digest('hex');
}

function readProviderEventId(payload: unknown) {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return undefined;
  }

  const candidate = payload as Record<string, unknown>;
  if (typeof candidate.id === 'string' && candidate.id.trim().length > 0) {
    return candidate.id.trim();
  }

  if (
    typeof candidate.data === 'object' &&
    candidate.data !== null &&
    !Array.isArray(candidate.data)
  ) {
    const data = candidate.data as Record<string, unknown>;
    return typeof data.id === 'string' && data.id.trim().length > 0 ? data.id.trim() : undefined;
  }

  return undefined;
}

function buildWebhookIdempotencyKey(input: {
  eventType: string;
  normalized?: NormalizedWebhookEvent;
  payload: unknown;
  rawBody: Buffer;
}) {
  const providerEventId = input.normalized?.providerEventId ?? readProviderEventId(input.payload);

  if (providerEventId) {
    return `moosyl:${providerEventId}:${input.eventType}`;
  }

  if (input.normalized?.providerTransactionId) {
    return [
      'moosyl',
      input.eventType,
      input.normalized.providerTransactionId,
      input.normalized.rawProviderStatus ?? input.normalized.normalizedStatus,
      input.normalized.providerReference ?? '',
    ].join(':');
  }

  return `moosyl:${input.eventType}:${hashBody(input.rawBody)}`;
}

export class PaymentWebhookService {
  private readonly moosylProvider: PaymentProvider;
  private readonly now: () => Date;
  private readonly paymentService: PaymentService;
  private readonly repository: DataRepository;

  constructor(options: PaymentWebhookServiceOptions) {
    this.moosylProvider = options.moosylProvider;
    this.now = options.now ?? (() => new Date());
    this.paymentService = options.paymentService;
    this.repository = options.repository;
  }

  async handleMoosylWebhook(input: HandleMoosylWebhookInput) {
    const eventType = input.eventType?.trim() || 'unknown';
    const verified = await this.moosylProvider.verifyWebhook?.({
      rawBody: input.rawBody,
      signature: input.signature,
    });

    if (!verified?.signatureValid) {
      await this.recordWebhookEvent({
        eventType,
        idempotencyKey: `moosyl:invalid:${eventType}:${hashBody(input.rawBody)}`,
        processingStatus: 'failed',
        signatureValid: false,
        errorMessage: 'Invalid Moosyl webhook signature.',
      });
      throw new AppError(
        401,
        'payment_webhook_signature_invalid',
        'La signature du webhook Moosyl est invalide.',
      );
    }

    if (!MOOSYL_WEBHOOK_EVENTS.has(eventType)) {
      await this.recordWebhookEvent({
        eventType,
        idempotencyKey: `moosyl:unknown:${eventType}:${hashBody(input.rawBody)}`,
        processingStatus: 'ignored',
        signatureValid: true,
      });
      return {
        ignored: true,
        processed: false,
      };
    }

    const normalized = await this.moosylProvider.normalizeWebhookEvent?.({
      eventType,
      payload: input.payload,
    });

    if (!normalized) {
      throw new AppError(
        500,
        'payment_webhook_normalizer_missing',
        'Le normaliseur Moosyl est indisponible.',
      );
    }

    const idempotencyKey = buildWebhookIdempotencyKey({
      eventType,
      normalized,
      payload: input.payload,
      rawBody: input.rawBody,
    });
    const event = await this.recordWebhookEvent({
      eventType,
      idempotencyKey,
      processingStatus: 'received',
      signatureValid: true,
      ...(normalized.providerEventId ? { providerEventId: normalized.providerEventId } : {}),
      ...(normalized.providerTransactionId
        ? { providerTransactionId: normalized.providerTransactionId }
        : {}),
    });

    if (event.processingStatus === 'ignored') {
      return {
        ignored: true,
        processed: false,
      };
    }

    if (normalized.normalizedStatus === 'ignored') {
      await this.updateWebhookEvent(event.eventId, {
        processedAt: this.now().toISOString(),
        processingStatus: 'ignored',
      });
      return {
        ignored: true,
        processed: false,
      };
    }

    try {
      const result = await this.paymentService.processProviderWebhook(normalized);
      if ('mismatch' in result && result.mismatch) {
        await this.updateWebhookEvent(event.eventId, {
          errorMessage:
            'Le montant ou la devise confirmés par le prestataire ne correspondent pas au paiement.',
          processedAt: this.now().toISOString(),
          processingStatus: 'failed',
        });
        throw new AppError(
          409,
          'payment_provider_amount_mismatch',
          'Le montant ou la devise confirmés par le prestataire ne correspondent pas au paiement.',
        );
      }
      await this.updateWebhookEvent(event.eventId, {
        processedAt: this.now().toISOString(),
        processingStatus: result.ignored ? 'ignored' : 'processed',
      });
      return {
        ignored: result.ignored,
        processed: !result.ignored,
        receiptId: result.receiptId,
      };
    } catch (error) {
      await this.updateWebhookEvent(event.eventId, {
        errorMessage: error instanceof Error ? error.message : 'Webhook processing failed.',
        processedAt: this.now().toISOString(),
        processingStatus: 'failed',
      });
      throw error;
    }
  }

  private async recordWebhookEvent(input: {
    errorMessage?: string;
    eventType: string;
    idempotencyKey: string;
    processingStatus: ProviderWebhookEvent['processingStatus'];
    providerEventId?: string;
    providerTransactionId?: string;
    signatureValid: boolean;
  }) {
    return this.repository.runTransaction(async (transaction) => {
      const existing = await transaction.findPaymentWebhookEventByIdempotencyKey(
        input.idempotencyKey,
      );
      const timestamp = this.now().toISOString();
      const eventId = randomUUID();
      const isDuplicate =
        existing &&
        (existing.doc.processingStatus === 'processed' ||
          existing.doc.processingStatus === 'ignored' ||
          existing.doc.processingStatus === 'failed');
      const event: ProviderWebhookEvent = {
        eventId,
        eventType: input.eventType,
        idempotencyKey: input.idempotencyKey,
        processingStatus: isDuplicate ? 'ignored' : input.processingStatus,
        provider: 'moosyl',
        ...(input.providerEventId ? { providerEventId: input.providerEventId } : {}),
        ...(input.providerTransactionId
          ? { providerTransactionId: input.providerTransactionId }
          : {}),
        receivedAt: timestamp,
        signatureValid: input.signatureValid,
        ...(input.errorMessage ? { errorMessage: input.errorMessage } : {}),
      };

      transaction.setPaymentWebhookEvent(eventId, event);
      return event;
    });
  }

  private async updateWebhookEvent(eventId: string, patch: Partial<ProviderWebhookEvent>) {
    await this.repository.runTransaction(async (transaction) => {
      const event = await transaction.getPaymentWebhookEvent(eventId);

      if (!event) {
        return null;
      }

      transaction.updatePaymentWebhookEvent(eventId, patch);
      return null;
    });
  }
}
