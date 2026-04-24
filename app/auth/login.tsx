import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { BannerNotice } from '@/src/components/BannerNotice';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { AuthCard } from '@/src/components/auth/AuthCard';
import { AuthField, AuthFieldAccessoryButton } from '@/src/components/auth/AuthField';
import { RoleSelector } from '@/src/components/auth/RoleSelector';
import { AuthScreen } from '@/src/components/auth/AuthScreen';
import { appConfig, isBackendEnabled, isDebugToolsEnabled } from '@/src/config/env';
import { useAppContext } from '@/src/context/AppProvider';
import { useSession } from '@/src/context/SessionProvider';
import { checkBackendHealth, mapBackendErrorToMessage } from '@/src/services/backendApi';
import {
  getFirebaseAuthUnavailableMessage,
  isFirebaseAuthAvailable,
  signInWithEmailPassword,
  signInWithGoogleFirebaseBridge,
  signUpWithEmailPassword,
} from '@/src/services/firebaseAuth';
import {
  getGoogleSignInUnavailableMessage,
  isGoogleSignInAvailable,
  signInWithGoogle,
} from '@/src/services/googleAuth';
import {
  storePendingOwnerAccessCode,
} from '@/src/services/pendingOwnerAccess';
import { colors } from '@/src/theme/colors';
import { radius } from '@/src/theme/radius';
import { spacing } from '@/src/theme/spacing';
import { typography } from '@/src/theme/typography';
import { BannerTone, Role } from '@/src/types';
import { isValidEmail, isValidPassword } from '@/src/utils/auth';
import { getHomeRouteForRole } from '@/src/utils/session';

interface FeedbackState {
  description: string;
  title: string;
  tone: BannerTone;
}

interface ClipboardCredentials {
  email: string;
  password: string;
  role?: Role;
}

type AuthMode = 'signin' | 'signup';
type ActiveAction = 'demo-owner' | 'demo-tenant' | 'email' | 'google' | 'role' | null;

interface RoleJourneyCopy {
  authDescription: string;
  authTitle: string;
  helper: string;
  roleDescription: string;
  roleTitle: string;
}

const roleJourneyCopy: Record<Role, RoleJourneyCopy> = {
  agency_admin: {
    authDescription:
      'Connectez-vous à l’espace agence pour gérer les accès propriétaires, la commission et les reçus simulés.',
    authTitle: 'Accéder à l’espace agence',
    helper:
      'Un accès administrateur agence doit être initialisé au préalable par le bootstrap sécurisé de la plateforme.',
    roleDescription:
      'Choisissez ce parcours si vous administrez une agence et opérez les invitations propriétaires.',
    roleTitle: 'Je suis agence',
  },
  owner: {
    authDescription:
      'Créez ou retrouvez votre compte propriétaire, puis activez-le avec le code d’accès transmis par l’agence.',
    authTitle: 'Accéder à l’espace propriétaire',
    helper:
      'Vous pourrez créer vos biens, ouvrir des unités et partager une invitation unique par logement après validation agence.',
    roleDescription:
      'Choisissez ce parcours si vous gérez des biens et rattachez ensuite chaque locataire par invitation.',
    roleTitle: 'Je suis propriétaire',
  },
  tenant: {
    authDescription:
      'Créez ou retrouvez votre espace locataire, puis rejoignez votre logement via un code ou un lien d’invitation.',
    authTitle: 'Accéder à l’espace locataire',
    helper:
      'Vous ne choisirez pas un appartement librement: votre logement vous sera attribué uniquement via invitation.',
    roleDescription:
      'Choisissez ce parcours si vous rejoignez une unité invitée et suivez ensuite vos loyers simulés.',
    roleTitle: 'Je suis locataire',
  },
};

function GoogleMark() {
  return (
    <View style={styles.googleMark}>
      <Text style={styles.googleMarkText}>G</Text>
    </View>
  );
}

function parseClipboardCredentials(rawValue: string): ClipboardCredentials | null {
  const trimmedValue = rawValue.trim();

  if (!trimmedValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmedValue) as Partial<ClipboardCredentials>;

    if (typeof parsed.email !== 'string' || typeof parsed.password !== 'string') {
      return null;
    }

    return {
      email: parsed.email,
      password: parsed.password,
      role:
        parsed.role === 'agency_admin' || parsed.role === 'owner' || parsed.role === 'tenant'
          ? parsed.role
          : undefined,
    };
  } catch {
    return null;
  }
}

function getRoleLabel(role: Role) {
  if (role === 'agency_admin') {
    return 'agence';
  }

  return role === 'owner' ? 'propriétaire' : 'locataire';
}

function AuthModeToggle({
  mode,
  onChange,
}: {
  mode: AuthMode;
  onChange: (value: AuthMode) => void;
}) {
  return (
    <View style={styles.modeToggle}>
      {[
        { label: 'Se connecter', value: 'signin' as const },
        { label: 'Créer un compte', value: 'signup' as const },
      ].map((option) => {
        const selected = option.value === mode;

        return (
          <Pressable
            accessibilityHint={`Affiche le formulaire ${option.label.toLowerCase()}`}
            accessibilityLabel={option.label}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            key={option.value}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.modeOption,
              selected && styles.modeOptionSelected,
              pressed && styles.pressed,
            ]}>
            <Text style={[styles.modeOptionText, selected && styles.modeOptionTextSelected]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function LoginScreen() {
  const { admin, invite, mode, ownerInvite, role } = useLocalSearchParams<{
    admin?: string;
    invite?: string;
    mode?: string;
    ownerInvite?: string;
    role?: string;
  }>();
  const [authMode, setAuthMode] = useState<AuthMode>(mode === 'signup' ? 'signup' : 'signin');
  const [activeAction, setActiveAction] = useState<ActiveAction>(null);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [displayNameError, setDisplayNameError] = useState<string | null>(null);
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | null>(null);
  const [backendNotice, setBackendNotice] = useState<FeedbackState | null>(null);
  const [ownerAccessCode, setOwnerAccessCode] = useState('');
  const {
    clearAuthDebug,
    completePendingRoleSelection,
    isFirebaseEnabled,
    lastAuthEvent,
    needsRoleSelection,
    pendingProfile,
    reportAuthEvent,
    selectedDemoRole,
    setSelectedDemoRole,
    signIn,
    signInWithGoogle: createLegacyGoogleSession,
  } = useSession();
  const { savePendingInviteCode } = useAppContext();

  const firebaseAvailable = isFirebaseAuthAvailable();
  const googleAvailable = isGoogleSignInAvailable();
  const googleUnavailableMessage = getGoogleSignInUnavailableMessage();
  const firebaseUnavailableMessage = getFirebaseAuthUnavailableMessage();
  const hasInvite = typeof invite === 'string' && invite.trim().length > 0;
  const hasOwnerInvite =
    typeof ownerInvite === 'string' && ownerInvite.trim().length > 0;
  const isAgencyAdminEntry =
    !hasInvite &&
    !hasOwnerInvite &&
    (admin === '1' || role === 'agency_admin');
  const roleCopy = roleJourneyCopy[selectedDemoRole];

  useEffect(() => {
    if (mode === 'signup') {
      setAuthMode('signup');
    }
  }, [mode]);

  useEffect(() => {
    if (hasInvite) {
      setSelectedDemoRole('tenant');
      void savePendingInviteCode(invite);
    }
  }, [hasInvite, invite, savePendingInviteCode, setSelectedDemoRole]);

  useEffect(() => {
    if (hasOwnerInvite) {
      setSelectedDemoRole('owner');
      setOwnerAccessCode(ownerInvite.trim().toUpperCase());
      void storePendingOwnerAccessCode(ownerInvite);
    }
  }, [hasOwnerInvite, ownerInvite, setSelectedDemoRole]);

  useEffect(() => {
    if (isAgencyAdminEntry) {
      setSelectedDemoRole('agency_admin');
      return;
    }

    if (!hasInvite && !hasOwnerInvite && selectedDemoRole === 'agency_admin') {
      setSelectedDemoRole('tenant');
    }
  }, [
    hasInvite,
    hasOwnerInvite,
    isAgencyAdminEntry,
    selectedDemoRole,
    setSelectedDemoRole,
  ]);

  useEffect(() => {
    if (!isBackendEnabled) {
      setBackendNotice(null);
      return;
    }

    let isMounted = true;

    void checkBackendHealth()
      .then(() => {
        if (!isMounted) {
          return;
        }

        setBackendNotice({
          description: `Les écritures critiques utilisent ${appConfig.apiBaseUrl}.`,
          title: 'Backend opérationnel',
          tone: 'info',
        });
      })
      .catch((error) => {
        if (!isMounted) {
          return;
        }

        setBackendNotice({
          description: mapBackendErrorToMessage(
            error,
            'Le backend local ne répond pas encore sur cette plateforme.',
          ),
          title: 'Backend indisponible',
          tone: 'error',
        });
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const availabilityNotice = useMemo(() => {
    if (feedback) {
      return feedback;
    }

    if (!firebaseAvailable && firebaseUnavailableMessage) {
      return {
        description: firebaseUnavailableMessage,
        title: 'Configuration Firebase incomplète',
        tone: 'info' as const,
      };
    }

    if (!googleAvailable && googleUnavailableMessage) {
      return {
        description: googleUnavailableMessage,
        title: 'Connexion Google indisponible',
        tone: 'info' as const,
      };
    }

    return null;
  }, [feedback, firebaseAvailable, firebaseUnavailableMessage, googleAvailable, googleUnavailableMessage]);

  const clearFieldErrors = () => {
    setDisplayNameError(null);
    setEmailError(null);
    setPasswordError(null);
    setConfirmPasswordError(null);
  };

  const handleModeChange = (value: AuthMode) => {
    setAuthMode(value);
    setFeedback(null);
    clearFieldErrors();
  };

  const handleRoleChange = (role: Role) => {
    if (hasInvite) {
      setFeedback({
        description:
          'Une invitation locataire a été détectée. Le parcours reste verrouillé côté locataire pour terminer le rattachement.',
        title: 'Rôle prérempli',
        tone: 'info',
      });
      return;
    }

    if (hasOwnerInvite) {
      setFeedback({
        description:
          'Une invitation propriétaire d’agence a été détectée. Le parcours reste verrouillé côté propriétaire pour terminer l’activation.',
        title: 'Accès propriétaire prérempli',
        tone: 'info',
      });
      return;
    }

    setSelectedDemoRole(role);
    setFeedback(null);
  };

  const handleContinueWithGoogle = async () => {
    clearFieldErrors();
    setFeedback(null);
    clearAuthDebug();
    setActiveAction('google');

    try {
      if (isFirebaseEnabled) {
        const result = await signInWithGoogleFirebaseBridge(selectedDemoRole);

        if (result.status === 'success' && result.profile?.role) {
          reportAuthEvent({
            action: 'google-sign-in',
            message: result.message,
            scope: 'auth',
            status: 'success',
            title: 'Google connecté',
          });
          router.replace(getHomeRouteForRole(result.profile.role) as never);
          return;
        }

        if (result.status === 'needs-role') {
          reportAuthEvent({
            action: 'google-sign-in',
            message: result.message,
            scope: 'auth',
            status: 'info',
            title: 'Rôle requis',
          });
          setFeedback({
            description: result.message,
            title: 'Rôle requis',
            tone: 'info',
          });
          return;
        }

        if (result.status === 'needs-owner-access') {
          reportAuthEvent({
            action: 'google-sign-in',
            message: result.message,
            scope: 'auth',
            status: 'info',
            title: 'Accès agence requis',
          });
          router.replace('/owner-access' as never);
          return;
        }

        if (result.status === 'needs-verification') {
          reportAuthEvent({
            action: 'google-sign-in',
            message: result.message,
            scope: 'auth',
            status: 'info',
            title: 'Vérification requise',
          });
          router.replace('/auth/verify-email');
          return;
        }

        if (result.status === 'link-required') {
          reportAuthEvent({
            action: 'google-sign-in',
            message: result.message,
            scope: 'auth',
            status: 'info',
            title: 'Liaison requise',
          });
          setFeedback({
            description: result.message,
            title: 'Liaison requise',
            tone: 'info',
          });
          return;
        }

        reportAuthEvent({
          action: 'google-sign-in',
          message: result.message,
          scope: 'auth',
          status: result.status === 'error' ? 'error' : 'info',
          title:
            result.status === 'cancelled'
              ? 'Connexion annulée'
              : result.status === 'unavailable'
                ? 'Connexion indisponible'
                : 'Connexion Google échouée',
        });
        setFeedback({
          description: result.message,
          title:
            result.status === 'cancelled'
              ? 'Connexion annulée'
              : result.status === 'unavailable'
                ? 'Connexion indisponible'
                : 'Connexion Google échouée',
          tone: result.status === 'error' ? 'error' : 'info',
        });
        return;
      }

      const result = await signInWithGoogle();

      if (result.status === 'success') {
        await createLegacyGoogleSession(selectedDemoRole, result.payload);
        reportAuthEvent({
          action: 'google-sign-in-local',
          message: 'La session Google locale a été ouverte dans la démo.',
          scope: 'auth',
          status: 'success',
          title: 'Google connecté',
        });
        router.replace(getHomeRouteForRole(selectedDemoRole) as never);
        return;
      }

      reportAuthEvent({
        action: 'google-sign-in-local',
        message: result.message,
        scope: 'auth',
        status: result.status === 'error' ? 'error' : 'info',
        title:
          result.status === 'cancelled'
            ? 'Connexion annulée'
            : result.status === 'unavailable'
              ? 'Connexion Google indisponible'
              : 'Connexion Google échouée',
      });
      setFeedback({
        description: result.message,
        title:
          result.status === 'cancelled'
            ? 'Connexion annulée'
            : result.status === 'unavailable'
              ? 'Connexion Google indisponible'
              : 'Connexion Google échouée',
        tone: result.status === 'error' ? 'error' : 'info',
      });
    } finally {
      setActiveAction(null);
    }
  };

  const handleSubmit = async () => {
    clearFieldErrors();
    setFeedback(null);
    clearAuthDebug();

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedName = displayName.trim();
    let isFormValid = true;

    if (authMode === 'signup' && normalizedName.length < 2) {
      setDisplayNameError('Saisissez votre nom complet.');
      isFormValid = false;
    }

    if (!isValidEmail(normalizedEmail)) {
      setEmailError('Saisissez une adresse e-mail valide.');
      isFormValid = false;
    }

    if (authMode === 'signin' && password.trim().length === 0) {
      setPasswordError('Saisissez votre mot de passe.');
      isFormValid = false;
    }

    if (authMode === 'signup' && !isValidPassword(password)) {
      setPasswordError('Le mot de passe doit contenir au moins 8 caractères.');
      isFormValid = false;
    }

    if (authMode === 'signup' && confirmPassword !== password) {
      setConfirmPasswordError('Les mots de passe doivent être identiques.');
      isFormValid = false;
    }

    if (!isFormValid) {
      return;
    }

    setActiveAction('email');

    try {
      const result =
        authMode === 'signup'
          ? await signUpWithEmailPassword({
              displayName: normalizedName,
              email: normalizedEmail,
              password,
              role: selectedDemoRole,
            })
          : await signInWithEmailPassword({
              email: normalizedEmail,
              password,
            });

      if (result.status === 'success' && result.profile?.role) {
        reportAuthEvent({
          action: authMode === 'signup' ? 'email-sign-up' : 'email-sign-in',
          message: result.message,
          scope: 'auth',
          status: 'success',
          title: authMode === 'signup' ? 'Compte créé' : 'Connexion confirmée',
        });
        router.replace(getHomeRouteForRole(result.profile.role) as never);
        return;
      }

      if (result.status === 'needs-role') {
        reportAuthEvent({
          action: authMode === 'signup' ? 'email-sign-up' : 'email-sign-in',
          message: result.message,
          scope: 'auth',
          status: 'info',
          title: 'Rôle requis',
        });
        setFeedback({
          description: result.message,
          title: 'Rôle requis',
          tone: 'info',
        });
        return;
      }

      if (result.status === 'needs-owner-access') {
        reportAuthEvent({
          action: authMode === 'signup' ? 'email-sign-up' : 'email-sign-in',
          message: result.message,
          scope: 'auth',
          status: 'info',
          title: 'Accès agence requis',
        });
        router.replace('/owner-access' as never);
        return;
      }

      if (result.status === 'needs-verification') {
        reportAuthEvent({
          action: authMode === 'signup' ? 'email-sign-up' : 'email-sign-in',
          message: result.message,
          scope: 'auth',
          status: 'info',
          title: 'Vérification requise',
        });
        router.replace('/auth/verify-email');
        return;
      }

      if (result.status === 'link-required') {
        reportAuthEvent({
          action: authMode === 'signup' ? 'email-sign-up' : 'email-sign-in',
          message: result.message,
          scope: 'auth',
          status: 'info',
          title: 'Liaison requise',
        });
        setFeedback({
          description: result.message,
          title: authMode === 'signup' ? 'Compte existant' : 'Liaison requise',
          tone: 'info',
        });
        return;
      }

      reportAuthEvent({
        action: authMode === 'signup' ? 'email-sign-up' : 'email-sign-in',
        message: result.message,
        scope: 'auth',
        status: result.status === 'error' ? 'error' : 'info',
        title:
          result.status === 'unavailable'
            ? 'Connexion indisponible'
            : authMode === 'signup'
              ? 'Création du compte échouée'
              : 'Connexion e-mail échouée',
      });
      setFeedback({
        description: result.message,
        title:
          result.status === 'unavailable'
            ? 'Connexion indisponible'
            : authMode === 'signup'
              ? 'Création du compte échouée'
              : 'Connexion e-mail échouée',
        tone: result.status === 'error' ? 'error' : 'info',
      });
    } finally {
      setActiveAction(null);
    }
  };

  const handleCompleteRoleSelection = async () => {
    setActiveAction('role');
    setFeedback(null);

    try {
      await completePendingRoleSelection(selectedDemoRole);
      reportAuthEvent({
        action: 'complete-role-selection',
        message: `Le rôle ${getRoleLabel(selectedDemoRole)} a été confirmé.`,
        scope: 'auth',
        status: 'success',
        title: 'Rôle confirmé',
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Le rôle n’a pas pu être confirmé pour ce compte.';

      reportAuthEvent({
        action: 'complete-role-selection',
        message,
        scope: 'auth',
        status: 'error',
        title: 'Rôle non confirmé',
      });
      setFeedback({
        description: message,
        title: 'Rôle non confirmé',
        tone: 'error',
      });
    } finally {
      setActiveAction(null);
    }
  };

  const handleQuickSwitch = async (role: Role) => {
    setSelectedDemoRole(role);
    setActiveAction(role === 'tenant' ? 'demo-tenant' : 'demo-owner');

    try {
      await signIn(role);
      router.replace(getHomeRouteForRole(role) as never);
    } finally {
      setActiveAction(null);
    }
  };

  const handleClipboardSignIn = async () => {
    clearFieldErrors();
    setFeedback(null);
    clearAuthDebug();
    setActiveAction('email');

    try {
      const clipboardValue = await Clipboard.getStringAsync();
      const credentials = parseClipboardCredentials(clipboardValue);

      if (!credentials || !isValidEmail(credentials.email) || credentials.password.trim().length === 0) {
        const message =
          'Copiez un JSON valide comme {"email":"owner@example.com","password":"aaaa1111","role":"owner"} puis réessayez.';

        reportAuthEvent({
          action: 'clipboard-sign-in',
          message,
          scope: 'auth',
          status: 'error',
          title: 'Presse-papiers invalide',
        });
        setFeedback({
          description: message,
          title: 'Presse-papiers invalide',
          tone: 'error',
        });
        return;
      }

      if (credentials.role) {
        setSelectedDemoRole(credentials.role);
      }

      const result = await signInWithEmailPassword({
        email: credentials.email.trim().toLowerCase(),
        password: credentials.password,
      });

      if (result.status === 'success' && result.profile?.role) {
        reportAuthEvent({
          action: 'clipboard-sign-in',
          message: result.message,
          scope: 'auth',
          status: 'success',
          title: 'Connexion confirmée',
        });
        router.replace(getHomeRouteForRole(result.profile.role) as never);
        return;
      }

      if (result.status === 'needs-role') {
        reportAuthEvent({
          action: 'clipboard-sign-in',
          message: result.message,
          scope: 'auth',
          status: 'info',
          title: 'Rôle requis',
        });
        setFeedback({
          description: result.message,
          title: 'Rôle requis',
          tone: 'info',
        });
        return;
      }

      if (result.status === 'needs-owner-access') {
        reportAuthEvent({
          action: 'clipboard-sign-in',
          message: result.message,
          scope: 'auth',
          status: 'info',
          title: 'Accès agence requis',
        });
        router.replace('/owner-access' as never);
        return;
      }

      if (result.status === 'needs-verification') {
        reportAuthEvent({
          action: 'clipboard-sign-in',
          message: result.message,
          scope: 'auth',
          status: 'info',
          title: 'Vérification requise',
        });
        router.replace('/auth/verify-email');
        return;
      }

      if (result.status === 'link-required') {
        reportAuthEvent({
          action: 'clipboard-sign-in',
          message: result.message,
          scope: 'auth',
          status: 'info',
          title: 'Liaison requise',
        });
        setFeedback({
          description: result.message,
          title: 'Liaison requise',
          tone: 'info',
        });
        return;
      }

      reportAuthEvent({
        action: 'clipboard-sign-in',
        message: result.message,
        scope: 'auth',
        status: result.status === 'error' ? 'error' : 'info',
        title:
          result.status === 'unavailable'
            ? 'Connexion indisponible'
            : 'Connexion e-mail échouée',
      });
      setFeedback({
        description: result.message,
        title:
          result.status === 'unavailable'
            ? 'Connexion indisponible'
            : 'Connexion e-mail échouée',
        tone: result.status === 'error' ? 'error' : 'info',
      });
    } finally {
      setActiveAction(null);
    }
  };

  return (
    <AuthScreen
      subtitle="Choisissez d’abord votre rôle, puis connectez-vous à votre espace ATouPay. Les paiements restent clairement simulés dans cette version."
      title="Bienvenue">
      <AuthCard
        description={
          isAgencyAdminEntry
            ? 'Espace réservé aux comptes agence initialisés par la plateforme.'
            : roleCopy.roleDescription
        }
        title={isAgencyAdminEntry ? 'Accès agence' : 'Choisir votre parcours'}>
        {hasInvite ? (
          <BannerNotice
            description="Une invitation locataire a été détectée. Le parcours est verrouillé côté locataire pour rattacher ce compte au bon logement."
            title="Invitation en attente"
            tone="info"
          />
        ) : null}

        {hasOwnerInvite ? (
          <BannerNotice
            description="Une invitation propriétaire émise par l’agence a été détectée. Le parcours reste verrouillé côté propriétaire jusqu’à l’activation."
            title="Accès propriétaire détecté"
            tone="info"
          />
        ) : null}

        {isAgencyAdminEntry ? (
          <BannerNotice
            description="Connectez-vous uniquement avec l’adresse autorisée pour administrer les invitations propriétaires, la commission et le support."
            title="Espace administrateur"
            tone="info"
          />
        ) : (
          <RoleSelector
            disabled={hasInvite || hasOwnerInvite}
            onChange={handleRoleChange}
            roles={['tenant', 'owner']}
            selectedRole={selectedDemoRole}
          />
        )}

        <View style={styles.roleSummary}>
          <Text style={styles.roleTitle}>{roleCopy.roleTitle}</Text>
          <Text style={styles.roleHelper}>{roleCopy.helper}</Text>
        </View>
      </AuthCard>

      <AuthCard
        description={roleCopy.authDescription}
        title={roleCopy.authTitle}>
        {availabilityNotice ? (
          <BannerNotice
            description={availabilityNotice.description}
            title={availabilityNotice.title}
            tone={availabilityNotice.tone}
          />
        ) : null}

        {backendNotice ? (
          <BannerNotice
            description={backendNotice.description}
            title={backendNotice.title}
            tone={backendNotice.tone}
          />
        ) : null}

        <AuthModeToggle mode={authMode} onChange={handleModeChange} />

        <PrimaryButton
          accessibilityHint="Démarre la connexion Google sur build iOS ou Android"
          disabled={!googleAvailable || activeAction === 'email' || activeAction === 'role'}
          icon={<GoogleMark />}
          label="Continuer avec Google"
          loading={activeAction === 'google'}
          onPress={handleContinueWithGoogle}
          variant="secondary"
        />

        <Text style={styles.savedRole}>
          {selectedDemoRole === 'owner'
            ? 'Le compte ouvrira l’espace propriétaire seulement après validation d’un code d’accès agence.'
            : selectedDemoRole === 'tenant'
              ? 'Le compte ouvrira l’espace locataire et attendra une invitation pour rattacher le logement.'
              : 'Le compte ouvrira l’espace agence uniquement si cette adresse e-mail a été autorisée par le bootstrap administrateur.'}
        </Text>

        {selectedDemoRole === 'owner' ? (
          <AuthField
            autoCapitalize="characters"
            autoCorrect={false}
            helper="Lien détecté automatiquement ou code remis par l’agence avant activation."
            label="Code d’accès agence"
            onChangeText={(value) => {
              setOwnerAccessCode(value);
              void storePendingOwnerAccessCode(value);
            }}
            placeholder="ABCD-1234-EFGH-5678"
            value={ownerAccessCode}
          />
        ) : null}

        <View style={styles.divider} />

        {authMode === 'signup' ? (
          <AuthField
            autoCapitalize="words"
            autoComplete="name"
            error={displayNameError}
            label="Nom complet"
            onChangeText={setDisplayName}
            placeholder={
              selectedDemoRole === 'owner'
                ? 'Ahmed Ould Salem'
                : selectedDemoRole === 'tenant'
                  ? 'Mariem Mint Ahmed'
                  : 'Agence ATouPay'
            }
            textContentType="name"
            value={displayName}
            editable={firebaseAvailable}
          />
        ) : null}

        <AuthField
          autoComplete="email"
          error={emailError}
          helper="Adresse principale du compte ATouPay"
          keyboardType="email-address"
          label="E-mail"
          onChangeText={setEmail}
          onSubmitEditing={handleSubmit}
          placeholder="vous@exemple.com"
          returnKeyType="next"
          textContentType="emailAddress"
          value={email}
          editable={firebaseAvailable}
        />

        <AuthField
          autoComplete={authMode === 'signup' ? 'new-password' : 'password'}
          error={passwordError}
          helper={authMode === 'signup' ? 'Minimum 8 caractères' : 'Mot de passe du compte'}
          label="Mot de passe"
          onChangeText={setPassword}
          onSubmitEditing={handleSubmit}
          placeholder={
            authMode === 'signup' ? 'Choisissez un mot de passe' : 'Votre mot de passe'
          }
          rightAccessory={
            <AuthFieldAccessoryButton
              accessibilityHint="Affiche ou masque le mot de passe"
              accessibilityLabel={
                passwordVisible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'
              }
              onPress={() => setPasswordVisible((value) => !value)}>
              <Feather
                color={colors.textMuted}
                name={passwordVisible ? 'eye-off' : 'eye'}
                size={18}
              />
            </AuthFieldAccessoryButton>
          }
          secureTextEntry={!passwordVisible}
          textContentType={authMode === 'signup' ? 'newPassword' : 'password'}
          value={password}
          editable={firebaseAvailable}
        />

        {authMode === 'signup' ? (
          <AuthField
            autoComplete="new-password"
            error={confirmPasswordError}
            label="Confirmer le mot de passe"
            onChangeText={setConfirmPassword}
            onSubmitEditing={handleSubmit}
            placeholder="Répétez le mot de passe"
            rightAccessory={
              <AuthFieldAccessoryButton
                accessibilityHint="Affiche ou masque la confirmation du mot de passe"
                accessibilityLabel={
                  confirmPasswordVisible
                    ? 'Masquer la confirmation du mot de passe'
                    : 'Afficher la confirmation du mot de passe'
                }
                onPress={() => setConfirmPasswordVisible((value) => !value)}>
                <Feather
                  color={colors.textMuted}
                  name={confirmPasswordVisible ? 'eye-off' : 'eye'}
                  size={18}
                />
              </AuthFieldAccessoryButton>
            }
            secureTextEntry={!confirmPasswordVisible}
            textContentType="newPassword"
            value={confirmPassword}
            editable={firebaseAvailable}
          />
        ) : null}

        <PrimaryButton
          accessibilityLabel={
            authMode === 'signup' ? 'Valider la création de compte e-mail' : 'Valider la connexion e-mail'
          }
          accessibilityHint={
            authMode === 'signup'
              ? 'Crée un compte ATouPay avec e-mail et mot de passe'
              : 'Connecte le compte ATouPay avec e-mail et mot de passe'
          }
          disabled={!firebaseAvailable || activeAction === 'google' || activeAction === 'role'}
          label={authMode === 'signup' ? 'Créer mon compte' : 'Se connecter'}
          loading={activeAction === 'email'}
          onPress={handleSubmit}
        />

        <View style={styles.linkRow}>
          {authMode === 'signin' ? (
            <Pressable
              accessibilityHint="Affiche le formulaire de création de compte"
              accessibilityRole="button"
              onPress={() => handleModeChange('signup')}
              style={({ pressed }) => pressed && styles.pressed}>
              <Text style={styles.linkText}>Créer un compte</Text>
            </Pressable>
          ) : (
            <Pressable
              accessibilityHint="Revient au formulaire de connexion"
              accessibilityRole="button"
              onPress={() => handleModeChange('signin')}
              style={({ pressed }) => pressed && styles.pressed}>
              <Text style={styles.linkText}>J’ai déjà un compte</Text>
            </Pressable>
          )}

          {authMode === 'signin' ? (
            <Pressable
              accessibilityHint="Ouvre le parcours de réinitialisation du mot de passe"
              accessibilityRole="button"
              onPress={() => router.push('/auth/forgot-password')}
              style={({ pressed }) => pressed && styles.pressed}>
              <Text style={styles.linkText}>Mot de passe oublié ?</Text>
            </Pressable>
          ) : (
            <Text style={styles.linkHint}>
              Un e-mail de vérification sera envoyé après l’inscription.
            </Text>
          )}
        </View>

        <View style={styles.secondaryLinkRow}>
          <Pressable
            accessibilityHint="Ouvre les conditions d’utilisation"
            accessibilityRole="button"
            onPress={() => router.push('/terms')}
            style={({ pressed }) => pressed && styles.pressed}>
            <Text style={styles.secondaryLinkText}>Conditions</Text>
          </Pressable>
          <Pressable
            accessibilityHint="Ouvre l’aide et les responsabilités"
            accessibilityRole="button"
            onPress={() => router.push('/help')}
            style={({ pressed }) => pressed && styles.pressed}>
            <Text style={styles.secondaryLinkText}>Aide & responsabilité</Text>
          </Pressable>
          <Pressable
            accessibilityHint="Ouvre la récupération assistée"
            accessibilityRole="button"
            onPress={() => router.push('/support?mode=recovery')}
            style={({ pressed }) => pressed && styles.pressed}>
            <Text style={styles.secondaryLinkText}>Récupérer mon compte</Text>
          </Pressable>
        </View>
      </AuthCard>

      {needsRoleSelection && pendingProfile ? (
        <AuthCard
          description={pendingProfile.email}
          title="Finaliser le rôle">
          <Text style={styles.helperText}>
            Le compte est authentifié. Confirmez simplement l’espace {getRoleLabel(selectedDemoRole)} pour terminer l’accès.
          </Text>
          <PrimaryButton
            accessibilityLabel={`Confirmer le rôle ${getRoleLabel(selectedDemoRole)}`}
            accessibilityHint="Confirme le rôle choisi pour terminer l’ouverture de session"
            disabled={activeAction === 'google' || activeAction === 'email'}
            label={`Continuer comme ${getRoleLabel(selectedDemoRole)}`}
            loading={activeAction === 'role'}
            onPress={handleCompleteRoleSelection}
          />
        </AuthCard>
      ) : null}

      {isDebugToolsEnabled ? (
        <AuthCard
          description="Visible uniquement dans les builds internes pour aider la validation."
          title="Diagnostic auth">
          <Text style={styles.debugText}>
            {`Dernier événement: ${lastAuthEvent ? `${lastAuthEvent.title} • ${lastAuthEvent.message}` : 'aucun'}`}
          </Text>
          <Text style={styles.debugText}>
            {`Mode: ${authMode === 'signup' ? 'création de compte' : 'connexion'} • Rôle: ${selectedDemoRole}`}
          </Text>
          <PrimaryButton
            accessibilityLabel="Connexion rapide via le presse-papiers"
            accessibilityHint="Lit des identifiants JSON depuis le presse-papiers et déclenche une connexion e-mail en build interne"
            disabled={activeAction !== null}
            label="Connexion rapide (presse-papiers)"
            loading={activeAction === 'email'}
            onPress={() => {
              void handleClipboardSignIn();
            }}
            variant="secondary"
          />
        </AuthCard>
      ) : null}

      {isDebugToolsEnabled && !firebaseAvailable ? (
        <AuthCard
          description="Visible uniquement dans les builds internes pour continuer la revue sans OAuth ni Firebase configurés."
          title="Accès de démonstration">
          <View style={styles.quickActions}>
            <PrimaryButton
              accessibilityLabel="Ouvrir la démo locataire"
              accessibilityHint="Ouvre directement la démo locataire"
              disabled={activeAction !== null}
              label="Continuer comme locataire"
              loading={activeAction === 'demo-tenant'}
              onPress={() => {
                void handleQuickSwitch('tenant');
              }}
              variant="secondary"
            />
            <PrimaryButton
              accessibilityLabel="Ouvrir la démo propriétaire"
              accessibilityHint="Ouvre directement la démo propriétaire"
              disabled={activeAction !== null}
              label="Continuer comme propriétaire"
              loading={activeAction === 'demo-owner'}
              onPress={() => {
                void handleQuickSwitch('owner');
              }}
              variant="secondary"
            />
          </View>
        </AuthCard>
      ) : null}
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  googleMark: {
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  googleMarkText: {
    color: colors.text,
    ...typography.bodyStrong,
  },
  roleSummary: {
    backgroundColor: colors.surfaceGlass,
    borderColor: colors.border,
    borderRadius: radius.xl,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.sm,
  },
  roleTitle: {
    color: colors.text,
    ...typography.bodyStrong,
  },
  roleHelper: {
    color: colors.textMuted,
    ...typography.caption,
  },
  modeToggle: {
    backgroundColor: colors.surfaceGlass,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    padding: 4,
  },
  modeOption: {
    alignItems: 'center',
    borderRadius: radius.pill,
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: spacing.sm,
  },
  modeOptionSelected: {
    backgroundColor: colors.surfaceElevated,
  },
  modeOptionText: {
    color: colors.textMuted,
    ...typography.bodyStrong,
  },
  modeOptionTextSelected: {
    color: colors.text,
  },
  savedRole: {
    color: colors.textMuted,
    ...typography.caption,
  },
  divider: {
    backgroundColor: colors.border,
    height: 1,
    marginVertical: spacing.xs,
  },
  linkRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  linkText: {
    color: colors.primaryDark,
    ...typography.bodyStrong,
  },
  linkHint: {
    color: colors.textMuted,
    flex: 1,
    textAlign: 'right',
    ...typography.caption,
  },
  secondaryLinkRow: {
    flexWrap: 'wrap',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  secondaryLinkText: {
    color: colors.textMuted,
    ...typography.caption,
  },
  helperText: {
    color: colors.textMuted,
    ...typography.caption,
  },
  quickActions: {
    gap: spacing.sm,
  },
  debugText: {
    color: colors.textMuted,
    ...typography.caption,
  },
  pressed: {
    opacity: 0.75,
  },
});
