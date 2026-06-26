import type { RentPaymentProviderStatus } from './types.js';

const allowedTransitions = new Set<string>([
  'requires_payment->processing',
  'requires_payment->cancelled',
  'processing->paid',
  'processing->failed',
  'processing->cancelled',
  'processing->disputed',
  'paid->disputed',
  'paid->refunded',
  'failed->requires_payment',
  'cancelled->requires_payment',
]);

export function canTransitionPaymentStatus(
  from: RentPaymentProviderStatus,
  to: RentPaymentProviderStatus,
) {
  if (from === to) {
    return true;
  }

  return allowedTransitions.has(`${from}->${to}`);
}

export function isTerminalPaymentStatus(status: RentPaymentProviderStatus) {
  return status === 'paid' || status === 'cancelled' || status === 'refunded';
}
