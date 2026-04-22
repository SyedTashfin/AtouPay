function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
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
  const date = new Date(`${dateValue}T00:00:00`);

  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
    .format(date)
    .replace(/[\u00a0\u202f]/g, ' ');
}

export function formatCompactDate(dateValue: string) {
  const date = new Date(`${dateValue}T00:00:00`);

  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
  })
    .format(date)
    .replace('.', '')
    .replace(/[\u00a0\u202f]/g, ' ');
}

