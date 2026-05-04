import { randomUUID } from 'node:crypto';

import type { UserDoc } from '../domain/types.js';
import { AppError } from '../lib/errors.js';
import type { DataRepository, TransactionContext } from '../repositories/types.js';
import {
  OWNER_ACCOUNT_FEE_AMOUNT,
  OWNER_ACCOUNT_FEE_CURRENCY,
  OWNER_ACCOUNT_FEE_INTERVAL_DAYS,
} from './billingConstants.js';
import {
  addDays,
  buildInitialOwnerBillingAccount,
  calculateOwnerBillingStatus,
  extendOwnerBillingPeriod,
} from './billingStatus.js';
import {
  assertOwnerBillingWriteAllowed,
  canOwnerCreateInvites,
  canOwnerManageProperties,
} from './billingAccessGuard.js';
import type {
  OwnerBillingAccount,
  OwnerBillingInvoice,
  OwnerBillingInvoiceStatus,
  OwnerBillingPayment,
  OwnerBillingPaymentProvider,
} from './types.js';

export interface OwnerBillingSummary {
  account: OwnerBillingAccount;
  activeUntil: string;
  canCreateInvites: boolean;
  canManageProperties: boolean;
  feeAmount: number;
  feeCurrency: 'EUR';
  intervalDays: number;
  latestInvoice: OwnerBillingInvoice | null;
  nextPaymentDueAt: string;
  statusMessage: string;
}

export interface AgencyOwnerBillingSummary {
  account: OwnerBillingAccount;
  activeUntil: string;
  canCreateInvites: boolean;
  canManageProperties: boolean;
  latestInvoice: OwnerBillingInvoice | null;
  nextPaymentDueAt: string;
  owner: {
    displayName: string;
    email: string;
    ownerId: string;
    status: UserDoc['status'];
    uid: string;
  };
  statusMessage: string;
}

interface OwnerBillingServiceOptions {
  now?: () => Date;
  repository: DataRepository;
}

export interface MarkOwnerBillingInvoicePaidInput {
  actorRole: 'agency_admin' | 'owner' | 'system';
  actorUserId: string;
  agencyId: string;
  note?: string;
  ownerId: string;
  provider: Extract<OwnerBillingPaymentProvider, 'manual' | 'simulated'>;
  providerReference?: string;
}

function latestInvoiceFromList(invoices: Array<{ doc: OwnerBillingInvoice; id: string }>) {
  return invoices
    .map(({ doc }) => doc)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null;
}

function findPayableInvoice(invoices: OwnerBillingInvoice[]) {
  return invoices
    .filter((invoice) => invoice.status === 'open' || invoice.status === 'overdue')
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null;
}

function statusMessage(account: OwnerBillingAccount) {
  if (account.status === 'active') {
    return 'Votre compte propriétaire est actif.';
  }

  if (account.status === 'grace_period') {
    return 'Votre période d’accès est dépassée. Veuillez régler les frais d’accès pour éviter une suspension.';
  }

  if (account.status === 'past_due') {
    return 'Veuillez régler les frais d’accès propriétaire pour continuer à créer des biens, unités et invitations.';
  }

  return 'Votre compte propriétaire est suspendu. Contactez l’agence.';
}

function summarize(account: OwnerBillingAccount, latestInvoice: OwnerBillingInvoice | null): OwnerBillingSummary {
  return {
    account,
    activeUntil: account.currentPeriodEnd,
    canCreateInvites: canOwnerCreateInvites(account.status),
    canManageProperties: canOwnerManageProperties(account.status),
    feeAmount: account.feeAmount,
    feeCurrency: account.feeCurrency,
    intervalDays: account.intervalDays,
    latestInvoice,
    nextPaymentDueAt: account.nextPaymentDueAt,
    statusMessage: statusMessage(account),
  };
}

function markInvoiceOverdueIfNeeded(
  invoice: OwnerBillingInvoice,
  now: Date,
): OwnerBillingInvoice {
  if (invoice.status !== 'open') {
    return invoice;
  }

  if (new Date(invoice.dueAt).getTime() >= now.getTime()) {
    return invoice;
  }

  return {
    ...invoice,
    status: 'overdue',
    updatedAt: now.toISOString(),
  };
}

function createInvoiceFromAccount(account: OwnerBillingAccount, now: Date): OwnerBillingInvoice {
  const isOverdue = new Date(account.nextPaymentDueAt).getTime() < now.getTime();
  const periodStart = isOverdue ? now.toISOString() : account.currentPeriodEnd;
  const periodEnd = addDays(new Date(periodStart), account.intervalDays).toISOString();
  const invoiceId = randomUUID();

  return {
    agencyId: account.agencyId,
    amount: account.feeAmount,
    createdAt: now.toISOString(),
    currency: account.feeCurrency,
    dueAt: isOverdue ? now.toISOString() : account.nextPaymentDueAt,
    invoiceId,
    label: 'owner_account_access',
    ownerId: account.ownerId,
    periodEnd,
    periodStart,
    provider: 'simulated',
    status: isOverdue ? 'overdue' : 'open',
    updatedAt: now.toISOString(),
  };
}

export class OwnerBillingService {
  private readonly now: () => Date;
  private readonly repository: DataRepository;

  constructor(options: OwnerBillingServiceOptions) {
    this.now = options.now ?? (() => new Date());
    this.repository = options.repository;
  }

  async getOrCreateOwnerBillingAccount(ownerId: string, agencyId: string) {
    return this.repository.runTransaction(async (transaction) => {
      const account = await transaction.getOwnerBillingAccount(ownerId);

      return this.resolveOwnerBillingAccountInTransaction(
        transaction,
        ownerId,
        agencyId,
        account,
      );
    });
  }

  async getOwnerBillingSummary(ownerId: string) {
    return this.repository.runTransaction(async (transaction) => {
      const owner = await transaction.getOwner(ownerId);

      if (!owner?.agencyId) {
        throw new AppError(
          409,
          'owner_agency_missing',
          'Le propriétaire n’est rattaché à aucune agence.',
        );
      }

      const existingAccount = await transaction.getOwnerBillingAccount(ownerId);
      const invoices = await transaction.listOwnerBillingInvoicesByOwner(ownerId);
      const account = this.resolveOwnerBillingAccountInTransaction(
        transaction,
        ownerId,
        owner.agencyId,
        existingAccount,
      );
      const latestInvoice = latestInvoiceFromList(invoices);

      return summarize(account, latestInvoice);
    });
  }

  async createOwnerBillingInvoiceIfNeeded(ownerId: string, agencyId: string) {
    return this.repository.runTransaction(async (transaction) => {
      const existingAccount = await transaction.getOwnerBillingAccount(ownerId);
      const invoices = await transaction.listOwnerBillingInvoicesByOwner(ownerId);
      const account = this.resolveOwnerBillingAccountInTransaction(
        transaction,
        ownerId,
        agencyId,
        existingAccount,
      );
      const invoice = this.createOwnerBillingInvoiceIfNeededInTransaction(
        transaction,
        account,
        invoices.map(({ doc }) => doc),
      );

      return invoice;
    });
  }

  async markOwnerBillingInvoicePaid(input: MarkOwnerBillingInvoicePaidInput) {
    return this.repository.runTransaction(async (transaction) =>
      this.markOwnerBillingInvoicePaidInTransaction(transaction, input),
    );
  }

  async extendOwnerAccess(ownerId: string, paidAt: Date) {
    return this.repository.runTransaction(async (transaction) => {
      const account = await transaction.getOwnerBillingAccount(ownerId);

      if (!account) {
        throw new AppError(
          404,
          'owner_billing_account_missing',
          'Le compte de facturation propriétaire est introuvable.',
        );
      }

      const nextAccount = extendOwnerBillingPeriod({ account, paidAt });
      transaction.updateOwnerBillingAccount(ownerId, nextAccount);

      return nextAccount;
    });
  }

  async recalculateOwnerBillingStatus(ownerId: string) {
    return this.repository.runTransaction(async (transaction) => {
      const account = await transaction.getOwnerBillingAccount(ownerId);

      if (!account) {
        throw new AppError(
          404,
          'owner_billing_account_missing',
          'Le compte de facturation propriétaire est introuvable.',
        );
      }

      return this.recalculateOwnerBillingStatusInTransaction(transaction, account);
    });
  }

  async suspendOwnerBillingAccount(ownerId: string, reason: string, actorUserId: string) {
    const timestamp = this.now().toISOString();

    return this.repository.runTransaction(async (transaction) => {
      const account = await this.getExistingAccountForMutation(transaction, ownerId);
      const invoices = await transaction.listOwnerBillingInvoicesByOwner(ownerId);
      const nextAccount: OwnerBillingAccount = {
        ...account,
        status: 'suspended',
        updatedAt: timestamp,
      };

      transaction.updateOwnerBillingAccount(ownerId, {
        status: 'suspended',
        updatedAt: timestamp,
      });
      this.recordAudit(transaction, {
        actorRole: 'agency_admin',
        actorUserId,
        agencyId: account.agencyId,
        entityId: ownerId,
        entityType: 'ownerBillingAccount',
        eventType: 'owner_billing_suspended',
        metadata: {
          reason,
        },
        targetUid: ownerId,
        timestamp,
      });
      this.createNotification(transaction, {
        agencyId: account.agencyId,
        body: 'Votre compte propriétaire est suspendu. Contactez l’agence.',
        relatedEntityId: ownerId,
        relatedEntityType: 'ownerBillingAccount',
        role: 'owner',
        timestamp,
        title: 'Compte propriétaire suspendu',
        type: 'owner_billing_suspended',
        userId: ownerId,
      });

      return summarize(nextAccount, latestInvoiceFromList(invoices));
    });
  }

  async reactivateOwnerBillingAccount(ownerId: string, actorUserId: string) {
    const timestamp = this.now().toISOString();

    return this.repository.runTransaction(async (transaction) => {
      const account = await this.getExistingAccountForMutation(transaction, ownerId);
      const invoices = await transaction.listOwnerBillingInvoicesByOwner(ownerId);
      const recalculated = calculateOwnerBillingStatus(
        {
          ...account,
          status: 'active',
        },
        this.now(),
      );
      const nextAccount: OwnerBillingAccount = {
        ...account,
        gracePeriodEndsAt: recalculated.gracePeriodEndsAt,
        status: recalculated.status,
        updatedAt: timestamp,
      };

      transaction.updateOwnerBillingAccount(ownerId, {
        gracePeriodEndsAt: recalculated.gracePeriodEndsAt,
        status: nextAccount.status,
        updatedAt: timestamp,
      });
      this.recordAudit(transaction, {
        actorRole: 'agency_admin',
        actorUserId,
        agencyId: account.agencyId,
        entityId: ownerId,
        entityType: 'ownerBillingAccount',
        eventType: 'owner_billing_reactivated',
        metadata: {
          status: nextAccount.status,
        },
        targetUid: ownerId,
        timestamp,
      });
      this.createNotification(transaction, {
        agencyId: account.agencyId,
        body: 'Votre compte propriétaire a été réactivé par l’agence.',
        relatedEntityId: ownerId,
        relatedEntityType: 'ownerBillingAccount',
        role: 'owner',
        timestamp,
        title: 'Compte propriétaire réactivé',
        type: 'owner_billing_reactivated',
        userId: ownerId,
      });

      return summarize(nextAccount, latestInvoiceFromList(invoices));
    });
  }

  async assertOwnerCanPerformWriteOperation(ownerId: string, operationName: string) {
    const summary = await this.getOwnerBillingSummary(ownerId);
    assertOwnerBillingWriteAllowed(summary.account, operationName);
  }

  async listAgencyOwnerBilling(agencyId: string, owners: UserDoc[]) {
    return Promise.all(
      owners
        .filter((owner) => owner.role === 'owner' && owner.ownerId)
        .map(async (owner): Promise<AgencyOwnerBillingSummary> => {
          const summary = await this.getOwnerBillingSummary(owner.ownerId!);

          return {
            account: summary.account,
            activeUntil: summary.activeUntil,
            canCreateInvites: summary.canCreateInvites,
            canManageProperties: summary.canManageProperties,
            latestInvoice: summary.latestInvoice,
            nextPaymentDueAt: summary.nextPaymentDueAt,
            owner: {
              displayName: owner.displayName,
              email: owner.email,
              ownerId: owner.ownerId!,
              status: owner.status,
              uid: owner.uid,
            },
            statusMessage: summary.statusMessage,
          };
        }),
    );
  }

  private async getExistingAccountForMutation(transaction: TransactionContext, ownerId: string) {
    const account = await transaction.getOwnerBillingAccount(ownerId);

    if (!account) {
      throw new AppError(
        404,
        'owner_billing_account_missing',
        'Le compte de facturation propriétaire est introuvable.',
      );
    }

    return account;
  }

  private resolveOwnerBillingAccountInTransaction(
    transaction: TransactionContext,
    ownerId: string,
    agencyId: string,
    account: OwnerBillingAccount | null,
  ) {
    if (!account) {
      const nextAccount = buildInitialOwnerBillingAccount({
        agencyId,
        now: this.now(),
        ownerId,
      });
      transaction.setOwnerBillingAccount(ownerId, nextAccount);
      return nextAccount;
    }

    const nextStatus = calculateOwnerBillingStatus(account, this.now());
    const nextAccount: OwnerBillingAccount = {
      ...account,
      agencyId,
      feeAmount: account.feeAmount || OWNER_ACCOUNT_FEE_AMOUNT,
      feeCurrency: account.feeCurrency || OWNER_ACCOUNT_FEE_CURRENCY,
      gracePeriodEndsAt: nextStatus.gracePeriodEndsAt,
      intervalDays: account.intervalDays || OWNER_ACCOUNT_FEE_INTERVAL_DAYS,
      status: nextStatus.status,
      updatedAt: nextStatus.status === account.status ? account.updatedAt : this.now().toISOString(),
    };

    if (
      nextAccount.agencyId !== account.agencyId ||
      nextAccount.feeAmount !== account.feeAmount ||
      nextAccount.feeCurrency !== account.feeCurrency ||
      nextAccount.gracePeriodEndsAt !== account.gracePeriodEndsAt ||
      nextAccount.intervalDays !== account.intervalDays ||
      nextAccount.status !== account.status ||
      nextAccount.updatedAt !== account.updatedAt
    ) {
      transaction.updateOwnerBillingAccount(ownerId, {
        agencyId: nextAccount.agencyId,
        feeAmount: nextAccount.feeAmount,
        feeCurrency: nextAccount.feeCurrency,
        gracePeriodEndsAt: nextStatus.gracePeriodEndsAt,
        intervalDays: nextAccount.intervalDays,
        status: nextAccount.status,
        updatedAt: nextAccount.updatedAt,
      });
    }

    return nextAccount;
  }

  private createOwnerBillingInvoiceIfNeededInTransaction(
    transaction: TransactionContext,
    account: OwnerBillingAccount,
    invoices: OwnerBillingInvoice[],
  ) {
    const now = this.now();
    const payableInvoice = findPayableInvoice(invoices);

    if (payableInvoice) {
      const normalizedInvoice = markInvoiceOverdueIfNeeded(payableInvoice, now);

      if (normalizedInvoice.status !== payableInvoice.status) {
        transaction.updateOwnerBillingInvoice(payableInvoice.invoiceId, {
          status: normalizedInvoice.status,
          updatedAt: normalizedInvoice.updatedAt,
        });
      }

      return normalizedInvoice;
    }

    const invoice = createInvoiceFromAccount(account, now);
    transaction.setOwnerBillingInvoice(invoice.invoiceId, invoice);

    return invoice;
  }

  private async markOwnerBillingInvoicePaidInTransaction(
    transaction: TransactionContext,
    input: MarkOwnerBillingInvoicePaidInput,
  ) {
    const existingAccount = await transaction.getOwnerBillingAccount(input.ownerId);
    const invoices = (await transaction.listOwnerBillingInvoicesByOwner(input.ownerId)).map(({ doc }) => doc);
    const account = this.resolveOwnerBillingAccountInTransaction(
      transaction,
      input.ownerId,
      input.agencyId,
      existingAccount,
    );
    const invoice = this.createOwnerBillingInvoiceIfNeededInTransaction(transaction, account, invoices);
    const paidAt = this.now();
    const paidAtIso = paidAt.toISOString();
    const billingPaymentId = randomUUID();
    const nextAccount = extendOwnerBillingPeriod({ account, paidAt });
    const payment: OwnerBillingPayment = {
      agencyId: input.agencyId,
      amount: invoice.amount,
      billingPaymentId,
      confirmedAt: paidAtIso,
      createdAt: paidAtIso,
      currency: invoice.currency,
      invoiceId: invoice.invoiceId,
      ownerId: input.ownerId,
      provider: input.provider,
      recordedByUserId: input.actorUserId,
      status: 'confirmed',
      ...(input.note ? { note: input.note } : {}),
      ...(input.providerReference ? { providerReference: input.providerReference } : {}),
    };
    const paidInvoice: OwnerBillingInvoice = {
      ...invoice,
      paidAt: paidAtIso,
      provider: input.provider,
      status: 'paid',
      updatedAt: paidAtIso,
      ...(input.note ? { note: input.note } : {}),
      ...(input.providerReference ? { providerReference: input.providerReference } : {}),
    };

    transaction.updateOwnerBillingAccount(input.ownerId, nextAccount);
    transaction.updateOwnerBillingInvoice(invoice.invoiceId, {
      paidAt: paidAtIso,
      provider: paidInvoice.provider,
      status: paidInvoice.status,
      updatedAt: paidInvoice.updatedAt,
      ...(paidInvoice.note ? { note: paidInvoice.note } : {}),
      ...(paidInvoice.providerReference
        ? { providerReference: paidInvoice.providerReference }
        : {}),
    });
    transaction.setOwnerBillingPayment(billingPaymentId, payment);
    this.recordAudit(transaction, {
      actorRole: input.actorRole,
      actorUserId: input.actorUserId,
      agencyId: input.agencyId,
      entityId: invoice.invoiceId,
      entityType: 'ownerBillingInvoice',
      eventType: 'owner_billing_paid',
      metadata: {
        amount: invoice.amount,
        billingPaymentId,
        currency: invoice.currency,
        provider: input.provider,
      },
      targetUid: input.ownerId,
      timestamp: paidAtIso,
    });
    this.createNotification(transaction, {
      agencyId: input.agencyId,
      body: 'Les frais d’accès propriétaire ont été enregistrés. Votre période d’accès est prolongée.',
      relatedEntityId: invoice.invoiceId,
      relatedEntityType: 'ownerBillingInvoice',
      role: 'owner',
      timestamp: paidAtIso,
      title: 'Frais d’accès réglés',
      type: 'owner_billing_paid',
      userId: input.ownerId,
    });

    return summarize(nextAccount, paidInvoice);
  }

  private async recalculateOwnerBillingStatusInTransaction(
    transaction: TransactionContext,
    account: OwnerBillingAccount,
  ) {
    const nextStatus = calculateOwnerBillingStatus(account, this.now());
    const nextAccount: OwnerBillingAccount = {
      ...account,
      gracePeriodEndsAt: nextStatus.gracePeriodEndsAt,
      status: nextStatus.status,
      updatedAt: nextStatus.status === account.status ? account.updatedAt : this.now().toISOString(),
    };

    if (nextAccount.status !== account.status || nextAccount.gracePeriodEndsAt !== account.gracePeriodEndsAt) {
      transaction.updateOwnerBillingAccount(account.ownerId, {
        gracePeriodEndsAt: nextStatus.gracePeriodEndsAt,
        status: nextAccount.status,
        updatedAt: nextAccount.updatedAt,
      });
    }

    return nextAccount;
  }

  private recordAudit(
    transaction: TransactionContext,
    input: {
      actorRole: 'agency_admin' | 'owner' | 'system';
      actorUserId: string | null;
      agencyId: string | null;
      entityId: string | null;
      entityType: string;
      eventType:
        | 'owner_billing_paid'
        | 'owner_billing_reactivated'
        | 'owner_billing_suspended';
      metadata: Record<string, boolean | number | string | null>;
      targetUid?: string | null;
      timestamp: string;
    },
  ) {
    transaction.setAuditLog(randomUUID(), {
      actorRole: input.actorRole,
      actorUid: input.actorUserId,
      agencyId: input.agencyId,
      createdAt: input.timestamp,
      entityId: input.entityId,
      entityType: input.entityType,
      eventType: input.eventType,
      metadata: input.metadata,
      targetUid: input.targetUid ?? null,
    });
  }

  private createNotification(
    transaction: TransactionContext,
    input: {
      agencyId: string | null;
      body: string;
      relatedEntityId: string | null;
      relatedEntityType: string | null;
      role: 'agency_admin' | 'owner' | 'tenant';
      timestamp: string;
      title: string;
      type:
        | 'owner_billing_paid'
        | 'owner_billing_reactivated'
        | 'owner_billing_suspended';
      userId?: string | null;
    },
  ) {
    transaction.setNotification(randomUUID(), {
      agencyId: input.agencyId,
      body: input.body,
      createdAt: input.timestamp,
      readAt: null,
      relatedEntityId: input.relatedEntityId,
      relatedEntityType: input.relatedEntityType,
      role: input.role,
      title: input.title,
      type: input.type,
      userId: input.userId ?? null,
    });
  }
}
