import { PAYMENT_PROVIDER_LIVE_ACK_VALUE, type AppConfig } from '../config/env.js';
import { AppError } from '../lib/errors.js';
import type { PaymentProviderName } from './types.js';

export interface PaymentRuntimeConfig {
  liveMode: boolean;
  moosyl?: {
    publicApiUrl: string;
    publicAppUrl: string;
    publishableKey: string;
    secretKey: string;
    webhookSecret: string;
  };
  provider: PaymentProviderName;
}

export function getPaymentRuntimeConfig(config: AppConfig): PaymentRuntimeConfig {
  const provider = config.paymentProvider;

  if (provider === 'simulated') {
    return {
      liveMode: config.paymentLiveMode,
      provider,
    };
  }

  if (
    !config.moosylSecretKey ||
    !config.moosylPublishableKey ||
    !config.moosylWebhookSecret ||
    !config.publicApiUrl ||
    !config.publicAppUrl
  ) {
    throw new AppError(
      500,
      'payment_provider_config_missing',
      'La configuration Moosyl du backend est incomplète.',
    );
  }

  if (
    config.paymentLiveMode &&
    config.paymentProviderLiveAck !== PAYMENT_PROVIDER_LIVE_ACK_VALUE
  ) {
    throw new AppError(
      500,
      'payment_live_ack_required',
      'La configuration Moosyl live exige une confirmation opérateur explicite.',
    );
  }

  return {
    liveMode: config.paymentLiveMode,
    moosyl: {
      publicApiUrl: config.publicApiUrl,
      publicAppUrl: config.publicAppUrl,
      publishableKey: config.moosylPublishableKey,
      secretKey: config.moosylSecretKey,
      webhookSecret: config.moosylWebhookSecret,
    },
    provider,
  };
}

export function assertRealProviderCallsAllowed(config: AppConfig) {
  if (config.paymentProvider === 'simulated') {
    return;
  }

  if (config.appVariant === 'production' && !config.paymentLiveMode) {
    throw new AppError(
      403,
      'payment_live_mode_required',
      'Les appels prestataire réels sont désactivés en production tant que PAYMENT_LIVE_MODE=false.',
    );
  }
}
