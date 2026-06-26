import { createHash, randomUUID } from 'node:crypto';

import type { AppConfig } from '../config/env.js';
import type {
  AuditLogDoc,
  AuthContext,
  NotificationDoc,
  PaymentStatus,
  ReceiptDoc,
  RentPaymentDoc,
  UserDoc,
} from '../domain/types.js';
import { AppError } from '../lib/errors.js';
import type { DataRepository, TransactionContext } from '../repositories/types.js';
import { RENT_PAYMENT_CURRENCY } from './paymentConstants.js';
import { assertRealProviderCallsAllowed, getPaymentRuntimeConfig } from './paymentConfig.js';
import type { PaymentProvider } from './paymentProvider.js';
import { canTransitionPaymentStatus, isTerminalPaymentStatus } from './paymentStatusTransitions.js';
import { MoosylPaymentProvider, type MoosylHttpClient } from './providers/moosylPaymentProvider.js';
import { SimulatedPaymentProvider } from './providers/simulatedPaymentProvider.js';
import type {
  CreateRentPaymentIntentInput,
  NormalizedWebhookEvent,
  PaymentAttempt,
  PaymentIntent,
  PaymentProviderName,
  ProviderTransaction,
  RentPaymentIntentOutput,
  RentPaymentProviderStatus,
  RentPaymentStatusOutput,
} from './types.js';

interface PaymentServiceOptions {
  config: AppConfig;
  moosylHttpClient?: MoosylHttpClient | undefined;
  now?: () => Date;
  providers?: Partial<Record<PaymentProviderName, PaymentProvider>> | undefined;
  repository: DataRepository;
}

interface PreparedPaymentIntent {
  intent: PaymentIntent;
  needsProviderCreation: boolean;
}

function assertRole(user: UserDoc | null, role: UserDoc['role']) {
  if (!user) {
    throw new AppError(
      409,
      'profile_not_bootstrapped',
      'Le profil applicatif ATouPay doit être initialisé avant cette opération.',
    );
  }

  if (user.role !== role) {
    throw new AppError(
      403,
      'forbidden_role',
      'Ce compte ne peut pas exécuter cette action avec son rôle actuel.',
    );
  }

  return user;
}

function assertActiveTenant(user: UserDoc | null) {
  const tenant = assertRole(user, 'tenant');

  if (tenant.status !== 'active') {
    throw new AppError(
      403,
      'tenant_inactive',
      'Ce compte locataire n’est pas autorisé à poursuivre cette opération.',
    );
  }

  return tenant;
}

function assertActiveReadableUser(user: UserDoc | null) {
  if (!user) {
    throw new AppError(
      409,
      'profile_not_bootstrapped',
      'Le profil applicatif ATouPay doit être initialisé avant cette opération.',
    );
  }

  if (user.status !== 'active') {
    throw new AppError(
      403,
      'account_inactive',
      'Ce compte n’est pas autorisé à accéder à cette opération.',
    );
  }

  return user;
}

function buildReceiptNumber(now: Date) {
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  const suffix = randomUUID().replace(/-/g, '').toUpperCase().slice(0, 6);

  return `ATP-${year}${month}${day}-${suffix}`;
}

function mapPaymentStatus(status: RentPaymentProviderStatus): PaymentStatus {
  if (status === 'paid') {
    return 'paid';
  }

  if (status === 'failed') {
    return 'failed';
  }

  if (status === 'cancelled') {
    return 'cancelled';
  }

  if (status === 'disputed') {
    return 'disputed';
  }

  return 'pending';
}

function isPayableRentStatus(status: PaymentStatus) {
  return status === 'pending' || status === 'late' || status === 'failed' || status === 'cancelled';
}

function resolveRentAmount(payment: RentPaymentDoc) {
  return payment.rentAmount ?? payment.grossAmount;
}

function buildZeroFeeLedger(rentAmount: number) {
  return {
    agencyFeeAmount: 0,
    commissionRate: 0,
    grossAmount: rentAmount,
    ownerNetAmount: rentAmount,
    ownerReceivableAmount: rentAmount,
    platformRentFeeAmount: 0,
    rentAmount,
    tenantFeeAmount: 0,
  } satisfies Pick<
    PaymentIntent,
    | 'agencyFeeAmount'
    | 'commissionRate'
    | 'ownerNetAmount'
    | 'ownerReceivableAmount'
    | 'platformRentFeeAmount'
    | 'rentAmount'
    | 'tenantFeeAmount'
  > & { grossAmount: number };
}

function buildIdempotencyKey(input: {
  paymentId: string;
  provider: PaymentProviderName;
  rentAmount: number;
}) {
  return createHash('sha256')
    .update(`${input.provider}:${input.paymentId}:${input.rentAmount}`)
    .digest('hex');
}

function latestIntent(intents: PaymentIntent[]) {
  return intents.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null;
}

function isReusableIntent(intent: PaymentIntent) {
  return intent.status === 'requires_payment' || intent.status === 'processing' || intent.status === 'paid';
}

export class PaymentService {
  private readonly config: AppConfig;
  private readonly now: () => Date;
  private readonly providers: Record<PaymentProviderName, PaymentProvider>;
  private readonly repository: DataRepository;

  constructor(options: PaymentServiceOptions) {
    this.config = options.config;
    this.now = options.now ?? (() => new Date());
    this.repository = options.repository;
    const runtimeConfig = getPaymentRuntimeConfig(options.config);
    const simulatedProvider = new SimulatedPaymentProvider();
    const moosylProvider = runtimeConfig.moosyl
      ? new MoosylPaymentProvider({
          ...(options.moosylHttpClient ? { httpClient: options.moosylHttpClient } : {}),
          publishableKey: runtimeConfig.moosyl.publishableKey,
          secretKey: runtimeConfig.moosyl.secretKey,
          webhookSecret: runtimeConfig.moosyl.webhookSecret,
        })
      : undefined;

    this.providers = {
      moosyl:
        options.providers?.moosyl ??
        moosylProvider ??
        new SimulatedPaymentProvider(),
      simulated: options.providers?.simulated ?? simulatedProvider,
    };
  }

  async createRentPaymentIntent(identity: AuthContext, paymentId: string) {
    const providerName = this.config.paymentProvider;

    if (providerName !== 'simulated') {
      assertRealProviderCallsAllowed(this.config);
    }

    const prepared = await this.prepareRentPaymentIntent(identity, paymentId, providerName);
    const provider = this.providers[providerName];

    if (!prepared.needsProviderCreation) {
      return this.intentOutput(prepared.intent);
    }

    const providerResult = await provider.createRentPaymentIntent({
      agencyId: prepared.intent.agencyId,
      amount: prepared.intent.amount,
      idempotencyKey: prepared.intent.idempotencyKey,
      intentId: prepared.intent.intentId,
      ownerId: prepared.intent.ownerId,
      paymentId: prepared.intent.paymentId,
      propertyId: prepared.intent.propertyId,
      ...(prepared.intent.rentPeriodId ? { rentPeriodId: prepared.intent.rentPeriodId } : {}),
      tenantId: prepared.intent.tenantId,
      unitId: prepared.intent.unitId,
    });

    return this.repository.runTransaction(async (transaction) => {
      const currentIntent = await transaction.getPaymentIntent(prepared.intent.intentId);

      if (!currentIntent) {
        throw new AppError(
          404,
          'payment_intent_missing',
          'L’intention de paiement est introuvable.',
        );
      }

      const timestamp = this.now().toISOString();
      const providerTransactionId =
        providerResult.providerTransactionId ?? currentIntent.providerTransactionId;
      const existingTransaction = providerTransactionId
        ? await transaction.getProviderTransaction(providerTransactionId)
        : null;
      const nextIntent: PaymentIntent = {
        ...currentIntent,
        ...(providerResult.checkoutUrl ? { checkoutUrl: providerResult.checkoutUrl } : {}),
        ...(providerResult.providerRequestId
          ? { providerRequestId: providerResult.providerRequestId }
          : {}),
        ...(providerTransactionId ? { providerTransactionId } : {}),
        status: providerResult.status,
        updatedAt: timestamp,
      };
      transaction.updatePaymentIntent(currentIntent.intentId, {
        ...(nextIntent.checkoutUrl ? { checkoutUrl: nextIntent.checkoutUrl } : {}),
        ...(nextIntent.providerRequestId
          ? { providerRequestId: nextIntent.providerRequestId }
          : {}),
        ...(nextIntent.providerTransactionId
          ? { providerTransactionId: nextIntent.providerTransactionId }
          : {}),
        status: nextIntent.status,
        updatedAt: timestamp,
      });
      transaction.updatePaymentAttempt(`attempt-${currentIntent.intentId}`, {
        ...(providerTransactionId ? { providerTransactionId } : {}),
        status: providerResult.status,
        updatedAt: timestamp,
      });
      if (providerTransactionId) {
        const transactionDoc: ProviderTransaction = {
          amount: currentIntent.amount,
          createdAt: existingTransaction?.createdAt ?? timestamp,
          currency: RENT_PAYMENT_CURRENCY,
          intentId: currentIntent.intentId,
          normalizedStatus: providerResult.status,
          paymentId: currentIntent.paymentId,
          provider: providerName,
          providerTransactionId,
          updatedAt: timestamp,
        };

        if (existingTransaction) {
          transaction.updateProviderTransaction(providerTransactionId, transactionDoc);
        } else {
          transaction.setProviderTransaction(providerTransactionId, transactionDoc);
        }
      }

      return this.intentOutput({
        ...nextIntent,
        ...(providerResult.publishableKey
          ? { providerReference: nextIntent.providerReference }
          : {}),
      }, providerResult.publishableKey);
    });
  }

  async getRentPaymentStatus(identity: AuthContext, paymentId: string): Promise<RentPaymentStatusOutput> {
    return this.repository.runTransaction(async (transaction) => {
      const user = assertActiveReadableUser(await transaction.getUser(identity.uid));
      const payment = await this.getScopedPayment(transaction, user, paymentId);
      const intents = (await transaction.listPaymentIntentsByPayment(paymentId)).map(({ doc }) => doc);
      const intent = latestIntent(intents);

      return {
        amount: resolveRentAmount(payment),
        currency: RENT_PAYMENT_CURRENCY,
        intentId: intent?.intentId ?? null,
        paymentId,
        paymentStatus: payment.paymentStatus,
        provider: intent?.provider ?? null,
        providerReference: payment.providerReference ?? intent?.providerReference ?? null,
        providerStatus: intent?.status ?? null,
        receiptId: payment.receiptId,
      };
    });
  }

  async cancelRentPaymentIntent(identity: AuthContext, paymentId: string): Promise<RentPaymentStatusOutput> {
    return this.repository.runTransaction(async (transaction) => {
      const tenant = assertActiveTenant(await transaction.getUser(identity.uid));
      const payment = await transaction.getPayment(paymentId);

      if (!payment) {
        throw new AppError(404, 'payment_not_found', 'Le paiement demandé est introuvable.');
      }

      if (payment.tenantId !== tenant.uid && payment.tenantId !== tenant.tenantId) {
        throw new AppError(403, 'forbidden_payment_scope', 'Ce paiement ne vous appartient pas.');
      }

      if (payment.paymentStatus === 'paid') {
        throw new AppError(
          409,
          'payment_already_paid',
          'Un paiement confirmé ne peut pas être annulé depuis cette action.',
        );
      }

      const intents = (await transaction.listPaymentIntentsByPayment(paymentId)).map(({ doc }) => doc);
      const intent = latestIntent(
        intents.filter((candidate) => candidate.status === 'requires_payment' || candidate.status === 'processing'),
      );

      if (!intent) {
        return {
          amount: resolveRentAmount(payment),
          currency: RENT_PAYMENT_CURRENCY,
          intentId: null,
          paymentId,
          paymentStatus: payment.paymentStatus,
          provider: null,
          providerReference: payment.providerReference,
          providerStatus: null,
          receiptId: payment.receiptId,
        };
      }

      if (!canTransitionPaymentStatus(intent.status, 'cancelled')) {
        throw new AppError(
          409,
          'payment_status_transition_not_allowed',
          'Cette intention de paiement ne peut pas être annulée dans son état actuel.',
        );
      }

      const timestamp = this.now().toISOString();
      transaction.updatePaymentIntent(intent.intentId, {
        cancelledAt: timestamp,
        status: 'cancelled',
        updatedAt: timestamp,
      });
      transaction.updatePaymentAttempt(`attempt-${intent.intentId}`, {
        status: 'cancelled',
        updatedAt: timestamp,
      });
      transaction.updatePayment(paymentId, {
        paymentStatus: 'cancelled',
        updatedAt: timestamp,
      });

      return {
        amount: resolveRentAmount(payment),
        currency: RENT_PAYMENT_CURRENCY,
        intentId: intent.intentId,
        paymentId,
        paymentStatus: 'cancelled',
        provider: intent.provider,
        providerReference: payment.providerReference,
        providerStatus: 'cancelled',
        receiptId: payment.receiptId,
      };
    });
  }

  async completeSimulatedIntent(identity: AuthContext, paymentId: string) {
    if (this.config.appVariant === 'production') {
      throw new AppError(
        403,
        'payment_simulation_disabled',
        'La finalisation simulée des loyers est désactivée en production.',
      );
    }

    await this.prepareRentPaymentIntent(identity, paymentId, 'simulated');
  }

  async processProviderWebhook(normalized: NormalizedWebhookEvent) {
    if (normalized.normalizedStatus === 'ignored') {
      return {
        ignored: true,
        receiptId: null,
      };
    }

    if (!normalized.providerTransactionId) {
      throw new AppError(
        409,
        'payment_provider_transaction_missing',
        'Le webhook prestataire ne contient pas de transaction exploitable.',
      );
    }

    const providerTransactionId = normalized.providerTransactionId;
    const normalizedStatus = normalized.normalizedStatus as RentPaymentProviderStatus;

    return this.repository.runTransaction(async (transaction) => {
      const intentResult = await transaction.findPaymentIntentByProviderTransactionId(
        providerTransactionId,
      );

      if (!intentResult) {
        throw new AppError(
          404,
          'payment_intent_not_found',
          'Aucune intention de paiement ne correspond à cette transaction prestataire.',
        );
      }

      const intent = intentResult.doc;
      const payment = await transaction.getPayment(intent.paymentId);

      if (!payment) {
        throw new AppError(404, 'payment_not_found', 'Le paiement associé est introuvable.');
      }

      const existingReceipt = payment.receiptId
        ? await transaction.getReceipt(payment.receiptId)
        : null;
      const tenant = await transaction.getTenant(payment.tenantId);
      const owner = await transaction.getOwner(payment.ownerId);
      const ownerUser = await transaction.getUser(payment.ownerId);
      const property = await transaction.getProperty(payment.propertyId);
      const unit = await transaction.getUnit(payment.unitId);
      const agency = payment.agencyId ? await transaction.getAgency(payment.agencyId) : null;
      const existingProviderTransaction = await transaction.getProviderTransaction(
        providerTransactionId,
      );

      if (!tenant || !owner || !ownerUser || !property || !unit) {
        throw new AppError(
          409,
          'payment_context_missing',
          'Le contexte du paiement est incomplet.',
        );
      }

      if (
        normalized.normalizedStatus === 'paid' &&
        (normalized.amount !== intent.amount || normalized.currency !== intent.currency)
      ) {
        const timestamp = this.now().toISOString();
        const recordId = randomUUID();
        transaction.setPaymentReconciliationRecord(recordId, {
          createdAt: timestamp,
          intentId: intent.intentId,
          paymentId: intent.paymentId,
          provider: intent.provider,
          providerTransactionId,
          reason: 'amount_or_currency_mismatch',
          recordId,
          status: 'mismatch',
          updatedAt: timestamp,
        });
        return {
          ignored: false,
          mismatch: true,
          receiptId: null,
        };
      }

      if (payment.paymentStatus === 'paid' && payment.receiptId && existingReceipt) {
        this.upsertProviderTransaction(transaction, existingProviderTransaction, {
          amount: intent.amount,
          currency: intent.currency,
          intentId: intent.intentId,
          paymentId: intent.paymentId,
          provider: intent.provider,
          providerTransactionId,
          ...(normalized.rawProviderStatus ? { rawProviderStatus: normalized.rawProviderStatus } : {}),
          normalizedStatus: 'paid',
        });
        if (intent.status !== 'paid') {
          const timestamp = this.now().toISOString();
          const providerReference = payment.providerReference ?? normalized.providerReference;
          transaction.updatePaymentIntent(intent.intentId, {
            paidAt: payment.paidAt ?? timestamp,
            ...(providerReference ? { providerReference } : {}),
            status: 'paid',
            updatedAt: timestamp,
          });
        }

        return {
          ignored: false,
          receiptId: payment.receiptId,
        };
      }

      if (!canTransitionPaymentStatus(intent.status, normalizedStatus)) {
        if (isTerminalPaymentStatus(intent.status)) {
          return {
            ignored: true,
            receiptId: payment.receiptId,
          };
        }

        throw new AppError(
          409,
          'payment_status_transition_not_allowed',
          'Le changement de statut prestataire n’est pas autorisé.',
        );
      }

      if (normalizedStatus !== 'paid') {
        const timestamp = this.now().toISOString();
        transaction.updatePaymentIntent(intent.intentId, {
          ...(normalizedStatus === 'failed' ? { failedAt: timestamp } : {}),
          ...(normalizedStatus === 'cancelled' ? { cancelledAt: timestamp } : {}),
          ...(normalized.providerReference
            ? { providerReference: normalized.providerReference }
            : {}),
          status: normalizedStatus,
          updatedAt: timestamp,
        });
        transaction.updatePaymentAttempt(`attempt-${intent.intentId}`, {
          ...(normalized.providerReference
            ? { providerReference: normalized.providerReference }
            : {}),
          status: normalizedStatus,
          updatedAt: timestamp,
        });
        transaction.updatePayment(intent.paymentId, {
          paymentStatus: mapPaymentStatus(normalizedStatus),
          updatedAt: timestamp,
        } as Partial<RentPaymentDoc>);
        this.upsertProviderTransaction(transaction, existingProviderTransaction, {
          amount: intent.amount,
          currency: intent.currency,
          intentId: intent.intentId,
          paymentId: intent.paymentId,
          provider: intent.provider,
          providerTransactionId,
          ...(normalized.rawProviderStatus ? { rawProviderStatus: normalized.rawProviderStatus } : {}),
          normalizedStatus,
        });

        return {
          ignored: false,
          receiptId: null,
        };
      }

      const paidAt = this.now();
      const paidAtIso = paidAt.toISOString();
      const receiptId = randomUUID();
      const receiptNumber = buildReceiptNumber(paidAt);
      const qrVerificationToken = createHash('sha256')
        .update(`${intent.paymentId}:${receiptId}:${paidAtIso}`)
        .digest('hex');
      const receiptProviderReference = normalized.providerReference ?? providerTransactionId;
      const receipt: ReceiptDoc = {
        agencyDisplayName: agency?.displayName ?? 'Agence ATouPay',
        agencyFeeAmount: 0,
        agencyId: payment.agencyId,
        grossAmount: intent.amount,
        id: receiptId,
        issuedAt: paidAtIso,
        issuedBy: 'backend',
        issuanceSource: 'provider-confirmed',
        ownerDisplayName: owner.displayName,
        ownerEmail: ownerUser.email,
        ownerId: payment.ownerId,
        ownerNetAmount: intent.amount,
        paidAt: paidAtIso,
        paymentId: intent.paymentId,
        paymentMethod: intent.provider === 'moosyl' ? 'Moosyl' : 'Prestataire',
        paymentStatus: 'paid',
        provider: intent.provider,
        providerConfirmationMessage: 'Paiement confirmé par le prestataire de paiement.',
        providerReference: receiptProviderReference,
        propertyId: payment.propertyId,
        propertyLabel: property.label,
        qrVerificationToken,
        receiptNumber,
        simulated: false,
        tenantDisplayName: tenant.displayName,
        tenantEmail: tenant.email,
        tenantId: payment.tenantId,
        unitId: payment.unitId,
        unitLabel: unit.label,
        verificationUrl: this.buildReceiptVerificationUrl(qrVerificationToken),
      };

      transaction.setReceipt(receiptId, receipt);
      transaction.updatePayment(intent.paymentId, {
        ...buildZeroFeeLedger(intent.amount),
        paidAt: paidAtIso,
        paymentMethod: receipt.paymentMethod,
        paymentStatus: 'paid',
        providerReference: receiptProviderReference,
        receiptId,
        updatedAt: paidAtIso,
      });
      transaction.updatePaymentIntent(intent.intentId, {
        paidAt: paidAtIso,
        providerReference: receiptProviderReference,
        status: 'paid',
        updatedAt: paidAtIso,
      });
      transaction.updatePaymentAttempt(`attempt-${intent.intentId}`, {
        providerReference: receiptProviderReference,
        status: 'paid',
        updatedAt: paidAtIso,
      });
      this.upsertProviderTransaction(transaction, existingProviderTransaction, {
        amount: intent.amount,
        currency: intent.currency,
        intentId: intent.intentId,
        paymentId: intent.paymentId,
          provider: intent.provider,
          providerTransactionId,
          ...(normalized.rawProviderStatus ? { rawProviderStatus: normalized.rawProviderStatus } : {}),
          normalizedStatus: 'paid',
        });
      this.recordAudit(transaction, {
        agencyId: payment.agencyId,
        entityId: intent.paymentId,
        entityType: 'rentPayment',
        eventType: 'payment_completed',
        metadata: {
          amount: intent.amount,
          provider: intent.provider,
          receiptId,
        },
        targetUid: payment.tenantId,
        timestamp: paidAtIso,
      });
      this.createNotification(transaction, {
        agencyId: payment.agencyId,
        body: `Paiement de loyer confirmé: ${intent.amount} ${intent.currency}.`,
        relatedEntityId: intent.paymentId,
        relatedEntityType: 'rentPayment',
        role: 'tenant',
        timestamp: paidAtIso,
        title: 'Paiement confirmé',
        type: 'payment_completed',
        userId: payment.tenantId,
      });
      this.createNotification(transaction, {
        agencyId: payment.agencyId,
        body: `Loyer confirmé par prestataire: ${intent.amount} ${intent.currency}.`,
        relatedEntityId: intent.paymentId,
        relatedEntityType: 'rentPayment',
        role: 'owner',
        timestamp: paidAtIso,
        title: 'Loyer payé',
        type: 'payment_completed',
        userId: payment.ownerId,
      });
      if (payment.agencyId) {
        this.createNotification(transaction, {
          agencyId: payment.agencyId,
          body: `Paiement de loyer confirmé: ${intent.amount} ${intent.currency}.`,
          relatedEntityId: intent.paymentId,
          relatedEntityType: 'rentPayment',
          role: 'agency_admin',
          timestamp: paidAtIso,
          title: 'Paiement confirmé',
          type: 'payment_completed',
        });
      }

      return {
        ignored: false,
        receiptId,
      };
    });
  }

  private async prepareRentPaymentIntent(
    identity: AuthContext,
    paymentId: string,
    providerName: PaymentProviderName,
  ): Promise<PreparedPaymentIntent> {
    return this.repository.runTransaction(async (transaction) => {
      const tenantUser = assertActiveTenant(await transaction.getUser(identity.uid));
      const payment = await transaction.getPayment(paymentId);

      if (!payment) {
        throw new AppError(404, 'payment_not_found', 'Le paiement demandé est introuvable.');
      }

      if (payment.tenantId !== tenantUser.uid && payment.tenantId !== tenantUser.tenantId) {
        throw new AppError(403, 'forbidden_payment_scope', 'Ce paiement ne vous appartient pas.');
      }

      if (payment.paymentStatus === 'paid') {
        throw new AppError(409, 'payment_already_paid', 'Ce loyer a déjà été réglé.');
      }

      if (!isPayableRentStatus(payment.paymentStatus)) {
        throw new AppError(
          409,
          'payment_not_payable',
          'Ce paiement ne peut pas être réglé dans son état actuel.',
        );
      }

      const rentAmount = resolveRentAmount(payment);
      const ledger = buildZeroFeeLedger(rentAmount);
      const intents = (await transaction.listPaymentIntentsByPayment(paymentId)).map(({ doc }) => doc);
      const reusableIntent = latestIntent(
        intents.filter((intent) => intent.provider === providerName && isReusableIntent(intent)),
      );

      if (reusableIntent) {
        const shouldCallProvider =
          providerName !== 'simulated' &&
          reusableIntent.status === 'requires_payment' &&
          !reusableIntent.providerTransactionId;
        return {
          intent: reusableIntent,
          needsProviderCreation: shouldCallProvider,
        };
      }

      const timestamp = this.now().toISOString();
      const intentId = randomUUID();
      const providerTransactionId =
        providerName === 'simulated'
          ? `sim_${intentId.replace(/-/g, '').slice(0, 24)}`
          : undefined;
      const intent: PaymentIntent = {
        agencyId: payment.agencyId,
        amount: rentAmount,
        createdAt: timestamp,
        currency: RENT_PAYMENT_CURRENCY,
        idempotencyKey: buildIdempotencyKey({
          paymentId,
          provider: providerName,
          rentAmount,
        }),
        intentId,
        ownerId: payment.ownerId,
        paymentId,
        propertyId: payment.propertyId,
        provider: providerName,
        ...(providerTransactionId ? { providerTransactionId } : {}),
        status: providerName === 'simulated' ? 'requires_payment' : 'requires_payment',
        tenantId: payment.tenantId,
        unitId: payment.unitId,
        updatedAt: timestamp,
        ...ledger,
      };
      const attempt: PaymentAttempt = {
        attemptId: `attempt-${intentId}`,
        createdAt: timestamp,
        intentId,
        paymentId,
        provider: providerName,
        ...(providerTransactionId ? { providerTransactionId } : {}),
        status: intent.status,
        tenantId: payment.tenantId,
        updatedAt: timestamp,
      };

      transaction.setPaymentIntent(intentId, intent);
      transaction.setPaymentAttempt(attempt.attemptId, attempt);
      transaction.updatePayment(paymentId, {
        ...ledger,
        updatedAt: timestamp,
      });
      if (providerTransactionId) {
        transaction.setProviderTransaction(providerTransactionId, {
          amount: rentAmount,
          createdAt: timestamp,
          currency: RENT_PAYMENT_CURRENCY,
          intentId,
          normalizedStatus: intent.status,
          paymentId,
          provider: providerName,
          providerTransactionId,
          updatedAt: timestamp,
        });
      }

      return {
        intent,
        needsProviderCreation: providerName !== 'simulated',
      };
    });
  }

  private async getScopedPayment(transaction: TransactionContext, user: UserDoc, paymentId: string) {
    const payment = await transaction.getPayment(paymentId);

    if (!payment) {
      throw new AppError(404, 'payment_not_found', 'Le paiement demandé est introuvable.');
    }

    if (user.role === 'tenant') {
      if (payment.tenantId !== user.uid && payment.tenantId !== user.tenantId) {
        throw new AppError(403, 'forbidden_payment_scope', 'Ce paiement ne vous appartient pas.');
      }
      return payment;
    }

    if (user.role === 'owner') {
      if (!user.ownerId || payment.ownerId !== user.ownerId) {
        throw new AppError(403, 'forbidden_payment_scope', 'Ce paiement ne vous est pas accessible.');
      }
      return payment;
    }

    if (!user.agencyId || payment.agencyId !== user.agencyId) {
      throw new AppError(403, 'forbidden_payment_scope', 'Ce paiement ne vous est pas accessible.');
    }

    return payment;
  }

  private intentOutput(intent: PaymentIntent, publishableKey?: string): RentPaymentIntentOutput {
    return {
      amount: intent.amount,
      ...(intent.checkoutUrl ? { checkoutUrl: intent.checkoutUrl } : {}),
      currency: intent.currency,
      intentId: intent.intentId,
      paymentId: intent.paymentId,
      provider: intent.provider,
      ...(publishableKey ? { publishableKey } : {}),
      status: intent.status,
      ...(intent.providerTransactionId ? { transactionId: intent.providerTransactionId } : {}),
    };
  }

  private buildReceiptVerificationUrl(token: string) {
    const scheme = this.config.inviteBaseUrl.split('://')[0] ?? 'atoupay';

    return `${scheme}://receipt-verification?token=${encodeURIComponent(token)}`;
  }

  private upsertProviderTransaction(
    transaction: TransactionContext,
    existing: ProviderTransaction | null,
    input: Omit<ProviderTransaction, 'createdAt' | 'updatedAt'>,
  ) {
    const timestamp = this.now().toISOString();
    const doc: ProviderTransaction = {
      ...input,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };

    if (existing) {
      transaction.updateProviderTransaction(input.providerTransactionId, doc);
    } else {
      transaction.setProviderTransaction(input.providerTransactionId, doc);
    }
  }

  private recordAudit(
    transaction: TransactionContext,
    input: {
      agencyId: string | null;
      entityId: string | null;
      entityType: string;
      eventType: AuditLogDoc['eventType'];
      metadata?: Record<string, boolean | number | string | null>;
      targetUid?: string | null;
      timestamp: string;
    },
  ) {
    transaction.setAuditLog(randomUUID(), {
      actorRole: 'system',
      actorUid: null,
      agencyId: input.agencyId,
      createdAt: input.timestamp,
      entityId: input.entityId,
      entityType: input.entityType,
      eventType: input.eventType,
      metadata: input.metadata ?? {},
      targetUid: input.targetUid ?? null,
    });
  }

  private createNotification(
    transaction: TransactionContext,
    input: {
      agencyId: string | null;
      body: string;
      relatedEntityId?: string | null;
      relatedEntityType?: string | null;
      role: NotificationDoc['role'];
      timestamp: string;
      title: string;
      type: NotificationDoc['type'];
      userId?: string | null;
    },
  ) {
    transaction.setNotification(randomUUID(), {
      agencyId: input.agencyId,
      body: input.body,
      createdAt: input.timestamp,
      readAt: null,
      relatedEntityId: input.relatedEntityId ?? null,
      relatedEntityType: input.relatedEntityType ?? null,
      role: input.role,
      title: input.title,
      type: input.type,
      userId: input.userId ?? null,
    });
  }
}
