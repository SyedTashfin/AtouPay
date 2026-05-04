import {
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

export interface TransactionContext {
  getAgencyAdminBootstrap(bootstrapId: string): Promise<AgencyAdminBootstrapDoc | null>;
  getAgency(agencyId: string): Promise<AgencyDoc | null>;
  getLegalTerms(documentId: string): Promise<LegalTermsDoc | null>;
  getNotification(notificationId: string): Promise<NotificationDoc | null>;
  getOwner(ownerId: string): Promise<OwnerDoc | null>;
  getOwnerAccessInvite(inviteId: string): Promise<OwnerAccessInviteDoc | null>;
  getOwnerBillingAccount(ownerId: string): Promise<OwnerBillingAccount | null>;
  getOwnerBillingInvoice(invoiceId: string): Promise<OwnerBillingInvoice | null>;
  getPayment(paymentId: string): Promise<RentPaymentDoc | null>;
  getProperty(propertyId: string): Promise<PropertyDoc | null>;
  getReceipt(receiptId: string): Promise<ReceiptDoc | null>;
  getSupportRequest(requestId: string): Promise<SupportRequestDoc | null>;
  getTenant(tenantId: string): Promise<TenantDoc | null>;
  getInvite(inviteId: string): Promise<TenantInviteDoc | null>;
  getUnit(unitId: string): Promise<UnitDoc | null>;
  getUserTermsAcceptance(uid: string): Promise<UserTermsAcceptanceDoc | null>;
  getUser(uid: string): Promise<UserDoc | null>;
  listOwnerBillingInvoicesByOwner(ownerId: string): Promise<Array<{ doc: OwnerBillingInvoice; id: string }>>;
  listPaymentsByUnit(unitId: string): Promise<Array<{ doc: RentPaymentDoc; id: string }>>;
  listUnitsByProperty(propertyId: string): Promise<Array<{ doc: UnitDoc; id: string }>>;
  setAgency(agencyId: string, agency: AgencyDoc): void;
  setAgencyAdminBootstrap(bootstrapId: string, bootstrap: AgencyAdminBootstrapDoc): void;
  setLegalTerms(documentId: string, terms: LegalTermsDoc): void;
  setOwnerBillingAccount(ownerId: string, account: OwnerBillingAccount): void;
  setOwnerBillingInvoice(invoiceId: string, invoice: OwnerBillingInvoice): void;
  setOwnerBillingPayment(paymentId: string, payment: OwnerBillingPayment): void;
  setOwnerAccessInvite(inviteId: string, invite: OwnerAccessInviteDoc): void;
  setInvite(inviteId: string, invite: TenantInviteDoc): void;
  setOwner(ownerId: string, owner: OwnerDoc): void;
  setPayment(paymentId: string, payment: RentPaymentDoc): void;
  setProperty(propertyId: string, property: PropertyDoc): void;
  setReceipt(receiptId: string, receipt: ReceiptDoc): void;
  setSupportRequest(requestId: string, request: SupportRequestDoc): void;
  setTenant(tenantId: string, tenant: TenantDoc): void;
  setUnit(unitId: string, unit: UnitDoc): void;
  setUserTermsAcceptance(uid: string, acceptance: UserTermsAcceptanceDoc): void;
  setUser(uid: string, user: UserDoc): void;
  deleteOwnerAccessInvite(inviteId: string): void;
  deleteProperty(propertyId: string): void;
  deleteUnit(unitId: string): void;
  updateAgency(agencyId: string, patch: Partial<AgencyDoc>): void;
  updateAgencyAdminBootstrap(bootstrapId: string, patch: Partial<AgencyAdminBootstrapDoc>): void;
  updateOwnerAccessInvite(inviteId: string, patch: Partial<OwnerAccessInviteDoc>): void;
  updateOwnerBillingAccount(ownerId: string, patch: Partial<OwnerBillingAccount>): void;
  updateOwnerBillingInvoice(invoiceId: string, patch: Partial<OwnerBillingInvoice>): void;
  updateInvite(inviteId: string, patch: Partial<TenantInviteDoc>): void;
  setAuditLog(auditLogId: string, auditLog: AuditLogDoc): void;
  setNotification(notificationId: string, notification: NotificationDoc): void;
  updateNotification(notificationId: string, patch: Partial<NotificationDoc>): void;
  updatePayment(paymentId: string, patch: Partial<RentPaymentDoc>): void;
  updateProperty(propertyId: string, patch: Partial<PropertyDoc>): void;
  updateSupportRequest(requestId: string, patch: Partial<SupportRequestDoc>): void;
  updateUnit(unitId: string, patch: Partial<UnitDoc>): void;
  updateUser(uid: string, patch: Partial<UserDoc>): void;
}

export interface DataRepository {
  findAgencyAdminBootstrapByEmail(email: string): Promise<{ doc: AgencyAdminBootstrapDoc; id: string } | null>;
  findReceiptByVerificationToken(token: string): Promise<{ doc: ReceiptDoc; id: string } | null>;
  findUserByEmail(email: string): Promise<UserDoc | null>;
  getAgency(agencyId: string): Promise<AgencyDoc | null>;
  getLegalTerms(documentId: string): Promise<LegalTermsDoc | null>;
  getNotification(notificationId: string): Promise<NotificationDoc | null>;
  getOwner(ownerId: string): Promise<OwnerDoc | null>;
  getOwnerBillingAccount(ownerId: string): Promise<OwnerBillingAccount | null>;
  getPayment(paymentId: string): Promise<RentPaymentDoc | null>;
  getProperty(propertyId: string): Promise<PropertyDoc | null>;
  getReceipt(receiptId: string): Promise<ReceiptDoc | null>;
  getSupportRequest(requestId: string): Promise<SupportRequestDoc | null>;
  getTenant(tenantId: string): Promise<TenantDoc | null>;
  getUnit(unitId: string): Promise<UnitDoc | null>;
  getUserTermsAcceptance(uid: string): Promise<UserTermsAcceptanceDoc | null>;
  getUser(uid: string): Promise<UserDoc | null>;
  listOwnerAccessInvitesByAgency(agencyId: string): Promise<Array<{ doc: OwnerAccessInviteDoc; id: string }>>;
  listAuditLogsByAgency(agencyId: string): Promise<Array<{ doc: AuditLogDoc; id: string }>>;
  listNotificationsByAgency(agencyId: string): Promise<Array<{ doc: NotificationDoc; id: string }>>;
  listNotificationsByUser(userId: string): Promise<Array<{ doc: NotificationDoc; id: string }>>;
  listOwnerBillingAccountsByAgency(agencyId: string): Promise<Array<{ doc: OwnerBillingAccount; id: string }>>;
  listOwnerBillingInvoicesByOwner(ownerId: string): Promise<Array<{ doc: OwnerBillingInvoice; id: string }>>;
  listPaymentsByAgency(agencyId: string): Promise<Array<{ doc: RentPaymentDoc; id: string }>>;
  listPaymentsByOwner(ownerId: string): Promise<Array<{ doc: RentPaymentDoc; id: string }>>;
  listPropertiesByOwner(ownerId: string): Promise<Array<{ doc: PropertyDoc; id: string }>>;
  listSupportRequestsByAgency(agencyId: string): Promise<Array<{ doc: SupportRequestDoc; id: string }>>;
  listSupportRequestsByUser(userId: string): Promise<Array<{ doc: SupportRequestDoc; id: string }>>;
  listTenantsByOwner(ownerId: string): Promise<Array<{ doc: TenantDoc; id: string }>>;
  listUnitsByOwner(ownerId: string): Promise<Array<{ doc: UnitDoc; id: string }>>;
  listUsersByAgency(agencyId: string, role?: UserDoc['role']): Promise<UserDoc[]>;
  setLegalTerms(documentId: string, terms: LegalTermsDoc): Promise<void>;
  runTransaction<T>(handler: (transaction: TransactionContext) => Promise<T>): Promise<T>;
}
