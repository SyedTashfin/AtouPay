import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useState } from 'react';

import { ToastMessage } from '@/src/components/ToastMessage';
import {
  currentMonthKey,
  ownerUser,
  paymentMethods,
  payments as initialPayments,
  properties,
  tenantContacts,
  tenantUser,
} from '@/src/data/mockData';
import {
  removeStoredItems,
  readStoredJson,
  storageKeys,
  writeStoredJson,
} from '@/src/storage/persistence';
import {
  DismissedHintKey,
  DismissedHintsState,
  OwnerDashboardSummary,
  PaymentAttemptResult,
  PaymentFilterState,
  PaymentProvider,
  PaymentRecord,
  PaymentStatusFilter,
  PersistedPaymentFilters,
  Property,
  TenantContact,
  ToastState,
} from '@/src/types';
import { formatCurrency } from '@/src/utils/currency';
import { simulatePaymentProcessing } from '@/src/utils/payments';

interface AppContextValue {
  currentMonthKey: string;
  currentTenantPayment?: PaymentRecord;
  dismissHint: (hint: DismissedHintKey) => void;
  getPropertyById: (id: string) => Property | undefined;
  getTenantById: (id: string) => TenantContact | undefined;
  isHintDismissed: (hint: DismissedHintKey) => boolean;
  isHydrated: boolean;
  ownerDashboardSummary: OwnerDashboardSummary;
  ownerPayments: PaymentRecord[];
  ownerPaymentsFilter: PaymentFilterState;
  ownerUser: typeof ownerUser;
  paymentMethods: PaymentProvider[];
  payments: PaymentRecord[];
  payRent: (paymentId: string, provider: PaymentProvider) => Promise<PaymentAttemptResult>;
  properties: Property[];
  resetPaymentFilters: () => Promise<void>;
  resetPersistedAppData: () => Promise<void>;
  restoreMockPayments: () => Promise<void>;
  setOwnerPaymentsFilter: (value: {
    propertyId?: string;
    status?: PaymentStatusFilter;
  }) => void;
  setTenantPaymentsFilter: (value: PaymentStatusFilter) => void;
  tenantContacts: TenantContact[];
  tenantPayments: PaymentRecord[];
  tenantPaymentsFilter: PaymentStatusFilter;
  tenantUser: typeof tenantUser;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

const defaultPaymentFilters: PersistedPaymentFilters = {
  ownerPropertyId: 'all',
  ownerStatus: 'all',
  tenantStatus: 'all',
};

function sortPayments(a: PaymentRecord, b: PaymentRecord) {
  return new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime();
}

function normalizePaymentFilters(
  value: PersistedPaymentFilters | null,
): PersistedPaymentFilters {
  if (!value) {
    return defaultPaymentFilters;
  }

  const normalizeStatus = (status: string): PaymentStatusFilter =>
    status === 'paid' || status === 'pending' || status === 'late' ? status : 'all';

  return {
    ownerPropertyId:
      typeof value.ownerPropertyId === 'string' ? value.ownerPropertyId : 'all',
    ownerStatus: normalizeStatus(value.ownerStatus),
    tenantStatus: normalizeStatus(value.tenantStatus),
  };
}

function normalizePayments(value: PaymentRecord[] | null) {
  return Array.isArray(value) && value.length > 0 ? value : initialPayments;
}

function normalizeDismissedHints(value: DismissedHintsState | null) {
  return value && typeof value === 'object' ? value : {};
}

export function AppProvider({ children }: PropsWithChildren) {
  const [payments, setPayments] = useState<PaymentRecord[]>(initialPayments);
  const [paymentFilters, setPaymentFilters] =
    useState<PersistedPaymentFilters>(defaultPaymentFilters);
  const [dismissedHints, setDismissedHints] = useState<DismissedHintsState>({});
  const [toast, setToast] = useState<ToastState | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function hydrateAppState() {
      const [storedPayments, storedFilters, storedHints] = await Promise.all([
        readStoredJson<PaymentRecord[] | null>(storageKeys.payments, null),
        readStoredJson<PersistedPaymentFilters | null>(storageKeys.paymentFilters, null),
        readStoredJson<DismissedHintsState | null>(storageKeys.dismissedHints, null),
      ]);

      if (!isMounted) {
        return;
      }

      setPayments(normalizePayments(storedPayments));
      setPaymentFilters(normalizePaymentFilters(storedFilters));
      setDismissedHints(normalizeDismissedHints(storedHints));
      setIsHydrated(true);
    }

    hydrateAppState();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    Promise.all([
      writeStoredJson(storageKeys.payments, payments),
      writeStoredJson(storageKeys.paymentFilters, paymentFilters),
      writeStoredJson(storageKeys.dismissedHints, dismissedHints),
    ]).catch(() => {
      // Ignore non-sensitive persistence failures in demo mode.
    });
  }, [dismissedHints, isHydrated, paymentFilters, payments]);

  const clearToast = useCallback(() => {
    setToast(null);
  }, []);

  const pushToast = useCallback((tone: ToastState['tone'], title: string, message: string) => {
    setToast({
      id: Date.now(),
      message,
      title,
      tone,
    });
  }, []);

  const getPropertyById = (id: string) => properties.find((property) => property.id === id);

  const getTenantById = (id: string) => tenantContacts.find((tenant) => tenant.id === id);

  const dismissHint = (hint: DismissedHintKey) => {
    setDismissedHints((currentHints) => ({
      ...currentHints,
      [hint]: true,
    }));
  };

  const isHintDismissed = (hint: DismissedHintKey) => !!dismissedHints[hint];

  const setTenantPaymentsFilter = (value: PaymentStatusFilter) => {
    setPaymentFilters((currentFilters) => ({
      ...currentFilters,
      tenantStatus: value,
    }));
  };

  const setOwnerPaymentsFilter = ({
    propertyId,
    status,
  }: {
    propertyId?: string;
    status?: PaymentStatusFilter;
  }) => {
    setPaymentFilters((currentFilters) => ({
      ...currentFilters,
      ownerPropertyId: propertyId ?? currentFilters.ownerPropertyId,
      ownerStatus: status ?? currentFilters.ownerStatus,
    }));
  };

  const resetPaymentFilters = async () => {
    setPaymentFilters(defaultPaymentFilters);
    await removeStoredItems([storageKeys.paymentFilters]);
    pushToast('info', 'Filtres réinitialisés', 'Les filtres de paiement ont été remis à zéro.');
  };

  const restoreMockPayments = async () => {
    setPayments(initialPayments);
    await removeStoredItems([storageKeys.payments]);
    pushToast(
      'info',
      'Paiements restaurés',
      'L’historique mock a été remis à son état initial pour la validation.',
    );
  };

  const resetPersistedAppData = async () => {
    setPayments(initialPayments);
    setPaymentFilters(defaultPaymentFilters);
    setDismissedHints({});
    await removeStoredItems([
      storageKeys.dismissedHints,
      storageKeys.paymentFilters,
      storageKeys.payments,
    ]);
    pushToast(
      'info',
      'Données locales effacées',
      'Les filtres, astuces masquées et paiements persistés ont été réinitialisés.',
    );
  };

  const tenantPayments = payments
    .filter((payment) => payment.tenantId === tenantUser.id)
    .sort(sortPayments);

  const ownerPayments = payments
    .filter((payment) => payment.ownerId === ownerUser.id)
    .sort(sortPayments);

  const currentTenantPayment =
    tenantPayments.find((payment) => payment.monthKey === currentMonthKey) ??
    tenantPayments.find((payment) => payment.status !== 'paid') ??
    tenantPayments[0];

  const currentMonthPayments = ownerPayments.filter(
    (payment) => payment.monthKey === currentMonthKey,
  );

  const collectedThisMonth = currentMonthPayments
    .filter((payment) => payment.status === 'paid')
    .reduce((total, payment) => total + payment.amount, 0);

  const expectedThisMonth = currentMonthPayments.reduce(
    (total, payment) => total + payment.amount,
    0,
  );

  const pendingAmount = currentMonthPayments
    .filter((payment) => payment.status === 'pending')
    .reduce((total, payment) => total + payment.amount, 0);

  const lateAmount = currentMonthPayments
    .filter((payment) => payment.status === 'late')
    .reduce((total, payment) => total + payment.amount, 0);

  const vacantImpact = properties
    .filter((property) => property.occupancyStatus === 'vacant')
    .reduce((total, property) => total + property.monthlyRent, 0);

  const ownerDashboardSummary: OwnerDashboardSummary = {
    collectedThisMonth,
    expectedThisMonth,
    progressPercentage:
      expectedThisMonth > 0 ? Math.round((collectedThisMonth / expectedThisMonth) * 100) : 0,
    propertiesCount: properties.length,
    tenantsCount: tenantContacts.length,
    pendingCount: currentMonthPayments.filter((payment) => payment.status === 'pending').length,
    lateCount: currentMonthPayments.filter((payment) => payment.status === 'late').length,
    occupiedCount: properties.filter((property) => property.occupancyStatus === 'occupied').length,
    monthlyPotentialIncome: properties.reduce(
      (total, property) => total + property.monthlyRent,
      0,
    ),
    vacantImpact,
    actionItems: [
      {
        id: 'late-rent',
        title: 'Loyer en retard',
        description: `${currentMonthPayments.filter((payment) => payment.status === 'late').length} dossier à relancer`,
        amount: lateAmount,
      },
      {
        id: 'pending-confirmation',
        title: 'Paiements en attente',
        description: 'Transactions à confirmer ou encaisser',
        amount: pendingAmount,
      },
      {
        id: 'vacant-impact',
        title: 'Impact des logements vacants',
        description: 'Revenu potentiel non encaissé ce mois-ci',
        amount: vacantImpact,
      },
    ],
  };

  const payRent = async (
    paymentId: string,
    provider: PaymentProvider,
  ): Promise<PaymentAttemptResult> => {
    const targetPayment = payments.find((payment) => payment.id === paymentId);

    if (!targetPayment) {
      const result = {
        message: "Le paiement demandé n'a pas été retrouvé.",
        ok: false,
        title: 'Paiement indisponible',
      };

      pushToast('error', result.title, result.message);

      return result;
    }

    if (targetPayment.status === 'paid') {
      const result = {
        message: 'Ce loyer a déjà été enregistré comme payé.',
        ok: false,
        title: 'Paiement déjà traité',
      };

      pushToast('info', result.title, result.message);

      return result;
    }

    const simulationResult = await simulatePaymentProcessing(provider);

    if (!simulationResult.ok) {
      pushToast('error', simulationResult.title, simulationResult.message);

      return simulationResult;
    }

    setPayments((currentPayments) =>
      currentPayments.map((payment) =>
        payment.id === paymentId
          ? {
              ...payment,
              paidAt: new Date().toISOString().slice(0, 10),
              provider,
              referenceId: `ATP-${Date.now().toString().slice(-8)}`,
              status: 'paid',
            }
          : payment,
      ),
    );

    const successMessage = `${formatCurrency(targetPayment.amount)} enregistrés via ${provider}.`;

    pushToast('success', simulationResult.title, successMessage);

    return {
      message: successMessage,
      ok: true,
      title: simulationResult.title,
    };
  };

  return (
    <AppContext.Provider
      value={{
        currentMonthKey,
        currentTenantPayment,
        dismissHint,
        getPropertyById,
        getTenantById,
        isHintDismissed,
        isHydrated,
        ownerDashboardSummary,
        ownerPayments,
        ownerPaymentsFilter: {
          propertyId: paymentFilters.ownerPropertyId,
          status: paymentFilters.ownerStatus,
        },
        ownerUser,
        paymentMethods,
        payments,
        payRent,
        properties,
        resetPaymentFilters,
        resetPersistedAppData,
        restoreMockPayments,
        setOwnerPaymentsFilter,
        setTenantPaymentsFilter,
        tenantContacts,
        tenantPayments,
        tenantPaymentsFilter: paymentFilters.tenantStatus,
        tenantUser,
      }}>
      {children}
      <ToastMessage onHide={clearToast} toast={toast} />
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);

  if (!context) {
    throw new Error('useAppContext must be used inside AppProvider');
  }

  return context;
}
