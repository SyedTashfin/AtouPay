export interface PaymentProviderFinalizationInput {
  paymentMethod: string;
  receiptNumber: string;
}

export interface PaymentProviderFinalizationResult {
  providerReference: string;
  simulated: boolean;
}

export function finalizeSimulatedPaymentProvider(
  input: PaymentProviderFinalizationInput,
): PaymentProviderFinalizationResult {
  const methodPrefix = input.paymentMethod
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 12);

  return {
    providerReference: `SIM-${methodPrefix || 'PAY'}-${input.receiptNumber.slice(-10)}`,
    simulated: true,
  };
}
