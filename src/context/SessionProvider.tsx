import { createContext, PropsWithChildren, useContext, useEffect, useState } from 'react';

import {
  deleteSecureValue,
  removeStoredItem,
  readSecureJson,
  readStoredJson,
  storageKeys,
  writeSecureJson,
  writeStoredJson,
} from '@/src/storage/persistence';
import { Role, SessionState } from '@/src/types';

interface SessionContextValue {
  clearSessionStorage: () => Promise<void>;
  isAuthenticated: boolean;
  isHydrated: boolean;
  selectedDemoRole: Role;
  session: SessionState | null;
  setSelectedDemoRole: (role: Role) => void;
  signIn: (role: Role) => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

function isRole(value: string | null): value is Role {
  return value === 'tenant' || value === 'owner';
}

function isSessionState(value: unknown): value is SessionState {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as SessionState;

  return isRole(candidate.role) && typeof candidate.token === 'string';
}

export function SessionProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<SessionState | null>(null);
  const [selectedDemoRole, setSelectedDemoRoleState] = useState<Role>('tenant');
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function hydrateSession() {
      const [storedRole, storedSession] = await Promise.all([
        readStoredJson<string | null>(storageKeys.selectedDemoRole, null),
        readSecureJson<SessionState>(storageKeys.sessionSecure),
      ]);

      if (!isMounted) {
        return;
      }

      if (isRole(storedRole)) {
        setSelectedDemoRoleState(storedRole);
      }

      if (isSessionState(storedSession)) {
        setSession(storedSession);
        setSelectedDemoRoleState(storedSession.role);
      }

      setIsHydrated(true);
    }

    hydrateSession();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    writeStoredJson(storageKeys.selectedDemoRole, selectedDemoRole).catch(() => {
      // Ignore persistence failures in demo mode.
    });
  }, [isHydrated, selectedDemoRole]);

  const setSelectedDemoRole = (role: Role) => {
    setSelectedDemoRoleState(role);
  };

  const signIn = async (role: Role) => {
    const nextSession: SessionState = {
      role,
      token: `demo-${role}-session`,
    };

    setSelectedDemoRoleState(role);
    setSession(nextSession);
    await Promise.all([
      writeStoredJson(storageKeys.selectedDemoRole, role),
      writeSecureJson(storageKeys.sessionSecure, nextSession),
    ]);
  };

  const signOut = async () => {
    setSession(null);
    await deleteSecureValue(storageKeys.sessionSecure);
  };

  const clearSessionStorage = async () => {
    setSession(null);
    setSelectedDemoRoleState('tenant');
    await Promise.all([
      deleteSecureValue(storageKeys.sessionSecure),
      removeStoredItem(storageKeys.selectedDemoRole),
    ]);
  };

  return (
    <SessionContext.Provider
      value={{
        clearSessionStorage,
        isAuthenticated: !!session,
        isHydrated,
        selectedDemoRole,
        session,
        setSelectedDemoRole,
        signIn,
        signOut,
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
