export const RENT_PAYMENT_CURRENCY = 'MRU' as const;
export const PAYMENT_PROVIDER_MOOSYL = 'moosyl' as const;
export const PAYMENT_PROVIDER_SIMULATED = 'simulated' as const;
export const MOOSYL_PAYMENT_REQUEST_URL = 'https://api.moosyl.com/payment-request';

export const MOOSYL_WEBHOOK_EVENTS = new Set([
  'payment-request-created',
  'payment-request-updated',
  'payment-created',
  'payment-updated',
]);
