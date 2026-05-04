import { AppError } from '../lib/errors.js';
import type { OwnerBillingAccount, OwnerBillingStatus } from './types.js';

export function canOwnerManageProperties(status: OwnerBillingStatus) {
  return status === 'active' || status === 'grace_period';
}

export function canOwnerCreateInvites(status: OwnerBillingStatus) {
  return status === 'active' || status === 'grace_period';
}

export function assertOwnerBillingWriteAllowed(
  account: OwnerBillingAccount,
  operationName: string,
) {
  const pastDueBlockedOperations = new Set([
    'create_property',
    'create_unit',
    'create_tenant_invite',
  ]);

  if (account.status === 'past_due' && pastDueBlockedOperations.has(operationName)) {
    throw new AppError(
      402,
      'owner_billing_past_due',
      `Veuillez régler les frais d’accès propriétaire pour continuer cette opération: ${operationName}.`,
    );
  }

  if (account.status === 'suspended') {
    throw new AppError(
      403,
      'owner_billing_suspended',
      'Votre compte propriétaire est suspendu. Contactez l’agence.',
    );
  }
}
