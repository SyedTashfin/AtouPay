export type PaymentProviderName = 'moosyl' | 'simulated';

export type RentPaymentProviderStatus =
  | 'requires_payment'
  | 'processing'
  | 'paid'
  | 'failed'
  | 'cancelled'
  | 'disputed'
  | 'refunded';

export interface PaymentIntent {
  intentId: string;
  paymentId: string;
  tenantId: string;
  ownerId: string;
  agencyId: string | null;
  propertyId: string;
  unitId: string;
  rentPeriodId?: string;
  provider: PaymentProviderName;
  status: RentPaymentProviderStatus;
  amount: number;
  currency: 'MRU';
  rentAmount: number;
  tenantFeeAmount: 0;
  platformRentFeeAmount: 0;
  agencyFeeAmount: 0;
  commissionRate: 0;
  ownerNetAmount: number;
  ownerReceivableAmount: number;
  idempotencyKey: string;
  providerRequestId?: string;
  providerTransactionId?: string;
  providerReference?: string;
  checkoutUrl?: string;
  createdAt: string;
  updatedAt: string;
  paidAt?: string;
  failedAt?: string;
  cancelledAt?: string;
}

export interface PaymentAttempt {
  attemptId: string;
  intentId: string;
  paymentId: string;
  tenantId: string;
  provider: PaymentProviderName;
  status: RentPaymentProviderStatus;
  providerTransactionId?: string;
  providerReference?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderTransaction {
  providerTransactionId: string;
  provider: PaymentProviderName;
  intentId: string;
  paymentId: string;
  rawProviderStatus?: string;
  normalizedStatus: RentPaymentProviderStatus;
  amount: number;
  currency: 'MRU';
  createdAt: string;
  updatedAt: string;
}

export interface ProviderWebhookEvent {
  eventId: string;
  provider: PaymentProviderName;
  providerEventId?: string;
  providerTransactionId?: string;
  eventType: string;
  receivedAt: string;
  processedAt?: string;
  processingStatus: 'received' | 'processed' | 'ignored' | 'failed';
  signatureValid: boolean;
  idempotencyKey: string;
  errorMessage?: string;
}

export interface PaymentReconciliationRecord {
  recordId: string;
  intentId: string;
  paymentId: string;
  provider: PaymentProviderName;
  providerTransactionId?: string;
  status: 'matched' | 'mismatch' | 'ignored';
  reason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRentPaymentIntentInput {
  agencyId: string | null;
  amount: number;
  idempotencyKey: string;
  intentId: string;
  ownerId: string;
  paymentId: string;
  propertyId: string;
  rentPeriodId?: string;
  tenantId: string;
  unitId: string;
}

export interface CreateRentPaymentIntentResult {
  checkoutUrl?: string;
  provider: PaymentProviderName;
  providerRequestId?: string;
  providerTransactionId?: string;
  publishableKey?: string;
  status: RentPaymentProviderStatus;
}

export interface GetPaymentStatusInput {
  providerTransactionId: string;
}

export interface GetPaymentStatusResult {
  providerReference?: string;
  rawProviderStatus?: string;
  status: RentPaymentProviderStatus;
}

export interface VerifyWebhookInput {
  rawBody: Buffer;
  signature: string | undefined;
}

export interface VerifyWebhookResult {
  signatureValid: boolean;
}

export interface NormalizeWebhookInput {
  eventType: string;
  payload: unknown;
}

export interface NormalizedWebhookEvent {
  amount?: number;
  currency?: string;
  eventType: string;
  normalizedStatus: RentPaymentProviderStatus | 'ignored';
  providerEventId?: string;
  providerReference?: string;
  providerRequestId?: string;
  providerTransactionId?: string;
  rawProviderStatus?: string;
}

export interface RentPaymentIntentOutput {
  amount: number;
  checkoutUrl?: string;
  currency: 'MRU';
  intentId: string;
  paymentId: string;
  provider: PaymentProviderName;
  publishableKey?: string;
  status: RentPaymentProviderStatus;
  transactionId?: string;
}

export interface RentPaymentStatusOutput {
  amount: number;
  currency: 'MRU';
  intentId: string | null;
  paymentId: string;
  paymentStatus: string;
  provider: PaymentProviderName | null;
  providerReference?: string | null;
  providerStatus: RentPaymentProviderStatus | null;
  receiptId: string | null;
}
