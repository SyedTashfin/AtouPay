import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View, StyleSheet } from 'react-native';

import { BannerNotice } from '@/src/components/BannerNotice';
import { JourneyCard } from '@/src/components/JourneyCard';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { AuthCard } from '@/src/components/auth/AuthCard';
import { AuthField } from '@/src/components/auth/AuthField';
import { AuthScreen } from '@/src/components/auth/AuthScreen';
import { useSession } from '@/src/context/SessionProvider';
import { redeemOwnerAccessViaBackend, mapBackendErrorToMessage } from '@/src/services/backendApi';
import {
  clearPendingOwnerAccessCode,
  getPendingOwnerAccessCode,
  storePendingOwnerAccessCode,
} from '@/src/services/pendingOwnerAccess';
import { colors } from '@/src/theme/colors';
import { spacing } from '@/src/theme/spacing';
import { typography } from '@/src/theme/typography';

interface FeedbackState {
  description: string;
  title: string;
  tone: 'info' | 'success' | 'error';
}

export default function OwnerAccessScreen() {
  const { ownerInvite } = useLocalSearchParams<{ ownerInvite?: string }>();
  const { pendingProfile, refreshSession, signOut } = useSession();
  const [inviteCode, setInviteCode] = useState('');
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function hydrateInviteCode() {
      const storedCode = await getPendingOwnerAccessCode();

      if (!isMounted) {
        return;
      }

      if (typeof ownerInvite === 'string' && ownerInvite.trim().length > 0) {
        setInviteCode(ownerInvite.trim().toUpperCase());
        await storePendingOwnerAccessCode(ownerInvite);
        return;
      }

      if (storedCode) {
        setInviteCode(storedCode);
      }
    }

    void hydrateInviteCode();

    return () => {
      isMounted = false;
    };
  }, [ownerInvite]);

  const handlePasteCode = async () => {
    const value = await Clipboard.getStringAsync();
    setInviteCode(value);
    await storePendingOwnerAccessCode(value);
    setFeedback(
      value.trim().length > 0
        ? {
            description: 'Le code du presse-papiers a été collé dans le champ.',
            title: 'Code collé',
            tone: 'info',
          }
        : {
            description: 'Le presse-papiers est vide.',
            title: 'Presse-papiers vide',
            tone: 'error',
          },
    );
  };

  const handleActivateOwnerAccess = async () => {
    setFeedback(null);

    if (inviteCode.trim().length < 8) {
      setFeedback({
        description:
          'Saisissez le code propriétaire fourni par l’agence ou ouvrez le lien d’invitation complet.',
        title: 'Code requis',
        tone: 'error',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      await redeemOwnerAccessViaBackend({
        inviteCode: inviteCode.trim(),
      });
      await clearPendingOwnerAccessCode();
      await refreshSession();
      setFeedback({
        description:
          'Votre accès propriétaire a été activé. Vous pouvez maintenant gérer vos biens et unités.',
        title: 'Accès activé',
        tone: 'success',
      });
      router.replace('/(owner)/home');
    } catch (error) {
      setFeedback({
        description: mapBackendErrorToMessage(
          error,
          "L’activation propriétaire n’a pas pu être finalisée.",
        ),
        title: 'Activation impossible',
        tone: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthScreen
      subtitle="Authentification réussie. Il manque maintenant la validation d’un code d’accès agence pour activer l’espace propriétaire."
      title="Accès propriétaire à activer">
      <JourneyCard
        description="L’accès propriétaire est volontairement séparé de la connexion pour éviter les comptes utilisables sans autorisation agence."
        steps={[
          {
            description: 'Connectez-vous avec Google ou e-mail comme d’habitude.',
            iconName: 'user-check',
            title: 'Compte connecté',
          },
          {
            description: 'Collez le code propriétaire transmis par l’agence.',
            iconName: 'key',
            title: 'Code agence',
          },
          {
            description: 'Une fois activé, vous arrivez dans l’espace propriétaire.',
            iconName: 'home',
            title: 'Espace débloqué',
          },
        ]}
        title="Activation en trois étapes"
      />

      <AuthCard
        description={pendingProfile?.email}
        title="Compte en attente d’autorisation">
        <Text style={styles.copy}>
          Ce compte est bien connecté, mais l’agence doit encore autoriser l’accès
          propriétaire. Sans ce code, vous ne pouvez pas créer de biens ni inviter des
          locataires.
        </Text>

        {feedback ? (
          <BannerNotice
            description={feedback.description}
            title={feedback.title}
            tone={feedback.tone}
          />
        ) : null}

        <AuthField
          autoCapitalize="characters"
          autoCorrect={false}
          helper="Code fourni par l’agence ou détecté depuis un lien propriétaire."
          label="Code d’accès agence"
          onChangeText={(value) => {
            setInviteCode(value);
            void storePendingOwnerAccessCode(value);
          }}
          placeholder="ABCD-1234-EFGH-5678"
          value={inviteCode}
        />

        <View style={styles.actions}>
          <PrimaryButton
            accessibilityHint="Colle un code d’accès propriétaire depuis le presse-papiers"
            label="Coller le code"
            onPress={() => {
              void handlePasteCode();
            }}
            variant="secondary"
          />
          <PrimaryButton
            accessibilityHint="Valide le code d’accès agence et active le compte propriétaire"
            label="Activer mon accès propriétaire"
            loading={isSubmitting}
            onPress={() => {
              void handleActivateOwnerAccess();
            }}
          />
        </View>

        <PrimaryButton
          accessibilityHint="Ferme la session active et revient à l’écran de connexion"
          label="Se déconnecter"
          onPress={async () => {
            await signOut();
            router.replace('/auth/login');
          }}
          variant="secondary"
        />
        <PrimaryButton
          accessibilityHint="Ouvre l’aide et le support agence"
          label="Besoin d’aide ?"
          onPress={() => router.push('/support?mode=recovery')}
          variant="ghost"
        />
      </AuthCard>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  copy: {
    color: colors.textMuted,
    ...typography.body,
  },
  actions: {
    gap: spacing.sm,
  },
});
