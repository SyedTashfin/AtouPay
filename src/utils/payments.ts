import { PaymentAttemptResult, PaymentProvider } from '@/src/types';

function wait(durationMs: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });
}

export async function simulatePaymentProcessing(
  provider: PaymentProvider,
): Promise<PaymentAttemptResult> {
  await wait(1200);

  if (provider === 'Carte bancaire') {
    return {
      message:
        'La carte bancaire reste en mode test dans cette démo. Essayez Bankily, Sedad ou Masrvi.',
      ok: false,
      title: 'Paiement refusé',
    };
  }

  return {
    message: `Le règlement a été enregistré via ${provider}.`,
    ok: true,
    title: 'Paiement confirmé',
  };
}

