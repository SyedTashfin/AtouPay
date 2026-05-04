import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BannerNotice } from '@/src/components/BannerNotice';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { AuthCard } from '@/src/components/auth/AuthCard';
import { AuthField, AuthFieldAccessoryButton } from '@/src/components/auth/AuthField';
import { AuthHeader } from '@/src/components/auth/AuthHeader';
import { AuthLegalLinks } from '@/src/components/auth/AuthLegalLinks';
import { AuthMode, AuthModeToggle } from '@/src/components/auth/AuthModeToggle';
import { AuthScreen } from '@/src/components/auth/AuthScreen';
import { GoogleSignInButton } from '@/src/components/auth/GoogleSignInButton';
import { useAppContext } from '@/src/context/AppProvider';
import { useI18n } from '@/src/i18n/I18nProvider';
import { useSession } from '@/src/context/SessionProvider';
import {
  getFirebaseAuthUnavailableMessage,
  isFirebaseAuthAvailable,
  signInWithEmailPassword,
  signInWithGoogleFirebaseBridge,
  signUpWithEmailPassword,
} from '@/src/services/firebaseAuth';
import {
  getPendingOwnerAccessCode,
  storePendingOwnerAccessCode,
} from '@/src/services/pendingOwnerAccess';
import { colors } from '@/src/theme/colors';
import { radius } from '@/src/theme/radius';
import { spacing } from '@/src/theme/spacing';
import { typography } from '@/src/theme/typography';
import { BannerTone, Role } from '@/src/types';
import { isValidEmail, isValidPassword } from '@/src/utils/auth';
import { getHomeRouteForRole } from '@/src/utils/session';
import { isGoogleSignInAvailable } from '@/src/services/googleAuth';

interface FeedbackState {
  description: string;
  title: string;
  tone: BannerTone;
}

interface RoleAuthScreenProps {
  role: Role;
}

interface RoleScreenCopy {
  forgotPasswordRole?: 'owner' | 'tenant';
  inviteLinkLabel?: string;
  signupCodeField?: 'invite' | 'owner-access';
  subtitle: string;
  title: string;
}

const roleScreenCopy: Record<Role, RoleScreenCopy> = {
  agency_admin: {
    subtitle: 'Connectez-vous pour administrer votre portefeuille et vos accès.',
    title: 'Espace agence',
  },
  owner: {
    forgotPasswordRole: 'owner',
    signupCodeField: 'owner-access',
    subtitle: 'Connectez-vous pour gérer vos biens, loyers et locataires.',
    title: 'Espace propriétaire',
  },
  tenant: {
    forgotPasswordRole: 'tenant',
    inviteLinkLabel: 'Entrer un code logement',
    subtitle: 'Connectez-vous pour accéder à vos loyers, paiements et quittances.',
    title: 'Espace locataire',
  },
};

function normalizeMode(
  mode: string | undefined,
  role: Role,
  hasInviteParam: boolean,
): AuthMode {
  if (mode === 'signup') {
    return 'signup';
  }

  if (role === 'tenant' && hasInviteParam) {
    return 'signup';
  }

  return 'signin';
}

function normalizeFieldValue(value: string) {
  return value.trim().toUpperCase();
}

export function RoleAuthScreen({ role }: RoleAuthScreenProps) {
  const { invite, mode, ownerInvite } = useLocalSearchParams<{
    invite?: string;
    mode?: string;
    ownerInvite?: string;
  }>();
  const [authMode, setAuthMode] = useState<AuthMode>(
    normalizeMode(mode, role, typeof invite === 'string' && invite.trim().length > 0),
  );
  const [activeAction, setActiveAction] = useState<'email' | 'google' | 'role' | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [ownerAccessCode, setOwnerAccessCode] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [displayNameError, setDisplayNameError] = useState<string | null>(null);
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | null>(null);
  const screenCopy = roleScreenCopy[role];
  const { copy } = useI18n();
  const { pendingInviteCode, savePendingInviteCode } = useAppContext();
  const {
    clearAuthDebug,
    completePendingRoleSelection,
    isFirebaseEnabled,
    needsRoleSelection,
    pendingProfile,
    reportAuthEvent,
    setSelectedDemoRole,
  } = useSession();

  const firebaseAvailable = isFirebaseAuthAvailable();
  const firebaseUnavailableMessage = getFirebaseAuthUnavailableMessage();
  const googleAvailable = isFirebaseEnabled && isGoogleSignInAvailable();
  const hasInviteParam = typeof invite === 'string' && invite.trim().length > 0;
  const hasOwnerInviteParam =
    typeof ownerInvite === 'string' && ownerInvite.trim().length > 0;

  useEffect(() => {
    setSelectedDemoRole(role);
  }, [role, setSelectedDemoRole]);

  useEffect(() => {
    setAuthMode(normalizeMode(mode, role, hasInviteParam));
  }, [hasInviteParam, mode, role]);

  useEffect(() => {
    if (!hasInviteParam) {
      if (role === 'tenant' && inviteCode.length === 0 && pendingInviteCode) {
        setInviteCode(pendingInviteCode);
      }

      return;
    }

    const normalizedInviteCode = normalizeFieldValue(invite);
    setInviteCode(normalizedInviteCode);
    void savePendingInviteCode(normalizedInviteCode);
  }, [hasInviteParam, invite, inviteCode.length, pendingInviteCode, role, savePendingInviteCode]);

  useEffect(() => {
    let isMounted = true;

    async function hydrateOwnerCode() {
      if (hasOwnerInviteParam) {
        const normalizedOwnerCode = normalizeFieldValue(ownerInvite);
        setOwnerAccessCode(normalizedOwnerCode);
        await storePendingOwnerAccessCode(normalizedOwnerCode);
        return;
      }

      if (role !== 'owner') {
        return;
      }

      const storedCode = await getPendingOwnerAccessCode();

      if (!isMounted || !storedCode) {
        return;
      }

      setOwnerAccessCode(storedCode);
    }

    void hydrateOwnerCode();

    return () => {
      isMounted = false;
    };
  }, [hasOwnerInviteParam, ownerInvite, role]);

  const availabilityNotice = useMemo(() => {
    if (feedback) {
      return feedback;
    }

    if (!firebaseAvailable && firebaseUnavailableMessage) {
      return {
        description: firebaseUnavailableMessage,
        title: 'Connexion indisponible',
        tone: 'info' as const,
      };
    }

    return null;
  }, [feedback, firebaseAvailable, firebaseUnavailableMessage]);

  const clearFieldErrors = () => {
    setDisplayNameError(null);
    setEmailError(null);
    setPasswordError(null);
    setConfirmPasswordError(null);
  };

  const handleBackPress = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/auth');
  };

  const handleModeChange = (value: AuthMode) => {
    setAuthMode(value);
    setFeedback(null);
    clearFieldErrors();
  };

  const handleContinueWithGoogle = async () => {
    clearFieldErrors();
    setFeedback(null);
    clearAuthDebug();
    setActiveAction('google');

    try {
      const result = await signInWithGoogleFirebaseBridge(role);

      if (result.status === 'success' && result.profile?.role) {
        reportAuthEvent({
          action: 'google-sign-in',
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

      const failureTitle =
        result.status === 'cancelled'
          ? 'Connexion annulée'
          : result.status === 'unavailable'
            ? 'Connexion indisponible'
            : 'Connexion Google échouée';

      reportAuthEvent({
        action: 'google-sign-in',
        message: result.message,
        scope: 'auth',
        status: result.status === 'error' ? 'error' : 'info',
        title: failureTitle,
      });
      setFeedback({
        description: result.message,
        title: failureTitle,
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
    const normalizedInviteCode = normalizeFieldValue(inviteCode);
    const normalizedOwnerCode = normalizeFieldValue(ownerAccessCode);
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

    if (role === 'tenant') {
      await savePendingInviteCode(normalizedInviteCode);
    }

    if (role === 'owner' && normalizedOwnerCode.length > 0) {
      await storePendingOwnerAccessCode(normalizedOwnerCode);
    }

    setActiveAction('email');

    try {
      const result =
        authMode === 'signup'
          ? await signUpWithEmailPassword({
              displayName: normalizedName,
              email: normalizedEmail,
              password,
              role,
            })
          : await signInWithEmailPassword({
              email: normalizedEmail,
              password,
              preferredRole: role,
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

      const failureTitle =
        result.status === 'unavailable'
          ? 'Connexion indisponible'
          : authMode === 'signup'
            ? 'Création du compte échouée'
            : 'Connexion e-mail échouée';

      reportAuthEvent({
        action: authMode === 'signup' ? 'email-sign-up' : 'email-sign-in',
        message: result.message,
        scope: 'auth',
        status: result.status === 'error' ? 'error' : 'info',
        title: failureTitle,
      });
      setFeedback({
        description: result.message,
        title: failureTitle,
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
      await completePendingRoleSelection(role);
      reportAuthEvent({
        action: 'complete-role-selection',
        message: 'Votre espace a été confirmé.',
        scope: 'auth',
        status: 'success',
        title: 'Accès confirmé',
      });
      router.replace(getHomeRouteForRole(role) as never);
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
        title: 'Confirmation impossible',
      });
      setFeedback({
        description: message,
        title: 'Confirmation impossible',
        tone: 'error',
      });
    } finally {
      setActiveAction(null);
    }
  };

  return (
    <AuthScreen
      subtitle={screenCopy.subtitle}
      title={screenCopy.title}
      topSlot={<AuthHeader onBackPress={handleBackPress} />}>
      <AuthCard>
        {availabilityNotice ? (
          <BannerNotice
            description={availabilityNotice.description}
            title={availabilityNotice.title}
            tone={availabilityNotice.tone}
          />
        ) : null}

        {role === 'tenant' && hasInviteParam ? (
          <BannerNotice
            description="Le code logement a été enregistré. Créez ou ouvrez votre compte, puis le rattachement se fera depuis l’accueil locataire."
            title="Code logement détecté"
            tone="info"
          />
        ) : null}

        {role === 'tenant' && authMode === 'signup' && !hasInviteParam ? (
          <BannerNotice
            description="Créez votre compte maintenant. Le code logement du propriétaire se saisit ensuite depuis l’accueil locataire."
            title="Compte d’abord, logement ensuite"
            tone="info"
          />
        ) : null}

        {role === 'owner' && hasOwnerInviteParam ? (
          <BannerNotice
            description="Le code d’accès agence a été enregistré pour la suite du parcours."
            title="Code d’accès détecté"
            tone="info"
          />
        ) : null}

        <AuthModeToggle mode={authMode} onChange={handleModeChange} />

        {googleAvailable ? (
          <GoogleSignInButton
            disabled={activeAction === 'email' || activeAction === 'role'}
            loading={activeAction === 'google'}
            onPress={() => {
              void handleContinueWithGoogle();
            }}
          />
        ) : null}

        {googleAvailable ? <View style={styles.divider} /> : null}

        {authMode === 'signup' ? (
          <AuthField
            autoCapitalize="words"
            autoComplete="name"
            editable={firebaseAvailable}
            error={displayNameError}
            label="Nom complet"
            onChangeText={setDisplayName}
            placeholder="Nom et prénom"
            textContentType="name"
            value={displayName}
          />
        ) : null}

        <AuthField
          autoComplete="email"
          editable={firebaseAvailable}
          error={emailError}
          keyboardType="email-address"
          label="E-mail"
          onChangeText={setEmail}
          onSubmitEditing={handleSubmit}
          placeholder="vous@exemple.com"
          returnKeyType="next"
          textContentType="emailAddress"
          value={email}
        />

        <AuthField
          autoComplete={authMode === 'signup' ? 'new-password' : 'password'}
          editable={firebaseAvailable}
          error={passwordError}
          helper={authMode === 'signup' ? '8 caractères minimum' : undefined}
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
        />

        {authMode === 'signup' ? (
          <AuthField
            autoComplete="new-password"
            editable={firebaseAvailable}
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
          />
        ) : null}

        {authMode === 'signup' && screenCopy.signupCodeField === 'owner-access' ? (
          <AuthField
            autoCapitalize="characters"
            autoCorrect={false}
            helper="Renseignez-le si votre agence vous l’a transmis."
            label="Code d’accès agence"
            onChangeText={(value) => {
              setOwnerAccessCode(value);
              void storePendingOwnerAccessCode(value);
            }}
            placeholder="ABCD-1234-EFGH-5678"
            value={ownerAccessCode}
          />
        ) : null}

        <PrimaryButton
          accessibilityHint={
            authMode === 'signup'
              ? 'Crée un compte ATouPay avec e-mail et mot de passe'
              : 'Connecte le compte ATouPay avec e-mail et mot de passe'
          }
          disabled={!firebaseAvailable || activeAction === 'google' || activeAction === 'role'}
          label={authMode === 'signup' ? 'Créer mon compte' : 'Se connecter'}
          loading={activeAction === 'email'}
          onPress={() => {
            void handleSubmit();
          }}
        />

        <View style={styles.linkRow}>
          <Pressable
            accessibilityHint={
              authMode === 'signin'
                ? 'Affiche le formulaire de création de compte'
                : 'Revient au formulaire de connexion'
            }
            accessibilityRole="button"
            onPress={() => handleModeChange(authMode === 'signin' ? 'signup' : 'signin')}
            style={({ pressed }) => pressed && styles.pressed}>
            <Text style={styles.linkText}>
              {authMode === 'signin' ? 'Créer un compte' : 'J’ai déjà un compte'}
            </Text>
          </Pressable>

          {screenCopy.forgotPasswordRole ? (
            <Pressable
              accessibilityHint={copy('Ouvre le parcours de réinitialisation du mot de passe')}
              accessibilityRole="button"
              onPress={() =>
                router.push(`/auth/forgot-password?role=${screenCopy.forgotPasswordRole}` as never)
              }
              style={({ pressed }) => pressed && styles.pressed}>
              <Text style={styles.linkText}>{copy('Mot de passe oublié ?')}</Text>
            </Pressable>
          ) : null}
        </View>

        {screenCopy.inviteLinkLabel ? (
          <Pressable
            accessibilityHint={copy('Ouvre l’écran de saisie du code d’invitation')}
            accessibilityRole="button"
            onPress={() => router.push('/auth/invitation')}
            style={({ pressed }) => [styles.inlineLink, pressed && styles.pressed]}>
            <Text style={styles.linkText}>{copy(screenCopy.inviteLinkLabel)}</Text>
          </Pressable>
        ) : null}

        <AuthLegalLinks />
      </AuthCard>

      {needsRoleSelection && pendingProfile ? (
        <AuthCard
          description={pendingProfile.email}
          title="Finaliser votre accès">
          <Text style={styles.helperText}>
            {copy('Confirmez cet espace pour terminer l’ouverture de session.')}
          </Text>
          <PrimaryButton
            accessibilityHint="Confirme le rôle choisi pour terminer la connexion"
            disabled={activeAction === 'google' || activeAction === 'email'}
            label="Continuer"
            loading={activeAction === 'role'}
            onPress={() => {
              void handleCompleteRoleSelection();
            }}
          />
        </AuthCard>
      ) : null}
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  divider: {
    backgroundColor: colors.border,
    height: 1,
    marginVertical: spacing.xs,
  },
  helperText: {
    color: colors.textMuted,
    ...typography.caption,
  },
  inlineLink: {
    alignItems: 'flex-start',
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
  pressed: {
    opacity: 0.75,
  },
});
