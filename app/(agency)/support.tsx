import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BannerNotice } from '@/src/components/BannerNotice';
import { ListEmptyState } from '@/src/components/ListEmptyState';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { ProofImagePreview } from '@/src/components/ProofImagePreview';
import { ScreenHeader } from '@/src/components/ScreenHeader';
import {
  listSupportRequestsViaBackend,
  mapBackendErrorToMessage,
  reviewManualPaymentProofViaBackend,
  updateSupportRequestViaBackend,
} from '@/src/services/backendApi';
import { SupportRequestRecord } from '@/src/types';
import { colors } from '@/src/theme/colors';
import { radius } from '@/src/theme/radius';
import { spacing } from '@/src/theme/spacing';
import { typography } from '@/src/theme/typography';
import { formatDateTimeLabel } from '@/src/utils/dates';

interface FeedbackState {
  description: string;
  title: string;
  tone: 'error' | 'info' | 'success';
}

function statusLabel(status: SupportRequestRecord['status']) {
  if (status === 'resolved') {
    return 'Résolu';
  }

  return status === 'in_progress' ? 'En cours' : 'Soumis';
}

function RequestRow({
  isUpdating,
  onMark,
  onReviewProof,
  request,
}: {
  isUpdating: boolean;
  onMark: (requestId: string, status: 'in_progress' | 'resolved') => void;
  onReviewProof: (
    request: SupportRequestRecord,
    decision: 'confirmed' | 'disputed' | 'rejected',
  ) => void;
  request: SupportRequestRecord;
}) {
  const hasManualProof = Boolean(request.manualProofStatus);

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardCopy}>
          <Text style={styles.title}>{request.subject}</Text>
          <Text style={styles.meta}>
            {`${request.requestorDisplayName} • ${request.contactEmail}`}
          </Text>
          <Text style={styles.meta}>
            {`${request.requestorRole} • ${formatDateTimeLabel(request.createdAt)}`}
          </Text>
        </View>
        <View
          style={[
            styles.statusBadge,
            request.status === 'resolved'
              ? styles.badgeResolved
              : request.status === 'in_progress'
                ? styles.badgeProgress
                : styles.badgeSubmitted,
          ]}>
          <Text style={styles.statusText}>{statusLabel(request.status)}</Text>
        </View>
      </View>

      <Text style={styles.category}>{request.category}</Text>
      <Text style={styles.description}>{request.description}</Text>
      {request.phoneNumber ? <Text style={styles.meta}>{`Téléphone: ${request.phoneNumber}`}</Text> : null}
      {request.paymentId ? <Text style={styles.meta}>{`Paiement lié: ${request.paymentId}`}</Text> : null}
      {hasManualProof ? (
        <View style={styles.proofBox}>
          <Text style={styles.proofTitle}>Preuve paiement manuel</Text>
          <Text style={styles.meta}>{`Statut preuve: ${request.manualProofStatus}`}</Text>
          {request.ownerReviewStatus ? (
            <Text style={styles.meta}>{`Revue propriétaire: ${request.ownerReviewStatus}`}</Text>
          ) : null}
          {request.expectedAtouPayReference ? (
            <Text style={styles.meta}>{`Référence attendue: ${request.expectedAtouPayReference}`}</Text>
          ) : null}
          {request.submittedPaymentReference ? (
            <Text style={styles.meta}>{`Référence saisie: ${request.submittedPaymentReference}`}</Text>
          ) : null}
          {typeof request.expectedAmount === 'number' ? (
            <Text style={styles.meta}>{`Montant attendu: ${request.expectedAmount} MRU`}</Text>
          ) : null}
          {typeof request.submittedAmount === 'number' ? (
            <Text style={styles.meta}>{`Montant déclaré: ${request.submittedAmount} MRU`}</Text>
          ) : null}
          {request.submittedPaymentDate ? (
            <Text style={styles.meta}>
              {`Date déclarée: ${request.submittedPaymentDate}${request.submittedPaymentTime ? ` ${request.submittedPaymentTime}` : ''}`}
            </Text>
          ) : null}
          {request.proofCheckResult ? (
            <View style={styles.riskBox}>
              <Text style={styles.proofTitle}>{`Risque: ${request.proofCheckResult.riskLevel}`}</Text>
              {request.proofCheckResult.warnings.map((warning) => (
                <Text key={warning} style={styles.meta}>{`• ${warning}`}</Text>
              ))}
            </View>
          ) : null}
          {request.proofTransactionReference ? (
            <Text style={styles.meta}>{`Référence transactionnelle: ${request.proofTransactionReference}`}</Text>
          ) : null}
          {request.proofNote ? <Text style={styles.meta}>{`Note: ${request.proofNote}`}</Text> : null}
          {request.proofImageOriginalFileName ? (
            <Text style={styles.meta}>{`Fichier original: ${request.proofImageOriginalFileName}`}</Text>
          ) : null}
          {request.proofImageSizeBytes ? (
            <Text style={styles.meta}>{`Taille: ${Math.round(request.proofImageSizeBytes / 1024)} Ko`}</Text>
          ) : null}
          <ProofImagePreview
            fileName={request.proofImageFileName}
            storagePath={request.proofImageStoragePath}
          />
        </View>
      ) : null}
      {request.resolutionNote ? (
        <Text style={styles.meta}>{`Dernière note: ${request.resolutionNote}`}</Text>
      ) : null}

      <View style={styles.actions}>
        {hasManualProof && request.manualProofStatus !== 'confirmed' ? (
          <>
            <PrimaryButton
              label="Confirmer paiement"
              loading={isUpdating}
              onPress={() => onReviewProof(request, 'confirmed')}
            />
            <PrimaryButton
              label="Rejeter preuve"
              loading={isUpdating}
              onPress={() => onReviewProof(request, 'rejected')}
              variant="secondary"
            />
            <PrimaryButton
              label="Contester"
              loading={isUpdating}
              onPress={() => onReviewProof(request, 'disputed')}
              variant="secondary"
            />
          </>
        ) : null}
        {request.status !== 'in_progress' && request.status !== 'resolved' ? (
          <PrimaryButton
            label="Prendre en charge"
            loading={isUpdating}
            onPress={() => onMark(request.id, 'in_progress')}
            variant="secondary"
          />
        ) : null}
        {request.status !== 'resolved' ? (
          <PrimaryButton
            label="Marquer résolu"
            loading={isUpdating}
            onPress={() => onMark(request.id, 'resolved')}
          />
        ) : null}
      </View>
    </View>
  );
}

export default function AgencySupportScreen() {
  const [requests, setRequests] = useState<SupportRequestRecord[]>([]);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [queueFilter, setQueueFilter] = useState<
    'all' | 'disputed' | 'escalation' | 'high_risk' | 'waiting_owner_review'
  >('all');
  const [updatingRequestId, setUpdatingRequestId] = useState<string | null>(null);

  const loadRequests = async () => {
    const nextRequests = await listSupportRequestsViaBackend();
    setRequests(nextRequests);
  };

  useEffect(() => {
    void loadRequests().catch((error) => {
      setFeedback({
        description: mapBackendErrorToMessage(error, 'La file support est indisponible.'),
        title: 'Chargement impossible',
        tone: 'error',
      });
    });
  }, []);

  const handleUpdateRequest = async (requestId: string, status: 'in_progress' | 'resolved') => {
    setUpdatingRequestId(requestId);
    setFeedback(null);

    try {
      const updated = await updateSupportRequestViaBackend({
        requestId,
        resolutionNote:
          status === 'resolved'
            ? 'Demande clôturée depuis l’espace agence.'
            : 'Demande prise en charge par l’agence.',
        status,
      });

      setRequests((currentRequests) =>
        currentRequests.map((request) => (request.id === requestId ? updated : request)),
      );
      setFeedback({
        description:
          status === 'resolved'
            ? 'La demande est maintenant marquée comme résolue.'
            : 'La demande est maintenant en cours de traitement.',
        title: status === 'resolved' ? 'Demande résolue' : 'Demande prise en charge',
        tone: 'success',
      });
    } catch (error) {
      setFeedback({
        description: mapBackendErrorToMessage(error, "La mise à jour du support n’a pas pu être appliquée."),
        title: 'Mise à jour impossible',
        tone: 'error',
      });
    } finally {
      setUpdatingRequestId(null);
    }
  };

  const handleReviewManualProof = async (
    request: SupportRequestRecord,
    decision: 'confirmed' | 'disputed' | 'rejected',
  ) => {
    const requestId = request.id;
    setUpdatingRequestId(requestId);
    setFeedback(null);

    try {
      const updated = await reviewManualPaymentProofViaBackend({
        decision,
        note:
          decision === 'confirmed'
            ? 'Paiement confirmé après revue de la preuve.'
            : decision === 'rejected'
              ? 'Preuve rejetée depuis l’espace agence.'
              : 'Preuve contestée depuis l’espace agence.',
        ...(decision === 'confirmed' && request.proofCheckResult?.riskLevel === 'high'
          ? {
              overrideReason:
                'Dérogation agence après vérification manuelle des éléments fournis.',
            }
          : {}),
        requestId,
      });

      setRequests((currentRequests) =>
        currentRequests.map((request) => (request.id === requestId ? updated : request)),
      );
      setFeedback({
        description:
          decision === 'confirmed'
            ? 'Le paiement manuel est confirmé et le reçu a été généré par le backend.'
            : decision === 'rejected'
              ? 'La preuve est rejetée. Aucun reçu n’a été généré.'
              : 'La preuve est contestée. Aucun reçu n’a été généré.',
        title:
          decision === 'confirmed'
            ? 'Paiement confirmé'
            : decision === 'rejected'
              ? 'Preuve rejetée'
              : 'Preuve contestée',
        tone: decision === 'confirmed' ? 'success' : 'info',
      });
    } catch (error) {
      setFeedback({
        description: mapBackendErrorToMessage(error, "La revue de preuve n’a pas pu être appliquée."),
        title: 'Revue impossible',
        tone: 'error',
      });
    } finally {
      setUpdatingRequestId(null);
    }
  };

  const filteredRequests = requests.filter((request) => {
    if (queueFilter === 'waiting_owner_review') {
      return request.ownerReviewStatus === 'waiting_owner_review';
    }

    if (queueFilter === 'escalation') {
      return request.agencyEscalationAvailable === true;
    }

    if (queueFilter === 'high_risk') {
      return request.proofCheckResult?.riskLevel === 'high';
    }

    if (queueFilter === 'disputed') {
      return request.manualProofStatus === 'disputed' || request.ownerReviewStatus === 'disputed';
    }

    return true;
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        contentContainerStyle={styles.content}
        data={filteredRequests}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <ListEmptyState
            description="Les demandes de récupération, litiges et incidents de l’agence apparaîtront ici."
            title="Aucune demande support"
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <ScreenHeader
              subtitle="Suivi minimal des incidents, litiges et récupérations assistées."
              title="Support agence"
            />

            {feedback ? (
              <BannerNotice
                description={feedback.description}
                title={feedback.title}
                tone={feedback.tone}
              />
            ) : null}
            <View style={styles.filterRow}>
              {[
                ['all', 'Tout'],
                ['waiting_owner_review', 'Attente propriétaire'],
                ['escalation', 'Escalade'],
                ['high_risk', 'Risque élevé'],
                ['disputed', 'Contesté'],
              ].map(([value, label]) => (
                <Pressable
                  key={value}
                  onPress={() => setQueueFilter(value as typeof queueFilter)}
                  style={[
                    styles.filterButton,
                    queueFilter === value ? styles.filterButtonActive : null,
                  ]}>
                  <Text
                    style={[
                      styles.filterText,
                      queueFilter === value ? styles.filterTextActive : null,
                    ]}>
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <RequestRow
            isUpdating={updatingRequestId === item.id}
            onMark={(requestId, status) => {
              void handleUpdateRequest(requestId, status);
            }}
            onReviewProof={(request, decision) => {
              void handleReviewManualProof(request, decision);
            }}
            request={item}
          />
        )}
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
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.sm,
  },
  cardHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  cardCopy: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: colors.text,
    ...typography.bodyStrong,
  },
  meta: {
    color: colors.textMuted,
    ...typography.caption,
  },
  category: {
    color: colors.primaryDark,
    textTransform: 'uppercase',
    ...typography.caption,
  },
  description: {
    color: colors.text,
    ...typography.body,
  },
  proofBox: {
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.sm,
  },
  proofTitle: {
    color: colors.text,
    ...typography.bodyStrong,
  },
  riskBox: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    gap: spacing.xs,
    padding: spacing.sm,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  filterButton: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  filterButtonActive: {
    backgroundColor: colors.primaryDark,
    borderColor: colors.primaryDark,
  },
  filterText: {
    color: colors.textMuted,
    ...typography.caption,
  },
  filterTextActive: {
    color: colors.surface,
  },
  statusBadge: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  badgeSubmitted: {
    backgroundColor: colors.surfaceMuted,
  },
  badgeProgress: {
    backgroundColor: '#FFF4E5',
  },
  badgeResolved: {
    backgroundColor: '#EAF7F0',
  },
  statusText: {
    color: colors.text,
    ...typography.caption,
  },
  actions: {
    gap: spacing.sm,
  },
});
