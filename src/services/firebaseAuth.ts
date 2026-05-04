import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  fetchSignInMethodsForEmail,
  GoogleAuthProvider,
  linkWithCredential,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  User,
} from 'firebase/auth';

import { getFirebaseUnavailableMessage, isFirebaseConfigured, requireFirebaseAuth } from '@/src/lib/firebase';
import { signInWithGoogle, signOutFromGoogle } from '@/src/services/googleAuth';
import {
  createSessionProfileFromFirebase,
  ensureUserProfileRole,
  getAuthProvidersFromUser,
  getPrimaryAuthProvider,
  syncUserProfileFromAuthUser,
} from '@/src/services/userProfile';
import { AuthProvider, FirebaseUserProfileRecord, Role } from '@/src/types';

type ExistingProvider = 'google' | 'password';

type FirebaseAuthFailureStatus = 'cancelled' | 'error' | 'unavailable';

interface FirebaseAuthSuccessResult {
  status: 'success';
  message: string;
  profile?: FirebaseUserProfileRecord;
  provider?: AuthProvider;
}

interface FirebaseAuthNeedsRoleResult {
  status: 'needs-role';
  message: string;
  profile: FirebaseUserProfileRecord;
  provider: AuthProvider;
}

interface FirebaseAuthNeedsOwnerAccessResult {
  status: 'needs-owner-access';
  message: string;
  profile: FirebaseUserProfileRecord;
  provider: AuthProvider;
}

interface FirebaseAuthNeedsVerificationResult {
  status: 'needs-verification';
  message: string;
  profile: FirebaseUserProfileRecord;
  provider: 'password';
}

interface FirebaseAuthLinkRequiredResult {
  status: 'link-required';
  email: string;
  existingProvider: ExistingProvider;
  message: string;
}

interface FirebaseAuthFailureResult {
  code?: string;
  message: string;
  status: FirebaseAuthFailureStatus;
}

export type FirebaseAuthResult =
  | FirebaseAuthSuccessResult
  | FirebaseAuthNeedsRoleResult
  | FirebaseAuthNeedsOwnerAccessResult
  | FirebaseAuthNeedsVerificationResult
  | FirebaseAuthLinkRequiredResult
  | FirebaseAuthFailureResult;

interface SignUpWithEmailPasswordInput {
  displayName: string;
  email: string;
  password: string;
  role: Role;
}

interface SignInWithEmailPasswordInput {
  email: string;
  password: string;
  preferredRole?: Role;
}

let pendingGoogleCredential: ReturnType<typeof GoogleAuthProvider.credential> | null = null;
let pendingGoogleEmail: string | null = null;

function getAuthErrorCode(error: unknown) {
  if (!error || typeof error !== 'object' || !('code' in error)) {
    return undefined;
  }

  const candidate = error as { code?: unknown };

  return typeof candidate.code === 'string' ? candidate.code : undefined;
}

function mapAuthErrorMessage(error: unknown, fallback: string) {
  const code = getAuthErrorCode(error);

  switch (code) {
    case 'auth/account-exists-with-different-credential':
      return 'Ce compte existe déjà avec un autre mode de connexion.';
    case 'auth/email-already-in-use':
      return 'Cette adresse e-mail est déjà utilisée.';
    case 'auth/invalid-credential':
      return 'Les identifiants sont invalides ou expirés.';
    case 'auth/invalid-email':
      return 'Adresse e-mail invalide.';
    case 'auth/missing-password':
      return 'Le mot de passe est requis.';
    case 'auth/network-request-failed':
      return 'Le réseau est indisponible. Réessayez depuis une connexion stable.';
    case 'auth/too-many-requests':
      return 'Trop de tentatives. Réessayez un peu plus tard.';
    case 'auth/user-disabled':
      return 'Ce compte a été désactivé.';
    case 'auth/user-not-found':
      return 'Aucun compte ne correspond à cette adresse e-mail.';
    case 'auth/weak-password':
      return 'Le mot de passe doit être plus robuste.';
    case 'auth/wrong-password':
      return 'Mot de passe incorrect.';
    default:
      return fallback;
  }
}

function getExistingProviderFromMethods(methods: string[]): ExistingProvider {
  if (methods.includes('google.com')) {
    return 'google';
  }

  return 'password';
}

async function resolvePostAuthState(
  user: User,
  providerHint: AuthProvider,
  options: {
    displayName?: string;
    role?: Role;
  } = {},
): Promise<FirebaseAuthResult> {
  let profile = await syncUserProfileFromAuthUser(user);

  if (!profile.role && options.role) {
    profile = await ensureUserProfileRole(user, options.role);
  }

  if (!profile.role) {
    return {
      message: 'Choisissez Locataire ou Propriétaire pour finaliser votre espace ATouPay.',
      profile,
      provider: getPrimaryAuthProvider(profile.authProviders, providerHint),
      status: 'needs-role',
    };
  }

  const resolvedProvider = getPrimaryAuthProvider(profile.authProviders, providerHint);

  if (profile.role === 'owner' && profile.status === 'pending_owner_access') {
    return {
      message:
        'Votre compte propriétaire est authentifié mais reste bloqué jusqu’à validation d’un code d’accès agence.',
      profile,
      provider: resolvedProvider,
      status: 'needs-owner-access',
    };
  }

  if (resolvedProvider === 'password' && !user.emailVerified) {
    return {
      message:
        'Vérifiez votre adresse e-mail pour activer votre session ATouPay, puis revenez dans l’application.',
      profile,
      provider: 'password',
      status: 'needs-verification',
    };
  }

  return {
    message: 'Connexion confirmée.',
    profile,
    provider: resolvedProvider,
    status: 'success',
  };
}

export function isFirebaseAuthAvailable() {
  return isFirebaseConfigured;
}

export function getFirebaseAuthUnavailableMessage() {
  return getFirebaseUnavailableMessage();
}

export function getCurrentFirebaseUser() {
  if (!isFirebaseConfigured) {
    return null;
  }

  return requireFirebaseAuth().currentUser;
}

export async function signUpWithEmailPassword(
  input: SignUpWithEmailPasswordInput,
): Promise<FirebaseAuthResult> {
  if (!isFirebaseConfigured) {
    return {
      message:
        getFirebaseUnavailableMessage() ??
        'Firebase Auth n’est pas disponible dans cette build.',
      status: 'unavailable',
    };
  }

  const auth = requireFirebaseAuth();
  const email = input.email.trim().toLowerCase();
  const displayName = input.displayName.trim();
  const currentUser = auth.currentUser;

  if (
    currentUser &&
    currentUser.email?.toLowerCase() === email &&
    !currentUser.providerData.some((provider) => provider.providerId === 'password')
  ) {
    try {
      const linkedUser = await linkPasswordToCurrentUser(email, input.password);

      if (displayName.length > 0) {
        await updateProfile(linkedUser, { displayName });
      }

      return resolvePostAuthState(linkedUser, 'password', {
        displayName,
        role: input.role,
      });
    } catch (error) {
      return {
        code: getAuthErrorCode(error),
        message: mapAuthErrorMessage(
          error,
          'Le mot de passe n’a pas pu être associé à ce compte Google.',
        ),
        status: 'error',
      };
    }
  }

  try {
    const methods = await fetchSignInMethodsForEmail(auth, email);

    if (methods.includes('google.com') && !methods.includes('password')) {
      return {
        email,
        existingProvider: 'google',
        message:
          'Ce compte existe déjà avec Google. Connectez-vous d’abord avec Google pour relier un mot de passe au même utilisateur.',
        status: 'link-required',
      };
    }

    const credential = await createUserWithEmailAndPassword(auth, email, input.password);

    if (displayName.length > 0) {
      await updateProfile(credential.user, { displayName });
    }

    await sendEmailVerification(credential.user);

    return resolvePostAuthState(credential.user, 'password', {
      displayName,
      role: input.role,
    });
  } catch (error) {
    if (getAuthErrorCode(error) === 'auth/email-already-in-use') {
      try {
        const credential = await signInWithEmailAndPassword(auth, email, input.password);

        await linkGoogleToExistingPasswordAccountIfNeeded(credential.user);

        // Existing accounts keep their stored backend role, so agency credentials
        // entered from owner/tenant screens still route to the agency area.
        return resolvePostAuthState(credential.user, 'password');
      } catch (signInError) {
        return {
          code: getAuthErrorCode(signInError),
          message: mapAuthErrorMessage(
            signInError,
            'Ce compte existe déjà. Connectez-vous avec le bon mot de passe.',
          ),
          status: 'error',
        };
      }
    }

    return {
      code: getAuthErrorCode(error),
      message: mapAuthErrorMessage(error, 'La création du compte a échoué.'),
      status: 'error',
    };
  }
}

export async function signInWithEmailPassword(
  input: SignInWithEmailPasswordInput,
): Promise<FirebaseAuthResult> {
  if (!isFirebaseConfigured) {
    return {
      message:
        getFirebaseUnavailableMessage() ??
        'Firebase Auth n’est pas disponible dans cette build.',
      status: 'unavailable',
    };
  }

  const auth = requireFirebaseAuth();
  const email = input.email.trim().toLowerCase();

  try {
    const credential = await signInWithEmailAndPassword(auth, email, input.password);

    await linkGoogleToExistingPasswordAccountIfNeeded(credential.user);

    return resolvePostAuthState(credential.user, 'password', {
      role: input.preferredRole,
    });
  } catch (error) {
    return {
      code: getAuthErrorCode(error),
      message: mapAuthErrorMessage(error, 'La connexion e-mail a échoué.'),
      status: 'error',
    };
  }
}

export async function signInWithGoogleFirebaseBridge(
  preferredRole?: Role,
): Promise<FirebaseAuthResult> {
  if (!isFirebaseConfigured) {
    return {
      message:
        getFirebaseUnavailableMessage() ??
        'Firebase Auth n’est pas disponible dans cette build.',
      status: 'unavailable',
    };
  }

  const nativeResult = await signInWithGoogle();

  if (nativeResult.status !== 'success') {
    return nativeResult;
  }

  const auth = requireFirebaseAuth();
  const idToken = nativeResult.payload.idToken ?? null;
  const accessToken = nativeResult.payload.accessToken ?? null;

  if (!idToken && !accessToken) {
    return {
      message:
        'Google a répondu sans jeton exploitable pour Firebase. Vérifiez la configuration OAuth du projet.',
      status: 'error',
    };
  }

  const credential = GoogleAuthProvider.credential(idToken, accessToken);

  try {
    const userCredential = await signInWithCredential(auth, credential);
    let profile = await syncUserProfileFromAuthUser(userCredential.user);

    if (!profile.role && preferredRole) {
      profile = await ensureUserProfileRole(userCredential.user, preferredRole);
    }

    if (!profile.role) {
      return {
        message: 'Choisissez votre rôle applicatif pour finaliser votre espace ATouPay.',
        profile,
        provider: 'google',
        status: 'needs-role',
      };
    }

    return {
      message: 'Connexion Google confirmée.',
      profile,
      provider: getPrimaryAuthProvider(profile.authProviders, 'google'),
      status: 'success',
    };
  } catch (error) {
    const code = getAuthErrorCode(error);
    const email = nativeResult.payload.profile.email.toLowerCase();

    if (code === 'auth/account-exists-with-different-credential') {
      const methods = await fetchSignInMethodsForEmail(auth, email).catch(() => []);
      const existingProvider = getExistingProviderFromMethods(methods);

      pendingGoogleCredential = GoogleAuthProvider.credential(idToken, accessToken);
      pendingGoogleEmail = email;

      return {
        email,
        existingProvider,
        message:
          existingProvider === 'password'
            ? 'Ce compte existe déjà avec e-mail et mot de passe. Connectez-vous d’abord avec ce mot de passe pour relier Google.'
            : 'Ce compte Google existe déjà. Reprenez la connexion avec Google pour relancer la session.',
        status: 'link-required',
      };
    }

    return {
      code,
      message: mapAuthErrorMessage(
        error,
        'La connexion Google n’a pas pu être associée à Firebase.',
      ),
      status: 'error',
    };
  }
}

export async function linkGoogleToExistingPasswordAccountIfNeeded(user?: User | null) {
  if (!pendingGoogleCredential) {
    return null;
  }

  if (!user) {
    const auth = requireFirebaseAuth();
    user = auth.currentUser;
  }

  if (!user) {
    return null;
  }

  const currentEmail = user.email?.trim().toLowerCase();

  if (!currentEmail || !pendingGoogleEmail || currentEmail !== pendingGoogleEmail) {
    return null;
  }

  if (user.providerData.some((provider) => provider.providerId === 'google.com')) {
    pendingGoogleCredential = null;
    pendingGoogleEmail = null;
    return syncUserProfileFromAuthUser(user);
  }

  await linkWithCredential(user, pendingGoogleCredential);
  pendingGoogleCredential = null;
  pendingGoogleEmail = null;

  return syncUserProfileFromAuthUser(user);
}

export async function linkPasswordToCurrentUser(email: string, password: string) {
  const auth = requireFirebaseAuth();
  const user = auth.currentUser;

  if (!user || !user.email) {
    throw new Error('Aucun utilisateur Firebase n’est connecté.');
  }

  if (user.email.trim().toLowerCase() !== email.trim().toLowerCase()) {
    throw new Error('Le compte connecté ne correspond pas à cette adresse e-mail.');
  }

  if (user.providerData.some((provider) => provider.providerId === 'password')) {
    return user;
  }

  const credential = EmailAuthProvider.credential(email, password);
  const linkResult = await linkWithCredential(user, credential);

  return linkResult.user;
}

export async function sendPasswordReset({
  email,
}: {
  email: string;
}): Promise<FirebaseAuthResult> {
  if (!isFirebaseConfigured) {
    return {
      message:
        getFirebaseUnavailableMessage() ??
        'Firebase Auth n’est pas disponible dans cette build.',
      status: 'unavailable',
    };
  }

  try {
    await sendPasswordResetEmail(requireFirebaseAuth(), email.trim().toLowerCase());

    return {
      message:
        'Si cette adresse existe, un e-mail de réinitialisation vient d’être envoyé.',
      status: 'success',
    };
  } catch (error) {
    return {
      code: getAuthErrorCode(error),
      message: mapAuthErrorMessage(
        error,
        'La demande de réinitialisation a échoué.',
      ),
      status: 'error',
    };
  }
}

export async function resendVerificationEmail(): Promise<FirebaseAuthResult> {
  if (!isFirebaseConfigured) {
    return {
      message:
        getFirebaseUnavailableMessage() ??
        'Firebase Auth n’est pas disponible dans cette build.',
      status: 'unavailable',
    };
  }

  const auth = requireFirebaseAuth();
  const user = auth.currentUser;

  if (!user) {
    return {
      message: 'Aucun compte connecté ne peut recevoir un e-mail de vérification.',
      status: 'error',
    };
  }

  try {
    await sendEmailVerification(user);

    return {
      message: 'Un nouvel e-mail de vérification vient d’être envoyé.',
      profile: await syncUserProfileFromAuthUser(user),
      provider: getPrimaryAuthProvider(getAuthProvidersFromUser(user), 'password'),
      status: 'success',
    };
  } catch (error) {
    return {
      code: getAuthErrorCode(error),
      message: mapAuthErrorMessage(
        error,
        'L’e-mail de vérification n’a pas pu être renvoyé.',
      ),
      status: 'error',
    };
  }
}

export async function refreshCurrentUser(): Promise<FirebaseAuthResult> {
  if (!isFirebaseConfigured) {
    return {
      message:
        getFirebaseUnavailableMessage() ??
        'Firebase Auth n’est pas disponible dans cette build.',
      status: 'unavailable',
    };
  }

  const auth = requireFirebaseAuth();
  const user = auth.currentUser;

  if (!user) {
    return {
      message: 'Aucun utilisateur Firebase n’est connecté.',
      status: 'error',
    };
  }

  try {
    await reload(user);

    return resolvePostAuthState(auth.currentUser ?? user, 'password');
  } catch (error) {
    return {
      code: getAuthErrorCode(error),
      message: mapAuthErrorMessage(error, 'Le rafraîchissement du compte a échoué.'),
      status: 'error',
    };
  }
}

export async function signOutFromFirebase() {
  if (!isFirebaseConfigured) {
    return;
  }

  await signOut(requireFirebaseAuth());
}

export async function signOutCompletely(authProvider?: AuthProvider) {
  await signOutFromFirebase();

  if (authProvider === 'google') {
    await signOutFromGoogle();
  }
}

export function getCurrentFirebaseSessionProfile() {
  const user = getCurrentFirebaseUser();

  if (!user) {
    return null;
  }

  return createSessionProfileFromFirebase(user);
}
