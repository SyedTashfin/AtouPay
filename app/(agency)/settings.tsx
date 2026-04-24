import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BannerNotice } from '@/src/components/BannerNotice';
import { InfoRow } from '@/src/components/InfoRow';
import { LanguageSelector } from '@/src/components/LanguageSelector';
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
  const [commissionRateInput, setCommissionRateInput] = useState('0');
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
        setCommissionRateInput(String(Math.round(settings.commissionRate * 100)));
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
    const normalizedPercentage = Number.parseFloat(commissionRateInput.replace(',', '.'));

    if (!Number.isFinite(normalizedPercentage) || normalizedPercentage < 0 || normalizedPercentage > 100) {
      setFeedback({
        description: 'Saisissez un pourcentage compris entre 0 et 100.',
        title: 'Commission invalide',
        tone: 'error',
      });
      return;
    }

    setFeedback(null);
    setIsSaving(true);

    try {
      const settings = await updateAgencySettingsViaBackend({
        commissionRate: normalizedPercentage / 100,
      });

      setDisplayName(settings.displayName);
      setCommissionRateInput(String(Math.round(settings.commissionRate * 100)));
      setFeedback({
        description:
          'Le nouveau taux sera appliqué uniquement aux futurs paiements simulés. Les écritures historiques ne sont pas réécrites.',
        title: 'Commission enregistrée',
        tone: 'success',
      });
    } catch (error) {
      setFeedback({
        description: mapBackendErrorToMessage(error, "La commission n’a pas pu être mise à jour."),
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
          subtitle="Réglages opératoires appliqués aux écritures futures de commission."
          title="Commission agence"
        />

        {feedback ? (
          <BannerNotice
            description={feedback.description}
            title={feedback.title}
            tone={feedback.tone}
          />
        ) : null}

        <LanguageSelector />

        <AuthCard
          description="Le taux est stocké dans l’agence et repris automatiquement lors du paiement simulé."
          title={displayName}>
          <AuthField
            autoCapitalize="none"
            autoCorrect={false}
            helper="Valeur en pourcentage. Exemple: 12.5 pour 12,5 %."
            keyboardType="decimal-pad"
            label="Commission agence (%)"
            onChangeText={setCommissionRateInput}
            placeholder="0"
            value={commissionRateInput}
          />

          <Text style={styles.helperText}>
            Aucun split bancaire réel n’est exécuté. La commission reste une écriture de ledger tant que les paiements ATouPay demeurent simulés.
          </Text>

          <PrimaryButton
            accessibilityHint="Enregistre le taux de commission agence pour les futurs paiements"
            label="Enregistrer le taux"
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
