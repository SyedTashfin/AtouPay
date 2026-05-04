import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BannerNotice } from '@/src/components/BannerNotice';
import { InfoRow } from '@/src/components/InfoRow';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { ScreenHeader } from '@/src/components/ScreenHeader';
import { AuthCard } from '@/src/components/auth/AuthCard';
import { AuthField } from '@/src/components/auth/AuthField';
import { useSession } from '@/src/context/SessionProvider';
import {
  getAgencySettingsViaBackend,
  mapBackendErrorToMessage,
  updateAgencySettingsViaBackend,
} from '@/src/services/backendApi';
import { colors } from '@/src/theme/colors';
import { spacing } from '@/src/theme/spacing';
import { typography } from '@/src/theme/typography';

interface FeedbackState {
  description: string;
  title: string;
  tone: 'error' | 'info' | 'success';
}

export default function AgencySettingsScreen() {
  const { signOut } = useSession();
  const [displayName, setDisplayName] = useState('Agence ATouPay');
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadSettings() {
      try {
        const settings = await getAgencySettingsViaBackend();

        if (!isMounted) {
          return;
        }

        setDisplayName(settings.displayName);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setFeedback({
          description: mapBackendErrorToMessage(error, 'Les réglages agence sont indisponibles.'),
          title: 'Chargement impossible',
          tone: 'error',
        });
      }
    }

    void loadSettings();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSave = async () => {
    const normalizedDisplayName = displayName.trim();

    if (!normalizedDisplayName) {
      setFeedback({
        description: 'Saisissez le nom affiché de l’agence.',
        title: 'Nom agence invalide',
        tone: 'error',
      });
      return;
    }

    setFeedback(null);
    setIsSaving(true);

    try {
      const settings = await updateAgencySettingsViaBackend({
        displayName: normalizedDisplayName,
      });

      setDisplayName(settings.displayName);
      setFeedback({
        description:
          'Le nom affiché est enregistré. Les frais d’accès propriétaire restent séparés des loyers.',
        title: 'Réglages enregistrés',
        tone: 'success',
      });
    } catch (error) {
      setFeedback({
        description: mapBackendErrorToMessage(error, "Les réglages agence n’ont pas pu être mis à jour."),
        title: 'Enregistrement impossible',
        tone: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader
          subtitle="Frais d’accès propriétaire séparés des loyers et des quittances locataire."
          title="Facturation propriétaire"
        />

        {feedback ? (
          <BannerNotice
            description={feedback.description}
            title={feedback.title}
            tone={feedback.tone}
          />
        ) : null}

        <AuthCard
          description="Les loyers restent séparés de la facturation ATouPay. Les propriétaires paient un frais d’accès séparé."
          title={displayName}>
          <AuthField
            autoCapitalize="words"
            autoCorrect={false}
            helper="Nom visible dans l’espace agence et sur les reçus lorsque disponible."
            label="Nom de l’agence"
            onChangeText={setDisplayName}
            placeholder="Agence ATouPay"
            value={displayName}
          />

          <Text style={styles.helperText}>
            Frais d’accès propriétaire: 10 EUR toutes les 6 semaines. Ce frais garde le compte propriétaire actif et ne doit jamais apparaître comme une charge locataire ou une déduction du loyer.
          </Text>

          <PrimaryButton
            accessibilityHint="Enregistre le nom affiché de l’agence"
            label="Enregistrer"
            loading={isSaving}
            onPress={() => {
              void handleSave();
            }}
          />

          <PrimaryButton
            accessibilityHint="Ferme la session agence et revient à l’écran de connexion"
            label="Se déconnecter"
            onPress={async () => {
              await signOut();
              router.replace('/auth/login');
            }}
            variant="secondary"
          />

          <View style={styles.linkStack}>
            <InfoRow
              label="Langue"
              onPress={() => router.push('/language' as never)}
              value="Français, العربية, English"
            />
            <InfoRow
              label="Notifications"
              onPress={() => router.push('/notifications')}
              value="Événements agence et alertes opérateur"
            />
            <InfoRow
              label="Coordonnées de récupération"
              onPress={() => router.push('/profile-contact')}
              value="Téléphone et préférence de rappel"
            />
            <InfoRow
              label="Conditions d’utilisation"
              onPress={() => router.push('/terms')}
              value="Version applicable et responsabilités"
            />
            <InfoRow
              label="Aide & support"
              onPress={() => router.push('/help')}
              value="Consulter l’aide opérationnelle"
            />
          </View>
        </AuthCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  content: {
    gap: spacing.md,
    padding: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  helperText: {
    color: colors.textMuted,
    ...typography.body,
  },
  linkStack: {
    gap: spacing.sm,
  },
});
