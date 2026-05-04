import assert from 'node:assert/strict';
import test from 'node:test';

import { buildApp } from '../src/app.js';
import type {
  AgencyAdminBootstrapDoc,
  AgencyDoc,
  AuditLogDoc,
  AuthContext,
  InviteType,
  LegalTermsDoc,
  NotificationDoc,
  OwnerAccessInviteDoc,
  PaymentStatus,
  PropertyDoc,
  ReceiptDoc,
  RentPaymentDoc,
  SupportRequestDoc,
  TenantDoc,
  TenantInviteDoc,
  UnitDoc,
  UserTermsAcceptanceDoc,
  UserDoc,
} from '../src/domain/types.js';
import { AppError } from '../src/lib/errors.js';
import { hashInviteCode, hashStableValue } from '../src/lib/invite.js';
import type { AuthVerifier } from '../src/lib/firebase-admin.js';
import type { DataRepository, TransactionContext } from '../src/repositories/types.js';
import { BackendService } from '../src/services/backend-service.js';
import type { InviteEmailService } from '../src/services/email-service.js';
import type { AppConfig } from '../src/config/env.js';
import type {
  OwnerBillingAccount,
  OwnerBillingInvoice,
  OwnerBillingPayment,
} from '../src/billing/types.js';

type StoreState = {
  agencies: Map<string, AgencyDoc>;
  agencyAdminBootstraps: Map<string, AgencyAdminBootstrapDoc>;
  auditLogs: Map<string, AuditLogDoc>;
  legalDocuments: Map<string, LegalTermsDoc>;
  notifications: Map<string, NotificationDoc>;
  ownerBillingAccounts: Map<string, OwnerBillingAccount>;
  ownerBillingInvoices: Map<string, OwnerBillingInvoice>;
  ownerBillingPayments: Map<string, OwnerBillingPayment>;
  owners: Map<string, { agencyId: string | null; createdAt: string; displayName: string; updatedAt: string; userId: string }>;
  ownerAccessInvites: Map<string, OwnerAccessInviteDoc>;
  properties: Map<string, PropertyDoc>;
  receipts: Map<string, ReceiptDoc>;
  rentPayments: Map<string, RentPaymentDoc>;
  supportRequests: Map<string, SupportRequestDoc>;
  tenantInvites: Map<string, TenantInviteDoc>;
  tenants: Map<string, TenantDoc>;
  units: Map<string, UnitDoc>;
  userTermsAcceptances: Map<string, UserTermsAcceptanceDoc>;
  users: Map<string, UserDoc>;
};

function cloneMap<T>(input: Map<string, T>) {
  return new Map<string, T>(
    Array.from(input.entries(), ([key, value]) => [key, structuredClone(value)]),
  );
}

class FakeRepository implements DataRepository {
  state: StoreState;

  constructor(seed?: Partial<StoreState>) {
    this.state = {
      agencies: seed?.agencies ? cloneMap(seed.agencies) : new Map(),
      agencyAdminBootstraps: seed?.agencyAdminBootstraps
        ? cloneMap(seed.agencyAdminBootstraps)
        : new Map(),
      auditLogs: seed?.auditLogs ? cloneMap(seed.auditLogs) : new Map(),
      legalDocuments: seed?.legalDocuments ? cloneMap(seed.legalDocuments) : new Map(),
      notifications: seed?.notifications ? cloneMap(seed.notifications) : new Map(),
      ownerBillingAccounts: seed?.ownerBillingAccounts
        ? cloneMap(seed.ownerBillingAccounts)
        : new Map(),
      ownerBillingInvoices: seed?.ownerBillingInvoices
        ? cloneMap(seed.ownerBillingInvoices)
        : new Map(),
      ownerBillingPayments: seed?.ownerBillingPayments
        ? cloneMap(seed.ownerBillingPayments)
        : new Map(),
      owners: seed?.owners ? cloneMap(seed.owners) : new Map(),
      ownerAccessInvites: seed?.ownerAccessInvites ? cloneMap(seed.ownerAccessInvites) : new Map(),
      properties: seed?.properties ? cloneMap(seed.properties) : new Map(),
      receipts: seed?.receipts ? cloneMap(seed.receipts) : new Map(),
      rentPayments: seed?.rentPayments ? cloneMap(seed.rentPayments) : new Map(),
      supportRequests: seed?.supportRequests ? cloneMap(seed.supportRequests) : new Map(),
      tenantInvites: seed?.tenantInvites ? cloneMap(seed.tenantInvites) : new Map(),
      tenants: seed?.tenants ? cloneMap(seed.tenants) : new Map(),
      units: seed?.units ? cloneMap(seed.units) : new Map(),
      userTermsAcceptances: seed?.userTermsAcceptances
        ? cloneMap(seed.userTermsAcceptances)
        : new Map(),
      users: seed?.users ? cloneMap(seed.users) : new Map(),
    };
  }

  async findAgencyAdminBootstrapByEmail(email: string) {
    for (const [id, doc] of this.state.agencyAdminBootstraps.entries()) {
      if (doc.email === email) {
        return { doc, id };
      }
    }

    return null;
  }

  async findReceiptByVerificationToken(token: string) {
    for (const [id, doc] of this.state.receipts.entries()) {
      if (doc.qrVerificationToken === token) {
        return { doc, id };
      }
    }

    return null;
  }

  async findUserByEmail(email: string) {
    for (const doc of this.state.users.values()) {
      if (doc.email === email) {
        return doc;
      }
    }

    return null;
  }

  async getAgency(agencyId: string) {
    return this.state.agencies.get(agencyId) ?? null;
  }

  async getLegalTerms(documentId: string) {
    return this.state.legalDocuments.get(documentId) ?? null;
  }

  async getNotification(notificationId: string) {
    return this.state.notifications.get(notificationId) ?? null;
  }

  async getOwner(ownerId: string) {
    return this.state.owners.get(ownerId) ?? null;
  }

  async getOwnerBillingAccount(ownerId: string) {
    return this.state.ownerBillingAccounts.get(ownerId) ?? null;
  }

  async getPayment(paymentId: string) {
    return this.state.rentPayments.get(paymentId) ?? null;
  }

  async getProperty(propertyId: string) {
    return this.state.properties.get(propertyId) ?? null;
  }

  async getReceipt(receiptId: string) {
    return this.state.receipts.get(receiptId) ?? null;
  }

  async getSupportRequest(requestId: string) {
    return this.state.supportRequests.get(requestId) ?? null;
  }

  async getTenant(tenantId: string) {
    return this.state.tenants.get(tenantId) ?? null;
  }

  async getUnit(unitId: string) {
    return this.state.units.get(unitId) ?? null;
  }

  async getUserTermsAcceptance(uid: string) {
    return this.state.userTermsAcceptances.get(uid) ?? null;
  }

  async getUser(uid: string) {
    return this.state.users.get(uid) ?? null;
  }

  async listOwnerAccessInvitesByAgency(agencyId: string) {
    return Array.from(this.state.ownerAccessInvites.entries())
      .filter(([, doc]) => doc.agencyId === agencyId)
      .map(([id, doc]) => ({ doc, id }));
  }

  async listAuditLogsByAgency(agencyId: string) {
    return Array.from(this.state.auditLogs.entries())
      .filter(([, doc]) => doc.agencyId === agencyId)
      .map(([id, doc]) => ({ doc, id }));
  }

  async listNotificationsByAgency(agencyId: string) {
    return Array.from(this.state.notifications.entries())
      .filter(([, doc]) => doc.agencyId === agencyId)
      .map(([id, doc]) => ({ doc, id }));
  }

  async listNotificationsByUser(userId: string) {
    return Array.from(this.state.notifications.entries())
      .filter(([, doc]) => doc.userId === userId)
      .map(([id, doc]) => ({ doc, id }));
  }

  async listOwnerBillingAccountsByAgency(agencyId: string) {
    return Array.from(this.state.ownerBillingAccounts.entries())
      .filter(([, doc]) => doc.agencyId === agencyId)
      .map(([id, doc]) => ({ doc, id }));
  }

  async listOwnerBillingInvoicesByOwner(ownerId: string) {
    return Array.from(this.state.ownerBillingInvoices.entries())
      .filter(([, doc]) => doc.ownerId === ownerId)
      .map(([id, doc]) => ({ doc, id }));
  }

  async listPaymentsByAgency(agencyId: string) {
    return Array.from(this.state.rentPayments.entries())
      .filter(([, doc]) => doc.agencyId === agencyId)
      .map(([id, doc]) => ({ doc, id }));
  }

  async listPaymentsByOwner(ownerId: string) {
    return Array.from(this.state.rentPayments.entries())
      .filter(([, doc]) => doc.ownerId === ownerId)
      .map(([id, doc]) => ({ doc, id }));
  }

  async listPropertiesByOwner(ownerId: string) {
    return Array.from(this.state.properties.entries())
      .filter(([, doc]) => doc.ownerId === ownerId)
      .map(([id, doc]) => ({ doc, id }));
  }

  async listSupportRequestsByAgency(agencyId: string) {
    return Array.from(this.state.supportRequests.entries())
      .filter(([, doc]) => doc.agencyId === agencyId)
      .map(([id, doc]) => ({ doc, id }));
  }

  async listSupportRequestsByUser(userId: string) {
    return Array.from(this.state.supportRequests.entries())
      .filter(([, doc]) => doc.userId === userId)
      .map(([id, doc]) => ({ doc, id }));
  }

  async listTenantsByOwner(ownerId: string) {
    return Array.from(this.state.tenants.entries())
      .filter(([, doc]) => doc.ownerId === ownerId)
      .map(([id, doc]) => ({ doc, id }));
  }

  async listUnitsByOwner(ownerId: string) {
    return Array.from(this.state.units.entries())
      .filter(([, doc]) => doc.ownerId === ownerId)
      .map(([id, doc]) => ({ doc, id }));
  }

  async listUsersByAgency(agencyId: string, role?: UserDoc['role']) {
    return Array.from(this.state.users.values()).filter(
      (user) => user.agencyId === agencyId && (role ? user.role === role : true),
    );
  }

  async setLegalTerms(documentId: string, terms: LegalTermsDoc) {
    this.state.legalDocuments.set(documentId, structuredClone(terms));
  }

  async runTransaction<T>(handler: (transaction: TransactionContext) => Promise<T>): Promise<T> {
    const working: StoreState = {
      agencies: cloneMap(this.state.agencies),
      agencyAdminBootstraps: cloneMap(this.state.agencyAdminBootstraps),
      auditLogs: cloneMap(this.state.auditLogs),
      legalDocuments: cloneMap(this.state.legalDocuments),
      notifications: cloneMap(this.state.notifications),
      ownerBillingAccounts: cloneMap(this.state.ownerBillingAccounts),
      ownerBillingInvoices: cloneMap(this.state.ownerBillingInvoices),
      ownerBillingPayments: cloneMap(this.state.ownerBillingPayments),
      owners: cloneMap(this.state.owners),
      ownerAccessInvites: cloneMap(this.state.ownerAccessInvites),
      properties: cloneMap(this.state.properties),
      receipts: cloneMap(this.state.receipts),
      rentPayments: cloneMap(this.state.rentPayments),
      supportRequests: cloneMap(this.state.supportRequests),
      tenantInvites: cloneMap(this.state.tenantInvites),
      tenants: cloneMap(this.state.tenants),
      units: cloneMap(this.state.units),
      userTermsAcceptances: cloneMap(this.state.userTermsAcceptances),
      users: cloneMap(this.state.users),
    };

    const getRequired = <T>(collection: Map<string, T>, id: string) => {
      const value = collection.get(id);

      if (!value) {
        throw new AppError(404, 'not_found', `Document ${id} introuvable.`);
      }

      return value;
    };

    let hasWritten = false;
    const assertReadable = () => {
      if (hasWritten) {
        throw new Error('read after write inside transaction');
      }
    };

    const context: TransactionContext = {
      getAgencyAdminBootstrap: async (bootstrapId) => {
        assertReadable();
        return working.agencyAdminBootstraps.get(bootstrapId) ?? null;
      },
      getAgency: async (agencyId) => {
        assertReadable();
        return working.agencies.get(agencyId) ?? null;
      },
      getLegalTerms: async (documentId) => {
        assertReadable();
        return working.legalDocuments.get(documentId) ?? null;
      },
      getNotification: async (notificationId) => {
        assertReadable();
        return working.notifications.get(notificationId) ?? null;
      },
      getOwner: async (ownerId) => {
        assertReadable();
        return working.owners.get(ownerId) ?? null;
      },
      getOwnerAccessInvite: async (inviteId) => {
        assertReadable();
        return working.ownerAccessInvites.get(inviteId) ?? null;
      },
      getOwnerBillingAccount: async (ownerId) => {
        assertReadable();
        return working.ownerBillingAccounts.get(ownerId) ?? null;
      },
      getOwnerBillingInvoice: async (invoiceId) => {
        assertReadable();
        return working.ownerBillingInvoices.get(invoiceId) ?? null;
      },
      getPayment: async (paymentId) => {
        assertReadable();
        return working.rentPayments.get(paymentId) ?? null;
      },
      getProperty: async (propertyId) => {
        assertReadable();
        return working.properties.get(propertyId) ?? null;
      },
      getReceipt: async (receiptId) => {
        assertReadable();
        return working.receipts.get(receiptId) ?? null;
      },
      getSupportRequest: async (requestId) => {
        assertReadable();
        return working.supportRequests.get(requestId) ?? null;
      },
      getTenant: async (tenantId) => {
        assertReadable();
        return working.tenants.get(tenantId) ?? null;
      },
      getInvite: async (inviteId) => {
        assertReadable();
        return working.tenantInvites.get(inviteId) ?? null;
      },
      getUnit: async (unitId) => {
        assertReadable();
        return working.units.get(unitId) ?? null;
      },
      getUserTermsAcceptance: async (uid) => {
        assertReadable();
        return working.userTermsAcceptances.get(uid) ?? null;
      },
      getUser: async (uid) => {
        assertReadable();
        return working.users.get(uid) ?? null;
      },
      listOwnerBillingInvoicesByOwner: async (ownerId) => {
        assertReadable();
        return Array.from(working.ownerBillingInvoices.entries())
          .filter(([, doc]) => doc.ownerId === ownerId)
          .map(([id, doc]) => ({ doc, id }));
      },
      listPaymentsByUnit: async (unitId) => {
        assertReadable();
        return Array.from(working.rentPayments.entries())
          .filter(([, doc]) => doc.unitId === unitId)
          .map(([id, doc]) => ({ doc, id }));
      },
      listUnitsByProperty: async (propertyId) => {
        assertReadable();
        return Array.from(working.units.entries())
          .filter(([, doc]) => doc.propertyId === propertyId)
          .map(([id, doc]) => ({ doc, id }));
      },
      deleteProperty: (propertyId) => {
        hasWritten = true;
        working.properties.delete(propertyId);
      },
      deleteUnit: (unitId) => {
        hasWritten = true;
        working.units.delete(unitId);
      },
      deleteOwnerAccessInvite: (inviteId) => {
        hasWritten = true;
        working.ownerAccessInvites.delete(inviteId);
      },
      setAgency: (agencyId, agency) => {
        hasWritten = true;
        working.agencies.set(agencyId, structuredClone(agency));
      },
      setAgencyAdminBootstrap: (bootstrapId, bootstrap) => {
        hasWritten = true;
        working.agencyAdminBootstraps.set(bootstrapId, structuredClone(bootstrap));
      },
      setLegalTerms: (documentId, terms) => {
        hasWritten = true;
        working.legalDocuments.set(documentId, structuredClone(terms));
      },
      setOwnerBillingAccount: (ownerId, account) => {
        hasWritten = true;
        working.ownerBillingAccounts.set(ownerId, structuredClone(account));
      },
      setOwnerBillingInvoice: (invoiceId, invoice) => {
        hasWritten = true;
        working.ownerBillingInvoices.set(invoiceId, structuredClone(invoice));
      },
      setOwnerBillingPayment: (paymentId, payment) => {
        hasWritten = true;
        working.ownerBillingPayments.set(paymentId, structuredClone(payment));
      },
      setOwnerAccessInvite: (inviteId, invite) => {
        hasWritten = true;
        working.ownerAccessInvites.set(inviteId, structuredClone(invite));
      },
      setInvite: (inviteId, invite) => {
        hasWritten = true;
        working.tenantInvites.set(inviteId, structuredClone(invite));
      },
      setOwner: (ownerId, owner) => {
        hasWritten = true;
        working.owners.set(ownerId, structuredClone(owner));
      },
      setPayment: (paymentId, payment) => {
        hasWritten = true;
        working.rentPayments.set(paymentId, structuredClone(payment));
      },
      setProperty: (propertyId, property) => {
        hasWritten = true;
        working.properties.set(propertyId, structuredClone(property));
      },
      setReceipt: (receiptId, receipt) => {
        hasWritten = true;
        working.receipts.set(receiptId, structuredClone(receipt));
      },
      setSupportRequest: (requestId, request) => {
        hasWritten = true;
        working.supportRequests.set(requestId, structuredClone(request));
      },
      setTenant: (tenantId, tenant) => {
        hasWritten = true;
        working.tenants.set(tenantId, structuredClone(tenant));
      },
      setUnit: (unitId, unit) => {
        hasWritten = true;
        working.units.set(unitId, structuredClone(unit));
      },
      setUserTermsAcceptance: (uid, acceptance) => {
        hasWritten = true;
        working.userTermsAcceptances.set(uid, structuredClone(acceptance));
      },
      setUser: (uid, user) => {
        hasWritten = true;
        working.users.set(uid, structuredClone(user));
      },
      setAuditLog: (auditLogId, auditLog) => {
        hasWritten = true;
        working.auditLogs.set(auditLogId, structuredClone(auditLog));
      },
      setNotification: (notificationId, notification) => {
        hasWritten = true;
        working.notifications.set(notificationId, structuredClone(notification));
      },
      updateAgency: (agencyId, patch) => {
        hasWritten = true;
        const current = getRequired(working.agencies, agencyId);
        working.agencies.set(agencyId, { ...current, ...structuredClone(patch) });
      },
      updateAgencyAdminBootstrap: (bootstrapId, patch) => {
        hasWritten = true;
        const current = getRequired(working.agencyAdminBootstraps, bootstrapId);
        working.agencyAdminBootstraps.set(bootstrapId, { ...current, ...structuredClone(patch) });
      },
      updateOwnerAccessInvite: (inviteId, patch) => {
        hasWritten = true;
        const current = getRequired(working.ownerAccessInvites, inviteId);
        working.ownerAccessInvites.set(inviteId, { ...current, ...structuredClone(patch) });
      },
      updateOwnerBillingAccount: (ownerId, patch) => {
        hasWritten = true;
        const current = getRequired(working.ownerBillingAccounts, ownerId);
        working.ownerBillingAccounts.set(ownerId, { ...current, ...structuredClone(patch) });
      },
      updateOwnerBillingInvoice: (invoiceId, patch) => {
        hasWritten = true;
        const current = getRequired(working.ownerBillingInvoices, invoiceId);
        working.ownerBillingInvoices.set(invoiceId, { ...current, ...structuredClone(patch) });
      },
      updateInvite: (inviteId, patch) => {
        hasWritten = true;
        const current = getRequired(working.tenantInvites, inviteId);
        working.tenantInvites.set(inviteId, { ...current, ...structuredClone(patch) });
      },
      updateNotification: (notificationId, patch) => {
        hasWritten = true;
        const current = getRequired(working.notifications, notificationId);
        working.notifications.set(notificationId, { ...current, ...structuredClone(patch) });
      },
      updatePayment: (paymentId, patch) => {
        hasWritten = true;
        const current = getRequired(working.rentPayments, paymentId);
        working.rentPayments.set(paymentId, { ...current, ...structuredClone(patch) });
      },
      updateProperty: (propertyId, patch) => {
        hasWritten = true;
        const current = getRequired(working.properties, propertyId);
        working.properties.set(propertyId, { ...current, ...structuredClone(patch) });
      },
      updateSupportRequest: (requestId, patch) => {
        hasWritten = true;
        const current = getRequired(working.supportRequests, requestId);
        working.supportRequests.set(requestId, { ...current, ...structuredClone(patch) });
      },
      updateUnit: (unitId, patch) => {
        hasWritten = true;
        const current = getRequired(working.units, unitId);
        working.units.set(unitId, { ...current, ...structuredClone(patch) });
      },
      updateUser: (uid, patch) => {
        hasWritten = true;
        const current = getRequired(working.users, uid);
        working.users.set(uid, { ...current, ...structuredClone(patch) });
      },
    };

    const result = await handler(context);
    this.state = working;

    return result;
  }
}

class FakeAuthVerifier implements AuthVerifier {
  constructor(private readonly tokens: Record<string, AuthContext>) {}

  async verifyBearerToken(token: string) {
    const identity = this.tokens[token];

    if (!identity) {
      throw new Error('invalid token');
    }

    return identity;
  }
}

function buildUser(input: {
  agencyId?: string | null;
  email: string;
  ownerId?: string | null;
  role: 'agency_admin' | 'owner' | 'tenant';
  status?: 'active' | 'pending_owner_access' | 'suspended';
  tenantId?: string | null;
  uid: string;
}): UserDoc {
  return {
    agencyId: input.agencyId ?? null,
    authProviders: ['password'] as const,
    createdAt: '2026-04-22T09:00:00.000Z',
    displayName: input.email.split('@')[0] ?? 'ATouPay User',
    email: input.email,
    emailVerified: true,
    ownerId: input.ownerId ?? null,
    phoneNumber: null,
    phoneVerificationStatus: null,
    photoURL: null,
    recoveryContactPreference: null,
    role: input.role,
    status: input.status ?? 'active',
    supportRecoveryStatus: null,
    tenantId: input.tenantId ?? null,
    uid: input.uid,
    updatedAt: '2026-04-22T09:00:00.000Z',
  } satisfies UserDoc;
}

function buildOwnerBillingAccount(status: OwnerBillingAccount['status']): OwnerBillingAccount {
  const periodByStatus = {
    active: {
      currentPeriodEnd: '2026-06-03T10:00:00.000Z',
      currentPeriodStart: '2026-04-22T10:00:00.000Z',
      gracePeriodEndsAt: '2026-06-10T10:00:00.000Z',
      nextPaymentDueAt: '2026-06-03T10:00:00.000Z',
      updatedAt: '2026-04-22T10:00:00.000Z',
    },
    grace_period: {
      currentPeriodEnd: '2026-04-20T10:00:00.000Z',
      currentPeriodStart: '2026-03-09T10:00:00.000Z',
      gracePeriodEndsAt: '2026-04-27T10:00:00.000Z',
      nextPaymentDueAt: '2026-04-20T10:00:00.000Z',
      updatedAt: '2026-04-20T10:00:00.000Z',
    },
    past_due: {
      currentPeriodEnd: '2026-03-01T10:00:00.000Z',
      currentPeriodStart: '2026-01-19T10:00:00.000Z',
      gracePeriodEndsAt: '2026-03-08T10:00:00.000Z',
      nextPaymentDueAt: '2026-03-01T10:00:00.000Z',
      updatedAt: '2026-03-08T10:00:00.000Z',
    },
    suspended: {
      currentPeriodEnd: '2026-03-01T10:00:00.000Z',
      currentPeriodStart: '2026-01-19T10:00:00.000Z',
      gracePeriodEndsAt: '2026-03-08T10:00:00.000Z',
      nextPaymentDueAt: '2026-03-01T10:00:00.000Z',
      updatedAt: '2026-03-08T10:00:00.000Z',
    },
  } satisfies Record<OwnerBillingAccount['status'], {
    currentPeriodEnd: string;
    currentPeriodStart: string;
    gracePeriodEndsAt: string;
    nextPaymentDueAt: string;
    updatedAt: string;
  }>;

  return {
    agencyId: 'agency-1',
    createdAt: '2026-01-01T10:00:00.000Z',
    feeAmount: 10,
    feeCurrency: 'EUR',
    intervalDays: 42,
    ownerId: 'owner-1',
    status,
    ...periodByStatus[status],
  };
}

function buildOwnerBillingPaymentSeed(status: OwnerBillingAccount['status']): Partial<StoreState> {
  return {
    ownerBillingAccounts: new Map([['owner-1', buildOwnerBillingAccount(status)]]),
    owners: new Map([
      [
        'owner-1',
        {
          agencyId: 'agency-1',
          createdAt: '2026-04-20T10:00:00.000Z',
          displayName: 'Owner User',
          updatedAt: '2026-04-20T10:00:00.000Z',
          userId: 'owner-1',
        },
      ],
    ]),
    properties: new Map([
      [
        'property-1',
        {
          address: 'Tevragh-Zeina',
          createdAt: '2026-04-20T10:00:00.000Z',
          label: 'Résidence Alpha',
          ownerId: 'owner-1',
          updatedAt: '2026-04-20T10:00:00.000Z',
        },
      ],
    ]),
    rentPayments: new Map([
      [
        'payment-1',
        {
          agencyFeeAmount: 0,
          agencyId: 'agency-1',
          commissionRate: 0,
          createdAt: '2026-04-20T10:00:00.000Z',
          dueDate: '2026-04-05',
          grossAmount: 200000,
          monthKey: '2026-04',
          ownerId: 'owner-1',
          ownerNetAmount: 200000,
          ownerReceivableAmount: 200000,
          paidAt: null,
          paymentMethod: null,
          paymentStatus: 'pending',
          platformRentFeeAmount: 0,
          propertyId: 'property-1',
          providerReference: null,
          receiptId: null,
          rentAmount: 200000,
          tenantFeeAmount: 0,
          tenantId: 'tenant-1',
          unitId: 'unit-1',
          updatedAt: '2026-04-20T10:00:00.000Z',
        },
      ],
    ]),
    tenants: new Map([
      [
        'tenant-1',
        {
          createdAt: '2026-04-20T10:00:00.000Z',
          displayName: 'Tenant User',
          email: 'tenant@example.com',
          ownerId: 'owner-1',
          propertyId: 'property-1',
          status: 'active',
          unitId: 'unit-1',
          updatedAt: '2026-04-20T10:00:00.000Z',
          userId: 'tenant-1',
        },
      ],
    ]),
    units: new Map([
      [
        'unit-1',
        {
          activeInviteId: null,
          createdAt: '2026-04-20T10:00:00.000Z',
          currency: 'MRU',
          label: 'A1',
          ownerId: 'owner-1',
          propertyId: 'property-1',
          rentAmount: 200000,
          status: 'occupied',
          tenantId: 'tenant-1',
          updatedAt: '2026-04-20T10:00:00.000Z',
        },
      ],
    ]),
    users: new Map([
      [
        'owner-1',
        buildUser({
          agencyId: 'agency-1',
          email: 'owner@example.com',
          ownerId: 'owner-1',
          role: 'owner',
          uid: 'owner-1',
        }),
      ],
      [
        'tenant-1',
        buildUser({
          agencyId: 'agency-1',
          email: 'tenant@example.com',
          ownerId: 'owner-1',
          role: 'tenant',
          tenantId: 'tenant-1',
          uid: 'tenant-1',
        }),
      ],
    ]),
  };
}

function buildOwnerBillingUserSeed(): Partial<StoreState> {
  return {
    owners: new Map([
      [
        'owner-1',
        {
          agencyId: 'agency-1',
          createdAt: '2026-04-20T10:00:00.000Z',
          displayName: 'Owner User',
          updatedAt: '2026-04-20T10:00:00.000Z',
          userId: 'owner-1',
        },
      ],
    ]),
    users: new Map([
      [
        'owner-1',
        buildUser({
          agencyId: 'agency-1',
          email: 'owner@example.com',
          ownerId: 'owner-1',
          role: 'owner',
          uid: 'owner-1',
        }),
      ],
    ]),
  };
}

async function buildTestApp(
  seed?: Partial<StoreState>,
  options?: {
    config?: Partial<AppConfig>;
    emailService?: InviteEmailService;
  },
) {
  const config: AppConfig = {
    appVariant: 'development',
    credentialStrategy: 'application-default',
    firebaseProjectId: 'atoupay-test',
    host: '127.0.0.1',
    inviteBaseUrl: 'atoupay://auth/login',
    isEmailEnabled: false,
    isAuthEmulatorEnabled: false,
    isFirestoreEmulatorEnabled: false,
    logLevel: 'silent',
    nodeEnv: 'test',
    paymentProvider: 'simulated',
    port: 3001,
    runtimeMode: 'cloud-run',
    ...options?.config,
  };
  const repository = new FakeRepository(seed);
  if (!repository.state.legalDocuments.has('terms-of-use')) {
    repository.state.legalDocuments.set('terms-of-use', {
      locale: 'fr',
      responsibilityStatement: 'AtouPay agit comme plateforme de gestion et de preuve interne.',
      sections: [
        {
          body: 'Les paiements simulés ne correspondent à aucun débit bancaire réel.',
          title: 'Paiement simulé',
        },
      ],
      summary: 'Conditions de test ATouPay.',
      supportPath: 'Contactez votre agence.',
      title: 'Conditions d’utilisation AtouPay',
      updatedAt: '2026-04-22T10:00:00.000Z',
      version: '2026-04-23.1',
    });
  }

  for (const uid of ['admin-1', 'owner-1', 'tenant-1']) {
    if (!repository.state.userTermsAcceptances.has(uid)) {
      repository.state.userTermsAcceptances.set(uid, {
        acceptedAt: '2026-04-22T10:00:00.000Z',
        appVersion: '1.0.0',
        locale: 'fr',
        termsVersion: '2026-04-23.1',
        uid,
      });
    }
  }
  const authVerifier = new FakeAuthVerifier({
    'admin-token': {
      displayName: 'Agency Admin',
      email: 'admin@example.com',
      emailVerified: true,
      phoneNumber: null,
      photoUrl: null,
      primaryProvider: 'password',
      providers: ['password'],
      uid: 'admin-1',
    },
    'owner-token': {
      displayName: 'Owner User',
      email: 'owner@example.com',
      emailVerified: true,
      phoneNumber: null,
      photoUrl: null,
      primaryProvider: 'password',
      providers: ['password'],
      uid: 'owner-1',
    },
    'tenant-token': {
      displayName: 'Tenant User',
      email: 'tenant@example.com',
      emailVerified: true,
      phoneNumber: null,
      photoUrl: null,
      primaryProvider: 'google',
      providers: ['google'],
      uid: 'tenant-1',
    },
    'tenant-phone-token': {
      displayName: 'Tenant User',
      email: 'tenant@example.com',
      emailVerified: true,
      phoneNumber: '+22236000000',
      photoUrl: null,
      primaryProvider: 'phone',
      providers: ['google', 'phone'],
      uid: 'tenant-1',
    },
  });
  const services = new BackendService({
    config,
    ...(options?.emailService ? { emailService: options.emailService } : {}),
    now: () => new Date('2026-04-22T10:00:00.000Z'),
    repository,
  });
  const app = await buildApp({
    authVerifier,
    config,
    logger: false,
    repository,
    services,
  });

  return { app, repository };
}

test('GET /health returns a healthy service response', async () => {
  const { app } = await buildTestApp();

  const response = await app.inject({
    method: 'GET',
    url: '/health',
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    ok: true,
    service: '@atoupay/backend',
    status: 'healthy',
  });

  await app.close();
});

test('GET /v1/legal/terms returns the current terms document', async () => {
  const { app } = await buildTestApp();

  const response = await app.inject({
    method: 'GET',
    url: '/v1/legal/terms',
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().data.version, '2026-04-23.1');

  await app.close();
});

test('POST /v1/legal/terms/accept stores the authenticated acceptance', async () => {
  const { app, repository } = await buildTestApp({
    userTermsAcceptances: new Map(),
    users: new Map([
      [
        'tenant-1',
        buildUser({
          email: 'tenant@example.com',
          role: 'tenant',
          uid: 'tenant-1',
        }),
      ],
    ]),
  });

  const response = await app.inject({
    headers: {
      authorization: 'Bearer tenant-token',
    },
    method: 'POST',
    payload: {
      appVersion: '1.2.3',
      locale: 'fr-MR',
    },
    url: '/v1/legal/terms/accept',
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().data.requiresAcceptance, false);
  assert.equal(repository.state.userTermsAcceptances.get('tenant-1')?.termsVersion, '2026-04-23.1');

  await app.close();
});

test('PATCH /v1/profile/contact marks a Firebase-verified matching phone as verified', async () => {
  const { app, repository } = await buildTestApp({
    users: new Map([
      [
        'tenant-1',
        buildUser({
          email: 'tenant@example.com',
          role: 'tenant',
          uid: 'tenant-1',
        }),
      ],
    ]),
  });

  const response = await app.inject({
    headers: {
      authorization: 'Bearer tenant-phone-token',
    },
    method: 'PATCH',
    payload: {
      phoneNumber: '+22236000000',
      recoveryContactPreference: 'phone',
    },
    url: '/v1/profile/contact',
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().data.phoneNumber, '+22236000000');
  assert.equal(response.json().data.phoneVerificationStatus, 'verified');
  assert.equal(repository.state.users.get('tenant-1')?.phoneVerificationStatus, 'verified');

  await app.close();
});

test('PATCH /v1/profile/contact resets verification when the phone changes away from Firebase Auth', async () => {
  const verifiedUser = buildUser({
    email: 'tenant@example.com',
    role: 'tenant',
    uid: 'tenant-1',
  });
  verifiedUser.phoneNumber = '+22236000000';
  verifiedUser.phoneVerificationStatus = 'verified';

  const { app, repository } = await buildTestApp({
    users: new Map([['tenant-1', verifiedUser]]),
  });

  const response = await app.inject({
    headers: {
      authorization: 'Bearer tenant-phone-token',
    },
    method: 'PATCH',
    payload: {
      phoneNumber: '+22245000000',
      recoveryContactPreference: 'phone',
    },
    url: '/v1/profile/contact',
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().data.phoneNumber, '+22245000000');
  assert.equal(response.json().data.phoneVerificationStatus, 'unverified');
  assert.equal(repository.state.users.get('tenant-1')?.phoneVerificationStatus, 'unverified');

  await app.close();
});

test('POST /v1/profile/bootstrap leaves a fresh owner pending agency access', async () => {
  const { app, repository } = await buildTestApp();

  const response = await app.inject({
    headers: {
      authorization: 'Bearer owner-token',
    },
    method: 'POST',
    payload: {
      role: 'owner',
    },
    url: '/v1/profile/bootstrap',
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().data.role, 'owner');
  assert.equal(response.json().data.ownerId, null);
  assert.equal(repository.state.users.get('owner-1')?.status, 'pending_owner_access');

  await app.close();
});

test('POST /v1/profile/bootstrap claims a seeded agency admin bootstrap', async () => {
  const bootstrapId = hashStableValue('admin@example.com');
  const { app, repository } = await buildTestApp({
    agencies: new Map([
      [
        'agency-1',
        {
          commissionRate: 0.1,
          commissionType: 'percentage',
          createdAt: '2026-04-20T10:00:00.000Z',
          displayName: 'Agence Test',
          updatedAt: '2026-04-20T10:00:00.000Z',
        },
      ],
    ]),
    agencyAdminBootstraps: new Map([
      [
        bootstrapId,
        {
          agencyId: 'agency-1',
          claimedAt: null,
          claimedByUid: null,
          createdAt: '2026-04-20T10:00:00.000Z',
          email: 'admin@example.com',
          status: 'pending',
          updatedAt: '2026-04-20T10:00:00.000Z',
        },
      ],
    ]),
  });

  const response = await app.inject({
    headers: {
      authorization: 'Bearer admin-token',
    },
    method: 'POST',
    payload: {
      role: 'agency_admin',
    },
    url: '/v1/profile/bootstrap',
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().data.role, 'agency_admin');
  assert.equal(repository.state.users.get('admin-1')?.agencyId, 'agency-1');
  assert.equal(repository.state.agencyAdminBootstraps.get(bootstrapId)?.claimedByUid, 'admin-1');

  await app.close();
});

test('POST /v1/profile/bootstrap routes authorized agency credentials from owner or tenant paths', async () => {
  const bootstrapId = hashStableValue('admin@example.com');
  const { app, repository } = await buildTestApp({
    agencies: new Map([
      [
        'agency-1',
        {
          commissionRate: 0.1,
          commissionType: 'percentage',
          createdAt: '2026-04-20T10:00:00.000Z',
          displayName: 'Agence Test',
          updatedAt: '2026-04-20T10:00:00.000Z',
        },
      ],
    ]),
    agencyAdminBootstraps: new Map([
      [
        bootstrapId,
        {
          agencyId: 'agency-1',
          claimedAt: null,
          claimedByUid: null,
          createdAt: '2026-04-20T10:00:00.000Z',
          email: 'admin@example.com',
          status: 'pending',
          updatedAt: '2026-04-20T10:00:00.000Z',
        },
      ],
    ]),
  });

  const response = await app.inject({
    headers: {
      authorization: 'Bearer admin-token',
    },
    method: 'POST',
    payload: {
      role: 'owner',
    },
    url: '/v1/profile/bootstrap',
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().data.role, 'agency_admin');
  assert.equal(repository.state.users.get('admin-1')?.role, 'agency_admin');
  assert.equal(repository.state.agencyAdminBootstraps.get(bootstrapId)?.claimedByUid, 'admin-1');

  await app.close();
});

test('POST /v1/profile/bootstrap returns the existing account role from the wrong public path', async () => {
  const { app } = await buildTestApp({
    users: new Map([
      [
        'owner-1',
        buildUser({
          agencyId: 'agency-1',
          email: 'owner@example.com',
          ownerId: 'owner-1',
          role: 'owner',
          uid: 'owner-1',
        }),
      ],
    ]),
  });

  const response = await app.inject({
    headers: {
      authorization: 'Bearer owner-token',
    },
    method: 'POST',
    payload: {
      role: 'tenant',
    },
    url: '/v1/profile/bootstrap',
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().data.role, 'owner');
  assert.equal(response.json().data.ownerId, 'owner-1');

  await app.close();
});

test('POST /v1/agency/owner-access-invites creates an invite for an agency admin', async () => {
  const sentOwnerAccessEmails: Parameters<InviteEmailService['sendOwnerAccessInvite']>[0][] = [];
  const { app, repository } = await buildTestApp({
    agencies: new Map([
      [
        'agency-1',
        {
          commissionRate: 0.1,
          commissionType: 'percentage',
          createdAt: '2026-04-20T10:00:00.000Z',
          displayName: 'Agence Test',
          updatedAt: '2026-04-20T10:00:00.000Z',
        },
      ],
    ]),
    users: new Map([
      [
        'admin-1',
        buildUser({
          agencyId: 'agency-1',
          email: 'admin@example.com',
          role: 'agency_admin',
          uid: 'admin-1',
        }),
      ],
    ]),
  }, {
    emailService: {
      async sendOwnerAccessInvite(input) {
        sentOwnerAccessEmails.push(input);
      },
      async sendTenantInvite() {},
    },
  });

  const response = await app.inject({
    headers: {
      authorization: 'Bearer admin-token',
    },
    method: 'POST',
    payload: {
      email: 'new-owner@example.com',
      inviteType: 'code' satisfies InviteType,
    },
    url: '/v1/agency/owner-access-invites',
  });

  assert.equal(response.statusCode, 201);
  assert.equal(response.json().data.status, 'pending');
  assert.equal(repository.state.ownerAccessInvites.size, 1);
  assert.equal(sentOwnerAccessEmails.length, 1);
  assert.equal(sentOwnerAccessEmails[0]?.email, 'new-owner@example.com');
  assert.equal(sentOwnerAccessEmails[0]?.agencyName, 'Agence Test');
  assert.equal(sentOwnerAccessEmails[0]?.inviteCode, response.json().data.ownerInviteCode);

  await app.close();
});

test('invite email failures do not block owner access invite creation', async () => {
  const { app, repository } = await buildTestApp({
    agencies: new Map([
      [
        'agency-1',
        {
          commissionRate: 0.1,
          commissionType: 'percentage',
          createdAt: '2026-04-20T10:00:00.000Z',
          displayName: 'Agence Test',
          updatedAt: '2026-04-20T10:00:00.000Z',
        },
      ],
    ]),
    users: new Map([
      [
        'admin-1',
        buildUser({
          agencyId: 'agency-1',
          email: 'admin@example.com',
          role: 'agency_admin',
          uid: 'admin-1',
        }),
      ],
    ]),
  }, {
    emailService: {
      async sendOwnerAccessInvite() {
        throw new Error('resend unavailable');
      },
      async sendTenantInvite() {},
    },
  });

  const response = await app.inject({
    headers: {
      authorization: 'Bearer admin-token',
    },
    method: 'POST',
    payload: {
      email: 'new-owner@example.com',
      inviteType: 'code' satisfies InviteType,
    },
    url: '/v1/agency/owner-access-invites',
  });

  assert.equal(response.statusCode, 201);
  assert.equal(response.json().data.status, 'pending');
  assert.equal(repository.state.ownerAccessInvites.size, 1);

  await app.close();
});

test('POST /v1/agency/owner-access-invites/:inviteId/revoke revokes a pending invite', async () => {
  const inviteId = 'owner-access-invite-1';
  const { app, repository } = await buildTestApp({
    agencies: new Map([
      [
        'agency-1',
        {
          commissionRate: 0.1,
          commissionType: 'percentage',
          createdAt: '2026-04-20T10:00:00.000Z',
          displayName: 'Agence Test',
          updatedAt: '2026-04-20T10:00:00.000Z',
        },
      ],
    ]),
    ownerAccessInvites: new Map([
      [
        inviteId,
        {
          agencyId: 'agency-1',
          claimedAt: null,
          claimedByUid: null,
          codeHash: inviteId,
          createdAt: '2026-04-22T10:00:00.000Z',
          email: 'new-owner@example.com',
          expiresAt: '2026-04-29T10:00:00.000Z',
          intendedRole: 'owner',
          inviteType: 'code' satisfies InviteType,
          status: 'pending',
        },
      ],
    ]),
    users: new Map([
      [
        'admin-1',
        buildUser({
          agencyId: 'agency-1',
          email: 'admin@example.com',
          role: 'agency_admin',
          uid: 'admin-1',
        }),
      ],
    ]),
  });

  const response = await app.inject({
    headers: {
      authorization: 'Bearer admin-token',
    },
    method: 'POST',
    url: `/v1/agency/owner-access-invites/${inviteId}/revoke`,
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().data.status, 'revoked');
  assert.equal(repository.state.ownerAccessInvites.get(inviteId)?.status, 'revoked');
  assert.equal(repository.state.auditLogs.size, 1);

  await app.close();
});

test('DELETE /v1/agency/owner-access-invites/:inviteId removes a revoked invite', async () => {
  const inviteId = 'owner-access-invite-1';
  const { app, repository } = await buildTestApp({
    agencies: new Map([
      [
        'agency-1',
        {
          commissionRate: 0.1,
          commissionType: 'percentage',
          createdAt: '2026-04-20T10:00:00.000Z',
          displayName: 'Agence Test',
          updatedAt: '2026-04-20T10:00:00.000Z',
        },
      ],
    ]),
    ownerAccessInvites: new Map([
      [
        inviteId,
        {
          agencyId: 'agency-1',
          claimedAt: null,
          claimedByUid: null,
          codeHash: inviteId,
          createdAt: '2026-04-22T10:00:00.000Z',
          email: 'old-owner@example.com',
          expiresAt: '2026-04-29T10:00:00.000Z',
          intendedRole: 'owner',
          inviteType: 'code' satisfies InviteType,
          status: 'revoked',
        },
      ],
    ]),
    users: new Map([
      [
        'admin-1',
        buildUser({
          agencyId: 'agency-1',
          email: 'admin@example.com',
          role: 'agency_admin',
          uid: 'admin-1',
        }),
      ],
    ]),
  });

  const response = await app.inject({
    headers: {
      authorization: 'Bearer admin-token',
    },
    method: 'DELETE',
    url: `/v1/agency/owner-access-invites/${inviteId}`,
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().data.id, inviteId);
  assert.equal(repository.state.ownerAccessInvites.has(inviteId), false);
  assert.equal(repository.state.auditLogs.size, 1);
  assert.equal(Array.from(repository.state.auditLogs.values())[0]?.eventType, 'owner_invite_deleted');

  await app.close();
});

test('DELETE /v1/agency/owner-access-invites/:inviteId requires revoke before delete', async () => {
  const inviteId = 'owner-access-invite-1';
  const { app, repository } = await buildTestApp({
    ownerAccessInvites: new Map([
      [
        inviteId,
        {
          agencyId: 'agency-1',
          claimedAt: null,
          claimedByUid: null,
          codeHash: inviteId,
          createdAt: '2026-04-22T10:00:00.000Z',
          email: 'new-owner@example.com',
          expiresAt: '2026-04-29T10:00:00.000Z',
          intendedRole: 'owner',
          inviteType: 'code' satisfies InviteType,
          status: 'pending',
        },
      ],
    ]),
    users: new Map([
      [
        'admin-1',
        buildUser({
          agencyId: 'agency-1',
          email: 'admin@example.com',
          role: 'agency_admin',
          uid: 'admin-1',
        }),
      ],
    ]),
  });

  const response = await app.inject({
    headers: {
      authorization: 'Bearer admin-token',
    },
    method: 'DELETE',
    url: `/v1/agency/owner-access-invites/${inviteId}`,
  });

  assert.equal(response.statusCode, 409);
  assert.equal(response.json().error.code, 'owner_access_revoke_required');
  assert.equal(repository.state.ownerAccessInvites.has(inviteId), true);

  await app.close();
});

test('PATCH /v1/agency/settings updates agency display name and keeps rent commission disabled', async () => {
  const { app, repository } = await buildTestApp({
    agencies: new Map([
      [
        'agency-1',
        {
          commissionRate: 0.1,
          commissionType: 'percentage',
          createdAt: '2026-04-20T10:00:00.000Z',
          displayName: 'Agence Test',
          updatedAt: '2026-04-20T10:00:00.000Z',
        },
      ],
    ]),
    users: new Map([
      [
        'admin-1',
        buildUser({
          agencyId: 'agency-1',
          email: 'admin@example.com',
          role: 'agency_admin',
          uid: 'admin-1',
        }),
      ],
    ]),
  });

  const response = await app.inject({
    headers: {
      authorization: 'Bearer admin-token',
    },
    method: 'PATCH',
    payload: {
      displayName: 'Agence Centre',
    },
    url: '/v1/agency/settings',
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().data.displayName, 'Agence Centre');
  assert.equal(response.json().data.commissionRate, 0);
  assert.equal(response.json().data.legacyCommissionRate, 0.1);
  assert.equal(response.json().data.ownerAccountFeeAmount, 10);
  assert.equal(response.json().data.ownerAccountFeeCurrency, 'EUR');
  assert.equal(response.json().data.ownerAccountFeeIntervalDays, 42);
  assert.equal(repository.state.agencies.get('agency-1')?.commissionRate, 0);
  assert.equal(repository.state.agencies.get('agency-1')?.displayName, 'Agence Centre');

  await app.close();
});

test('POST /v1/agency/owner-access-invites rejects non agency admins', async () => {
  const { app } = await buildTestApp({
    users: new Map([
      [
        'tenant-1',
        buildUser({
          email: 'tenant@example.com',
          role: 'tenant',
          uid: 'tenant-1',
        }),
      ],
    ]),
  });

  const response = await app.inject({
    headers: {
      authorization: 'Bearer tenant-token',
    },
    method: 'POST',
    payload: {
      inviteType: 'code' satisfies InviteType,
    },
    url: '/v1/agency/owner-access-invites',
  });

  assert.equal(response.statusCode, 403);
  assert.equal(response.json().error.code, 'forbidden_role');

  await app.close();
});

test('empty JSON request bodies return invalid_request instead of internal_error', async () => {
  const { app } = await buildTestApp();

  const response = await app.inject({
    headers: {
      authorization: 'Bearer owner-token',
      'content-type': 'application/json',
    },
    method: 'POST',
    url: '/v1/profile/bootstrap',
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().error.code, 'invalid_request');

  await app.close();
});

test('support requests can be created by a tenant and resolved by an agency admin', async () => {
  const { app } = await buildTestApp({
    users: new Map([
      [
        'admin-1',
        buildUser({
          agencyId: 'agency-1',
          email: 'admin@example.com',
          role: 'agency_admin',
          uid: 'admin-1',
        }),
      ],
      [
        'owner-1',
        buildUser({
          agencyId: 'agency-1',
          email: 'owner@example.com',
          ownerId: 'owner-1',
          role: 'owner',
          uid: 'owner-1',
        }),
      ],
      [
        'tenant-1',
        buildUser({
          email: 'tenant@example.com',
          ownerId: 'owner-1',
          role: 'tenant',
          tenantId: 'tenant-1',
          uid: 'tenant-1',
        }),
      ],
    ]),
    owners: new Map([
      [
        'owner-1',
        {
          agencyId: 'agency-1',
          createdAt: '2026-04-20T10:00:00.000Z',
          displayName: 'Owner User',
          updatedAt: '2026-04-20T10:00:00.000Z',
          userId: 'owner-1',
        },
      ],
    ]),
    agencies: new Map([
      [
        'agency-1',
        {
          commissionRate: 0.1,
          commissionType: 'percentage',
          createdAt: '2026-04-20T10:00:00.000Z',
          displayName: 'Agence Test',
          updatedAt: '2026-04-20T10:00:00.000Z',
        },
      ],
    ]),
    tenants: new Map([
      [
        'tenant-1',
        {
          createdAt: '2026-04-22T10:00:00.000Z',
          displayName: 'Tenant User',
          email: 'tenant@example.com',
          ownerId: 'owner-1',
          propertyId: 'property-1',
          status: 'active',
          unitId: 'unit-1',
          updatedAt: '2026-04-22T10:00:00.000Z',
          userId: 'tenant-1',
        },
      ],
    ]),
  });

  const createResponse = await app.inject({
    headers: {
      authorization: 'Bearer tenant-token',
    },
    method: 'POST',
    payload: {
      category: 'payment_problem',
      description: 'Le reçu ne s’affiche pas.',
      subject: 'Problème reçu',
    },
    url: '/v1/support/requests',
  });

  assert.equal(createResponse.statusCode, 201);
  const requestId = createResponse.json().data.id as string;

  const listResponse = await app.inject({
    headers: {
      authorization: 'Bearer admin-token',
    },
    method: 'GET',
    url: '/v1/support/requests',
  });

  assert.equal(listResponse.statusCode, 200);
  assert.equal(listResponse.json().data.length, 1);

  const resolveResponse = await app.inject({
    headers: {
      authorization: 'Bearer admin-token',
    },
    method: 'PATCH',
    payload: {
      resolutionNote: 'Support contacté.',
      status: 'resolved',
    },
    url: `/v1/support/requests/${requestId}`,
  });

  assert.equal(resolveResponse.statusCode, 200);
  assert.equal(resolveResponse.json().data.status, 'resolved');

  await app.close();
});

test('agency and owner dashboards expose operational summaries', async () => {
  const { app } = await buildTestApp({
    agencies: new Map([
      [
        'agency-1',
        {
          commissionRate: 0.1,
          commissionType: 'percentage',
          createdAt: '2026-04-20T10:00:00.000Z',
          displayName: 'Agence Test',
          updatedAt: '2026-04-20T10:00:00.000Z',
        },
      ],
    ]),
    ownerAccessInvites: new Map([
      [
        'owner-invite-1',
        {
          agencyId: 'agency-1',
          claimedAt: null,
          claimedByUid: null,
          codeHash: 'owner-invite-1',
          createdAt: '2026-04-20T10:00:00.000Z',
          email: null,
          expiresAt: '2026-04-29T10:00:00.000Z',
          intendedRole: 'owner',
          inviteType: 'code',
          status: 'pending',
        },
      ],
    ]),
    owners: new Map([
      [
        'owner-1',
        {
          agencyId: 'agency-1',
          createdAt: '2026-04-20T10:00:00.000Z',
          displayName: 'Owner User',
          updatedAt: '2026-04-20T10:00:00.000Z',
          userId: 'owner-1',
        },
      ],
    ]),
    properties: new Map([
      [
        'property-1',
        {
          address: 'Tevragh-Zeina',
          createdAt: '2026-04-20T10:00:00.000Z',
          label: 'Résidence Alpha',
          ownerId: 'owner-1',
          updatedAt: '2026-04-20T10:00:00.000Z',
        },
      ],
    ]),
    rentPayments: new Map([
      [
        'payment-1',
        {
          agencyFeeAmount: 20000,
          agencyId: 'agency-1',
          commissionRate: 0.1,
          createdAt: '2026-04-20T10:00:00.000Z',
          dueDate: '2026-04-05',
          grossAmount: 200000,
          monthKey: '2026-04',
          ownerId: 'owner-1',
          ownerNetAmount: 180000,
          paidAt: '2026-04-21T10:00:00.000Z',
          paymentMethod: 'Bankily',
          paymentStatus: 'paid',
          propertyId: 'property-1',
          providerReference: 'SIM-1',
          receiptId: 'receipt-1',
          tenantId: 'tenant-1',
          unitId: 'unit-1',
          updatedAt: '2026-04-21T10:00:00.000Z',
        },
      ],
      [
        'payment-2',
        {
          agencyFeeAmount: 15000,
          agencyId: 'agency-1',
          commissionRate: 0.1,
          createdAt: '2026-04-20T10:00:00.000Z',
          dueDate: '2026-04-05',
          grossAmount: 150000,
          monthKey: '2026-04',
          ownerId: 'owner-1',
          ownerNetAmount: 135000,
          paidAt: null,
          paymentMethod: null,
          paymentStatus: 'pending',
          propertyId: 'property-1',
          providerReference: null,
          receiptId: null,
          tenantId: 'tenant-2',
          unitId: 'unit-2',
          updatedAt: '2026-04-20T10:00:00.000Z',
        },
      ],
    ]),
    tenants: new Map([
      [
        'tenant-1',
        {
          createdAt: '2026-04-20T10:00:00.000Z',
          displayName: 'Tenant User',
          email: 'tenant@example.com',
          ownerId: 'owner-1',
          propertyId: 'property-1',
          status: 'active',
          unitId: 'unit-1',
          updatedAt: '2026-04-20T10:00:00.000Z',
          userId: 'tenant-1',
        },
      ],
    ]),
    units: new Map([
      [
        'unit-1',
        {
          activeInviteId: null,
          createdAt: '2026-04-20T10:00:00.000Z',
          currency: 'MRU',
          label: 'A1',
          ownerId: 'owner-1',
          propertyId: 'property-1',
          rentAmount: 200000,
          status: 'occupied',
          tenantId: 'tenant-1',
          updatedAt: '2026-04-20T10:00:00.000Z',
        },
      ],
      [
        'unit-2',
        {
          activeInviteId: null,
          createdAt: '2026-04-20T10:00:00.000Z',
          currency: 'MRU',
          label: 'A2',
          ownerId: 'owner-1',
          propertyId: 'property-1',
          rentAmount: 150000,
          status: 'vacant',
          tenantId: null,
          updatedAt: '2026-04-20T10:00:00.000Z',
        },
      ],
    ]),
    users: new Map([
      [
        'admin-1',
        buildUser({
          agencyId: 'agency-1',
          email: 'admin@example.com',
          role: 'agency_admin',
          uid: 'admin-1',
        }),
      ],
      [
        'owner-1',
        buildUser({
          agencyId: 'agency-1',
          email: 'owner@example.com',
          ownerId: 'owner-1',
          role: 'owner',
          uid: 'owner-1',
        }),
      ],
      [
        'tenant-1',
        buildUser({
          agencyId: 'agency-1',
          email: 'tenant@example.com',
          ownerId: 'owner-1',
          role: 'tenant',
          tenantId: 'tenant-1',
          uid: 'tenant-1',
        }),
      ],
    ]),
  });

  const agencyResponse = await app.inject({
    headers: {
      authorization: 'Bearer admin-token',
    },
    method: 'GET',
    url: '/v1/agency/dashboard?period=this_month',
  });

  assert.equal(agencyResponse.statusCode, 200);
  assert.equal(agencyResponse.json().data.activeOwnersCount, 1);
  assert.equal(agencyResponse.json().data.activeTenantsCount, 1);
  assert.equal(agencyResponse.json().data.pendingInvitesCount, 1);
  assert.equal(agencyResponse.json().data.rentSummary.grossAmount, 200000);
  assert.equal(agencyResponse.json().data.paymentsByStatus.pending, 1);

  const ownerResponse = await app.inject({
    headers: {
      authorization: 'Bearer owner-token',
    },
    method: 'GET',
    url: '/v1/owner/dashboard?period=this_month',
  });

  assert.equal(ownerResponse.statusCode, 200);
  assert.equal(ownerResponse.json().data.totalPropertiesCount, 1);
  assert.equal(ownerResponse.json().data.totalUnitsCount, 2);
  assert.equal(ownerResponse.json().data.ownerNetAmount, 180000);

  await app.close();
});

test('owner inventory endpoints update and delete safe records', async () => {
  const { app, repository } = await buildTestApp({
    owners: new Map([
      [
        'owner-1',
        {
          agencyId: 'agency-1',
          createdAt: '2026-04-22T09:00:00.000Z',
          displayName: 'Owner User',
          updatedAt: '2026-04-22T09:00:00.000Z',
          userId: 'owner-1',
        },
      ],
    ]),
    properties: new Map([
      [
        'property-1',
        {
          address: 'Old address',
          createdAt: '2026-04-22T09:00:00.000Z',
          label: 'Old property',
          ownerId: 'owner-1',
          updatedAt: '2026-04-22T09:00:00.000Z',
        },
      ],
    ]),
    units: new Map([
      [
        'unit-1',
        {
          activeInviteId: null,
          createdAt: '2026-04-22T09:00:00.000Z',
          currency: 'MRU',
          label: 'A1',
          notes: null,
          ownerId: 'owner-1',
          propertyId: 'property-1',
          rentAmount: 100000,
          status: 'vacant',
          tenantId: null,
          updatedAt: '2026-04-22T09:00:00.000Z',
        },
      ],
    ]),
    users: new Map([
      [
        'owner-1',
        buildUser({
          agencyId: 'agency-1',
          email: 'owner@example.com',
          ownerId: 'owner-1',
          role: 'owner',
          uid: 'owner-1',
        }),
      ],
    ]),
  });

  const propertyResponse = await app.inject({
    headers: {
      authorization: 'Bearer owner-token',
    },
    method: 'PATCH',
    payload: {
      address: 'Tevragh-Zeina, Nouakchott',
      label: 'Résidence Alpha',
    },
    url: '/v1/owner/properties/property-1',
  });

  assert.equal(propertyResponse.statusCode, 200);
  assert.equal(repository.state.properties.get('property-1')?.label, 'Résidence Alpha');

  const unitResponse = await app.inject({
    headers: {
      authorization: 'Bearer owner-token',
    },
    method: 'PATCH',
    payload: {
      label: 'Appartement A3',
      notes: '2e étage',
      rentAmount: 150000,
    },
    url: '/v1/owner/units/unit-1',
  });

  assert.equal(unitResponse.statusCode, 200);
  assert.equal(repository.state.units.get('unit-1')?.label, 'Appartement A3');
  assert.equal(repository.state.units.get('unit-1')?.rentAmount, 150000);

  const deleteUnitResponse = await app.inject({
    headers: {
      authorization: 'Bearer owner-token',
    },
    method: 'DELETE',
    url: '/v1/owner/units/unit-1',
  });

  assert.equal(deleteUnitResponse.statusCode, 200);
  assert.equal(repository.state.units.has('unit-1'), false);

  const deletePropertyResponse = await app.inject({
    headers: {
      authorization: 'Bearer owner-token',
    },
    method: 'DELETE',
    url: '/v1/owner/properties/property-1',
  });

  assert.equal(deletePropertyResponse.statusCode, 200);
  assert.equal(repository.state.properties.has('property-1'), false);

  await app.close();
});

test('owner inventory delete rejects occupied or non-empty records', async () => {
  const { app } = await buildTestApp({
    owners: new Map([
      [
        'owner-1',
        {
          agencyId: 'agency-1',
          createdAt: '2026-04-22T09:00:00.000Z',
          displayName: 'Owner User',
          updatedAt: '2026-04-22T09:00:00.000Z',
          userId: 'owner-1',
        },
      ],
    ]),
    properties: new Map([
      [
        'property-1',
        {
          address: 'Tevragh-Zeina',
          createdAt: '2026-04-22T09:00:00.000Z',
          label: 'Résidence Alpha',
          ownerId: 'owner-1',
          updatedAt: '2026-04-22T09:00:00.000Z',
        },
      ],
    ]),
    units: new Map([
      [
        'unit-1',
        {
          activeInviteId: null,
          createdAt: '2026-04-22T09:00:00.000Z',
          currency: 'MRU',
          label: 'A1',
          notes: null,
          ownerId: 'owner-1',
          propertyId: 'property-1',
          rentAmount: 100000,
          status: 'occupied',
          tenantId: 'tenant-1',
          updatedAt: '2026-04-22T09:00:00.000Z',
        },
      ],
    ]),
    users: new Map([
      [
        'owner-1',
        buildUser({
          agencyId: 'agency-1',
          email: 'owner@example.com',
          ownerId: 'owner-1',
          role: 'owner',
          uid: 'owner-1',
        }),
      ],
    ]),
  });

  const deleteUnitResponse = await app.inject({
    headers: {
      authorization: 'Bearer owner-token',
    },
    method: 'DELETE',
    url: '/v1/owner/units/unit-1',
  });

  assert.equal(deleteUnitResponse.statusCode, 409);
  assert.equal(deleteUnitResponse.json().error.code, 'unit_not_deletable');

  const deletePropertyResponse = await app.inject({
    headers: {
      authorization: 'Bearer owner-token',
    },
    method: 'DELETE',
    url: '/v1/owner/properties/property-1',
  });

  assert.equal(deletePropertyResponse.statusCode, 409);
  assert.equal(deletePropertyResponse.json().error.code, 'property_has_units');

  await app.close();
});

test('agency admins can suspend and reactivate agency users', async () => {
  const { app, repository } = await buildTestApp({
    users: new Map([
      [
        'admin-1',
        buildUser({
          agencyId: 'agency-1',
          email: 'admin@example.com',
          role: 'agency_admin',
          uid: 'admin-1',
        }),
      ],
      [
        'tenant-1',
        buildUser({
          agencyId: 'agency-1',
          email: 'tenant@example.com',
          ownerId: 'owner-1',
          role: 'tenant',
          tenantId: 'tenant-1',
          uid: 'tenant-1',
        }),
      ],
    ]),
    tenants: new Map([
      [
        'tenant-1',
        {
          createdAt: '2026-04-20T10:00:00.000Z',
          displayName: 'Tenant User',
          email: 'tenant@example.com',
          ownerId: 'owner-1',
          propertyId: 'property-1',
          status: 'active',
          unitId: 'unit-1',
          updatedAt: '2026-04-20T10:00:00.000Z',
          userId: 'tenant-1',
        },
      ],
    ]),
  });

  const suspendResponse = await app.inject({
    headers: {
      authorization: 'Bearer admin-token',
    },
    method: 'PATCH',
    payload: {
      status: 'suspended',
    },
    url: '/v1/agency/users/tenant-1/status',
  });

  assert.equal(suspendResponse.statusCode, 200);
  assert.equal(suspendResponse.json().data.status, 'suspended');
  assert.equal(repository.state.users.get('tenant-1')?.status, 'suspended');
  assert.equal(repository.state.tenants.get('tenant-1')?.status, 'suspended');
  assert.equal(repository.state.auditLogs.size, 1);
  assert.equal(repository.state.notifications.size, 1);

  const notificationsResponse = await app.inject({
    headers: {
      authorization: 'Bearer tenant-token',
    },
    method: 'GET',
    url: '/v1/notifications',
  });

  assert.equal(notificationsResponse.statusCode, 200);
  assert.equal(notificationsResponse.json().data[0].type, 'account_suspended');

  const reactivateResponse = await app.inject({
    headers: {
      authorization: 'Bearer admin-token',
    },
    method: 'PATCH',
    payload: {
      status: 'active',
    },
    url: '/v1/agency/users/tenant-1/status',
  });

  assert.equal(reactivateResponse.statusCode, 200);
  assert.equal(repository.state.users.get('tenant-1')?.status, 'active');
  assert.equal(repository.state.tenants.get('tenant-1')?.status, 'active');

  await app.close();
});

test('live owner -> tenant -> simulated payment flow issues a verifiable receipt', async () => {
  const ownerInviteCode = 'OWNR-1111-AAAA-BBBB';
  const ownerInviteId = hashInviteCode(ownerInviteCode);
  const sentTenantEmails: Parameters<InviteEmailService['sendTenantInvite']>[0][] = [];
  const { app, repository } = await buildTestApp({
    agencies: new Map([
      [
        'agency-1',
        {
          commissionRate: 0.15,
          commissionType: 'percentage',
          createdAt: '2026-04-20T10:00:00.000Z',
          displayName: 'Agence Test',
          updatedAt: '2026-04-20T10:00:00.000Z',
        },
      ],
    ]),
    ownerAccessInvites: new Map([
      [
        ownerInviteId,
        {
          agencyId: 'agency-1',
          claimedAt: null,
          claimedByUid: null,
          codeHash: ownerInviteId,
          createdAt: '2026-04-20T10:00:00.000Z',
          email: 'owner@example.com',
          expiresAt: '2026-04-29T10:00:00.000Z',
          intendedRole: 'owner',
          inviteType: 'code',
          status: 'pending',
        },
      ],
    ]),
    users: new Map([
      [
        'owner-1',
        buildUser({
          email: 'owner@example.com',
          role: 'owner',
          status: 'pending_owner_access',
          uid: 'owner-1',
        }),
      ],
      [
        'tenant-1',
        buildUser({
          email: 'tenant@example.com',
          role: 'tenant',
          uid: 'tenant-1',
        }),
      ],
    ]),
  }, {
    emailService: {
      async sendOwnerAccessInvite() {},
      async sendTenantInvite(input) {
        sentTenantEmails.push(input);
      },
    },
  });

  const activateOwnerResponse = await app.inject({
    headers: {
      authorization: 'Bearer owner-token',
    },
    method: 'POST',
    payload: {
      inviteCode: ownerInviteCode,
    },
    url: '/v1/owner-access/redeem',
  });

  assert.equal(activateOwnerResponse.statusCode, 200);

  const propertyResponse = await app.inject({
    headers: {
      authorization: 'Bearer owner-token',
    },
    method: 'POST',
    payload: {
      address: 'Tevragh-Zeina',
      label: 'Résidence Alpha',
    },
    url: '/v1/owner/properties',
  });

  assert.equal(propertyResponse.statusCode, 201);
  const propertyId = propertyResponse.json().data.id as string;

  const unitResponse = await app.inject({
    headers: {
      authorization: 'Bearer owner-token',
    },
    method: 'POST',
    payload: {
      currency: 'MRU',
      label: 'A1',
      notes: '2e étage, côté cour',
      propertyId,
      rentAmount: 200000,
    },
    url: '/v1/owner/units',
  });

  assert.equal(unitResponse.statusCode, 201);
  const unitId = unitResponse.json().data.id as string;
  assert.equal(repository.state.units.get(unitId)?.notes, '2e étage, côté cour');

  const tenantInviteResponse = await app.inject({
    headers: {
      authorization: 'Bearer owner-token',
    },
    method: 'POST',
    payload: {
      email: 'tenant@example.com',
      inviteType: 'code' satisfies InviteType,
      unitId,
    },
    url: '/v1/invites',
  });

  assert.equal(tenantInviteResponse.statusCode, 201);
  const tenantInviteCode = tenantInviteResponse.json().data.inviteCode as string;
  assert.equal(sentTenantEmails.length, 1);
  assert.equal(sentTenantEmails[0]?.email, 'tenant@example.com');
  assert.equal(sentTenantEmails[0]?.ownerName, 'Owner User');
  assert.equal(sentTenantEmails[0]?.propertyLabel, 'Résidence Alpha');
  assert.equal(sentTenantEmails[0]?.unitLabel, 'A1');
  assert.equal(sentTenantEmails[0]?.inviteCode, tenantInviteCode);

  const tenantRedeemResponse = await app.inject({
    headers: {
      authorization: 'Bearer tenant-token',
    },
    method: 'POST',
    payload: {
      inviteCode: tenantInviteCode,
    },
    url: '/v1/invites/redeem',
  });

  assert.equal(tenantRedeemResponse.statusCode, 200);
  const paymentId = tenantRedeemResponse.json().data.paymentId as string;
  const seededPayment = repository.state.rentPayments.get(paymentId);

  assert.equal(seededPayment?.paymentStatus, 'pending' satisfies PaymentStatus);
  assert.equal(seededPayment?.agencyFeeAmount, 0);
  assert.equal(seededPayment?.commissionRate, 0);
  assert.equal(seededPayment?.ownerNetAmount, 200000);
  assert.equal(seededPayment?.tenantFeeAmount, 0);
  assert.equal(seededPayment?.platformRentFeeAmount, 0);
  assert.equal(seededPayment?.ownerReceivableAmount, 200000);

  const completePaymentResponse = await app.inject({
    headers: {
      authorization: 'Bearer tenant-token',
    },
    method: 'POST',
    payload: {
      paymentMethod: 'Bankily',
    },
    url: `/v1/payments/${paymentId}/simulate-complete`,
  });

  assert.equal(completePaymentResponse.statusCode, 200);
  const receipt = completePaymentResponse.json().data.receipt as ReceiptDoc;

  assert.equal(receipt.simulated, true);
  assert.equal(receipt.grossAmount, 200000);
  assert.equal(receipt.agencyFeeAmount, 0);
  assert.equal(receipt.ownerNetAmount, 200000);

  const verifyResponse = await app.inject({
    method: 'GET',
    url: `/v1/receipts/verify/${receipt.qrVerificationToken}`,
  });

  assert.equal(verifyResponse.statusCode, 200);
  assert.equal(verifyResponse.json().data.valid, true);
  assert.equal(verifyResponse.json().data.receipt.receiptNumber, receipt.receiptNumber);

  await app.close();
});

test('owner billing account uses 10 EUR six-week access and simulated payment extends early from current period end', async () => {
  const { app, repository } = await buildTestApp({
    owners: new Map([
      [
        'owner-1',
        {
          agencyId: 'agency-1',
          createdAt: '2026-04-20T10:00:00.000Z',
          displayName: 'Owner User',
          updatedAt: '2026-04-20T10:00:00.000Z',
          userId: 'owner-1',
        },
      ],
    ]),
    users: new Map([
      [
        'owner-1',
        buildUser({
          agencyId: 'agency-1',
          email: 'owner@example.com',
          ownerId: 'owner-1',
          role: 'owner',
          uid: 'owner-1',
        }),
      ],
    ]),
  });

  const summaryResponse = await app.inject({
    headers: {
      authorization: 'Bearer owner-token',
    },
    method: 'GET',
    url: '/v1/owner/billing',
  });

  assert.equal(summaryResponse.statusCode, 200);
  assert.equal(summaryResponse.json().data.feeAmount, 10);
  assert.equal(summaryResponse.json().data.feeCurrency, 'EUR');
  assert.equal(summaryResponse.json().data.intervalDays, 42);
  assert.equal(summaryResponse.json().data.account.status, 'active');
  assert.equal(summaryResponse.json().data.activeUntil, '2026-06-03T10:00:00.000Z');

  const payResponse = await app.inject({
    headers: {
      authorization: 'Bearer owner-token',
    },
    method: 'POST',
    url: '/v1/owner/billing/pay-simulated',
  });

  assert.equal(payResponse.statusCode, 200);
  assert.equal(payResponse.json().data.latestInvoice.status, 'paid');
  assert.equal(payResponse.json().data.activeUntil, '2026-07-15T10:00:00.000Z');
  assert.equal(repository.state.ownerBillingInvoices.size, 1);
  assert.equal(repository.state.ownerBillingPayments.size, 1);

  await app.close();
});

test('production simulated owner fee payment returns 403', async () => {
  const { app, repository } = await buildTestApp(buildOwnerBillingUserSeed(), {
    config: {
      appVariant: 'production',
      paymentProvider: 'simulated',
    },
  });

  const payResponse = await app.inject({
    headers: {
      authorization: 'Bearer owner-token',
    },
    method: 'POST',
    url: '/v1/owner/billing/pay-simulated',
  });

  assert.equal(payResponse.statusCode, 403);
  assert.equal(payResponse.json().error.code, 'owner_billing_simulation_disabled');
  assert.equal(repository.state.ownerBillingInvoices.size, 0);
  assert.equal(repository.state.ownerBillingPayments.size, 0);

  await app.close();
});

test('development simulated owner fee payment still works', async () => {
  const { app } = await buildTestApp(buildOwnerBillingUserSeed(), {
    config: {
      appVariant: 'development',
      paymentProvider: 'simulated',
    },
  });

  const payResponse = await app.inject({
    headers: {
      authorization: 'Bearer owner-token',
    },
    method: 'POST',
    url: '/v1/owner/billing/pay-simulated',
  });

  assert.equal(payResponse.statusCode, 200);
  assert.equal(payResponse.json().data.latestInvoice.status, 'paid');

  await app.close();
});

test('preview simulated owner fee payment still works', async () => {
  const { app } = await buildTestApp(buildOwnerBillingUserSeed(), {
    config: {
      appVariant: 'preview',
      paymentProvider: 'manual',
    },
  });

  const payResponse = await app.inject({
    headers: {
      authorization: 'Bearer owner-token',
    },
    method: 'POST',
    url: '/v1/owner/billing/pay-simulated',
  });

  assert.equal(payResponse.statusCode, 200);
  assert.equal(payResponse.json().data.latestInvoice.status, 'paid');

  await app.close();
});

for (const billingStatus of ['active', 'grace_period', 'past_due'] as const) {
  test(`tenant rent payment still works when owner billing is ${billingStatus}`, async () => {
    const { app } = await buildTestApp(buildOwnerBillingPaymentSeed(billingStatus));

    const paymentResponse = await app.inject({
      headers: {
        authorization: 'Bearer tenant-token',
      },
      method: 'POST',
      payload: {
        paymentMethod: 'Bankily',
      },
      url: '/v1/payments/payment-1/simulate-complete',
    });

    assert.equal(paymentResponse.statusCode, 200);
    assert.equal(paymentResponse.json().data.payment.agencyFeeAmount, 0);
    assert.equal(paymentResponse.json().data.payment.commissionRate, 0);
    assert.equal(paymentResponse.json().data.payment.ownerReceivableAmount, 200000);
    assert.equal(paymentResponse.json().data.payment.paymentStatus, 'paid');

    await app.close();
  });
}

test('past due owner billing blocks new invites without blocking tenant rent payment', async () => {
  const { app } = await buildTestApp({
    ownerBillingAccounts: new Map([
      [
        'owner-1',
        {
          agencyId: 'agency-1',
          createdAt: '2026-01-01T10:00:00.000Z',
          currentPeriodEnd: '2026-03-01T10:00:00.000Z',
          currentPeriodStart: '2026-01-19T10:00:00.000Z',
          feeAmount: 10,
          feeCurrency: 'EUR',
          gracePeriodEndsAt: '2026-03-08T10:00:00.000Z',
          intervalDays: 42,
          nextPaymentDueAt: '2026-03-01T10:00:00.000Z',
          ownerId: 'owner-1',
          status: 'past_due',
          updatedAt: '2026-03-08T10:00:00.000Z',
        },
      ],
    ]),
    owners: new Map([
      [
        'owner-1',
        {
          agencyId: 'agency-1',
          createdAt: '2026-04-20T10:00:00.000Z',
          displayName: 'Owner User',
          updatedAt: '2026-04-20T10:00:00.000Z',
          userId: 'owner-1',
        },
      ],
    ]),
    properties: new Map([
      [
        'property-1',
        {
          address: 'Tevragh-Zeina',
          createdAt: '2026-04-20T10:00:00.000Z',
          label: 'Résidence Alpha',
          ownerId: 'owner-1',
          updatedAt: '2026-04-20T10:00:00.000Z',
        },
      ],
    ]),
    rentPayments: new Map([
      [
        'payment-1',
        {
          agencyFeeAmount: 0,
          agencyId: 'agency-1',
          commissionRate: 0,
          createdAt: '2026-04-20T10:00:00.000Z',
          dueDate: '2026-04-05',
          grossAmount: 200000,
          monthKey: '2026-04',
          ownerId: 'owner-1',
          ownerNetAmount: 200000,
          ownerReceivableAmount: 200000,
          paidAt: null,
          paymentMethod: null,
          paymentStatus: 'pending',
          platformRentFeeAmount: 0,
          propertyId: 'property-1',
          providerReference: null,
          receiptId: null,
          rentAmount: 200000,
          tenantFeeAmount: 0,
          tenantId: 'tenant-1',
          unitId: 'unit-1',
          updatedAt: '2026-04-20T10:00:00.000Z',
        },
      ],
    ]),
    tenants: new Map([
      [
        'tenant-1',
        {
          createdAt: '2026-04-20T10:00:00.000Z',
          displayName: 'Tenant User',
          email: 'tenant@example.com',
          ownerId: 'owner-1',
          propertyId: 'property-1',
          status: 'active',
          unitId: 'unit-1',
          updatedAt: '2026-04-20T10:00:00.000Z',
          userId: 'tenant-1',
        },
      ],
    ]),
    units: new Map([
      [
        'unit-1',
        {
          activeInviteId: null,
          createdAt: '2026-04-20T10:00:00.000Z',
          currency: 'MRU',
          label: 'A1',
          ownerId: 'owner-1',
          propertyId: 'property-1',
          rentAmount: 200000,
          status: 'occupied',
          tenantId: 'tenant-1',
          updatedAt: '2026-04-20T10:00:00.000Z',
        },
      ],
      [
        'unit-2',
        {
          activeInviteId: null,
          createdAt: '2026-04-20T10:00:00.000Z',
          currency: 'MRU',
          label: 'A2',
          ownerId: 'owner-1',
          propertyId: 'property-1',
          rentAmount: 150000,
          status: 'vacant',
          tenantId: null,
          updatedAt: '2026-04-20T10:00:00.000Z',
        },
      ],
    ]),
    users: new Map([
      [
        'owner-1',
        buildUser({
          agencyId: 'agency-1',
          email: 'owner@example.com',
          ownerId: 'owner-1',
          role: 'owner',
          uid: 'owner-1',
        }),
      ],
      [
        'tenant-1',
        buildUser({
          agencyId: 'agency-1',
          email: 'tenant@example.com',
          ownerId: 'owner-1',
          role: 'tenant',
          tenantId: 'tenant-1',
          uid: 'tenant-1',
        }),
      ],
    ]),
  });

  const inviteResponse = await app.inject({
    headers: {
      authorization: 'Bearer owner-token',
    },
    method: 'POST',
    payload: {
      inviteType: 'code' satisfies InviteType,
      unitId: 'unit-2',
    },
    url: '/v1/invites',
  });

  assert.equal(inviteResponse.statusCode, 402);
  assert.equal(inviteResponse.json().error.code, 'owner_billing_past_due');

  const paymentResponse = await app.inject({
    headers: {
      authorization: 'Bearer tenant-token',
    },
    method: 'POST',
    payload: {
      paymentMethod: 'Bankily',
    },
    url: '/v1/payments/payment-1/simulate-complete',
  });

  assert.equal(paymentResponse.statusCode, 200);
  assert.equal(paymentResponse.json().data.payment.agencyFeeAmount, 0);
  assert.equal(paymentResponse.json().data.payment.ownerNetAmount, 200000);

  await app.close();
});

test('suspended owner billing blocks owner writes while tenant receipts remain readable', async () => {
  const { app, repository } = await buildTestApp({
    ownerBillingAccounts: new Map([
      [
        'owner-1',
        {
          agencyId: 'agency-1',
          createdAt: '2026-01-01T10:00:00.000Z',
          currentPeriodEnd: '2026-03-01T10:00:00.000Z',
          currentPeriodStart: '2026-01-19T10:00:00.000Z',
          feeAmount: 10,
          feeCurrency: 'EUR',
          gracePeriodEndsAt: '2026-03-08T10:00:00.000Z',
          intervalDays: 42,
          nextPaymentDueAt: '2026-03-01T10:00:00.000Z',
          ownerId: 'owner-1',
          status: 'suspended',
          updatedAt: '2026-03-08T10:00:00.000Z',
        },
      ],
    ]),
    owners: new Map([
      [
        'owner-1',
        {
          agencyId: 'agency-1',
          createdAt: '2026-04-20T10:00:00.000Z',
          displayName: 'Owner User',
          updatedAt: '2026-04-20T10:00:00.000Z',
          userId: 'owner-1',
        },
      ],
    ]),
    properties: new Map([
      [
        'property-1',
        {
          address: 'Tevragh-Zeina',
          createdAt: '2026-04-20T10:00:00.000Z',
          label: 'Résidence Alpha',
          ownerId: 'owner-1',
          updatedAt: '2026-04-20T10:00:00.000Z',
        },
      ],
    ]),
    receipts: new Map([
      [
        'receipt-1',
        {
          agencyDisplayName: 'Agence Test',
          agencyFeeAmount: 0,
          agencyId: 'agency-1',
          grossAmount: 200000,
          id: 'receipt-1',
          issuanceSource: 'simulate-complete',
          issuedAt: '2026-04-21T10:00:00.000Z',
          issuedBy: 'backend',
          ownerDisplayName: 'Owner User',
          ownerEmail: 'owner@example.com',
          ownerId: 'owner-1',
          ownerNetAmount: 200000,
          paidAt: '2026-04-21T10:00:00.000Z',
          paymentId: 'payment-1',
          paymentMethod: 'Bankily',
          paymentStatus: 'paid',
          propertyId: 'property-1',
          propertyLabel: 'Résidence Alpha',
          qrVerificationToken: 'receipt-token-12345678',
          receiptNumber: 'ATP-20260421-0001',
          simulated: true,
          tenantDisplayName: 'Tenant User',
          tenantEmail: 'tenant@example.com',
          tenantId: 'tenant-1',
          unitId: 'unit-1',
          unitLabel: 'A1',
          verificationUrl: 'atoupay://receipt-verification?token=receipt-token-12345678',
        },
      ],
    ]),
    rentPayments: new Map([
      [
        'payment-1',
        {
          agencyFeeAmount: 0,
          agencyId: 'agency-1',
          commissionRate: 0,
          createdAt: '2026-04-20T10:00:00.000Z',
          dueDate: '2026-04-05',
          grossAmount: 200000,
          monthKey: '2026-04',
          ownerId: 'owner-1',
          ownerNetAmount: 200000,
          ownerReceivableAmount: 200000,
          paidAt: '2026-04-21T10:00:00.000Z',
          paymentMethod: 'Bankily',
          paymentStatus: 'paid',
          platformRentFeeAmount: 0,
          propertyId: 'property-1',
          providerReference: 'SIM-123',
          receiptId: 'receipt-1',
          rentAmount: 200000,
          tenantFeeAmount: 0,
          tenantId: 'tenant-1',
          unitId: 'unit-1',
          updatedAt: '2026-04-21T10:00:00.000Z',
        },
      ],
    ]),
    tenants: new Map([
      [
        'tenant-1',
        {
          createdAt: '2026-04-20T10:00:00.000Z',
          displayName: 'Tenant User',
          email: 'tenant@example.com',
          ownerId: 'owner-1',
          propertyId: 'property-1',
          status: 'active',
          unitId: 'unit-1',
          updatedAt: '2026-04-20T10:00:00.000Z',
          userId: 'tenant-1',
        },
      ],
    ]),
    units: new Map([
      [
        'unit-1',
        {
          activeInviteId: null,
          createdAt: '2026-04-20T10:00:00.000Z',
          currency: 'MRU',
          label: 'A1',
          ownerId: 'owner-1',
          propertyId: 'property-1',
          rentAmount: 200000,
          status: 'vacant',
          tenantId: null,
          updatedAt: '2026-04-20T10:00:00.000Z',
        },
      ],
    ]),
    users: new Map([
      [
        'owner-1',
        buildUser({
          agencyId: 'agency-1',
          email: 'owner@example.com',
          ownerId: 'owner-1',
          role: 'owner',
          uid: 'owner-1',
        }),
      ],
      [
        'tenant-1',
        buildUser({
          agencyId: 'agency-1',
          email: 'tenant@example.com',
          ownerId: 'owner-1',
          role: 'tenant',
          tenantId: 'tenant-1',
          uid: 'tenant-1',
        }),
      ],
    ]),
  });

  const createPropertyResponse = await app.inject({
    headers: {
      authorization: 'Bearer owner-token',
    },
    method: 'POST',
    payload: {
      address: 'Ksar',
      label: 'Résidence Bloquée',
    },
    url: '/v1/owner/properties',
  });

  assert.equal(createPropertyResponse.statusCode, 403);
  assert.equal(createPropertyResponse.json().error.code, 'owner_billing_suspended');

  const createUnitResponse = await app.inject({
    headers: {
      authorization: 'Bearer owner-token',
    },
    method: 'POST',
    payload: {
      currency: 'MRU',
      label: 'A2',
      propertyId: 'property-1',
      rentAmount: 150000,
    },
    url: '/v1/owner/units',
  });

  assert.equal(createUnitResponse.statusCode, 403);
  assert.equal(createUnitResponse.json().error.code, 'owner_billing_suspended');

  const inviteResponse = await app.inject({
    headers: {
      authorization: 'Bearer owner-token',
    },
    method: 'POST',
    payload: {
      inviteType: 'code' satisfies InviteType,
      unitId: 'unit-1',
    },
    url: '/v1/invites',
  });

  assert.equal(inviteResponse.statusCode, 403);
  assert.equal(inviteResponse.json().error.code, 'owner_billing_suspended');

  const tenantReceiptResponse = await app.inject({
    headers: {
      authorization: 'Bearer tenant-token',
    },
    method: 'GET',
    url: '/v1/receipts/receipt-1',
  });

  assert.equal(tenantReceiptResponse.statusCode, 200);
  assert.equal(tenantReceiptResponse.json().data.receiptNumber, 'ATP-20260421-0001');

  const verifyResponse = await app.inject({
    method: 'GET',
    url: '/v1/receipts/verify/receipt-token-12345678',
  });

  assert.equal(verifyResponse.statusCode, 200);
  assert.equal(verifyResponse.json().data.valid, true);

  const storedPayment = repository.state.rentPayments.get('payment-1');
  assert.equal(storedPayment?.paymentStatus, 'paid');
  assert.equal(storedPayment?.agencyFeeAmount, 0);
  assert.equal(storedPayment?.ownerReceivableAmount, 200000);

  await app.close();
});

test('grace period owner billing still allows owner management writes', async () => {
  const { app } = await buildTestApp({
    ownerBillingAccounts: new Map([
      [
        'owner-1',
        {
          agencyId: 'agency-1',
          createdAt: '2026-01-01T10:00:00.000Z',
          currentPeriodEnd: '2026-04-20T10:00:00.000Z',
          currentPeriodStart: '2026-03-09T10:00:00.000Z',
          feeAmount: 10,
          feeCurrency: 'EUR',
          gracePeriodEndsAt: '2026-04-27T10:00:00.000Z',
          intervalDays: 42,
          nextPaymentDueAt: '2026-04-20T10:00:00.000Z',
          ownerId: 'owner-1',
          status: 'grace_period',
          updatedAt: '2026-04-20T10:00:00.000Z',
        },
      ],
    ]),
    owners: new Map([
      [
        'owner-1',
        {
          agencyId: 'agency-1',
          createdAt: '2026-04-20T10:00:00.000Z',
          displayName: 'Owner User',
          updatedAt: '2026-04-20T10:00:00.000Z',
          userId: 'owner-1',
        },
      ],
    ]),
    properties: new Map([
      [
        'property-1',
        {
          address: 'Tevragh-Zeina',
          createdAt: '2026-04-20T10:00:00.000Z',
          label: 'Résidence Alpha',
          ownerId: 'owner-1',
          updatedAt: '2026-04-20T10:00:00.000Z',
        },
      ],
    ]),
    units: new Map([
      [
        'unit-1',
        {
          activeInviteId: null,
          createdAt: '2026-04-20T10:00:00.000Z',
          currency: 'MRU',
          label: 'A1',
          ownerId: 'owner-1',
          propertyId: 'property-1',
          rentAmount: 200000,
          status: 'vacant',
          tenantId: null,
          updatedAt: '2026-04-20T10:00:00.000Z',
        },
      ],
    ]),
    users: new Map([
      [
        'owner-1',
        buildUser({
          agencyId: 'agency-1',
          email: 'owner@example.com',
          ownerId: 'owner-1',
          role: 'owner',
          uid: 'owner-1',
        }),
      ],
    ]),
  });

  const createPropertyResponse = await app.inject({
    headers: {
      authorization: 'Bearer owner-token',
    },
    method: 'POST',
    payload: {
      address: 'Ksar',
      label: 'Résidence Grace',
    },
    url: '/v1/owner/properties',
  });

  assert.equal(createPropertyResponse.statusCode, 201);

  const createUnitResponse = await app.inject({
    headers: {
      authorization: 'Bearer owner-token',
    },
    method: 'POST',
    payload: {
      currency: 'MRU',
      label: 'A2',
      propertyId: 'property-1',
      rentAmount: 150000,
    },
    url: '/v1/owner/units',
  });

  assert.equal(createUnitResponse.statusCode, 201);

  const inviteResponse = await app.inject({
    headers: {
      authorization: 'Bearer owner-token',
    },
    method: 'POST',
    payload: {
      inviteType: 'code' satisfies InviteType,
      unitId: 'unit-1',
    },
    url: '/v1/invites',
  });

  assert.equal(inviteResponse.statusCode, 201);

  await app.close();
});

test('agency admin can mark owner access fee paid and suspend or reactivate billing', async () => {
  const { app, repository } = await buildTestApp({
    owners: new Map([
      [
        'owner-1',
        {
          agencyId: 'agency-1',
          createdAt: '2026-04-20T10:00:00.000Z',
          displayName: 'Owner User',
          updatedAt: '2026-04-20T10:00:00.000Z',
          userId: 'owner-1',
        },
      ],
    ]),
    users: new Map([
      [
        'admin-1',
        buildUser({
          agencyId: 'agency-1',
          email: 'admin@example.com',
          role: 'agency_admin',
          uid: 'admin-1',
        }),
      ],
      [
        'owner-1',
        buildUser({
          agencyId: 'agency-1',
          email: 'owner@example.com',
          ownerId: 'owner-1',
          role: 'owner',
          uid: 'owner-1',
        }),
      ],
    ]),
  });

  const markPaidResponse = await app.inject({
    headers: {
      authorization: 'Bearer admin-token',
    },
    method: 'POST',
    payload: {
      note: 'Paiement manuel reçu.',
      provider: 'manual',
    },
    url: '/v1/agency/owners/owner-1/billing/mark-paid',
  });

  assert.equal(markPaidResponse.statusCode, 200);
  assert.equal(markPaidResponse.json().data.latestInvoice.status, 'paid');
  assert.equal(repository.state.ownerBillingPayments.size, 1);

  const suspendResponse = await app.inject({
    headers: {
      authorization: 'Bearer admin-token',
    },
    method: 'POST',
    payload: {
      reason: 'Contrôle agence.',
    },
    url: '/v1/agency/owners/owner-1/billing/suspend',
  });

  assert.equal(suspendResponse.statusCode, 200);
  assert.equal(suspendResponse.json().data.account.status, 'suspended');

  const reactivateResponse = await app.inject({
    headers: {
      authorization: 'Bearer admin-token',
    },
    method: 'POST',
    url: '/v1/agency/owners/owner-1/billing/reactivate',
  });

  assert.equal(reactivateResponse.statusCode, 200);
  assert.equal(reactivateResponse.json().data.account.status, 'active');
  assert.equal(repository.state.auditLogs.size, 3);
  assert.equal(repository.state.notifications.size, 3);

  await app.close();
});

test('late manual owner billing payment extends from now and reactivation preserves expired status', async () => {
  const expiredAccount: OwnerBillingAccount = {
    agencyId: 'agency-1',
    createdAt: '2026-01-01T10:00:00.000Z',
    currentPeriodEnd: '2026-03-01T10:00:00.000Z',
    currentPeriodStart: '2026-01-19T10:00:00.000Z',
    feeAmount: 10,
    feeCurrency: 'EUR',
    gracePeriodEndsAt: '2026-03-08T10:00:00.000Z',
    intervalDays: 42,
    nextPaymentDueAt: '2026-03-01T10:00:00.000Z',
    ownerId: 'owner-1',
    status: 'past_due',
    updatedAt: '2026-03-08T10:00:00.000Z',
  };
  const { app, repository } = await buildTestApp({
    ownerBillingAccounts: new Map([['owner-1', expiredAccount]]),
    owners: new Map([
      [
        'owner-1',
        {
          agencyId: 'agency-1',
          createdAt: '2026-04-20T10:00:00.000Z',
          displayName: 'Owner User',
          updatedAt: '2026-04-20T10:00:00.000Z',
          userId: 'owner-1',
        },
      ],
    ]),
    users: new Map([
      [
        'admin-1',
        buildUser({
          agencyId: 'agency-1',
          email: 'admin@example.com',
          role: 'agency_admin',
          uid: 'admin-1',
        }),
      ],
      [
        'owner-1',
        buildUser({
          agencyId: 'agency-1',
          email: 'owner@example.com',
          ownerId: 'owner-1',
          role: 'owner',
          uid: 'owner-1',
        }),
      ],
    ]),
  });

  const markPaidResponse = await app.inject({
    headers: {
      authorization: 'Bearer admin-token',
    },
    method: 'POST',
    payload: {
      note: 'Paiement reçu après échéance.',
      provider: 'manual',
    },
    url: '/v1/agency/owners/owner-1/billing/mark-paid',
  });

  assert.equal(markPaidResponse.statusCode, 200);
  assert.equal(markPaidResponse.json().data.activeUntil, '2026-06-03T10:00:00.000Z');
  assert.equal(repository.state.ownerBillingAccounts.get('owner-1')?.currentPeriodStart, '2026-04-22T10:00:00.000Z');
  assert.equal(repository.state.ownerBillingAccounts.get('owner-1')?.currentPeriodEnd, '2026-06-03T10:00:00.000Z');
  assert.equal(repository.state.ownerBillingPayments.size, 1);

  repository.state.ownerBillingAccounts.set('owner-1', {
    ...expiredAccount,
    status: 'suspended',
    updatedAt: '2026-04-22T10:00:00.000Z',
  });

  const reactivateResponse = await app.inject({
    headers: {
      authorization: 'Bearer admin-token',
    },
    method: 'POST',
    url: '/v1/agency/owners/owner-1/billing/reactivate',
  });

  assert.equal(reactivateResponse.statusCode, 200);
  assert.equal(reactivateResponse.json().data.account.status, 'past_due');
  assert.equal(reactivateResponse.json().data.activeUntil, '2026-03-01T10:00:00.000Z');

  await app.close();
});

test('legacy receipts still verify with safe fallback metadata', async () => {
  const { app } = await buildTestApp({
    receipts: new Map([
      [
        'receipt-legacy',
        {
          agencyFeeAmount: 21000,
          agencyId: 'agency-legacy',
          grossAmount: 175000,
          id: 'receipt-legacy',
          issuedAt: '2026-04-21T09:00:00.000Z',
          ownerDisplayName: 'Owner Legacy',
          ownerEmail: 'owner@example.com',
          ownerId: 'owner-1',
          ownerNetAmount: 154000,
          paidAt: '2026-04-21T09:00:00.000Z',
          paymentId: 'payment-legacy',
          paymentMethod: 'Bankily',
          propertyId: 'property-legacy',
          propertyLabel: 'Résidence Legacy',
          qrVerificationToken: 'legacy-token-12345678',
          receiptNumber: 'ATP-20260421-LEGACY',
          simulated: true,
          tenantDisplayName: 'Tenant Legacy',
          tenantEmail: 'tenant@example.com',
          tenantId: 'tenant-1',
          unitId: 'unit-legacy',
          unitLabel: 'B4',
          verificationUrl:
            'atoupay://receipt-verification?token=legacy-token-12345678',
        } as unknown as ReceiptDoc,
      ],
    ]),
  });

  const verifyResponse = await app.inject({
    method: 'GET',
    url: '/v1/receipts/verify/legacy-token-12345678',
  });

  assert.equal(verifyResponse.statusCode, 200);
  assert.equal(verifyResponse.json().data.valid, true);
  assert.equal(verifyResponse.json().data.receipt.agencyDisplayName, 'Agence ATouPay');
  assert.equal(verifyResponse.json().data.receipt.issuedBy, 'backend');
  assert.equal(verifyResponse.json().data.receipt.issuanceSource, 'simulate-complete');
  assert.equal(verifyResponse.json().data.receipt.paymentStatus, 'paid');

  await app.close();
});
