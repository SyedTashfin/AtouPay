import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BannerNotice } from '@/src/components/BannerNotice';
import { InfoRow } from '@/src/components/InfoRow';
import { JourneyCard } from '@/src/components/JourneyCard';
import { ListEmptyState } from '@/src/components/ListEmptyState';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { ScreenHeader } from '@/src/components/ScreenHeader';
import { useSession } from '@/src/context/SessionProvider';
import { useI18n } from '@/src/i18n/I18nProvider';
import { getLegalTermsViaBackend, mapBackendErrorToMessage } from '@/src/services/backendApi';
import { LegalTermsRecord } from '@/src/types';
import { colors } from '@/src/theme/colors';
import { radius } from '@/src/theme/radius';
import { shadows } from '@/src/theme/shadows';
import { spacing } from '@/src/theme/spacing';
import { typography } from '@/src/theme/typography';

export default function HelpScreen() {
  const { isAuthenticated } = useSession();
  const { copy } = useI18n();
  const [terms, setTerms] = useState<LegalTermsRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    void getLegalTermsViaBackend()
      .then((loadedTerms) => {
        if (isMounted) {
          setTerms(loadedTerms);
        }
      })
      .catch((loadError) => {
        if (!isMounted) {
          return;
        }

        setError(
          mapBackendErrorToMessage(
            loadError,
            "Le centre d’aide n’a pas pu être chargé.",
          ),
        );
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader
          onBackPress={() => router.back()}
          showBackButton
          subtitle="Assistance, limites de responsabilité et conduites à tenir dans les cas les plus courants."
          title="Aide & responsabilité"
        />

        {error ? (
          <BannerNotice
            description={error}
            title="Aide indisponible"
            tone="error"
          />
        ) : null}

        {!terms && !error ? (
          <ListEmptyState
            description="Le backend prépare le contenu d’aide opérationnelle."
            title="Chargement de l’aide"
          />
        ) : null}

        {terms ? (
          <>
            <JourneyCard
              description="Choisissez le chemin adapté au problème au lieu de parcourir une longue page de texte."
              steps={[
                {
                  description: 'Vérifiez le cadre d’utilisation et la responsabilité de la plateforme.',
                  iconName: 'shield',
                  title: 'Comprendre le cadre',
                },
                {
                  description: 'Créez une demande si un paiement, un compte ou une panne doit être suivi.',
                  iconName: 'message-circle',
                  title: 'Ouvrir un suivi',
                },
                {
                  description: 'L’agence traite la demande depuis son espace opérateur.',
                  iconName: 'briefcase',
                  title: 'Suivre avec l’agence',
                },
              ]}
              title="Trouver la bonne action"
            />

            <BannerNotice
              description={terms.supportPath}
              title="Canal support prioritaire"
              tone="info"
            />

            <View style={styles.card}>
              <Text style={styles.cardTitle}>{copy('Ce que fait AtouPay')}</Text>
              <Text style={styles.cardBody}>{terms.summary}</Text>
              <Text style={styles.cardBody}>{terms.responsibilityStatement}</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>{copy('Réponses pratiques')}</Text>
              {terms.sections.map((section) => (
                <View key={section.title} style={styles.sectionBlock}>
                  <Text style={styles.sectionTitle}>{section.title}</Text>
                  <Text style={styles.sectionBody}>{section.body}</Text>
                </View>
              ))}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>{copy('Accès rapides')}</Text>
              <InfoRow
                label="Conditions d’utilisation"
                onPress={() => router.push('/terms')}
                value={`Version ${terms.version}`}
              />
              <InfoRow
                label="Support / incident / litige"
                onPress={() =>
                  router.push((isAuthenticated ? '/support' : '/support?mode=recovery') as never)
                }
                value="Créer une demande d’assistance"
              />
              <InfoRow
                label="Récupération du compte"
                onPress={() =>
                  router.push((isAuthenticated ? '/auth/forgot-password' : '/support?mode=recovery') as never)
                }
                value="Réinitialisation e-mail ou assistance agence"
              />
            </View>

            <PrimaryButton
              accessibilityHint="Ouvre l’écran de support ou de récupération"
              label={isAuthenticated ? 'Contacter le support' : 'Demander une aide de récupération'}
              onPress={() => {
                router.push((isAuthenticated ? '/support' : '/support?mode=recovery') as never);
              }}
            />
          </>
        ) : null}
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
  card: {
    backgroundColor: colors.surfaceGlass,
    borderColor: colors.border,
    borderRadius: radius.xl,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.sm,
    ...shadows.soft,
  },
  cardTitle: {
    color: colors.text,
    ...typography.subheading,
  },
  cardBody: {
    color: colors.text,
    ...typography.body,
  },
  sectionBlock: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.sm,
  },
  sectionTitle: {
    color: colors.text,
    ...typography.bodyStrong,
  },
  sectionBody: {
    color: colors.textMuted,
    ...typography.body,
  },
});
