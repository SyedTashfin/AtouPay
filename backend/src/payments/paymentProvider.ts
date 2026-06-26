import type {
  CreateRentPaymentIntentInput,
  CreateRentPaymentIntentResult,
  GetPaymentStatusInput,
  GetPaymentStatusResult,
  NormalizeWebhookInput,
  NormalizedWebhookEvent,
  PaymentProviderName,
  VerifyWebhookInput,
  VerifyWebhookResult,
} from './types.js';

export interface PaymentProvider {
  name: PaymentProviderName;

  createRentPaymentIntent(
    input: CreateRentPaymentIntentInput,
  ): Promise<CreateRentPaymentIntentResult>;

  getPaymentStatus(input: GetPaymentStatusInput): Promise<GetPaymentStatusResult>;

  verifyWebhook?(input: VerifyWebhookInput): Promise<VerifyWebhookResult>;

  normalizeWebhookEvent?(input: NormalizeWebhookInput): Promise<NormalizedWebhookEvent>;
}
