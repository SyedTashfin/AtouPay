import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BannerNotice } from '@/src/components/BannerNotice';
import { ListEmptyState } from '@/src/components/ListEmptyState';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { ScreenHeader } from '@/src/components/ScreenHeader';
import { updateSupportRequestViaBackend, listSupportRequestsViaBackend, mapBackendErrorToMessage } from '@/src/services/backendApi';
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
  request,
}: {
  isUpdating: boolean;
  onMark: (requestId: string, status: 'in_progress' | 'resolved') => void;
  request: SupportRequestRecord;
}) {
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
      {request.resolutionNote ? (
        <Text style={styles.meta}>{`Dernière note: ${request.resolutionNote}`}</Text>
      ) : null}

      <View style={styles.actions}>
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        contentContainerStyle={styles.content}
        data={requests}
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
          </View>
        }
        renderItem={({ item }) => (
          <RequestRow
            isUpdating={updatingRequestId === item.id}
            onMark={(requestId, status) => {
              void handleUpdateRequest(requestId, status);
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
