export type OwnerBillingStatus =
  | 'active'
  | 'grace_period'
  | 'past_due'
  | 'suspended';

export type OwnerBillingInvoiceStatus =
  | 'open'
  | 'paid'
  | 'overdue'
  | 'void';

export type OwnerBillingPaymentProvider =
  | 'simulated'
  | 'manual'
  | 'moosyl'
  | 'stripe';

export type OwnerBillingAccount = {
  ownerId: string;
  agencyId: string;
  status: OwnerBillingStatus;
  feeAmount: number;
  feeCurrency: 'EUR';
  intervalDays: number;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  nextPaymentDueAt: string;
  gracePeriodEndsAt?: string;
  lastPaidAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type OwnerBillingInvoice = {
  invoiceId: string;
  ownerId: string;
  agencyId: string;
  amount: number;
  currency: 'EUR';
  label: 'owner_account_access';
  periodStart: string;
  periodEnd: string;
  dueAt: string;
  status: OwnerBillingInvoiceStatus;
  provider: OwnerBillingPaymentProvider;
  providerReference?: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
  paidAt?: string;
};

export type OwnerBillingPayment = {
  billingPaymentId: string;
  invoiceId: string;
  ownerId: string;
  agencyId: string;
  amount: number;
  currency: 'EUR';
  provider: OwnerBillingPaymentProvider;
  providerReference?: string;
  status: 'recorded' | 'confirmed' | 'failed' | 'cancelled';
  createdAt: string;
  confirmedAt?: string;
  recordedByUserId?: string;
  note?: string;
};
