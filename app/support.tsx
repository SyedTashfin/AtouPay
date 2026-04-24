import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BannerNotice } from '@/src/components/BannerNotice';
import { JourneyCard } from '@/src/components/JourneyCard';
import { ListEmptyState } from '@/src/components/ListEmptyState';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { ScreenHeader } from '@/src/components/ScreenHeader';
import { AuthCard } from '@/src/components/auth/AuthCard';
import { AuthField } from '@/src/components/auth/AuthField';
import { useSession } from '@/src/context/SessionProvider';
import {
  createRecoverySupportRequestViaBackend,
  createSupportRequestViaBackend,
  listSupportRequestsViaBackend,
  mapBackendErrorToMessage,
} from '@/src/services/backendApi';
import {
  RecoveryContactPreference,
  SupportRequestCategory,
  SupportRequestRecord,
} from '@/src/types';
import { colors } from '@/src/theme/colors';
import { radius } from '@/src/theme/radius';
import { shadows } from '@/src/theme/shadows';
import { spacing } from '@/src/theme/spacing';
import { typography } from '@/src/theme/typography';
import { formatDateTimeLabel } from '@/src/utils/dates';

interface FeedbackState {
  description: string;
  title: string;
  tone: 'error' | 'info' | 'success';
}

const categories: Array<{ label: string; value: SupportRequestCategory }> = [
  { label: 'Aide générale', value: 'general_help' },
  { label: 'Problème de paiement', value: 'payment_problem' },
  { label: 'Impayé locataire', value: 'tenant_nonpayment' },
  { label: 'Bug ou panne', value: 'bug_or_outage' },
  { label: 'Récupération du compte', value: 'account_recovery' },
];

const recoveryPreferences: Array<{ label: string; value: RecoveryContactPreference }> = [
  { label: 'E-mail', value: 'email' },
  { label: 'Téléphone', value: 'phone' },
];

function getDefaultSubject(category: SupportRequestCategory) {
  switch (category) {
    case 'payment_problem':
      return 'Signalement de paiement';
    case 'tenant_nonpayment':
      return 'Signalement d’impayé locataire';
    case 'bug_or_outage':
      return 'Signalement de bug ou indisponibilité';
    case 'account_recovery':
      return 'Demande de récupération de compte';
    default:
      return 'Demande de support ATouPay';
  }
}

function getStatusLabel(status: SupportRequestRecord['status']) {
  if (status === 'resolved') {
    return 'Résolu';
  }

  return status === 'in_progress' ? 'En cours' : 'Soumis';
}

function RequestRow({ request }: { request: SupportRequestRecord }) {
  return (
    <View style={styles.requestCard}>
      <View style={styles.requestHeader}>
        <View style={styles.requestCopy}>
          <Text style={styles.requestTitle}>{request.subject}</Text>
          <Text style={styles.requestMeta}>
            {`${request.requestorDisplayName} • ${formatDateTimeLabel(request.createdAt)}`}
          </Text>
        </View>
        <View
          style={[
            styles.statusBadge,
            request.status === 'resolved'
              ? styles.statusResolved
              : request.status === 'in_progress'
                ? styles.statusProgress
                : styles.statusSubmitted,
          ]}>
          <Text style={styles.statusBadgeText}>{getStatusLabel(request.status)}</Text>
        </View>
      </View>
      <Text style={styles.requestCategory}>{request.category}</Text>
      <Text style={styles.requestBody}>{request.description}</Text>
      {request.paymentId ? (
        <Text style={styles.requestMeta}>{`Paiement lié: ${request.paymentId}`}</Text>
      ) : null}
      {request.resolutionNote ? (
        <Text style={styles.requestMeta}>{`Suivi agence: ${request.resolutionNote}`}</Text>
      ) : null}
    </View>
  );
}

export default function SupportScreen() {
  const params = useLocalSearchParams<{
    category?: string;
    mode?: string;
    paymentId?: string;
  }>();
  const { isAuthenticated, session } = useSession();
  const [supportRequests, setSupportRequests] = useState<SupportRequestRecord[]>([]);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [contactEmail, setContactEmail] = useState(session?.profile?.email ?? '');
  const [phoneNumber, setPhoneNumber] = useState(session?.profile?.phoneNumber ?? '');
  const [category, setCategory] = useState<SupportRequestCategory>('general_help');
  const [recoveryPreference, setRecoveryPreference] =
    useState<RecoveryContactPreference>('email');
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isRecoveryMode = !isAuthenticated || params.mode === 'recovery';

  useEffect(() => {
    const requestedCategory =
      params.category === 'payment_problem' ||
      params.category === 'tenant_nonpayment' ||
      params.category === 'bug_or_outage' ||
      params.category === 'account_recovery'
        ? params.category
        : 'general_help';

    const nextCategory = (isRecoveryMode ? 'account_recovery' : requestedCategory) as SupportRequestCategory;
    setCategory(nextCategory);
    setSubject((currentValue) => currentValue || getDefaultSubject(nextCategory));
  }, [isRecoveryMode, params.category]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    let isMounted = true;
    setIsLoading(true);

    void listSupportRequestsViaBackend()
      .then((requests) => {
        if (isMounted) {
          setSupportRequests(requests);
        }
      })
      .catch((error) => {
        if (!isMounted) {
          return;
        }

        setFeedback({
          description: mapBackendErrorToMessage(error, 'Les demandes de support sont indisponibles.'),
          title: 'Historique indisponible',
          tone: 'error',
        });
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated]);

  const screenSubtitle = useMemo(() => {
    if (isRecoveryMode) {
      return 'Déposez une demande d’assistance si la récupération par e-mail ne suffit pas ou si vous n’avez plus accès à votre compte.';
    }

    return 'Signalez un problème de paiement, un incident applicatif ou un besoin d’assistance à votre agence.';
  }, [isRecoveryMode]);

  const handleSubmit = async () => {
    if (!subject.trim() || !description.trim()) {
      setFeedback({
        description: 'Le sujet et la description sont requis pour transmettre votre demande.',
        title: 'Champs requis',
        tone: 'error',
      });
      return;
    }

    if (isRecoveryMode && !contactEmail.trim()) {
      setFeedback({
        description: 'Une adresse e-mail est requise pour la récupération assistée.',
        title: 'E-mail requis',
        tone: 'error',
      });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    try {
      const createdRequest = isRecoveryMode
        ? await createRecoverySupportRequestViaBackend({
            description,
            email: contactEmail,
            locale: Intl.DateTimeFormat().resolvedOptions().locale ?? 'fr',
            phoneNumber: phoneNumber.trim() || null,
            recoveryContactPreference: recoveryPreference,
            subject,
          })
        : await createSupportRequestViaBackend({
            category,
            description,
            paymentId: typeof params.paymentId === 'string' ? params.paymentId : undefined,
            phoneNumber: phoneNumber.trim() || null,
            recoveryContactPreference:
              category === 'account_recovery' ? recoveryPreference : null,
            subject,
          });

      if (isAuthenticated) {
        setSupportRequests((currentRequests) => [createdRequest, ...currentRequests]);
      }

      setDescription('');
      setSubject(getDefaultSubject(category));
      setFeedback({
        description:
          'La demande a été enregistrée. L’agence pourra la prendre en charge depuis son espace opérateur.',
        title: 'Demande envoyée',
        tone: 'success',
      });
    } catch (error) {
      setFeedback({
        description: mapBackendErrorToMessage(error, "La demande d’assistance n’a pas pu être envoyée."),
        title: 'Envoi impossible',
        tone: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        contentContainerStyle={styles.content}
        data={isAuthenticated ? supportRequests : []}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          isAuthenticated && !isLoading ? (
            <ListEmptyState
              description="Aucune demande n’a encore été créée depuis ce compte."
              title="Aucun suivi support"
            />
          ) : null
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <ScreenHeader
              onBackPress={() => router.back()}
              showBackButton
              subtitle={screenSubtitle}
              title={isRecoveryMode ? 'Récupération du compte' : 'Aide & support'}
            />

            <JourneyCard
              description={
                isRecoveryMode
                  ? 'Si le reset e-mail ne suffit pas, laissez une trace claire pour que l’agence vous accompagne.'
                  : 'Un bon ticket doit être court, contextualisé et directement exploitable par l’agence.'
              }
              steps={
                isRecoveryMode
                  ? [
                      {
                        description: 'Essayez d’abord la réinitialisation par e-mail Firebase.',
                        iconName: 'mail',
                        title: 'E-mail d’abord',
                      },
                      {
                        description: 'Ajoutez un téléphone uniquement comme contact de rappel.',
                        iconName: 'phone',
                        title: 'Contact utile',
                      },
                      {
                        description: 'L’agence marque ensuite la demande en cours ou résolue.',
                        iconName: 'check-square',
                        title: 'Suivi agence',
                      },
                    ]
                  : [
                      {
                        description: 'Choisissez la catégorie qui décrit le mieux le problème.',
                        iconName: 'tag',
                        title: 'Catégoriser',
                      },
                      {
                        description: 'Décrivez ce qui s’est passé et joignez le paiement si disponible.',
                        iconName: 'edit-3',
                        title: 'Expliquer',
                      },
                      {
                        description: 'Consultez l’historique pour voir l’état de traitement.',
                        iconName: 'activity',
                        title: 'Suivre',
                      },
                    ]
              }
              title={isRecoveryMode ? 'Récupération guidée' : 'Support guidé'}
              tone={isRecoveryMode ? 'warning' : 'primary'}
            />

            {feedback ? (
              <BannerNotice
                description={feedback.description}
                title={feedback.title}
                tone={feedback.tone}
              />
            ) : null}

            {isAuthenticated && session?.role === 'agency_admin' ? (
              <BannerNotice
                description="Les demandes globales de l’agence sont visibles dans l’espace agence, onglet Support."
                title="Vue agence disponible"
                tone="info"
              />
            ) : null}

            <AuthCard
              description={
                isRecoveryMode
                  ? 'La récupération principale reste l’e-mail Firebase. Le téléphone sert ici de contact de rappel tant que Firebase Phone Auth n’est pas activé.'
                  : 'Votre agence recevra la demande avec son contexte. Les paiements restent simulés dans cette version.'
              }
              title={isRecoveryMode ? 'Demander une aide de récupération' : 'Créer une demande'}>
              {isRecoveryMode ? (
                <AuthField
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  label="E-mail du compte"
                  onChangeText={setContactEmail}
                  placeholder="vous@exemple.com"
                  value={contactEmail}
                />
              ) : null}

              <AuthField
                autoCapitalize="sentences"
                label="Sujet"
                onChangeText={setSubject}
                placeholder="Décrivez brièvement votre besoin"
                value={subject}
              />

              <AuthField
                autoCapitalize="none"
                helper="Optionnel. Utilisé par l’agence comme contact de rappel. La récupération par téléphone nécessite encore l’activation de Firebase Phone Auth."
                keyboardType="phone-pad"
                label="Téléphone"
                onChangeText={setPhoneNumber}
                placeholder="+222 36 00 00 00"
                value={phoneNumber}
              />

              <View style={styles.choiceRow}>
                {categories
                  .filter((item) => !isRecoveryMode || item.value === 'account_recovery')
                  .map((item) => {
                    const selected = category === item.value;

                    return (
                      <PrimaryButton
                        key={item.value}
                        label={item.label}
                        onPress={() => {
                          setCategory(item.value);
                          setSubject(getDefaultSubject(item.value));
                        }}
                        variant={selected ? 'primary' : 'secondary'}
                      />
                    );
                  })}
              </View>

              {category === 'account_recovery' || isRecoveryMode ? (
                <View style={styles.choiceRow}>
                  {recoveryPreferences.map((item) => (
                    <PrimaryButton
                      key={item.value}
                      label={`Priorité ${item.label.toLowerCase()}`}
                      onPress={() => setRecoveryPreference(item.value)}
                      variant={recoveryPreference === item.value ? 'primary' : 'secondary'}
                    />
                  ))}
                </View>
              ) : null}

              <AuthField
                autoCapitalize="sentences"
                helper={
                  typeof params.paymentId === 'string'
                    ? `Le paiement ${params.paymentId} sera joint à cette demande.`
                    : 'Décrivez le problème, les étapes observées et le résultat attendu.'
                }
                label="Description"
                multiline
                onChangeText={setDescription}
                placeholder="Expliquez précisément la situation"
                value={description}
              />

              <PrimaryButton
                accessibilityHint="Envoie la demande de support ou de récupération"
                label={isRecoveryMode ? 'Envoyer la demande de récupération' : 'Envoyer la demande'}
                loading={isSubmitting}
                onPress={() => {
                  void handleSubmit();
                }}
              />

              <PrimaryButton
                accessibilityHint="Ouvre les informations de responsabilité et d’aide"
                label="Voir l’aide & responsabilité"
                onPress={() => router.push('/help')}
                variant="secondary"
              />
            </AuthCard>
          </View>
        }
        renderItem={({ item }) => <RequestRow request={item} />}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  content: {
    gap: spacing.sm,
    padding: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  header: {
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  choiceRow: {
    gap: spacing.sm,
  },
  requestCard: {
    backgroundColor: colors.surfaceGlass,
    borderColor: colors.border,
    borderRadius: radius.xl,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.sm,
    ...shadows.soft,
  },
  requestHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  requestCopy: {
    flex: 1,
    gap: 2,
  },
  requestTitle: {
    color: colors.text,
    ...typography.bodyStrong,
  },
  requestMeta: {
    color: colors.textMuted,
    ...typography.caption,
  },
  requestCategory: {
    color: colors.primaryDark,
    textTransform: 'uppercase',
    ...typography.caption,
  },
  requestBody: {
    color: colors.text,
    ...typography.body,
  },
  statusBadge: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  statusSubmitted: {
    backgroundColor: colors.surfaceMuted,
  },
  statusProgress: {
    backgroundColor: '#FFF4E5',
  },
  statusResolved: {
    backgroundColor: '#EAF7F0',
  },
  statusBadgeText: {
    color: colors.text,
    ...typography.caption,
  },
});
