import { User } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';

import { isBackendEnabled } from '@/src/config/env';
import { requireFirestore } from '@/src/lib/firebase';
import { bootstrapProfileViaBackend } from '@/src/services/backendApi';
import {
  AuthProvider,
  FirebaseUserProfileRecord,
  OwnerRecord,
  RecoveryContactPreference,
  Role,
  SessionUserProfile,
  SupportRequestStatus,
  UserStatus,
} from '@/src/types';

const profileReadRetryDelayMs = 250;
const profileReadRetryCount = 3;

function mapProviderId(providerId: string): AuthProvider | null {
  if (providerId === 'google.com') {
    return 'google';
  }

  if (providerId === 'password') {
    return 'password';
  }

  if (providerId === 'phone') {
    return 'phone';
  }

  return null;
}

function normalizeDateValue(value: unknown) {
  if (!value) {
    return undefined;
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    const candidate = value as { toDate?: () => Date };

    if (typeof candidate.toDate === 'function') {
      return candidate.toDate().toISOString();
    }
  }

  return undefined;
}

function normalizeNullableString(value: unknown) {
  return typeof value === 'string' || value === null ? value : undefined;
}

function normalizeRole(value: unknown): Role | undefined {
  return value === 'agency_admin' || value === 'tenant' || value === 'owner'
    ? value
    : undefined;
}

function normalizeStatus(value: unknown): UserStatus {
  return value === 'pending_owner_access' || value === 'suspended' ? value : 'active';
}

function normalizeRecoveryContactPreference(value: unknown): RecoveryContactPreference | null {
  return value === 'email' || value === 'phone' ? value : null;
}

function normalizeSupportRecoveryStatus(value: unknown): SupportRequestStatus | null {
  return value === 'submitted' || value === 'in_progress' || value === 'resolved' ? value : null;
}

function normalizeAuthProviders(value: unknown): AuthProvider[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (provider): provider is AuthProvider =>
      provider === 'google' || provider === 'password' || provider === 'demo',
  );
}

function userFallbackName(emailValue: unknown) {
  return typeof emailValue === 'string' && emailValue.length > 0
    ? emailValue
    : 'Compte ATouPay';
}

function isPermissionDeniedError(error: unknown) {
  if (!error || typeof error !== 'object' || !('code' in error)) {
    return false;
  }

  const candidate = error as { code?: unknown };

  return candidate.code === 'permission-denied' || candidate.code === 'firestore/permission-denied';
}

async function delay(ms: number) {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function buildProfileSnapshot(input: {
  agencyId?: string | null;
  authProviders: AuthProvider[];
  createdAt?: string;
  displayName: string;
  email: string;
  emailVerified: boolean;
  ownerId?: string | null;
  phoneNumber?: string | null;
  photoURL?: string | null;
  recoveryContactPreference?: RecoveryContactPreference | null;
  role?: Role;
  status: UserStatus;
  supportRecoveryStatus?: SupportRequestStatus | null;
  tenantId?: string | null;
  uid: string;
  updatedAt?: string;
}): FirebaseUserProfileRecord {
  return {
    agencyId: input.agencyId ?? null,
    authProviders: input.authProviders,
    createdAt: input.createdAt ?? new Date().toISOString(),
    displayName: input.displayName,
    email: input.email,
    emailVerified: input.emailVerified,
    ownerId: input.ownerId ?? null,
    phoneNumber: input.phoneNumber ?? null,
    photoURL: input.photoURL ?? null,
    recoveryContactPreference: input.recoveryContactPreference ?? null,
    role: input.role,
    status: input.status,
    supportRecoveryStatus: input.supportRecoveryStatus ?? null,
    tenantId: input.tenantId ?? null,
    uid: input.uid,
    updatedAt: input.updatedAt ?? new Date().toISOString(),
  };
}

export function getAuthProvidersFromUser(user: User): AuthProvider[] {
  const providers = user.providerData
    .map((provider) => mapProviderId(provider.providerId))
    .filter((value): value is AuthProvider => value !== null);

  return Array.from(new Set(providers));
}

export function getPrimaryAuthProvider(
  providers: AuthProvider[],
  fallback?: AuthProvider,
): AuthProvider {
  if (fallback && providers.includes(fallback)) {
    return fallback;
  }

  if (providers.length === 1) {
    return providers[0];
  }

  if (providers.includes('password')) {
    return 'password';
  }

  if (providers.includes('google')) {
    return 'google';
  }

  return 'demo';
}

export function createSessionProfileFromFirebase(
  user: User,
  profileRecord?: FirebaseUserProfileRecord | null,
): SessionUserProfile {
  const authProviders = profileRecord?.authProviders?.length
    ? profileRecord.authProviders
    : getAuthProvidersFromUser(user);

  return {
    agencyId: profileRecord?.agencyId ?? null,
    authProviders,
    displayName:
      user.displayName ??
      profileRecord?.displayName ??
      user.email ??
      'Compte ATouPay',
    email: user.email ?? profileRecord?.email ?? 'email indisponible',
    emailVerified: user.emailVerified,
    id: user.uid,
    ownerId: profileRecord?.ownerId ?? null,
    phoneNumber: profileRecord?.phoneNumber ?? null,
    photoUrl: user.photoURL ?? profileRecord?.photoURL ?? null,
    recoveryContactPreference: profileRecord?.recoveryContactPreference ?? null,
    status: profileRecord?.status ?? 'active',
    supportRecoveryStatus: profileRecord?.supportRecoveryStatus ?? null,
    tenantId: profileRecord?.tenantId ?? null,
  };
}

export async function getOwnerProfile(ownerId: string): Promise<OwnerRecord | null> {
  const db = requireFirestore();
  const snapshot = await getDoc(doc(db, 'owners', ownerId));

  if (!snapshot.exists()) {
    return null;
  }

  const data = snapshot.data();

  return {
    agencyId: normalizeNullableString(data.agencyId),
    createdAt: normalizeDateValue(data.createdAt),
    displayName:
      typeof data.displayName === 'string' && data.displayName.trim().length > 0
        ? data.displayName
        : 'Propriétaire ATouPay',
    id: ownerId,
    updatedAt: normalizeDateValue(data.updatedAt),
    userId: typeof data.userId === 'string' ? data.userId : ownerId,
  };
}

export async function getUserProfile(uid: string): Promise<FirebaseUserProfileRecord | null> {
  const db = requireFirestore();
  const snapshot = await getDoc(doc(db, 'users', uid));

  if (!snapshot.exists()) {
    return null;
  }

  const data = snapshot.data();

  return {
    agencyId: normalizeNullableString(data.agencyId),
    authProviders: normalizeAuthProviders(data.authProviders),
    createdAt: normalizeDateValue(data.createdAt),
    displayName:
      typeof data.displayName === 'string' && data.displayName.trim().length > 0
        ? data.displayName
        : userFallbackName(data.email),
    email: typeof data.email === 'string' ? data.email : 'email indisponible',
    emailVerified: data.emailVerified === true,
    ownerId: normalizeNullableString(data.ownerId),
    phoneNumber: normalizeNullableString(data.phoneNumber),
    photoURL:
      typeof data.photoURL === 'string' || data.photoURL === null ? data.photoURL : null,
    recoveryContactPreference: normalizeRecoveryContactPreference(data.recoveryContactPreference),
    role: normalizeRole(data.role),
    status: normalizeStatus(data.status),
    supportRecoveryStatus: normalizeSupportRecoveryStatus(data.supportRecoveryStatus),
    tenantId: normalizeNullableString(data.tenantId),
    uid,
    updatedAt: normalizeDateValue(data.updatedAt),
  };
}

async function getUserProfileWithRetry(
  uid: string,
  options?: {
    allowPermissionDeniedFallback?: boolean;
  },
) {
  let lastError: unknown;

  for (let attempt = 0; attempt < profileReadRetryCount; attempt += 1) {
    try {
      return await getUserProfile(uid);
    } catch (error) {
      lastError = error;

      if (!isPermissionDeniedError(error)) {
        throw error;
      }

      if (attempt < profileReadRetryCount - 1) {
        // Firebase Auth and Firestore can momentarily disagree right after sign-in.
        await delay(profileReadRetryDelayMs);
        continue;
      }
    }
  }

  if (options?.allowPermissionDeniedFallback && isPermissionDeniedError(lastError)) {
    return null;
  }

  throw lastError;
}

async function syncOwnerProfile(user: User, displayName: string) {
  const db = requireFirestore();
  const existingOwner = await getOwnerProfile(user.uid);

  await setDoc(
    doc(db, 'owners', user.uid),
    {
      ...(existingOwner ? {} : { createdAt: serverTimestamp() }),
      displayName,
      updatedAt: serverTimestamp(),
      userId: user.uid,
    },
    { merge: true },
  );
}

interface SyncUserProfileOptions {
  displayName?: string;
  role?: Role;
}

export async function syncUserProfileFromAuthUser(
  user: User,
  options: SyncUserProfileOptions = {},
): Promise<FirebaseUserProfileRecord> {
  const db = requireFirestore();
  const existingProfile = await getUserProfileWithRetry(user.uid, {
    allowPermissionDeniedFallback: isBackendEnabled,
  });

  if (!user.email && !existingProfile?.email) {
    throw new Error('Le compte Firebase ne fournit pas d’adresse e-mail exploitable.');
  }

  const authProviders = Array.from(
    new Set([
      ...getAuthProvidersFromUser(user),
      ...(existingProfile?.authProviders ?? []),
    ]),
  ).filter((provider) => provider !== 'demo');

  const displayName =
    options.displayName?.trim() ||
    user.displayName ||
    existingProfile?.displayName ||
    user.email ||
    'Compte ATouPay';
  const email = user.email ?? existingProfile?.email ?? '';
  const role = options.role ?? existingProfile?.role;
  const photoURL = user.photoURL ?? existingProfile?.photoURL ?? null;
  const shouldBlockOwnerActivationWithoutBackend =
    !isBackendEnabled && role === 'owner' && !existingProfile?.ownerId;
  const ownerId =
    existingProfile?.ownerId ??
    (role === 'owner' && !shouldBlockOwnerActivationWithoutBackend ? user.uid : null);
  const tenantId = existingProfile?.tenantId ?? null;
  const phoneNumber = existingProfile?.phoneNumber ?? null;
  const recoveryContactPreference = existingProfile?.recoveryContactPreference ?? null;
  const supportRecoveryStatus = existingProfile?.supportRecoveryStatus ?? null;
  const status: UserStatus =
    existingProfile?.status ?? (shouldBlockOwnerActivationWithoutBackend ? 'pending_owner_access' : 'active');
  const agencyId = existingProfile?.agencyId ?? null;

  if (isBackendEnabled) {
    if (existingProfile?.status === 'suspended') {
      return buildProfileSnapshot({
        agencyId,
        authProviders,
        createdAt: existingProfile.createdAt,
        displayName,
        email,
        emailVerified: user.emailVerified,
        ownerId,
        phoneNumber,
        photoURL,
        recoveryContactPreference,
        role,
        status: 'suspended',
        supportRecoveryStatus,
        tenantId,
        uid: user.uid,
        updatedAt: existingProfile.updatedAt,
      });
    }

    if (role) {
      await bootstrapProfileViaBackend(role);
      const syncedProfile = await getUserProfileWithRetry(user.uid, {
        allowPermissionDeniedFallback: true,
      });

      if (syncedProfile) {
        return syncedProfile;
      }
    } else if (existingProfile) {
      return buildProfileSnapshot({
        agencyId: existingProfile.agencyId ?? null,
        authProviders,
        createdAt: existingProfile.createdAt,
        displayName,
        email,
        emailVerified: user.emailVerified,
        ownerId: existingProfile.ownerId ?? null,
        phoneNumber,
        photoURL,
        recoveryContactPreference,
        role: existingProfile.role,
        status,
        supportRecoveryStatus,
        tenantId: existingProfile.tenantId ?? null,
        uid: user.uid,
        updatedAt: existingProfile.updatedAt,
      });
    }

    return buildProfileSnapshot({
      agencyId,
      authProviders,
      createdAt: existingProfile?.createdAt,
      displayName,
      email,
      emailVerified: user.emailVerified,
      ownerId,
      phoneNumber,
      photoURL,
      recoveryContactPreference,
      role,
      status,
      supportRecoveryStatus,
      tenantId,
      uid: user.uid,
      updatedAt: existingProfile?.updatedAt,
    });
  }

  await setDoc(
    doc(db, 'users', user.uid),
    {
      authProviders,
      agencyId,
      ...(existingProfile ? {} : { createdAt: serverTimestamp() }),
      displayName,
      email,
      emailVerified: user.emailVerified,
      ownerId,
      phoneNumber,
      photoURL,
      recoveryContactPreference,
      ...(role ? { role } : {}),
      status,
      supportRecoveryStatus,
      tenantId,
      uid: user.uid,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  if (role === 'owner' && status === 'active') {
    await syncOwnerProfile(user, displayName);
  }

  return {
    agencyId,
    authProviders,
    createdAt: existingProfile?.createdAt ?? new Date().toISOString(),
    displayName,
    email,
    emailVerified: user.emailVerified,
    ownerId,
    phoneNumber,
    photoURL,
    recoveryContactPreference,
    role,
    status,
    supportRecoveryStatus,
    tenantId,
    uid: user.uid,
    updatedAt: new Date().toISOString(),
  };
}

export async function ensureUserProfileRole(user: User, role: Role) {
  return syncUserProfileFromAuthUser(user, { role });
}
