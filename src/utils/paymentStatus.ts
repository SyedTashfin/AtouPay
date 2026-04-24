import { PaymentStatus } from '@/src/types';

export function formatPaymentStatusLabel(status?: PaymentStatus | null) {
  if (status === 'paid') {
    return 'Payé';
  }

  if (status === 'late') {
    return 'En retard';
  }

  if (status === 'failed') {
    return 'Échec';
  }

  if (status === 'cancelled') {
    return 'Annulé';
  }

  if (status === 'disputed') {
    return 'Contesté';
  }

  if (status === 'pending') {
    return 'En attente';
  }

  return 'En attente';
}
