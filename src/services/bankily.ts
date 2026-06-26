import { BankilyIntegrationMode, OwnerUser, PaymentRecord } from '@/src/types';

export const DEFAULT_BANKILY_INTEGRATION_MODE: BankilyIntegrationMode = 'qr_or_code_manual';
export const BANKILY_APP_OPEN_URL = 'bankily://';

export function getOwnerBankilyIntegrationMode(owner: OwnerUser): BankilyIntegrationMode {
  return owner.bankilyIntegrationMode ?? DEFAULT_BANKILY_INTEGRATION_MODE;
}

export function getBankilyPaymentReference(payment: PaymentRecord) {
  return payment.referenceId || `ATP-${payment.id}`;
}

export function isUnverifiedBankilyDeepLinkAllowed(input: {
  appVariant: 'development' | 'preview' | 'production';
  mode: BankilyIntegrationMode;
}) {
  return input.mode !== 'deep_link_unverified' || input.appVariant !== 'production';
}

export function buildBankilyDeepLink(
  template: string,
  input: {
    amount: number;
    merchantCode?: string | null;
    phoneNumber?: string | null;
    reference: string;
  },
) {
  const recipient = input.merchantCode ?? input.phoneNumber ?? '';

  return template
    .replace(/\{amount\}/g, encodeURIComponent(String(input.amount)))
    .replace(/\{merchantCode\}/g, encodeURIComponent(input.merchantCode ?? ''))
    .replace(/\{phoneNumber\}/g, encodeURIComponent(input.phoneNumber ?? ''))
    .replace(/\{recipient\}/g, encodeURIComponent(recipient))
    .replace(/\{reference\}/g, encodeURIComponent(input.reference));
}

export function resolveBankilyOpenUrl(input: {
  amount: number;
  mode: BankilyIntegrationMode;
  owner: OwnerUser;
  reference: string;
}) {
  if (
    input.mode === 'deep_link_confirmed' ||
    input.mode === 'deep_link_unverified' ||
    input.owner.bankilyDeepLinkTemplate
  ) {
    if (!input.owner.bankilyDeepLinkTemplate) {
      return null;
    }

    return buildBankilyDeepLink(input.owner.bankilyDeepLinkTemplate, {
      amount: input.amount,
      merchantCode: input.owner.bankilyMerchantCode,
      phoneNumber: input.owner.bankilyPhoneNumber,
      reference: input.reference,
    });
  }

  return BANKILY_APP_OPEN_URL;
}
