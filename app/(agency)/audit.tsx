import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BannerNotice } from '@/src/components/BannerNotice';
import { ListEmptyState } from '@/src/components/ListEmptyState';
import { ScreenHeader } from '@/src/components/ScreenHeader';
import { listAgencyAuditLogsViaBackend, mapBackendErrorToMessage } from '@/src/services/backendApi';
import { colors } from '@/src/theme/colors';
import { radius } from '@/src/theme/radius';
import { spacing } from '@/src/theme/spacing';
import { typography } from '@/src/theme/typography';
import { AuditLogRecord } from '@/src/types';
import { formatDateTimeLabel } from '@/src/utils/dates';

function auditLabel(eventType: AuditLogRecord['eventType']) {
  const labels: Record<AuditLogRecord['eventType'], string> = {
    account_reactivated: 'Compte réactivé',
    account_suspended: 'Compte suspendu',
    owner_activated: 'Propriétaire activé',
    owner_billing_paid: 'Frais propriétaire payés',
    owner_billing_reactivated: 'Facturation propriétaire réactivée',
    owner_billing_suspended: 'Facturation propriétaire suspendue',
    owner_invite_created: 'Invitation propriétaire créée',
    owner_invite_deleted: 'Invitation propriétaire supprimée',
    owner_invite_revoked: 'Invitation propriétaire révoquée',
    payment_completed: 'Paiement simulé finalisé',
    support_request_created: 'Support créé',
    support_request_updated: 'Support mis à jour',
    tenant_invite_created: 'Invitation locataire créée',
    tenant_invite_redeemed: 'Invitation locataire utilisée',
  };

  return labels[eventType];
}

function AuditRow({ item }: { item: AuditLogRecord }) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{auditLabel(item.eventType)}</Text>
      <Text style={styles.meta}>{formatDateTimeLabel(item.createdAt)}</Text>
      <Text style={styles.meta}>{`Acteur: ${item.actorRole} • Cible: ${item.targetUid ?? 'n/a'}`}</Text>
      <Text style={styles.meta}>{`${item.entityType}: ${item.entityId ?? 'n/a'}`}</Text>
    </View>
  );
}

export default function AgencyAuditScreen() {
  const [logs, setLogs] = useState<AuditLogRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    void listAgencyAuditLogsViaBackend()
      .then((nextLogs) => {
        if (isMounted) {
          setLogs(nextLogs);
        }
      })
      .catch((loadError) => {
        if (isMounted) {
          setError(mapBackendErrorToMessage(loadError, 'Le journal d’audit est indisponible.'));
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        contentContainerStyle={styles.content}
        data={logs}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <ListEmptyState
            description="Les événements opérationnels apparaîtront ici après les invitations, paiements simulés, support et suspensions."
            title="Aucun événement d’audit"
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <ScreenHeader
              subtitle="Journal minimal pour la traçabilité opérationnelle. Il ne remplace pas un système SIEM ou comptable."
              title="Audit"
            />
            {error ? (
              <BannerNotice description={error} title="Chargement impossible" tone="error" />
            ) : null}
          </View>
        }
        renderItem={({ item }) => <AuditRow item={item} />}
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
    gap: 2,
    padding: spacing.sm,
  },
  title: {
    color: colors.text,
    ...typography.bodyStrong,
  },
  meta: {
    color: colors.textMuted,
    ...typography.caption,
  },
});
