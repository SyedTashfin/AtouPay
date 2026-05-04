import {
  OWNER_ACCOUNT_FEE_AMOUNT,
  OWNER_ACCOUNT_FEE_CURRENCY,
  OWNER_ACCOUNT_FEE_INTERVAL_DAYS,
  OWNER_ACCOUNT_GRACE_PERIOD_DAYS,
} from './billingConstants.js';
import type { OwnerBillingAccount, OwnerBillingStatus } from './types.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * DAY_MS);
}

export function calculateOwnerBillingStatus(
  account: OwnerBillingAccount,
  now: Date,
): {
  gracePeriodEndsAt: string;
  status: OwnerBillingStatus;
} {
  if (account.status === 'suspended') {
    return {
      gracePeriodEndsAt:
        account.gracePeriodEndsAt ?? addDays(new Date(account.currentPeriodEnd), OWNER_ACCOUNT_GRACE_PERIOD_DAYS).toISOString(),
      status: 'suspended',
    };
  }

  const currentPeriodEnd = new Date(account.currentPeriodEnd);
  const gracePeriodEndsAt = addDays(currentPeriodEnd, OWNER_ACCOUNT_GRACE_PERIOD_DAYS).toISOString();

  if (now.getTime() <= currentPeriodEnd.getTime()) {
    return {
      gracePeriodEndsAt,
      status: 'active',
    };
  }

  if (now.getTime() <= new Date(gracePeriodEndsAt).getTime()) {
    return {
      gracePeriodEndsAt,
      status: 'grace_period',
    };
  }

  return {
    gracePeriodEndsAt,
    status: 'past_due',
  };
}
export function buildInitialOwnerBillingAccount(input: {
  agencyId: string;
  now: Date;
  ownerId: string;
}): OwnerBillingAccount {
  const currentPeriodStart = input.now.toISOString();
  const currentPeriodEnd = addDays(input.now, OWNER_ACCOUNT_FEE_INTERVAL_DAYS).toISOString();

  return {
    agencyId: input.agencyId,
    createdAt: currentPeriodStart,
    currentPeriodEnd,
    currentPeriodStart,
    feeAmount: OWNER_ACCOUNT_FEE_AMOUNT,
    feeCurrency: OWNER_ACCOUNT_FEE_CURRENCY,
    gracePeriodEndsAt: addDays(new Date(currentPeriodEnd), OWNER_ACCOUNT_GRACE_PERIOD_DAYS).toISOString(),
    intervalDays: OWNER_ACCOUNT_FEE_INTERVAL_DAYS,
    nextPaymentDueAt: currentPeriodEnd,
    ownerId: input.ownerId,
    status: 'active',
    updatedAt: currentPeriodStart,
  };
}

export function extendOwnerBillingPeriod(input: {
  account: OwnerBillingAccount;
  paidAt: Date;
}): OwnerBillingAccount {
  const currentEnd = new Date(input.account.currentPeriodEnd);
  const extensionBase =
    Number.isFinite(currentEnd.getTime()) && currentEnd.getTime() > input.paidAt.getTime()
      ? currentEnd
      : input.paidAt;
  const currentPeriodStart = extensionBase.toISOString();
  const currentPeriodEnd = addDays(extensionBase, input.account.intervalDays).toISOString();
  const gracePeriodEndsAt = addDays(new Date(currentPeriodEnd), OWNER_ACCOUNT_GRACE_PERIOD_DAYS).toISOString();
  const updatedAt = input.paidAt.toISOString();

  return {
    ...input.account,
    currentPeriodEnd,
    currentPeriodStart,
    gracePeriodEndsAt,
    lastPaidAt: updatedAt,
    nextPaymentDueAt: currentPeriodEnd,
    status: 'active',
    updatedAt,
  };
}
