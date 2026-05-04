import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BannerNotice } from '@/src/components/BannerNotice';
import { JourneyCard } from '@/src/components/JourneyCard';
import { ListEmptyState } from '@/src/components/ListEmptyState';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { ScreenHeader } from '@/src/components/ScreenHeader';
import { getLegalTermsViaBackend, getTermsStatusViaBackend, acceptTermsViaBackend, mapBackendErrorToMessage } from '@/src/services/backendApi';
import { useSession } from '@/src/context/SessionProvider';
import { useI18n } from '@/src/i18n/I18nProvider';
import { LegalTermsRecord, TermsAcceptanceStatus } from '@/src/types';
import { colors } from '@/src/theme/colors';
import { radius } from '@/src/theme/radius';
import { shadows } from '@/src/theme/shadows';
import { spacing } from '@/src/theme/spacing';
import { typography } from '@/src/theme/typography';
import { formatDateTimeLabel } from '@/src/utils/dates';
import { getHomeRouteForRole } from '@/src/utils/session';

interface FeedbackState {
  description: string;
  title: string;
  tone: 'error' | 'info' | 'success';
}

function getInstalledAppVersion() {
  return (
    Application.nativeApplicationVersion ??
    Constants.expoConfig?.version ??
    null
  );
}

export default function TermsScreen() {
  const {
    homeRoute,
    isAuthenticated,
    needsTermsAcceptance,
    refreshSession,
    reportAuthEvent,
    session,
  } = useSession();
  const { copy } = useI18n();
  const [terms, setTerms] = useState<LegalTermsRecord | null>(null);
  const [termsStatus, setTermsStatus] = useState<TermsAcceptanceStatus | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAccepting, setIsAccepting] = useState(false);

  const hasSessionIdentity = Boolean(session && (isAuthenticated || needsTermsAcceptance));

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setIsLoading(true);
      setFeedback(null);

      try {
        const [loadedTerms, loadedStatus] = await Promise.all([
          getLegalTermsViaBackend(),
          hasSessionIdentity ? getTermsStatusViaBackend() : Promise.resolve(null),
        ]);

        if (!isMounted) {
          return;
        }

        setTerms(loadedTerms);
        setTermsStatus(loadedStatus);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setFeedback({
          description: mapBackendErrorToMessage(
            error,
            "Les conditions d’utilisation n’ont pas pu être chargées.",
          ),
          title: 'Chargement impossible',
          tone: 'error',
        });
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      isMounted = false;
    };
  }, [hasSessionIdentity]);

  const mustAccept = Boolean(
    hasSessionIdentity && (needsTermsAcceptance || termsStatus?.requiresAcceptance),
  );
  const acceptanceSummary = useMemo(() => {
    if (!termsStatus?.acceptedAt) {
      return null;
    }

    return `Acceptées le ${formatDateTimeLabel(termsStatus.acceptedAt)} • version ${termsStatus.acceptedVersion}`;
  }, [termsStatus?.acceptedAt, termsStatus?.acceptedVersion]);

  const handleAccept = async () => {
    if (!terms) {
      return;
    }

    setIsAccepting(true);
    setFeedback(null);

    try {
      const locale = Intl.DateTimeFormat().resolvedOptions().locale ?? 'fr';
      const result = await acceptTermsViaBackend({
        appVersion: getInstalledAppVersion(),
        locale,
      });

      setTermsStatus(result);
      reportAuthEvent({
        action: 'terms-accepted',
        message: `Les conditions ${terms.version} ont été acceptées.`,
        scope: 'auth',
        status: 'success',
        title: 'Conditions acceptées',
      });
      setFeedback({
        description: 'Les conditions d’utilisation ont été enregistrées pour ce compte.',
        title: 'Acceptation confirmée',
        tone: 'success',
      });
      await refreshSession();
      router.replace((session ? getHomeRouteForRole(session.role) : homeRoute) as never);
    } catch (error) {
      setFeedback({
        description: mapBackendErrorToMessage(
          error,
          "L’acceptation des conditions n’a pas pu être enregistrée.",
        ),
        title: 'Acceptation impossible',
        tone: 'error',
      });
    } finally {
      setIsAccepting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader
          subtitle="Cadre d’utilisation, responsabilités et canal de support AtouPay."
          title="Conditions d’utilisation"
        />

        {mustAccept ? (
          <BannerNotice
            description="Vous devez accepter cette version avant d’accéder pleinement aux espaces agence, propriétaire ou locataire."
            title="Acceptation requise"
            tone="info"
          />
        ) : null}

        {feedback ? (
          <BannerNotice
            description={feedback.description}
            title={feedback.title}
            tone={feedback.tone}
          />
        ) : null}

        {isLoading ? (
          <ListEmptyState
            description="Le backend charge la version actuellement applicable."
            title="Chargement des conditions"
          />
        ) : null}

        {terms ? (
          <>
            <JourneyCard
              description="Un écran lisible doit expliquer le cadre, puis vous ramener vers l’action utile sans vous bloquer dans du texte."
              steps={[
                {
                  description: 'Lisez les points clés sur la responsabilité, les erreurs et le support.',
                  iconName: 'book-open',
                  title: 'Comprendre',
                },
                {
                  description: 'En cas de doute, passez par l’aide ou le support agence avant de continuer.',
                  iconName: 'life-buoy',
                  title: 'Demander de l’aide',
                },
                {
                  description: 'Acceptez uniquement si le cadre est clair, puis revenez à votre espace.',
                  iconName: 'check-circle',
                  title: 'Continuer',
                },
              ]}
              title="Parcours de lecture"
            />

            <View style={styles.heroCard}>
              <Text style={styles.heroTitle}>{terms.title}</Text>
              <Text style={styles.heroSummary}>{terms.summary}</Text>
              <Text style={styles.heroMeta}>
                {`Version ${terms.version} • mise à jour ${formatDateTimeLabel(terms.updatedAt)}`}
              </Text>
              {acceptanceSummary ? <Text style={styles.heroMeta}>{acceptanceSummary}</Text> : null}
            </View>

            <View style={styles.statementCard}>
              <Text style={styles.sectionTitle}>{copy('Responsabilité')}</Text>
              <Text style={styles.sectionBody}>{terms.responsibilityStatement}</Text>
              <Text style={styles.supportPath}>{terms.supportPath}</Text>
            </View>

            {terms.sections.map((section) => (
              <View key={section.title} style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                <Text style={styles.sectionBody}>{section.body}</Text>
              </View>
            ))}

            <View style={styles.actions}>
              {mustAccept ? (
                <PrimaryButton
                  accessibilityHint="Enregistre l’acceptation de cette version des conditions"
                  label="Accepter et continuer"
                  loading={isAccepting}
                  onPress={() => {
                    void handleAccept();
                  }}
                />
              ) : null}
              <PrimaryButton
                accessibilityHint="Ouvre la page d’aide et de responsabilité"
                label="Voir l’aide & responsabilité"
                onPress={() => {
                  router.push('/help');
                }}
                variant={mustAccept ? 'secondary' : 'primary'}
              />
              {!mustAccept ? (
                <PrimaryButton
                  accessibilityHint="Retourne à l’application"
                  label={hasSessionIdentity ? 'Retour à l’application' : 'Retour à la connexion'}
                  onPress={() => {
                    router.replace((hasSessionIdentity ? homeRoute : '/auth/login') as never);
                  }}
                  variant="secondary"
                />
              ) : null}
            </View>
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
  heroCard: {
    backgroundColor: colors.surfaceGlass,
    borderColor: colors.border,
    borderRadius: radius.xl,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.sm,
    ...shadows.soft,
  },
  heroTitle: {
    color: colors.text,
    ...typography.heading,
  },
  heroSummary: {
    color: colors.text,
    ...typography.body,
  },
  heroMeta: {
    color: colors.textMuted,
    ...typography.caption,
  },
  statementCard: {
    backgroundColor: colors.surfaceGlass,
    borderColor: colors.border,
    borderRadius: radius.xl,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.sm,
    ...shadows.soft,
  },
  sectionCard: {
    backgroundColor: colors.surfaceGlass,
    borderColor: colors.border,
    borderRadius: radius.xl,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.sm,
    ...shadows.soft,
  },
  sectionTitle: {
    color: colors.text,
    ...typography.subheading,
  },
  sectionBody: {
    color: colors.text,
    ...typography.body,
  },
  supportPath: {
    color: colors.primaryDark,
    ...typography.bodyStrong,
  },
  actions: {
    gap: spacing.sm,
  },
});
