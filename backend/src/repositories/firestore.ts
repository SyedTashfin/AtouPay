import { Firestore, Transaction } from 'firebase-admin/firestore';

import type {
  AgencyAdminBootstrapDoc,
  AgencyDoc,
  AuditLogDoc,
  LegalTermsDoc,
  NotificationDoc,
  OwnerDoc,
  OwnerAccessInviteDoc,
  PropertyDoc,
  ReceiptDoc,
  RentPaymentDoc,
  SupportRequestDoc,
  TenantDoc,
  TenantInviteDoc,
  UnitDoc,
  UserTermsAcceptanceDoc,
  UserDoc,
} from '../domain/types.js';
import type {
  OwnerBillingAccount,
  OwnerBillingInvoice,
  OwnerBillingPayment,
} from '../billing/types.js';
import type {
  PaymentAttempt,
  PaymentIntent,
  PaymentReconciliationRecord,
  ProviderTransaction,
  ProviderWebhookEvent,
} from '../payments/types.js';
import type { DataRepository, TransactionContext } from './types.js';

type CollectionName =
  | 'agencyAdminBootstraps'
  | 'agencies'
  | 'auditLogs'
  | 'legalDocuments'
  | 'notifications'
  | 'ownerBillingAccounts'
  | 'ownerBillingInvoices'
  | 'ownerBillingPayments'
  | 'owners'
  | 'ownerAccessInvites'
  | 'paymentAttempts'
  | 'paymentIntents'
  | 'paymentReconciliationRecords'
  | 'paymentWebhookEvents'
  | 'properties'
  | 'providerTransactions'
  | 'receipts'
  | 'rentPayments'
  | 'supportRequests'
  | 'tenantInvites'
  | 'tenants'
  | 'units'
  | 'userTermsAcceptances'
  | 'users';

function getRef(db: Firestore, collection: CollectionName, id: string) {
  return db.collection(collection).doc(id);
}

async function readDoc<T>(transaction: Transaction, db: Firestore, collection: CollectionName, id: string) {
  const snapshot = await transaction.get(getRef(db, collection, id));

  if (!snapshot.exists) {
    return null;
  }

  return snapshot.data() as T;
}

function createTransactionContext(db: Firestore, transaction: Transaction): TransactionContext {
  return {
    getAgencyAdminBootstrap: (bootstrapId) =>
      readDoc<AgencyAdminBootstrapDoc>(transaction, db, 'agencyAdminBootstraps', bootstrapId),
    getAgency: (agencyId) => readDoc<AgencyDoc>(transaction, db, 'agencies', agencyId),
    getLegalTerms: (documentId) => readDoc<LegalTermsDoc>(transaction, db, 'legalDocuments', documentId),
    getNotification: (notificationId) =>
      readDoc<NotificationDoc>(transaction, db, 'notifications', notificationId),
    getOwner: (ownerId) => readDoc<OwnerDoc>(transaction, db, 'owners', ownerId),
    getOwnerAccessInvite: (inviteId) =>
      readDoc<OwnerAccessInviteDoc>(transaction, db, 'ownerAccessInvites', inviteId),
    getOwnerBillingAccount: (ownerId) =>
      readDoc<OwnerBillingAccount>(transaction, db, 'ownerBillingAccounts', ownerId),
    getOwnerBillingInvoice: (invoiceId) =>
      readDoc<OwnerBillingInvoice>(transaction, db, 'ownerBillingInvoices', invoiceId),
    getInvite: (inviteId) => readDoc<TenantInviteDoc>(transaction, db, 'tenantInvites', inviteId),
    getPayment: (paymentId) => readDoc<RentPaymentDoc>(transaction, db, 'rentPayments', paymentId),
    getPaymentAttempt: (attemptId) =>
      readDoc<PaymentAttempt>(transaction, db, 'paymentAttempts', attemptId),
    getPaymentIntent: (intentId) =>
      readDoc<PaymentIntent>(transaction, db, 'paymentIntents', intentId),
    getPaymentWebhookEvent: (eventId) =>
      readDoc<ProviderWebhookEvent>(transaction, db, 'paymentWebhookEvents', eventId),
    getProperty: (propertyId) => readDoc<PropertyDoc>(transaction, db, 'properties', propertyId),
    getProviderTransaction: (providerTransactionId) =>
      readDoc<ProviderTransaction>(transaction, db, 'providerTransactions', providerTransactionId),
    getReceipt: (receiptId) => readDoc<ReceiptDoc>(transaction, db, 'receipts', receiptId),
    getSupportRequest: (requestId) =>
      readDoc<SupportRequestDoc>(transaction, db, 'supportRequests', requestId),
    getTenant: (tenantId) => readDoc<TenantDoc>(transaction, db, 'tenants', tenantId),
    getUnit: (unitId) => readDoc<UnitDoc>(transaction, db, 'units', unitId),
    getUserTermsAcceptance: (uid) =>
      readDoc<UserTermsAcceptanceDoc>(transaction, db, 'userTermsAcceptances', uid),
    getUser: (uid) => readDoc<UserDoc>(transaction, db, 'users', uid),
    findPaymentIntentByProviderTransactionId: async (providerTransactionId) => {
      const snapshot = await transaction.get(
        db.collection('paymentIntents').where('providerTransactionId', '==', providerTransactionId).limit(1),
      );

      if (snapshot.empty) {
        return null;
      }

      const doc = snapshot.docs[0]!;
      return {
        doc: doc.data() as PaymentIntent,
        id: doc.id,
      };
    },
    findPaymentWebhookEventByIdempotencyKey: async (idempotencyKey) => {
      const snapshot = await transaction.get(
        db.collection('paymentWebhookEvents').where('idempotencyKey', '==', idempotencyKey).limit(1),
      );

      if (snapshot.empty) {
        return null;
      }

      const doc = snapshot.docs[0]!;
      return {
        doc: doc.data() as ProviderWebhookEvent,
        id: doc.id,
      };
    },
    listOwnerBillingInvoicesByOwner: async (ownerId) => {
      const snapshot = await transaction.get(
        db.collection('ownerBillingInvoices').where('ownerId', '==', ownerId),
      );

      return snapshot.docs.map((doc) => ({
        doc: doc.data() as OwnerBillingInvoice,
        id: doc.id,
      }));
    },
    listPaymentIntentsByPayment: async (paymentId) => {
      const snapshot = await transaction.get(
        db.collection('paymentIntents').where('paymentId', '==', paymentId),
      );

      return snapshot.docs.map((doc) => ({
        doc: doc.data() as PaymentIntent,
        id: doc.id,
      }));
    },
    listPaymentsByUnit: async (unitId) => {
      const snapshot = await transaction.get(
        db.collection('rentPayments').where('unitId', '==', unitId),
      );

      return snapshot.docs.map((doc) => ({
        doc: doc.data() as RentPaymentDoc,
        id: doc.id,
      }));
    },
    listUnitsByProperty: async (propertyId) => {
      const snapshot = await transaction.get(
        db.collection('units').where('propertyId', '==', propertyId),
      );

      return snapshot.docs.map((doc) => ({
        doc: doc.data() as UnitDoc,
        id: doc.id,
      }));
    },
    deleteProperty: (propertyId) => {
      transaction.delete(getRef(db, 'properties', propertyId));
    },
    deleteUnit: (unitId) => {
      transaction.delete(getRef(db, 'units', unitId));
    },
    deleteOwnerAccessInvite: (inviteId) => {
      transaction.delete(getRef(db, 'ownerAccessInvites', inviteId));
    },
    setAgency: (agencyId, agency) => {
      transaction.set(getRef(db, 'agencies', agencyId), agency);
    },
    setAgencyAdminBootstrap: (bootstrapId, bootstrap) => {
      transaction.set(getRef(db, 'agencyAdminBootstraps', bootstrapId), bootstrap);
    },
    setLegalTerms: (documentId, terms) => {
      transaction.set(getRef(db, 'legalDocuments', documentId), terms);
    },
    setOwnerBillingAccount: (ownerId, account) => {
      transaction.set(getRef(db, 'ownerBillingAccounts', ownerId), account);
    },
    setOwnerBillingInvoice: (invoiceId, invoice) => {
      transaction.set(getRef(db, 'ownerBillingInvoices', invoiceId), invoice);
    },
    setOwnerBillingPayment: (paymentId, payment) => {
      transaction.set(getRef(db, 'ownerBillingPayments', paymentId), payment);
    },
    setOwnerAccessInvite: (inviteId, invite) => {
      transaction.set(getRef(db, 'ownerAccessInvites', inviteId), invite);
    },
    setInvite: (inviteId, invite) => {
      transaction.set(getRef(db, 'tenantInvites', inviteId), invite);
    },
    setOwner: (ownerId, owner) => {
      transaction.set(getRef(db, 'owners', ownerId), owner);
    },
    setPaymentAttempt: (attemptId, attempt) => {
      transaction.set(getRef(db, 'paymentAttempts', attemptId), attempt);
    },
    setPaymentIntent: (intentId, intent) => {
      transaction.set(getRef(db, 'paymentIntents', intentId), intent);
    },
    setPaymentReconciliationRecord: (recordId, record) => {
      transaction.set(getRef(db, 'paymentReconciliationRecords', recordId), record);
    },
    setPaymentWebhookEvent: (eventId, event) => {
      transaction.set(getRef(db, 'paymentWebhookEvents', eventId), event);
    },
    setPayment: (paymentId, payment) => {
      transaction.set(getRef(db, 'rentPayments', paymentId), payment);
    },
    setProperty: (propertyId, property) => {
      transaction.set(getRef(db, 'properties', propertyId), property);
    },
    setProviderTransaction: (providerTransactionId, transactionDoc) => {
      transaction.set(getRef(db, 'providerTransactions', providerTransactionId), transactionDoc);
    },
    setReceipt: (receiptId, receipt) => {
      transaction.set(getRef(db, 'receipts', receiptId), receipt);
    },
    setSupportRequest: (requestId, request) => {
      transaction.set(getRef(db, 'supportRequests', requestId), request);
    },
    setTenant: (tenantId, tenant) => {
      transaction.set(getRef(db, 'tenants', tenantId), tenant);
    },
    setUnit: (unitId, unit) => {
      transaction.set(getRef(db, 'units', unitId), unit);
    },
    setUserTermsAcceptance: (uid, acceptance) => {
      transaction.set(getRef(db, 'userTermsAcceptances', uid), acceptance);
    },
    setUser: (uid, user) => {
      transaction.set(getRef(db, 'users', uid), user);
    },
    setAuditLog: (auditLogId, auditLog) => {
      transaction.set(getRef(db, 'auditLogs', auditLogId), auditLog);
    },
    setNotification: (notificationId, notification) => {
      transaction.set(getRef(db, 'notifications', notificationId), notification);
    },
    updateAgency: (agencyId, patch) => {
      transaction.update(getRef(db, 'agencies', agencyId), patch);
    },
    updateAgencyAdminBootstrap: (bootstrapId, patch) => {
      transaction.update(getRef(db, 'agencyAdminBootstraps', bootstrapId), patch);
    },
    updateOwnerAccessInvite: (inviteId, patch) => {
      transaction.update(getRef(db, 'ownerAccessInvites', inviteId), patch);
    },
    updateOwnerBillingAccount: (ownerId, patch) => {
      transaction.update(getRef(db, 'ownerBillingAccounts', ownerId), patch);
    },
    updateOwnerBillingInvoice: (invoiceId, patch) => {
      transaction.update(getRef(db, 'ownerBillingInvoices', invoiceId), patch);
    },
    updateInvite: (inviteId, patch) => {
      transaction.update(getRef(db, 'tenantInvites', inviteId), patch);
    },
    updatePaymentAttempt: (attemptId, patch) => {
      transaction.update(getRef(db, 'paymentAttempts', attemptId), patch);
    },
    updatePaymentIntent: (intentId, patch) => {
      transaction.update(getRef(db, 'paymentIntents', intentId), patch);
    },
    updatePaymentWebhookEvent: (eventId, patch) => {
      transaction.update(getRef(db, 'paymentWebhookEvents', eventId), patch);
    },
    updateNotification: (notificationId, patch) => {
      transaction.update(getRef(db, 'notifications', notificationId), patch);
    },
    updateOwner: (ownerId, patch) => {
      transaction.update(getRef(db, 'owners', ownerId), patch);
    },
    updatePayment: (paymentId, patch) => {
      transaction.update(getRef(db, 'rentPayments', paymentId), patch);
    },
    updateProviderTransaction: (providerTransactionId, patch) => {
      transaction.update(getRef(db, 'providerTransactions', providerTransactionId), patch);
    },
    updateProperty: (propertyId, patch) => {
      transaction.update(getRef(db, 'properties', propertyId), patch);
    },
    updateSupportRequest: (requestId, patch) => {
      transaction.update(getRef(db, 'supportRequests', requestId), patch);
    },
    updateUnit: (unitId, patch) => {
      transaction.update(getRef(db, 'units', unitId), patch);
    },
    updateUser: (uid, patch) => {
      transaction.update(getRef(db, 'users', uid), patch);
    },
  };
}

export function createFirestoreRepository(db: Firestore): DataRepository {
  return {
    async findAgencyAdminBootstrapByEmail(email) {
      const snapshot = await db
        .collection('agencyAdminBootstraps')
        .where('email', '==', email)
        .limit(1)
        .get();

      if (snapshot.empty) {
        return null;
      }

      const doc = snapshot.docs[0]!;
      return {
        doc: doc.data() as AgencyAdminBootstrapDoc,
        id: doc.id,
      };
    },
    async findReceiptByVerificationToken(token) {
      const snapshot = await db
        .collection('receipts')
        .where('qrVerificationToken', '==', token)
        .limit(1)
        .get();

      if (snapshot.empty) {
        return null;
      }

      const doc = snapshot.docs[0]!;
      return {
        doc: doc.data() as ReceiptDoc,
        id: doc.id,
      };
    },
    async findUserByEmail(email) {
      const snapshot = await db
        .collection('users')
        .where('email', '==', email)
        .limit(1)
        .get();

      if (snapshot.empty) {
        return null;
      }

      return snapshot.docs[0]!.data() as UserDoc;
    },
    async getAgency(agencyId) {
      const snapshot = await getRef(db, 'agencies', agencyId).get();

      if (!snapshot.exists) {
        return null;
      }

      return snapshot.data() as AgencyDoc;
    },
    async getLegalTerms(documentId) {
      const snapshot = await getRef(db, 'legalDocuments', documentId).get();

      if (!snapshot.exists) {
        return null;
      }

      return snapshot.data() as LegalTermsDoc;
    },
    async getNotification(notificationId) {
      const snapshot = await getRef(db, 'notifications', notificationId).get();

      if (!snapshot.exists) {
        return null;
      }

      return snapshot.data() as NotificationDoc;
    },
    async getOwner(ownerId) {
      const snapshot = await getRef(db, 'owners', ownerId).get();

      if (!snapshot.exists) {
        return null;
      }

      return snapshot.data() as OwnerDoc;
    },
    async getOwnerBillingAccount(ownerId) {
      const snapshot = await getRef(db, 'ownerBillingAccounts', ownerId).get();

      if (!snapshot.exists) {
        return null;
      }

      return snapshot.data() as OwnerBillingAccount;
    },
    async getPayment(paymentId) {
      const snapshot = await getRef(db, 'rentPayments', paymentId).get();

      if (!snapshot.exists) {
        return null;
      }

      return snapshot.data() as RentPaymentDoc;
    },
    async getPaymentIntent(intentId) {
      const snapshot = await getRef(db, 'paymentIntents', intentId).get();

      if (!snapshot.exists) {
        return null;
      }

      return snapshot.data() as PaymentIntent;
    },
    async getPaymentWebhookEvent(eventId) {
      const snapshot = await getRef(db, 'paymentWebhookEvents', eventId).get();

      if (!snapshot.exists) {
        return null;
      }

      return snapshot.data() as ProviderWebhookEvent;
    },
    async getProperty(propertyId) {
      const snapshot = await getRef(db, 'properties', propertyId).get();

      if (!snapshot.exists) {
        return null;
      }

      return snapshot.data() as PropertyDoc;
    },
    async getProviderTransaction(providerTransactionId) {
      const snapshot = await getRef(db, 'providerTransactions', providerTransactionId).get();

      if (!snapshot.exists) {
        return null;
      }

      return snapshot.data() as ProviderTransaction;
    },
    async getReceipt(receiptId) {
      const snapshot = await getRef(db, 'receipts', receiptId).get();

      if (!snapshot.exists) {
        return null;
      }

      return snapshot.data() as ReceiptDoc;
    },
    async getSupportRequest(requestId) {
      const snapshot = await getRef(db, 'supportRequests', requestId).get();

      if (!snapshot.exists) {
        return null;
      }

      return snapshot.data() as SupportRequestDoc;
    },
    async getTenant(tenantId) {
      const snapshot = await getRef(db, 'tenants', tenantId).get();

      if (!snapshot.exists) {
        return null;
      }

      return snapshot.data() as TenantDoc;
    },
    async getUnit(unitId) {
      const snapshot = await getRef(db, 'units', unitId).get();

      if (!snapshot.exists) {
        return null;
      }

      return snapshot.data() as UnitDoc;
    },
    async getUserTermsAcceptance(uid) {
      const snapshot = await getRef(db, 'userTermsAcceptances', uid).get();

      if (!snapshot.exists) {
        return null;
      }

      return snapshot.data() as UserTermsAcceptanceDoc;
    },
    async getUser(uid) {
      const snapshot = await getRef(db, 'users', uid).get();

      if (!snapshot.exists) {
        return null;
      }

      return snapshot.data() as UserDoc;
    },
    async listOwnerAccessInvitesByAgency(agencyId) {
      const snapshot = await db
        .collection('ownerAccessInvites')
        .where('agencyId', '==', agencyId)
        .get();

      return snapshot.docs.map((doc) => ({
        doc: doc.data() as OwnerAccessInviteDoc,
        id: doc.id,
      }));
    },
    async listAuditLogsByAgency(agencyId) {
      const snapshot = await db
        .collection('auditLogs')
        .where('agencyId', '==', agencyId)
        .get();

      return snapshot.docs.map((doc) => ({
        doc: doc.data() as AuditLogDoc,
        id: doc.id,
      }));
    },
    async listNotificationsByAgency(agencyId) {
      const snapshot = await db
        .collection('notifications')
        .where('agencyId', '==', agencyId)
        .get();

      return snapshot.docs.map((doc) => ({
        doc: doc.data() as NotificationDoc,
        id: doc.id,
      }));
    },
    async listNotificationsByUser(userId) {
      const snapshot = await db
        .collection('notifications')
        .where('userId', '==', userId)
        .get();

      return snapshot.docs.map((doc) => ({
        doc: doc.data() as NotificationDoc,
        id: doc.id,
      }));
    },
    async listOwnerBillingAccountsByAgency(agencyId) {
      const snapshot = await db
        .collection('ownerBillingAccounts')
        .where('agencyId', '==', agencyId)
        .get();

      return snapshot.docs.map((doc) => ({
        doc: doc.data() as OwnerBillingAccount,
        id: doc.id,
      }));
    },
    async listOwnerBillingInvoicesByOwner(ownerId) {
      const snapshot = await db
        .collection('ownerBillingInvoices')
        .where('ownerId', '==', ownerId)
        .get();

      return snapshot.docs.map((doc) => ({
        doc: doc.data() as OwnerBillingInvoice,
        id: doc.id,
      }));
    },
    async findPaymentIntentByProviderTransactionId(providerTransactionId) {
      const snapshot = await db
        .collection('paymentIntents')
        .where('providerTransactionId', '==', providerTransactionId)
        .limit(1)
        .get();

      if (snapshot.empty) {
        return null;
      }

      const doc = snapshot.docs[0]!;
      return {
        doc: doc.data() as PaymentIntent,
        id: doc.id,
      };
    },
    async findPaymentWebhookEventByIdempotencyKey(idempotencyKey) {
      const snapshot = await db
        .collection('paymentWebhookEvents')
        .where('idempotencyKey', '==', idempotencyKey)
        .limit(1)
        .get();

      if (snapshot.empty) {
        return null;
      }

      const doc = snapshot.docs[0]!;
      return {
        doc: doc.data() as ProviderWebhookEvent,
        id: doc.id,
      };
    },
    async listPaymentIntentsByPayment(paymentId) {
      const snapshot = await db
        .collection('paymentIntents')
        .where('paymentId', '==', paymentId)
        .get();

      return snapshot.docs.map((doc) => ({
        doc: doc.data() as PaymentIntent,
        id: doc.id,
      }));
    },
    async listPaymentsByAgency(agencyId) {
      const snapshot = await db
        .collection('rentPayments')
        .where('agencyId', '==', agencyId)
        .get();

      return snapshot.docs.map((doc) => ({
        doc: doc.data() as RentPaymentDoc,
        id: doc.id,
      }));
    },
    async listPaymentsByOwner(ownerId) {
      const snapshot = await db
        .collection('rentPayments')
        .where('ownerId', '==', ownerId)
        .get();

      return snapshot.docs.map((doc) => ({
        doc: doc.data() as RentPaymentDoc,
        id: doc.id,
      }));
    },
    async listPropertiesByOwner(ownerId) {
      const snapshot = await db
        .collection('properties')
        .where('ownerId', '==', ownerId)
        .get();

      return snapshot.docs.map((doc) => ({
        doc: doc.data() as PropertyDoc,
        id: doc.id,
      }));
    },
    async listSupportRequestsByAgency(agencyId) {
      const snapshot = await db
        .collection('supportRequests')
        .where('agencyId', '==', agencyId)
        .get();

      return snapshot.docs.map((doc) => ({
        doc: doc.data() as SupportRequestDoc,
        id: doc.id,
      }));
    },
    async listSupportRequests() {
      const snapshot = await db.collection('supportRequests').get();

      return snapshot.docs.map((doc) => ({
        doc: doc.data() as SupportRequestDoc,
        id: doc.id,
      }));
    },
    async listSupportRequestsByUser(userId) {
      const snapshot = await db
        .collection('supportRequests')
        .where('userId', '==', userId)
        .get();

      return snapshot.docs.map((doc) => ({
        doc: doc.data() as SupportRequestDoc,
        id: doc.id,
      }));
    },
    async listTenantsByOwner(ownerId) {
      const snapshot = await db
        .collection('tenants')
        .where('ownerId', '==', ownerId)
        .get();

      return snapshot.docs.map((doc) => ({
        doc: doc.data() as TenantDoc,
        id: doc.id,
      }));
    },
    async listUnitsByOwner(ownerId) {
      const snapshot = await db
        .collection('units')
        .where('ownerId', '==', ownerId)
        .get();

      return snapshot.docs.map((doc) => ({
        doc: doc.data() as UnitDoc,
        id: doc.id,
      }));
    },
    async listUsersByAgency(agencyId, role) {
      let query = db.collection('users').where('agencyId', '==', agencyId);

      if (role) {
        query = query.where('role', '==', role);
      }

      const snapshot = await query.get();

      return snapshot.docs.map((doc) => doc.data() as UserDoc);
    },
    async setLegalTerms(documentId, terms) {
      await getRef(db, 'legalDocuments', documentId).set(terms);
    },
    async runTransaction(handler) {
      return db.runTransaction(async (transaction) => handler(createTransactionContext(db, transaction)));
    },
  };
}
