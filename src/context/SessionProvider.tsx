import { onAuthStateChanged, User } from 'firebase/auth';
import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

import { auth, isFirebaseConfigured } from '@/src/lib/firebase';
import { isBackendEnabled } from '@/src/config/env';
import {
  deleteSecureValue,
  removeStoredItem,
  readSecureJson,
  readStoredJson,
  storageKeys,
  writeSecureJson,
  writeStoredJson,
} from '@/src/storage/persistence';
import {
  refreshCurrentUser,
  signOutCompletely,
} from '@/src/services/firebaseAuth';
import { clearPendingOwnerAccessCode } from '@/src/services/pendingOwnerAccess';
import { getTermsStatusViaBackend } from '@/src/services/backendApi';
import {
  createSessionProfileFromFirebase,
  ensureUserProfileRole,
  getAuthProvidersFromUser,
  getPrimaryAuthProvider,
  syncUserProfileFromAuthUser,
} from '@/src/services/userProfile';
import {
  DiagnosticEvent,
  GoogleAuthPayload,
  Role,
  SessionState,
  SessionUserProfile,
} from '@/src/types';
import {
  authRoute,
  createDemoSession,
  createFirebaseSession,
  createGoogleSession,
  getHomeRouteForRole,
  isRole,
  normalizeSessionState,
  updateSessionRole,
  verificationRoute,
} from '@/src/utils/session';

type SessionStatus =
  | 'authenticated'
  | 'owner-access-required'
  | 'public'
  | 'role-required'
  | 'suspended'
  | 'terms-required'
  | 'verification-required';

interface SessionContextValue {
  authEntryRoute:
    | '/account-suspended'
    | '/auth/login'
    | '/auth/verify-email'
    | '/owner-access'
    | '/terms';
  clearSessionStorage: () => Promise<void>;
  clearAuthDebug: () => void;
  completePendingRoleSelection: (role: Role) => Promise<void>;
  hasSelectedRole: boolean;
  homeRoute:
    | '/(agency)/home'
    | '/(owner)/home'
    | '/(tenant)/home'
    | '/auth/login'
    | '/account-suspended'
    | '/owner-access'
    | '/terms';
  lastAuthEvent: DiagnosticEvent | null;
  isAuthenticated: boolean;
  isFirebaseEnabled: boolean;
  isHydrated: boolean;
  needsEmailVerification: boolean;
  needsOwnerAccess: boolean;
  needsRoleSelection: boolean;
  needsTermsAcceptance: boolean;
  pendingProfile: SessionUserProfile | null;
  reportAuthEvent: (event: Omit<DiagnosticEvent, 'timestamp'>) => void;
  selectedDemoRole: Role;
  session: SessionState | null;
  sessionStatus: SessionStatus;
  setSelectedDemoRole: (role: Role) => void;
  signIn: (role: Role) => Promise<void>;
  signInWithGoogle: (role: Role, payload: GoogleAuthPayload) => Promise<void>;
  signOut: () => Promise<void>;
  switchRole: (role: Role) => Promise<void>;
  refreshSession: () => Promise<void>;
  refreshVerification: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

export function SessionProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<SessionState | null>(null);
  const [selectedDemoRole, setSelectedDemoRoleState] = useState<Role>('tenant');
  const [hasSelectedRole, setHasSelectedRole] = useState(false);
  const [pendingProfile, setPendingProfile] = useState<SessionUserProfile | null>(null);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>('public');
  const [lastAuthEvent, setLastAuthEvent] = useState<DiagnosticEvent | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const requestRef = useRef(0);
  const sessionSnapshotRef = useRef<SessionState | null>(null);

  const reportAuthEvent = useCallback((event: Omit<DiagnosticEvent, 'timestamp'>) => {
    setLastAuthEvent({
      ...event,
      timestamp: new Date().toISOString(),
    });
  }, []);

  const clearAuthDebug = useCallback(() => {
    setLastAuthEvent(null);
  }, []);

  const commitSession = useCallback(
    async (
      nextSession: SessionState | null,
      nextStatus: SessionStatus,
      nextPendingProfile: SessionUserProfile | null,
    ) => {
      setSession(nextSession);
      setSessionStatus(nextStatus);
      setPendingProfile(nextPendingProfile);
      sessionSnapshotRef.current = nextSession;

      if (nextSession) {
        await writeSecureJson(storageKeys.sessionSecure, nextSession);
      } else {
        await deleteSecureValue(storageKeys.sessionSecure);
      }
    },
    [],
  );

  const applySelectedRole = useCallback(async (role: Role) => {
    setHasSelectedRole(true);
    setSelectedDemoRoleState(role);
    await writeStoredJson(storageKeys.selectedDemoRole, role);
  }, []);

  const applyFirebaseUserState = useCallback(
    async (user: User | null) => {
      const currentRequest = ++requestRef.current;

      const updateIfCurrent = async (
        nextSession: SessionState | null,
        nextStatus: SessionStatus,
        nextPendingProfile: SessionUserProfile | null,
      ) => {
        if (currentRequest !== requestRef.current) {
          return;
        }

        await commitSession(nextSession, nextStatus, nextPendingProfile);
        setIsHydrated(true);
      };

      if (!user) {
        const restoredDemoSession =
          sessionSnapshotRef.current?.kind === 'demo' ? sessionSnapshotRef.current : null;

        if (restoredDemoSession) {
          await updateIfCurrent(restoredDemoSession, 'authenticated', null);
          return;
        }

        await updateIfCurrent(null, 'public', null);
        return;
      }

      try {
        const profileRecord = await syncUserProfileFromAuthUser(user);
        const sessionProfile = createSessionProfileFromFirebase(user, profileRecord);

        if (profileRecord.role) {
          await applySelectedRole(profileRecord.role);
        }

        if (!profileRecord.role) {
          reportAuthEvent({
            action: 'firebase-role-selection',
            message: 'Le compte Firebase est authentifié, mais aucun rôle applicatif n’est encore enregistré.',
            scope: 'auth',
            status: 'info',
            title: 'Rôle requis',
          });
          await updateIfCurrent(null, 'role-required', sessionProfile);
          return;
        }

        if (profileRecord.status === 'suspended') {
          const authProviders =
            profileRecord.authProviders.length > 0
              ? profileRecord.authProviders
              : getAuthProvidersFromUser(user);
          const nextSession = createFirebaseSession({
            authProvider: getPrimaryAuthProvider(authProviders, sessionSnapshotRef.current?.authProvider),
            authProviders,
            profile: sessionProfile,
            role: profileRecord.role,
            token: `firebase-user:${user.uid}`,
          });

          reportAuthEvent({
            action: 'account-suspended',
            message: 'Ce compte ATouPay est suspendu par l’agence.',
            scope: 'auth',
            status: 'error',
            title: 'Compte suspendu',
          });
          await updateIfCurrent(nextSession, 'suspended', sessionProfile);
          return;
        }

        if (profileRecord.role === 'owner' && profileRecord.status === 'pending_owner_access') {
          const authProviders =
            profileRecord.authProviders.length > 0
              ? profileRecord.authProviders
              : getAuthProvidersFromUser(user);
          const nextSession = createFirebaseSession({
            authProvider: getPrimaryAuthProvider(authProviders, sessionSnapshotRef.current?.authProvider),
            authProviders,
            profile: sessionProfile,
            role: 'owner',
            token: `firebase-user:${user.uid}`,
          });

          reportAuthEvent({
            action: 'owner-access-required',
            message:
              'Le compte propriétaire est connecté mais attend encore une autorisation agence.',
            scope: 'auth',
            status: 'info',
            title: 'Accès agence requis',
          });
          await updateIfCurrent(nextSession, 'owner-access-required', sessionProfile);
          return;
        }

        const snapshot = sessionSnapshotRef.current;
        const providerHint =
          snapshot?.firebaseUid === user.uid ? snapshot.authProvider : undefined;
        const authProviders =
          profileRecord.authProviders.length > 0
            ? profileRecord.authProviders
            : getAuthProvidersFromUser(user);
        const nextSession = createFirebaseSession({
          authProvider: getPrimaryAuthProvider(authProviders, providerHint),
          authProviders,
          profile: sessionProfile,
          role: profileRecord.role,
          token: `firebase-user:${user.uid}`,
        });

        if (authProviders.includes('password') && !user.emailVerified) {
          reportAuthEvent({
            action: 'firebase-email-verification',
            message: 'Le compte e-mail existe mais reste bloqué tant que l’adresse n’est pas vérifiée.',
            scope: 'auth',
            status: 'info',
            title: 'Vérification requise',
          });
          await updateIfCurrent(nextSession, 'verification-required', sessionProfile);
          return;
        }

        if (isFirebaseConfigured && isBackendEnabled) {
          try {
            const termsStatus = await getTermsStatusViaBackend();

            if (termsStatus.requiresAcceptance) {
              reportAuthEvent({
                action: 'terms-required',
                message:
                  'Les conditions d’utilisation ATouPay doivent être acceptées avant d’ouvrir les espaces applicatifs.',
                scope: 'auth',
                status: 'info',
                title: 'Conditions à accepter',
              });
              await updateIfCurrent(nextSession, 'terms-required', sessionProfile);
              return;
            }
          } catch (error) {
            reportAuthEvent({
              action: 'terms-status-load',
              message:
                error instanceof Error
                  ? error.message
                  : 'Le statut des conditions d’utilisation est indisponible.',
              scope: 'auth',
              status: 'error',
              title: 'Conditions indisponibles',
            });
          }
        }

        reportAuthEvent({
          action: 'firebase-session-restored',
          message: `Session restaurée pour ${user.email ?? user.uid}.`,
          scope: 'auth',
          status: 'success',
          title: 'Session active',
        });
        await updateIfCurrent(nextSession, 'authenticated', null);
      } catch (error) {
        reportAuthEvent({
          action: 'firebase-session-sync',
          message:
            error instanceof Error
              ? error.message
              : "La synchronisation de session Firebase a échoué.",
          scope: 'auth',
          status: 'error',
          title: 'Session invalide',
        });
        await signOutCompletely(sessionSnapshotRef.current?.authProvider);
        await updateIfCurrent(null, 'public', null);
      }
    },
    [applySelectedRole, commitSession, reportAuthEvent],
  );

  useEffect(() => {
    let isMounted = true;
    let unsubscribe: (() => void) | undefined;

    async function hydrateSession() {
      const [storedRole, storedSession] = await Promise.all([
        readStoredJson<string | null>(storageKeys.selectedDemoRole, null),
        readSecureJson<unknown>(storageKeys.sessionSecure),
      ]);

      if (!isMounted) {
        return;
      }

      const restoredSession = normalizeSessionState(storedSession);
      sessionSnapshotRef.current = restoredSession;

      if (isRole(storedRole)) {
        setSelectedDemoRoleState(storedRole);
        setHasSelectedRole(true);
      }

      if (!isFirebaseConfigured || !auth) {
        if (restoredSession) {
          setSession(restoredSession);
          setSessionStatus('authenticated');
          setSelectedDemoRoleState(restoredSession.role);
          setHasSelectedRole(true);
        }

        setIsHydrated(true);
        return;
      }

      unsubscribe = onAuthStateChanged(auth, (user) => {
        void applyFirebaseUserState(user);
      });
    }

    void hydrateSession();

    return () => {
      isMounted = false;
      unsubscribe?.();
    };
  }, [applyFirebaseUserState]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    writeStoredJson(storageKeys.selectedDemoRole, selectedDemoRole).catch(() => {
      // Ignore non-sensitive local persistence failures.
    });
  }, [isHydrated, selectedDemoRole]);

  const setSelectedDemoRole = (role: Role) => {
    setHasSelectedRole(true);
    setSelectedDemoRoleState(role);
  };

  const signIn = async (role: Role) => {
    if (isFirebaseConfigured) {
      await signOutCompletely(session?.authProvider);
    }

    const nextSession = createDemoSession(role);

    await applySelectedRole(role);
    await commitSession(nextSession, 'authenticated', null);
    reportAuthEvent({
      action: 'demo-sign-in',
      message:
        role === 'tenant'
          ? 'Session de démonstration ouverte côté locataire.'
          : role === 'owner'
            ? 'Session de démonstration ouverte côté propriétaire.'
            : 'Session de démonstration ouverte côté agence.',
      scope: 'auth',
      status: 'success',
      title: 'Mode démo',
    });
  };

  const signInWithGoogle = async (role: Role, payload: GoogleAuthPayload) => {
    if (isFirebaseConfigured) {
      await signOutCompletely(session?.authProvider);
    }

    const nextSession = createGoogleSession(role, payload);

    await applySelectedRole(role);
    await commitSession(nextSession, 'authenticated', null);
    reportAuthEvent({
      action: 'legacy-google-session',
      message:
        role === 'tenant'
          ? 'Session Google locale ouverte côté locataire.'
          : role === 'owner'
            ? 'Session Google locale ouverte côté propriétaire.'
            : 'Session Google locale ouverte côté agence.',
      scope: 'auth',
      status: 'success',
      title: 'Google connecté',
    });
  };

  const completePendingRoleSelection = async (role: Role) => {
    if (isFirebaseConfigured && auth?.currentUser) {
      const profileRecord = await ensureUserProfileRole(auth.currentUser, role);
      const authProviders =
        profileRecord.authProviders.length > 0
          ? profileRecord.authProviders
          : getAuthProvidersFromUser(auth.currentUser);
      const nextSession = createFirebaseSession({
        authProvider: getPrimaryAuthProvider(authProviders, session?.authProvider),
        authProviders,
        profile: createSessionProfileFromFirebase(auth.currentUser, profileRecord),
        role,
        token: `firebase-user:${auth.currentUser.uid}`,
      });

      await applySelectedRole(role);

      const nextStatus =
        authProviders.includes('password') && !auth.currentUser.emailVerified
          ? 'verification-required'
          : profileRecord.status === 'suspended'
            ? 'suspended'
          : profileRecord.role === 'owner' && profileRecord.status === 'pending_owner_access'
            ? 'owner-access-required'
            : 'authenticated';
      const resolvedStatus =
        nextStatus === 'authenticated' && isBackendEnabled
          ? ((await getTermsStatusViaBackend()).requiresAcceptance ? 'terms-required' : 'authenticated')
          : nextStatus;

      await commitSession(
        nextSession,
        resolvedStatus,
          resolvedStatus === 'verification-required' ||
          resolvedStatus === 'owner-access-required' ||
          resolvedStatus === 'suspended' ||
          resolvedStatus === 'terms-required'
          ? nextSession.profile ?? null
          : null,
      );
      reportAuthEvent({
        action:
          resolvedStatus === 'owner-access-required'
            ? 'firebase-owner-pending'
            : resolvedStatus === 'suspended'
              ? 'firebase-account-suspended'
            : resolvedStatus === 'terms-required'
              ? 'firebase-terms-required'
            : 'firebase-role-confirmed',
        message:
          resolvedStatus === 'owner-access-required'
            ? 'Le rôle propriétaire a été mémorisé, mais une autorisation agence reste nécessaire.'
            : resolvedStatus === 'suspended'
              ? 'Ce compte est suspendu par l’agence et ne peut pas ouvrir son espace.'
            : resolvedStatus === 'terms-required'
              ? 'Le rôle a été mémorisé, mais les conditions d’utilisation doivent encore être acceptées.'
            : role === 'tenant'
              ? 'Le rôle locataire a été enregistré pour ce compte.'
              : role === 'owner'
                ? 'Le rôle propriétaire a été enregistré pour ce compte.'
                : 'Le rôle agence a été enregistré pour ce compte.',
        scope: 'auth',
        status:
          resolvedStatus === 'owner-access-required' || resolvedStatus === 'terms-required'
            || resolvedStatus === 'suspended'
            ? 'info'
            : 'success',
        title:
          resolvedStatus === 'owner-access-required'
            ? 'Accès agence requis'
            : resolvedStatus === 'suspended'
              ? 'Compte suspendu'
            : resolvedStatus === 'terms-required'
              ? 'Conditions requises'
              : 'Rôle confirmé',
      });
      return;
    }

    const nextSession = session ? updateSessionRole(session, role) : createDemoSession(role);

    await applySelectedRole(role);
    await commitSession(nextSession, 'authenticated', null);
    reportAuthEvent({
      action: 'demo-role-confirmed',
      message:
        role === 'tenant'
          ? 'Le rôle locataire a été mémorisé pour la démo locale.'
          : role === 'owner'
            ? 'Le rôle propriétaire a été mémorisé pour la démo locale.'
            : 'Le rôle agence a été mémorisé pour la démo locale.',
      scope: 'auth',
      status: 'success',
      title: 'Rôle confirmé',
    });
  };

  const switchRole = async (role: Role) => {
    if (isFirebaseConfigured && auth?.currentUser && session?.kind === 'firebase') {
      const profileRecord = await ensureUserProfileRole(auth.currentUser, role);
      const authProviders =
        profileRecord.authProviders.length > 0
          ? profileRecord.authProviders
          : getAuthProvidersFromUser(auth.currentUser);
      const nextSession = createFirebaseSession({
        authProvider: getPrimaryAuthProvider(authProviders, session.authProvider),
        authProviders,
        profile: createSessionProfileFromFirebase(auth.currentUser, profileRecord),
        role,
        token: `firebase-user:${auth.currentUser.uid}`,
      });

      await applySelectedRole(role);
      const resolvedStatus =
        authProviders.includes('password') && !auth.currentUser.emailVerified
          ? 'verification-required'
          : profileRecord.status === 'suspended'
            ? 'suspended'
          : isBackendEnabled && (await getTermsStatusViaBackend()).requiresAcceptance
            ? 'terms-required'
            : 'authenticated';
      await commitSession(
        nextSession,
        resolvedStatus,
        resolvedStatus === 'terms-required' || resolvedStatus === 'suspended'
          ? nextSession.profile ?? null
          : null,
      );
      reportAuthEvent({
        action: 'firebase-role-switch',
        message:
          resolvedStatus === 'terms-required'
            ? 'Le rôle a changé, mais les conditions d’utilisation doivent encore être acceptées.'
            : role === 'tenant'
            ? 'Le compte Firebase pointe maintenant vers l’espace locataire.'
            : role === 'owner'
              ? 'Le compte Firebase pointe maintenant vers l’espace propriétaire.'
              : 'Le compte Firebase pointe maintenant vers l’espace agence.',
        scope: 'auth',
        status: resolvedStatus === 'terms-required' ? 'info' : 'success',
        title: resolvedStatus === 'terms-required' ? 'Conditions requises' : 'Rôle changé',
      });
      return;
    }

    const nextSession = session ? updateSessionRole(session, role) : createDemoSession(role);

    await applySelectedRole(role);
    await commitSession(nextSession, 'authenticated', null);
    reportAuthEvent({
      action: 'demo-role-switch',
      message:
        role === 'tenant'
          ? 'La démo locale a basculé vers locataire.'
          : role === 'owner'
            ? 'La démo locale a basculé vers propriétaire.'
            : 'La démo locale a basculé vers agence.',
      scope: 'auth',
      status: 'success',
      title: 'Rôle changé',
    });
  };

  const signOut = async () => {
    if (isFirebaseConfigured) {
      await signOutCompletely(session?.authProvider);
    } else if (session?.authProvider === 'google') {
      await signOutCompletely('google');
    }

    await clearPendingOwnerAccessCode();
    await commitSession(null, 'public', null);
    reportAuthEvent({
      action: 'sign-out',
      message: 'La session active a été fermée proprement.',
      scope: 'auth',
      status: 'info',
      title: 'Déconnexion',
    });
  };

  const clearSessionStorage = async () => {
    await signOut();
    setHasSelectedRole(false);
    setSelectedDemoRoleState('tenant');
    await removeStoredItem(storageKeys.selectedDemoRole);
  };

  const refreshVerification = async () => {
    if (!isFirebaseConfigured) {
      return;
    }

    const result = await refreshCurrentUser();

    reportAuthEvent({
      action: 'refresh-verification',
      message: result.message,
      scope: 'auth',
      status: result.status === 'error' ? 'error' : result.status === 'success' ? 'success' : 'info',
      title:
        result.status === 'success'
          ? 'Session actualisée'
          : result.status === 'needs-verification'
            ? 'Vérification toujours requise'
            : result.status === 'needs-role'
              ? 'Rôle requis'
              : result.status === 'unavailable'
                ? 'Firebase indisponible'
                : 'Actualisation impossible',
    });

    if (result.status === 'success' || result.status === 'needs-role' || result.status === 'needs-verification') {
      await applyFirebaseUserState(auth?.currentUser ?? null);
    }
  };

  const refreshSession = async () => {
    if (!isFirebaseConfigured || !auth?.currentUser) {
      return;
    }

    await applyFirebaseUserState(auth.currentUser);
  };

  const homeRoute =
    sessionStatus === 'owner-access-required'
      ? '/owner-access'
      : sessionStatus === 'suspended'
        ? '/account-suspended'
      : sessionStatus === 'terms-required'
        ? '/terms'
      : session
        ? getHomeRouteForRole(session.role)
        : '/auth/login';
  const authEntryRoute =
    sessionStatus === 'verification-required'
      ? verificationRoute
      : sessionStatus === 'owner-access-required'
        ? '/owner-access'
        : sessionStatus === 'suspended'
          ? '/account-suspended'
        : sessionStatus === 'terms-required'
          ? '/terms'
        : authRoute;

  return (
    <SessionContext.Provider
      value={{
        authEntryRoute,
        clearSessionStorage,
        clearAuthDebug,
        completePendingRoleSelection,
        hasSelectedRole,
        homeRoute,
        lastAuthEvent,
        isAuthenticated: sessionStatus === 'authenticated',
        isFirebaseEnabled: isFirebaseConfigured,
        isHydrated,
        needsEmailVerification: sessionStatus === 'verification-required',
        needsOwnerAccess: sessionStatus === 'owner-access-required',
        needsRoleSelection: sessionStatus === 'role-required',
        needsTermsAcceptance: sessionStatus === 'terms-required',
        pendingProfile,
        reportAuthEvent,
        selectedDemoRole,
        session,
        sessionStatus,
        setSelectedDemoRole,
        signIn,
        signInWithGoogle,
        signOut,
        switchRole,
        refreshSession,
        refreshVerification,
      }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);

  if (!context) {
    throw new Error('useSession must be used inside SessionProvider');
  }

  return context;
}
