import type { PaymentProvider } from '../paymentProvider.js';

export class SimulatedPaymentProvider implements PaymentProvider {
  readonly name = 'simulated' as const;

  async createRentPaymentIntent() {
    return {
      provider: this.name,
      status: 'requires_payment' as const,
    };
  }

  async getPaymentStatus() {
    return {
      status: 'requires_payment' as const,
    };
  }
}
