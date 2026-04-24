import {
  AuthProvider,
  GoogleAuthPayload,
  RecoveryContactPreference,
  Role,
  SessionState,
  SessionUserProfile,
  SupportRequestStatus,
} from '@/src/types';

export const authRoute = '/auth/login' as const;
export const verificationRoute = '/auth/verify-email' as const;

export const roleHomeRoutes = {
  agency_admin: '/(agency)/home',
  owner: '/(owner)/home',
  tenant: '/(tenant)/home',
} as const;

export const roleRouteGroups = {
  agency_admin: '(agency)',
  owner: '(owner)',
  tenant: '(tenant)',
} as const;

export type RoleRouteGroup = (typeof roleRouteGroups)[Role];

export function isRole(value: string | null): value is Role {
  return value === 'agency_admin' || value === 'tenant' || value === 'owner';
}

function isAuthProvider(value: unknown): value is AuthProvider {
  return value === 'demo' || value === 'google' || value === 'password';
}

export function getHomeRouteForRole(role: Role) {
  return roleHomeRoutes[role];
}

export function getRouteGroupForRole(role: Role): RoleRouteGroup {
  return roleRouteGroups[role];
}

export function isProtectedRoleSegment(segment?: string): segment is RoleRouteGroup {
  return segment === '(agency)' || segment === '(tenant)' || segment === '(owner)';
}

export function createDemoSession(role: Role): SessionState {
  return {
    authProvider: 'demo',
    authProviders: ['demo'],
    kind: 'demo',
    lastAuthenticatedAt: new Date().toISOString(),
    role,
    token: `demo-${role}-session`,
  };
}

export function createGoogleSession(role: Role, payload: GoogleAuthPayload): SessionState {
  return {
    authProvider: 'google',
    authProviders: ['google'],
    firebaseUid: payload.profile.id,
    kind: 'demo',
    lastAuthenticatedAt: new Date().toISOString(),
    profile: payload.profile,
    role,
    token: payload.token,
  };
}

export function createFirebaseSession({
  authProvider,
  authProviders,
  profile,
  role,
  token,
}: {
  authProvider: AuthProvider;
  authProviders: AuthProvider[];
  profile: SessionUserProfile;
  role: Role;
  token: string;
}): SessionState {
  return {
    authProvider,
    authProviders,
    firebaseUid: profile.id,
    kind: 'firebase',
    lastAuthenticatedAt: new Date().toISOString(),
    profile,
    role,
    token,
  };
}

export function updateSessionRole(session: SessionState, role: Role): SessionState {
  return {
    ...session,
    role,
  };
}

function normalizeSessionProfile(value: unknown): SessionUserProfile | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const candidate = value as Partial<SessionUserProfile>;

  if (typeof candidate.id !== 'string' || typeof candidate.email !== 'string') {
    return undefined;
  }

  const normalizeRecoveryPreference = (input: unknown): RecoveryContactPreference | null | undefined =>
    input === 'email' || input === 'phone' ? input : undefined;
  const normalizeSupportRecoveryStatus = (input: unknown): SupportRequestStatus | null | undefined =>
    input === 'submitted' || input === 'in_progress' || input === 'resolved' ? input : undefined;

  return {
    authProviders:
      Array.isArray(candidate.authProviders) &&
      candidate.authProviders.every((provider) => typeof provider === 'string')
        ? candidate.authProviders.filter(isAuthProvider)
        : undefined,
    displayName:
      typeof candidate.displayName === 'string' && candidate.displayName.trim().length > 0
        ? candidate.displayName
        : candidate.email,
    email: candidate.email,
    emailVerified:
      typeof candidate.emailVerified === 'boolean' ? candidate.emailVerified : undefined,
    id: candidate.id,
    ownerId:
      typeof candidate.ownerId === 'string' || candidate.ownerId === null
        ? candidate.ownerId
        : undefined,
    phoneNumber:
      typeof candidate.phoneNumber === 'string' || candidate.phoneNumber === null
        ? candidate.phoneNumber
        : undefined,
    photoUrl:
      typeof candidate.photoUrl === 'string' || candidate.photoUrl === null
        ? candidate.photoUrl
        : undefined,
    recoveryContactPreference: normalizeRecoveryPreference(candidate.recoveryContactPreference),
    status:
      candidate.status === 'active' ||
      candidate.status === 'pending_owner_access' ||
      candidate.status === 'suspended'
        ? candidate.status
        : undefined,
    supportRecoveryStatus: normalizeSupportRecoveryStatus(candidate.supportRecoveryStatus),
    tenantId:
      typeof candidate.tenantId === 'string' || candidate.tenantId === null
        ? candidate.tenantId
        : undefined,
  };
}

export function getInitialsFromName(name: string, fallback = 'AT') {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  return initials || fallback;
}

export function normalizeSessionState(value: unknown): SessionState | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<SessionState> & {
    authProvider?: unknown;
    authProviders?: unknown;
    firebaseUid?: unknown;
    kind?: string;
    lastAuthenticatedAt?: unknown;
    profile?: unknown;
    role?: unknown;
    token?: unknown;
  };

  const role = typeof candidate.role === 'string' ? candidate.role : null;

  if (!isRole(role)) {
    return null;
  }

  if (typeof candidate.token !== 'string' || candidate.token.length === 0) {
    return null;
  }

  const profile = normalizeSessionProfile(candidate.profile);
  const rawKind = typeof candidate.kind === 'string' ? (candidate.kind as string) : undefined;
  const authProviders =
    Array.isArray(candidate.authProviders) &&
    candidate.authProviders.every((provider) => typeof provider === 'string')
      ? candidate.authProviders.filter(isAuthProvider)
      : profile?.authProviders;
  const provider =
    (isAuthProvider(candidate.authProvider) ? candidate.authProvider : null) ??
    (rawKind === 'google'
      ? 'google'
      : rawKind === 'password'
        ? 'password'
        : null) ??
    (authProviders?.includes('password')
      ? 'password'
      : authProviders?.includes('google')
        ? 'google'
        : 'demo');

  if (provider !== 'demo' && !profile) {
    return null;
  }

  return {
    authProvider: provider,
    ...(authProviders?.length ? { authProviders } : {}),
    firebaseUid:
      typeof candidate.firebaseUid === 'string'
        ? candidate.firebaseUid
        : profile?.id,
    kind:
      rawKind === 'firebase' || provider === 'password' ? 'firebase' : 'demo',
    lastAuthenticatedAt:
      typeof candidate.lastAuthenticatedAt === 'string'
        ? candidate.lastAuthenticatedAt
        : new Date().toISOString(),
    ...(profile ? { profile } : {}),
    role,
    token: candidate.token,
  };
}
