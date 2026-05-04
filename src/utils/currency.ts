import { getIntlLocale } from '@/src/i18n/translations';

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat(getIntlLocale(), {
    style: 'currency',
    currency: 'MRU',
    maximumFractionDigits: 0,
  })
    .format(amount)
    .replace(/[\u00a0\u202f]/g, ' ');
}
