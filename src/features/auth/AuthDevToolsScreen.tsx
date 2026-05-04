import * as Clipboard from 'expo-clipboard';
import { Redirect, router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BannerNotice } from '@/src/components/BannerNotice';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { AuthCard } from '@/src/components/auth/AuthCard';
import { AuthHeader } from '@/src/components/auth/AuthHeader';
import { AuthScreen } from '@/src/components/auth/AuthScreen';
import { appConfig, isClientDemoMode, isDebugToolsEnabled } from '@/src/config/env';
import { useSession } from '@/src/context/SessionProvider';
import {
  isFirebaseAuthAvailable,
  signInWithEmailPassword,
} from '@/src/services/firebaseAuth';
import { colors } from '@/src/theme/colors';
import { spacing } from '@/src/theme/spacing';
import { typography } from '@/src/theme/typography';
import { Role } from '@/src/types';
import { isValidEmail } from '@/src/utils/auth';
import { getHomeRouteForRole } from '@/src/utils/session';

interface FeedbackState {
  description: string;
  title: string;
  tone: 'info' | 'success' | 'error';
}

interface ClipboardCredentials {
  email: string;
  password: string;
  role?: Role;
}

const clientDemoAccounts: Record<'owner' | 'tenant', { email: string; label: string }> = {
  owner: {
    email: 'client.owner@example.com',
    label: 'propriétaire',
  },
  tenant: {
    email: 'client.tenant@example.com',
    label: 'locataire',
  },
};

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
      role: parsed.role === 'owner' || parsed.role === 'tenant' ? parsed.role : undefined,
    };
  } catch {
    return null;
  }
}

export function AuthDevToolsScreen() {
  const {
    clearAuthDebug,
    lastAuthEvent,
    reportAuthEvent,
    setSelectedDemoRole,
    signIn,
  } = useSession();
  const [activeAction, setActiveAction] = useState<
    'clipboard' | 'demo-owner' | 'demo-tenant' | null
  >(null);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const firebaseAvailable = isFirebaseAuthAvailable();
  const devToolsEnabled = __DEV__ && isDebugToolsEnabled;
  const clientDemoPassword = isClientDemoMode ? appConfig.clientDemoPassword : undefined;
  const clientDemoJson = useMemo(
    () =>
      clientDemoPassword
        ? {
            owner: JSON.stringify(
              {
                email: clientDemoAccounts.owner.email,
                password: clientDemoPassword,
                role: 'owner',
              },
              null,
              2,
            ),
            tenant: JSON.stringify(
              {
                email: clientDemoAccounts.tenant.email,
                password: clientDemoPassword,
                role: 'tenant',
              },
              null,
              2,
            ),
          }
        : null,
    [clientDemoPassword],
  );

  if (!devToolsEnabled) {
    return <Redirect href="/auth" />;
  }

  const handleBackPress = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/auth');
  };

  const handleQuickSwitch = async (role: Extract<Role, 'owner' | 'tenant'>) => {
    setSelectedDemoRole(role);
    setActiveAction(role === 'tenant' ? 'demo-tenant' : 'demo-owner');
    setFeedback(null);

    try {
      await signIn(role);
      router.replace(getHomeRouteForRole(role) as never);
    } finally {
      setActiveAction(null);
    }
  };

  const handleClipboardSignIn = async () => {
    clearAuthDebug();
    setFeedback(null);
    setActiveAction('clipboard');

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

      if (result.status === 'needs-owner-access') {
        router.replace('/owner-access' as never);
        return;
      }

      if (result.status === 'needs-verification') {
        router.replace('/auth/verify-email');
        return;
      }

      const failureTitle =
        result.status === 'unavailable'
          ? 'Connexion indisponible'
          : result.status === 'cancelled'
            ? 'Connexion annulée'
            : 'Connexion échouée';

      reportAuthEvent({
        action: 'clipboard-sign-in',
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

  const handleCopyDemoJson = async (role: 'owner' | 'tenant') => {
    if (!clientDemoJson) {
      return;
    }

    await Clipboard.setStringAsync(clientDemoJson[role]);
    setFeedback({
      description: `Le JSON ${clientDemoAccounts[role].label} a été copié dans le presse-papiers.`,
      title: 'JSON copié',
      tone: 'success',
    });
  };

  return (
    <AuthScreen
      subtitle="Outils internes masqués du parcours normal."
      title="Outils d’authentification"
      topSlot={<AuthHeader onBackPress={handleBackPress} />}>
      {feedback ? (
        <BannerNotice
          description={feedback.description}
          title={feedback.title}
          tone={feedback.tone}
        />
      ) : null}

      <AuthCard
        description="Visible uniquement en développement quand les outils internes sont activés."
        title="Diagnostic auth">
        <Text style={styles.debugText}>
          {`Dernier événement: ${lastAuthEvent ? `${lastAuthEvent.title} • ${lastAuthEvent.message}` : 'aucun'}`}
        </Text>
        <PrimaryButton
          accessibilityHint="Lit des identifiants JSON depuis le presse-papiers et déclenche une connexion e-mail"
          disabled={activeAction !== null || !firebaseAvailable}
          label="Connexion rapide (presse-papiers)"
          loading={activeAction === 'clipboard'}
          onPress={() => {
            void handleClipboardSignIn();
          }}
          variant="secondary"
        />
      </AuthCard>

      {!firebaseAvailable ? (
        <AuthCard
          description="Permet de poursuivre la revue interne sans configuration Firebase complète."
          title="Accès de démonstration">
          <View style={styles.quickActions}>
            <PrimaryButton
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

      {clientDemoJson ? (
        <AuthCard
          description="Réservé aux builds client-demo."
          title="Compte de démonstration">
          <Text style={styles.debugText}>
            Utilisez ces raccourcis pour copier les identifiants JSON sans les exposer dans le
            parcours normal.
          </Text>
          <View style={styles.quickActions}>
            <PrimaryButton
              accessibilityHint="Copie le JSON du compte démo locataire"
              label="Copier le JSON locataire"
              onPress={() => {
                void handleCopyDemoJson('tenant');
              }}
              variant="ghost"
            />
            <PrimaryButton
              accessibilityHint="Copie le JSON du compte démo propriétaire"
              label="Copier le JSON propriétaire"
              onPress={() => {
                void handleCopyDemoJson('owner');
              }}
              variant="ghost"
            />
          </View>
        </AuthCard>
      ) : null}
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  debugText: {
    color: colors.textMuted,
    ...typography.caption,
  },
  quickActions: {
    gap: spacing.sm,
  },
});
