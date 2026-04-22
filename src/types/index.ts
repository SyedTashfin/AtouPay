export type Role = 'tenant' | 'owner';

export type PaymentStatus = 'paid' | 'pending' | 'late';

export type PaymentStatusFilter = 'all' | PaymentStatus;

export type OccupancyStatus = 'occupied' | 'vacant';

export type PaymentProvider = 'Bankily' | 'Sedad' | 'Masrvi' | 'Carte bancaire';

export type DismissedHintKey = 'payment-demo';

export type BannerTone = 'info' | 'success' | 'error';

export interface SessionState {
  role: Role;
  token: string;
}

export interface PaymentFilterState {
  propertyId: string;
  status: PaymentStatusFilter;
}

export interface PersistedPaymentFilters {
  tenantStatus: PaymentStatusFilter;
  ownerStatus: PaymentStatusFilter;
  ownerPropertyId: string;
}

export type DismissedHintsState = Partial<Record<DismissedHintKey, true>>;

export interface PaymentAttemptResult {
  message: string;
  ok: boolean;
  title: string;
}

export interface TenantUser {
  id: string;
  role: 'tenant';
  fullName: string;
  initials: string;
  phone: string;
  email: string;
  propertyId: string;
}

export interface OwnerUser {
  id: string;
  role: 'owner';
  fullName: string;
  initials: string;
  phone: string;
  email: string;
  propertyIds: string[];
}

export interface TenantContact {
  id: string;
  fullName: string;
  initials: string;
  phone: string;
  email: string;
}

export interface Property {
  id: string;
  name: string;
  address: string;
  monthlyRent: number;
  occupancyStatus: OccupancyStatus;
  tenantIds: string[];
  ownerId: string;
  unitLabel?: string;
}

export interface PaymentRecord {
  id: string;
  monthKey: string;
  propertyId: string;
  tenantId: string;
  ownerId: string;
  amount: number;
  dueDate: string;
  status: PaymentStatus;
  referenceId: string;
  provider?: PaymentProvider;
  paidAt?: string;
}

export interface OwnerActionItem {
  id: string;
  title: string;
  description: string;
  amount: number;
}

export interface OwnerDashboardSummary {
  collectedThisMonth: number;
  expectedThisMonth: number;
  progressPercentage: number;
  propertiesCount: number;
  tenantsCount: number;
  pendingCount: number;
  lateCount: number;
  occupiedCount: number;
  monthlyPotentialIncome: number;
  vacantImpact: number;
  actionItems: OwnerActionItem[];
}

export interface ToastState {
  id: number;
  message: string;
  title: string;
  tone: BannerTone;
}
