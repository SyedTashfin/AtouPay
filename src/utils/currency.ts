const formatter = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'MRU',
  maximumFractionDigits: 0,
});

export function formatCurrency(amount: number) {
  return formatter.format(amount).replace(/[\u00a0\u202f]/g, ' ');
}

