import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { ToastMessage } from '@/src/components/ToastMessage';
import { auth, db, isFirebaseConfigured } from '@/src/lib/firebase';
import {
  currentMonthKey as seededCurrentMonthKey,
  ownerUser as seededOwnerUser,
  paymentMethods,
  payments as initialPayments,
  properties as seededProperties,
  tenantContacts as seededTenantContacts,
  tenantUser as seededTenantUser,
} from '@/src/data/mockData';
import { useSession } from '@/src/context/SessionProvider';
import { clearPendingInviteCode as clearPendingInviteStorage, getPendingInviteCode, storePendingInviteCode } from '@/src/services/pendingInvite';
import {
  mapOwnerRecordToUser,
  mapRentPaymentToUiPayment,
  mapTenantRecordToContact,
  mapUnitToUiProperty,
  normalizeOwnerRecord,
  normalizePropertyRecord,
  normalizeRentPaymentRecord,
  normalizeTenantRecord,
  normalizeUnitRecord,
  submitSimulatedRentPayment,
} from '@/src/services/rentalData';
import {
  removeStoredItems,
  readStoredJson,
  storageKeys,
  writeStoredJson,
} from '@/src/storage/persistence';
import {
  DiagnosticEvent,
  DismissedHintKey,
  DismissedHintsState,
  MutationResult,
  OwnerDashboardSummary,
  OwnerRecord,
  OwnerUser,
  PaymentAttemptResult,
  PaymentFilterState,
  PaymentProvider,
  PaymentRecord,
  PaymentStatusFilter,
  PersistedPaymentFilters,
  Property,
  PropertyRecord,
  RentPaymentRecord,
  TenantContact,
  TenantRecord,
  TenantUser,
  ToastState,
  UnitRecord,
} from '@/src/types';
import { formatCurrency } from '@/src/utils/currency';
import { getCurrentMonthKey } from '@/src/utils/dates';
import { simulatePaymentProcessing } from '@/src/utils/payments';
import { getInitialsFromName } from '@/src/utils/session';

interface AppContextValue {
  clearPendingInviteCode: () => Promise<void>;
  currentOwnerId?: string | null;
  currentTenantId?: string | null;
  currentUnitId?: string | null;
  currentMonthKey: string;
  currentTenantPayment?: PaymentRecord;
  dismissHint: (hint: DismissedHintKey) => void;
  getPropertyById: (id: string) => Property | undefined;
  getTenantById: (id: string) => TenantContact | undefined;
  isFirebaseDataMode: boolean;
  isHintDismissed: (hint: DismissedHintKey) => boolean;
  isHydrated: boolean;
  isSimulatedPaymentMode: boolean;
  lastDataEvent: DiagnosticEvent | null;
  ownerDashboardSummary: OwnerDashboardSummary;
  ownerPayments: PaymentRecord[];
  ownerPaymentsFilter: PaymentFilterState;
  ownerUser: OwnerUser;
  payRent: (paymentId: string, provider: PaymentProvider) => Promise<PaymentAttemptResult>;
  paymentMethods: PaymentProvider[];
  payments: PaymentRecord[];
  pendingInviteCode: string | null;
  properties: Property[];
  propertyRecords: PropertyRecord[];
  reportDataEvent: (event: Omit<DiagnosticEvent, 'timestamp'>) => void;
  resetPaymentFilters: () => Promise<void>;
  resetPersistedAppData: () => Promise<void>;
  restoreSeededDemoData: () => Promise<void>;
  restoreMockPayments: () => Promise<void>;
  savePendingInviteCode: (value: string) => Promise<void>;
  setOwnerPaymentsFilter: (value: {
    propertyId?: string;
    status?: PaymentStatusFilter;
  }) => void;
  setTenantPaymentsFilter: (value: PaymentStatusFilter) => void;
  tenantAssignmentRequired: boolean;
  tenantContacts: TenantContact[];
  tenantPayments: PaymentRecord[];
  tenantPaymentsFilter: PaymentStatusFilter;
  tenantUser: TenantUser;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

const defaultPaymentFilters: PersistedPaymentFilters = {
  ownerPropertyId: 'all',
  ownerStatus: 'all',
  tenantStatus: 'all',
};

function createSeededPayments() {
  return initialPayments.map((payment) => ({
    ...payment,
  }));
}

function sortPayments(a: PaymentRecord, b: PaymentRecord) {
  return new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime();
}

function getOwnerNetAmount(payment: PaymentRecord) {
  return payment.ownerReceivableAmount ?? payment.rentAmount ?? payment.amount;
}

function getAgencyFeeAmount(payment: PaymentRecord) {
  void payment;
  return 0;
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
  return Array.isArray(value) && value.length > 0 ? value : createSeededPayments();
}

function normalizeDismissedHints(value: DismissedHintsState | null) {
  return value && typeof value === 'object' ? value : {};
}

function buildInitials(value: string, fallback = 'AT') {
  return getInitialsFromName(value, fallback);
}

function createFallbackTenantUser(sessionName?: string, sessionEmail?: string): TenantUser {
  return {
    ...seededTenantUser,
    email: sessionEmail ?? seededTenantUser.email,
    fullName: sessionName ?? seededTenantUser.fullName,
    initials: buildInitials(sessionName ?? seededTenantUser.fullName, seededTenantUser.initials),
    propertyId: null,
    status: 'unassigned',
    unitId: null,
  };
}

function createFallbackOwnerUser(
  sessionName?: string,
  sessionEmail?: string,
  propertyIds: string[] = [],
): OwnerUser {
  return {
    ...seededOwnerUser,
    bankilyDeepLinkTemplate: null,
    bankilyIntegrationMode: 'not_configured',
    bankilyMerchantCode: null,
    bankilyPaymentMethodStatus: 'draft',
    bankilyPhoneNumber: null,
    bankilyQrImageUrl: null,
    email: sessionEmail ?? seededOwnerUser.email,
    fullName: sessionName ?? seededOwnerUser.fullName,
    id: seededOwnerUser.id,
    initials: buildInitials(sessionName ?? seededOwnerUser.fullName, seededOwnerUser.initials),
    propertyIds,
  };
}

export function AppProvider({ children }: PropsWithChildren) {
  const { session } = useSession();
  const [demoPayments, setDemoPayments] = useState<PaymentRecord[]>(createSeededPayments);
  const [paymentFilters, setPaymentFilters] =
    useState<PersistedPaymentFilters>(defaultPaymentFilters);
  const [dismissedHints, setDismissedHints] = useState<DismissedHintsState>({});
  const [pendingInviteCode, setPendingInviteCodeState] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [lastDataEvent, setLastDataEvent] = useState<DiagnosticEvent | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  const [firebaseOwnerRecord, setFirebaseOwnerRecord] = useState<OwnerRecord | null>(null);
  const [firebaseUserOwnerId, setFirebaseUserOwnerId] = useState<string | null>(null);
  const [firebaseUserTenantId, setFirebaseUserTenantId] = useState<string | null>(null);
  const [firebaseProperties, setFirebaseProperties] = useState<PropertyRecord[]>([]);
  const [firebaseUnits, setFirebaseUnits] = useState<UnitRecord[]>([]);
  const [firebaseTenants, setFirebaseTenants] = useState<TenantRecord[]>([]);
  const [firebaseTenantRecord, setFirebaseTenantRecord] = useState<TenantRecord | null>(null);
  const [firebaseTenantOwner, setFirebaseTenantOwner] = useState<OwnerRecord | null>(null);
  const [firebaseTenantProperty, setFirebaseTenantProperty] = useState<PropertyRecord | null>(null);
  const [firebaseTenantUnit, setFirebaseTenantUnit] = useState<UnitRecord | null>(null);
  const [firebasePayments, setFirebasePayments] = useState<RentPaymentRecord[]>([]);

  const isFirebaseDataMode = Boolean(
    isFirebaseConfigured && db && session?.kind === 'firebase' && session.firebaseUid,
  );

  const reportDataEvent = useCallback((event: Omit<DiagnosticEvent, 'timestamp'>) => {
    setLastDataEvent({
      ...event,
      timestamp: new Date().toISOString(),
    });
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function hydrateAppState() {
      const [storedPayments, storedFilters, storedHints, storedInviteCode] = await Promise.all([
        readStoredJson<PaymentRecord[] | null>(storageKeys.payments, null),
        readStoredJson<PersistedPaymentFilters | null>(storageKeys.paymentFilters, null),
        readStoredJson<DismissedHintsState | null>(storageKeys.dismissedHints, null),
        getPendingInviteCode(),
      ]);

      if (!isMounted) {
        return;
      }

      setDemoPayments(normalizePayments(storedPayments));
      setPaymentFilters(normalizePaymentFilters(storedFilters));
      setDismissedHints(normalizeDismissedHints(storedHints));
      setPendingInviteCodeState(storedInviteCode);
      setIsHydrated(true);
    }

    void hydrateAppState();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    void Promise.all([
      writeStoredJson(storageKeys.payments, demoPayments),
      writeStoredJson(storageKeys.paymentFilters, paymentFilters),
      writeStoredJson(storageKeys.dismissedHints, dismissedHints),
    ]).catch(() => {
      // Ignore non-sensitive persistence failures in demo mode.
    });
  }, [demoPayments, dismissedHints, isHydrated, paymentFilters]);

  useEffect(() => {
    if (!isFirebaseDataMode || !db || !session?.firebaseUid) {
      setFirebaseUserOwnerId(null);
      setFirebaseUserTenantId(null);
      return;
    }

    const userRef = doc(db, 'users', session.firebaseUid);

    return onSnapshot(userRef, (snapshot) => {
      if (!snapshot.exists()) {
        setFirebaseUserOwnerId(null);
        setFirebaseUserTenantId(null);
        return;
      }

      const data = snapshot.data();
      setFirebaseUserOwnerId(typeof data.ownerId === 'string' ? data.ownerId : null);
      setFirebaseUserTenantId(typeof data.tenantId === 'string' ? data.tenantId : null);
    }, (error) => {
      reportDataEvent({
        action: 'user-subscription',
        message: error.message,
        scope: 'firestore',
        status: 'error',
        title: 'Lecture du profil utilisateur impossible',
      });
    });
  }, [isFirebaseDataMode, reportDataEvent, session?.firebaseUid]);

  useEffect(() => {
    if (
      !isFirebaseDataMode ||
      !db ||
      !session?.firebaseUid ||
      session.role !== 'owner' ||
      session.profile?.status !== 'active'
    ) {
      setFirebaseOwnerRecord(null);
      setFirebaseProperties([]);
      setFirebaseUnits([]);
      setFirebaseTenants([]);
      setFirebasePayments([]);
      return;
    }

    const ownerId = firebaseUserOwnerId ?? session.firebaseUid;
    const ownerRef = doc(db, 'owners', ownerId);
    const propertiesQuery = query(collection(db, 'properties'), where('ownerId', '==', ownerId));
    const unitsQuery = query(collection(db, 'units'), where('ownerId', '==', ownerId));
    const tenantsQuery = query(collection(db, 'tenants'), where('ownerId', '==', ownerId));
    const paymentsQuery = query(collection(db, 'rentPayments'), where('ownerId', '==', ownerId));

    const unsubscribers = [
      onSnapshot(ownerRef, (snapshot) => {
        if (!snapshot.exists()) {
          setFirebaseOwnerRecord(null);
          return;
        }

        setFirebaseOwnerRecord(normalizeOwnerRecord(snapshot.id, snapshot.data()));
      }, (error) => {
        reportDataEvent({
          action: 'owner-subscription',
          message: error.message,
          scope: 'firestore',
          status: 'error',
          title: 'Lecture owner impossible',
        });
      }),
      onSnapshot(propertiesQuery, (snapshot) => {
        setFirebaseProperties(snapshot.docs.map((item) => normalizePropertyRecord(item.id, item.data())));
      }, (error) => {
        reportDataEvent({
          action: 'properties-subscription',
          message: error.message,
          scope: 'firestore',
          status: 'error',
          title: 'Lecture des biens impossible',
        });
      }),
      onSnapshot(unitsQuery, (snapshot) => {
        setFirebaseUnits(snapshot.docs.map((item) => normalizeUnitRecord(item.id, item.data())));
      }, (error) => {
        reportDataEvent({
          action: 'units-subscription',
          message: error.message,
          scope: 'firestore',
          status: 'error',
          title: 'Lecture des unités impossible',
        });
      }),
      onSnapshot(tenantsQuery, (snapshot) => {
        setFirebaseTenants(snapshot.docs.map((item) => normalizeTenantRecord(item.id, item.data())));
      }, (error) => {
        reportDataEvent({
          action: 'tenants-subscription',
          message: error.message,
          scope: 'firestore',
          status: 'error',
          title: 'Lecture des locataires impossible',
        });
      }),
      onSnapshot(paymentsQuery, (snapshot) => {
        setFirebasePayments(
          snapshot.docs.map((item) => normalizeRentPaymentRecord(item.id, item.data())),
        );
      }, (error) => {
        reportDataEvent({
          action: 'owner-payments-subscription',
          message: error.message,
          scope: 'firestore',
          status: 'error',
          title: 'Lecture des paiements propriétaire impossible',
        });
      }),
    ];

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [
    db,
    firebaseUserOwnerId,
    isFirebaseDataMode,
    reportDataEvent,
    session?.firebaseUid,
    session?.profile?.status,
    session?.role,
  ]);

  useEffect(() => {
    if (
      !isFirebaseDataMode ||
      !db ||
      session?.role !== 'tenant' ||
      session.profile?.status !== 'active'
    ) {
      setFirebaseTenantRecord(null);
      setFirebasePayments([]);
      return;
    }

    if (!firebaseUserTenantId) {
      setFirebaseTenantRecord(null);
      setFirebasePayments([]);
      return;
    }

    const tenantRef = doc(db, 'tenants', firebaseUserTenantId);
    const paymentsQuery = query(
      collection(db, 'rentPayments'),
      where('tenantId', '==', firebaseUserTenantId),
    );

    const unsubscribers = [
      onSnapshot(tenantRef, (snapshot) => {
        if (!snapshot.exists()) {
          setFirebaseTenantRecord(null);
          return;
        }

        setFirebaseTenantRecord(normalizeTenantRecord(snapshot.id, snapshot.data()));
      }, (error) => {
        reportDataEvent({
          action: 'tenant-subscription',
          message: error.message,
          scope: 'firestore',
          status: 'error',
          title: 'Lecture du profil locataire impossible',
        });
      }),
      onSnapshot(paymentsQuery, (snapshot) => {
        setFirebasePayments(
          snapshot.docs.map((item) => normalizeRentPaymentRecord(item.id, item.data())),
        );
      }, (error) => {
        reportDataEvent({
          action: 'tenant-payments-subscription',
          message: error.message,
          scope: 'firestore',
          status: 'error',
          title: 'Lecture des paiements locataire impossible',
        });
      }),
    ];

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [db, firebaseUserTenantId, isFirebaseDataMode, reportDataEvent, session?.profile?.status, session?.role]);

  useEffect(() => {
    if (
      !isFirebaseDataMode ||
      !db ||
      session?.role !== 'tenant' ||
      session.profile?.status !== 'active' ||
      !firebaseTenantRecord
    ) {
      setFirebaseTenantOwner(null);
      setFirebaseTenantProperty(null);
      setFirebaseTenantUnit(null);
      return;
    }

    const unitRef = doc(db, 'units', firebaseTenantRecord.unitId);
    const propertyRef = doc(db, 'properties', firebaseTenantRecord.propertyId);
    const ownerRef = doc(db, 'owners', firebaseTenantRecord.ownerId);

    const unsubscribers = [
      onSnapshot(unitRef, (snapshot) => {
        if (!snapshot.exists()) {
          setFirebaseTenantUnit(null);
          return;
        }

        setFirebaseTenantUnit(normalizeUnitRecord(snapshot.id, snapshot.data()));
      }, (error) => {
        reportDataEvent({
          action: 'tenant-unit-subscription',
          message: error.message,
          scope: 'firestore',
          status: 'error',
          title: 'Lecture de l’unité impossible',
        });
      }),
      onSnapshot(propertyRef, (snapshot) => {
        if (!snapshot.exists()) {
          setFirebaseTenantProperty(null);
          return;
        }

        setFirebaseTenantProperty(normalizePropertyRecord(snapshot.id, snapshot.data()));
      }, (error) => {
        reportDataEvent({
          action: 'tenant-property-subscription',
          message: error.message,
          scope: 'firestore',
          status: 'error',
          title: 'Lecture du bien impossible',
        });
      }),
      onSnapshot(ownerRef, (snapshot) => {
        if (!snapshot.exists()) {
          setFirebaseTenantOwner(null);
          return;
        }

        setFirebaseTenantOwner(normalizeOwnerRecord(snapshot.id, snapshot.data()));
      }, (error) => {
        reportDataEvent({
          action: 'tenant-owner-subscription',
          message: error.message,
          scope: 'firestore',
          status: 'error',
          title: 'Lecture du propriétaire impossible',
        });
      }),
    ];

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [db, firebaseTenantRecord, isFirebaseDataMode, reportDataEvent, session?.role]);

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

  const savePendingInviteCode = useCallback(async (value: string) => {
    const storedValue = await storePendingInviteCode(value);
    setPendingInviteCodeState(storedValue);
  }, []);

  const clearPendingInviteCode = useCallback(async () => {
    await clearPendingInviteStorage();
    setPendingInviteCodeState(null);
    reportDataEvent({
      action: 'pending-invite-cleared',
      message: 'Le code d’invitation mémorisé a été effacé.',
      scope: 'storage',
      status: 'info',
      title: 'Invitation effacée',
    });
  }, [reportDataEvent]);

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
    setDemoPayments(createSeededPayments());
    await removeStoredItems([storageKeys.payments]);
    pushToast(
      'info',
      'Paiements restaurés',
      'L’historique mock a été remis à son état initial pour la validation.',
    );
  };

  const restoreSeededDemoData = async () => {
    setDemoPayments(createSeededPayments());
    setPaymentFilters(defaultPaymentFilters);
    setDismissedHints({});
    setPendingInviteCodeState(null);
    await removeStoredItems([
      storageKeys.dismissedHints,
      storageKeys.paymentFilters,
      storageKeys.payments,
      storageKeys.pendingInviteCode,
    ]);
    pushToast(
      'info',
      'Démo restaurée',
      'Les données seed locales ont été remises à leur état initial.',
    );
  };

  const resetPersistedAppData = async () => {
    setPaymentFilters(defaultPaymentFilters);
    setDismissedHints({});
    setPendingInviteCodeState(null);
    await removeStoredItems([
      storageKeys.dismissedHints,
      storageKeys.paymentFilters,
      storageKeys.pendingInviteCode,
    ]);
    pushToast(
      'info',
      'Données locales effacées',
      'Les filtres, indications masquées et invitations mémorisées ont été réinitialisés.',
    );
  };

  const resolvedCurrentMonthKey = isFirebaseDataMode ? getCurrentMonthKey() : seededCurrentMonthKey;

  const resolvedProperties = useMemo(() => {
    if (!isFirebaseDataMode) {
      return seededProperties;
    }

    const propertyMap = new Map(firebaseProperties.map((property) => [property.id, property]));

    if (session?.role === 'tenant') {
      return firebaseTenantUnit
        ? [mapUnitToUiProperty(firebaseTenantUnit, firebaseTenantProperty ?? undefined)]
        : [];
    }

    return firebaseUnits
      .map((unit) => mapUnitToUiProperty(unit, propertyMap.get(unit.propertyId)))
      .sort((a, b) => {
        if (a.name === b.name) {
          return (a.unitLabel ?? '').localeCompare(b.unitLabel ?? '', 'fr');
        }

        return a.name.localeCompare(b.name, 'fr');
      });
  }, [
    firebaseProperties,
    firebaseTenantProperty,
    firebaseTenantUnit,
    firebaseUnits,
    isFirebaseDataMode,
    session?.role,
  ]);

  const resolvedTenantContacts = useMemo(() => {
    if (!isFirebaseDataMode) {
      return seededTenantContacts;
    }

    if (session?.role === 'owner') {
      return firebaseTenants.map(mapTenantRecordToContact);
    }

    return firebaseTenantRecord ? [mapTenantRecordToContact(firebaseTenantRecord)] : [];
  }, [firebaseTenantRecord, firebaseTenants, isFirebaseDataMode, session?.role]);

  const resolvedPayments = useMemo(() => {
    if (!isFirebaseDataMode) {
      return demoPayments;
    }

    return firebasePayments.map(mapRentPaymentToUiPayment).sort(sortPayments);
  }, [demoPayments, firebasePayments, isFirebaseDataMode]);

  const resolvedOwnerUser = useMemo<OwnerUser>(() => {
    if (!isFirebaseDataMode) {
      return seededOwnerUser;
    }

    if (session?.role === 'owner') {
      if (firebaseOwnerRecord) {
        return {
          ...mapOwnerRecordToUser(
            firebaseOwnerRecord,
            Array.from(new Set(firebaseProperties.map((property) => property.id))),
          ),
          email: session.profile?.email ?? '',
        };
      }

      return createFallbackOwnerUser(
        session?.profile?.displayName,
        session?.profile?.email,
        Array.from(new Set(firebaseProperties.map((property) => property.id))),
      );
    }

    if (firebaseTenantOwner) {
      return {
        ...mapOwnerRecordToUser(firebaseTenantOwner, []),
        email: '',
      };
    }

    return createFallbackOwnerUser();
  }, [firebaseOwnerRecord, firebaseProperties, firebaseTenantOwner, isFirebaseDataMode, session?.profile?.displayName, session?.profile?.email, session?.role]);

  const resolvedTenantUser = useMemo<TenantUser>(() => {
    if (!isFirebaseDataMode) {
      return seededTenantUser;
    }

    const displayName = session?.profile?.displayName ?? firebaseTenantRecord?.displayName;
    const email = session?.profile?.email ?? firebaseTenantRecord?.email;

    if (!displayName || !email) {
      return createFallbackTenantUser();
    }

    if (!firebaseTenantRecord || !firebaseTenantUnit) {
      return createFallbackTenantUser(displayName, email);
    }

    return {
      email,
      fullName: displayName,
      id: firebaseTenantRecord.id,
      initials: buildInitials(displayName),
      ownerId: firebaseTenantRecord.ownerId,
      phone: 'Non renseigné',
      propertyId: firebaseTenantUnit.id,
      role: 'tenant',
      status: firebaseTenantRecord.status,
      unitId: firebaseTenantRecord.unitId,
    };
  }, [firebaseTenantRecord, firebaseTenantUnit, isFirebaseDataMode, session?.profile?.displayName, session?.profile?.email]);

  const activeOwnerId =
    isFirebaseDataMode && session?.role === 'owner' && session.firebaseUid
      ? firebaseUserOwnerId ?? session.firebaseUid
      : resolvedOwnerUser.id;
  const activeTenantId =
    isFirebaseDataMode && session?.role === 'tenant' && session.firebaseUid
      ? session.firebaseUid
      : resolvedTenantUser.id;

  const ownerPayments =
    session?.role === 'owner'
      ? resolvedPayments.filter((payment) => payment.ownerId === activeOwnerId)
      : [];
  const tenantPayments =
    session?.role === 'tenant'
      ? resolvedPayments.filter((payment) => payment.tenantId === activeTenantId)
      : [];

  const currentTenantPayment =
    session?.role === 'tenant'
      ? tenantPayments.find((payment) => payment.monthKey === resolvedCurrentMonthKey) ??
        tenantPayments.find((payment) => payment.status !== 'paid') ??
        tenantPayments[0]
      : undefined;

  const currentMonthPayments = ownerPayments.filter(
    (payment) => payment.monthKey === resolvedCurrentMonthKey,
  );

  const collectedThisMonth = currentMonthPayments
    .filter((payment) => payment.status === 'paid')
    .reduce((total, payment) => total + getOwnerNetAmount(payment), 0);

  const grossCollectedThisMonth = currentMonthPayments
    .filter((payment) => payment.status === 'paid')
    .reduce((total, payment) => total + payment.amount, 0);

  const agencyFeesThisMonth = currentMonthPayments
    .filter((payment) => payment.status === 'paid')
    .reduce((total, payment) => total + getAgencyFeeAmount(payment), 0);

  const expectedThisMonth = currentMonthPayments.reduce(
    (total, payment) => total + getOwnerNetAmount(payment),
    0,
  );

  const pendingAmount = currentMonthPayments
    .filter((payment) => payment.status === 'pending')
    .reduce((total, payment) => total + getOwnerNetAmount(payment), 0);

  const lateAmount = currentMonthPayments
    .filter((payment) => payment.status === 'late')
    .reduce((total, payment) => total + getOwnerNetAmount(payment), 0);

  const vacantImpact = resolvedProperties
    .filter((property) => property.occupancyStatus === 'vacant')
    .reduce((total, property) => total + property.monthlyRent, 0);

  const distinctPropertyCount = isFirebaseDataMode
    ? Array.from(new Set(firebaseProperties.map((property) => property.id))).length
    : resolvedProperties.length;

  const ownerDashboardSummary: OwnerDashboardSummary = {
    actionItems: [
      {
        amount: lateAmount,
        description: `${currentMonthPayments.filter((payment) => payment.status === 'late').length} dossier à relancer`,
        id: 'late-rent',
        title: 'Loyer en retard',
      },
      {
        amount: pendingAmount,
        description: 'Transactions simulées à suivre ce mois-ci',
        id: 'pending-confirmation',
        title: 'Paiements en attente',
      },
      {
        amount: vacantImpact,
        description: 'Unités vacantes sans revenu simulé ce mois-ci',
        id: 'vacant-impact',
        title: 'Impact des unités vacantes',
      },
    ],
    agencyFeesThisMonth,
    collectedThisMonth,
    expectedThisMonth,
    grossCollectedThisMonth,
    lateCount: currentMonthPayments.filter((payment) => payment.status === 'late').length,
    monthlyPotentialIncome: resolvedProperties.reduce(
      (total, property) => total + property.monthlyRent,
      0,
    ),
    occupiedCount: resolvedProperties.filter((property) => property.occupancyStatus === 'occupied').length,
    pendingCount: currentMonthPayments.filter((payment) => payment.status === 'pending').length,
    progressPercentage:
      expectedThisMonth > 0 ? Math.round((collectedThisMonth / expectedThisMonth) * 100) : 0,
    propertiesCount: distinctPropertyCount,
    tenantsCount: resolvedTenantContacts.length,
    vacantImpact,
  };

  const getPropertyById = (id: string) => resolvedProperties.find((property) => property.id === id);

  const getTenantById = (id: string) => resolvedTenantContacts.find((tenant) => tenant.id === id);

  const payRent = async (
    paymentId: string,
    provider: PaymentProvider,
  ): Promise<PaymentAttemptResult> => {
    const targetPayment = resolvedPayments.find((payment) => payment.id === paymentId);

    if (!targetPayment) {
      const result = {
        message: "Le paiement demandé n'a pas été retrouvé.",
        ok: false,
        title: 'Paiement indisponible',
      };

      reportDataEvent({
        action: 'payment-lookup',
        message: result.message,
        scope: 'payment',
        status: 'error',
        title: result.title,
      });
      pushToast('error', result.title, result.message);

      return result;
    }

    if (targetPayment.status === 'paid') {
      const result = {
        message: 'Ce loyer a déjà été enregistré comme payé.',
        ok: false,
        title: 'Paiement déjà traité',
      };

      reportDataEvent({
        action: 'payment-duplicate',
        message: result.message,
        scope: 'payment',
        status: 'info',
        title: result.title,
      });
      pushToast('info', result.title, result.message);

      return result;
    }

    if (isFirebaseDataMode && session?.role === 'tenant' && session.firebaseUid) {
      const result = await submitSimulatedRentPayment({
        paymentId,
        provider,
        tenantId: session.firebaseUid,
      });

      reportDataEvent({
        action: 'payment-firestore-update',
        message: result.message,
        scope: 'payment',
        status: result.ok ? 'success' : 'error',
        title: result.title,
      });
      pushToast(result.ok ? 'success' : 'error', result.title, result.message);
      return result;
    }

    const simulationResult = await simulatePaymentProcessing(provider);

    if (!simulationResult.ok) {
      reportDataEvent({
        action: 'payment-simulation',
        message: simulationResult.message,
        scope: 'payment',
        status: 'error',
        title: simulationResult.title,
      });
      pushToast('error', simulationResult.title, simulationResult.message);

      return simulationResult;
    }

    const paidAt = new Date().toISOString();
    const updatedPayment: PaymentRecord = {
      ...targetPayment,
      paidAt,
      provider,
      referenceId: `ATP-${Date.now().toString().slice(-8)}`,
      status: 'paid',
    };

    setDemoPayments((currentPayments) =>
      currentPayments.map((payment) => (payment.id === paymentId ? updatedPayment : payment)),
    );

    const successMessage = `${formatCurrency(targetPayment.amount)} enregistrés via ${provider}.`;

    pushToast('success', simulationResult.title, successMessage);
    reportDataEvent({
      action: 'payment-demo-update',
      message: successMessage,
      scope: 'payment',
      status: 'success',
      title: simulationResult.title,
    });

    return {
      message: successMessage,
      ok: true,
      payment: updatedPayment,
      title: simulationResult.title,
    };
  };

  const tenantAssignmentRequired =
    isFirebaseDataMode && session?.role === 'tenant' ? !firebaseTenantRecord || !firebaseTenantUnit : false;
  const currentUnitId =
    session?.role === 'tenant'
      ? firebaseTenantUnit?.id ?? resolvedTenantUser.unitId ?? null
      : null;

  return (
    <AppContext.Provider
      value={{
        clearPendingInviteCode,
        currentOwnerId: activeOwnerId,
        currentTenantId: activeTenantId,
        currentUnitId,
        currentMonthKey: resolvedCurrentMonthKey,
        currentTenantPayment,
        dismissHint,
        getPropertyById,
        getTenantById,
        isFirebaseDataMode,
        isHintDismissed,
        isHydrated,
        isSimulatedPaymentMode: true,
        lastDataEvent,
        ownerDashboardSummary,
        ownerPayments,
        ownerPaymentsFilter: {
          propertyId: paymentFilters.ownerPropertyId,
          status: paymentFilters.ownerStatus,
        },
        ownerUser: resolvedOwnerUser,
        payRent,
        paymentMethods,
        payments: resolvedPayments,
        pendingInviteCode,
        properties: resolvedProperties,
        propertyRecords: isFirebaseDataMode
          ? firebaseProperties
          : seededProperties.map((property) => ({
              address: property.address,
              id: property.id,
              label: property.name,
              ownerId: property.ownerId,
            })),
        reportDataEvent,
        resetPaymentFilters,
        resetPersistedAppData,
        restoreMockPayments,
        restoreSeededDemoData,
        savePendingInviteCode,
        setOwnerPaymentsFilter,
        setTenantPaymentsFilter,
        tenantAssignmentRequired,
        tenantContacts: resolvedTenantContacts,
        tenantPayments,
        tenantPaymentsFilter: paymentFilters.tenantStatus,
        tenantUser: resolvedTenantUser,
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
