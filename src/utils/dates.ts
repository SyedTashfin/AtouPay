function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function normalizeDateValue(dateValue: string) {
  const normalized = dateValue.includes('T') ? dateValue : `${dateValue}T00:00:00`;

  return new Date(normalized);
}

export function getCurrentMonthKey(date = new Date()) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');

  return `${year}-${month}`;
}

export function getDefaultDueDate(monthKey = getCurrentMonthKey()) {
  return `${monthKey}-05`;
}

export function formatMonthLabel(monthKey: string) {
  const date = new Date(`${monthKey}-01T00:00:00`);

  return capitalize(
    new Intl.DateTimeFormat('fr-FR', {
      month: 'long',
      year: 'numeric',
    }).format(date),
  );
}

export function formatDateLabel(dateValue: string) {
  const date = normalizeDateValue(dateValue);

  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
    .format(date)
    .replace(/[\u00a0\u202f]/g, ' ');
}

export function formatCompactDate(dateValue: string) {
  const date = normalizeDateValue(dateValue);

  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
  })
    .format(date)
    .replace('.', '')
    .replace(/[\u00a0\u202f]/g, ' ');
}

export function formatDateTimeLabel(dateValue: string) {
  const date = normalizeDateValue(dateValue);

  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
    .format(date)
    .replace(/[\u00a0\u202f]/g, ' ');
}
