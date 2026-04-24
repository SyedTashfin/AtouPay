import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PropertyCard } from '@/src/components/PropertyCard';
import { ScreenHeader } from '@/src/components/ScreenHeader';
import { SectionTitle } from '@/src/components/SectionTitle';
import { SummaryCard } from '@/src/components/SummaryCard';
import { ListEmptyState } from '@/src/components/ListEmptyState';
import { useAppContext } from '@/src/context/AppProvider';
import { useSession } from '@/src/context/SessionProvider';
import { getOwnerDashboardViaBackend } from '@/src/services/backendApi';
import { OwnerBackendDashboardSummary } from '@/src/types';
import { colors } from '@/src/theme/colors';
import { radius } from '@/src/theme/radius';
import { spacing } from '@/src/theme/spacing';
import { typography } from '@/src/theme/typography';
import { getFirstName } from '@/src/utils/auth';
import { formatCurrency } from '@/src/utils/currency';

function NotificationBell({ count }: { count: number }) {
  return (
    <Pressable
      accessibilityHint="Ouvre le suivi des paiements à confirmer ou relancer"
      accessibilityLabel="Notifications du propriétaire"
      accessibilityRole="button"
      onPress={() => router.push('/notifications')}
      style={({ pressed }) => [styles.bellButton, pressed && styles.pressed]}>
      <Feather color={colors.text} name="bell" size={18} />
      {count > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export default function OwnerHomeScreen() {
  const { ownerDashboardSummary, ownerUser, properties } = useAppContext();
  const { session } = useSession();
  const [backendSummary, setBackendSummary] = useState<OwnerBackendDashboardSummary | null>(null);
  const firstName = getFirstName(
    session?.profile?.displayName ?? ownerUser.fullName,
    ownerUser.fullName.split(' ')[0],
  );

  useEffect(() => {
    let isMounted = true;

    void getOwnerDashboardViaBackend('this_month')
      .then((summary) => {
        if (isMounted) {
          setBackendSummary(summary);
        }
      })
      .catch(() => {
        if (isMounted) {
          setBackendSummary(null);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader
          rightAccessory={
            <NotificationBell count={ownerDashboardSummary.pendingCount + ownerDashboardSummary.lateCount} />
          }
          subtitle="Suivi des revenus, priorités et parc locatif"
          title={`Bonjour, ${firstName}`}
        />

        <SummaryCard
          helper={`Brut encaissé: ${formatCurrency(ownerDashboardSummary.grossCollectedThisMonth)} • Commission agence: ${formatCurrency(ownerDashboardSummary.agencyFeesThisMonth)}`}
          progress={ownerDashboardSummary.progressPercentage}
          subtitle="Net propriétaire collecté ce mois-ci"
          title="Revenus mensuels"
          value={formatCurrency(ownerDashboardSummary.collectedThisMonth)}
        />

        <View style={styles.statsGrid}>
          <SummaryCard
            compact
            subtitle={`${backendSummary?.totalUnitsCount ?? properties.length} unités`}
            title="Propriétés"
            value={String(backendSummary?.totalPropertiesCount ?? ownerDashboardSummary.propertiesCount)}
          />
          <SummaryCard
            compact
            subtitle="Locataires actifs"
            title="Locataires"
            value={String(backendSummary?.totalTenantsCount ?? ownerDashboardSummary.tenantsCount)}
          />
          <SummaryCard
            accent="warning"
            compact
            subtitle="À confirmer"
            title="En attente"
            value={String(ownerDashboardSummary.pendingCount)}
          />
          <SummaryCard
            accent="danger"
            compact
            subtitle="À relancer"
            title="En retard"
            value={String(ownerDashboardSummary.lateCount)}
          />
          <SummaryCard
            compact
            subtitle="Occupées / vacantes"
            title="Unités"
            value={`${backendSummary?.occupiedUnitsCount ?? ownerDashboardSummary.occupiedCount} / ${backendSummary?.vacantUnitsCount ?? 0}`}
          />
        </View>

        <View style={styles.section}>
          <SectionTitle
            subtitle="Actions financières prioritaires"
            title="À traiter"
          />
          <View style={styles.actionList}>
            {ownerDashboardSummary.actionItems.map((item) => (
              <View key={item.id} style={styles.actionRow}>
                <View style={styles.actionCopy}>
                  <Text style={styles.actionTitle}>{item.title}</Text>
                  <Text style={styles.actionDescription}>{item.description}</Text>
                </View>
                <Text style={styles.actionAmount}>{formatCurrency(item.amount)}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <SectionTitle subtitle="Aperçu du portefeuille locatif" title="Biens" />
          {properties.length > 0 ? (
            <View style={styles.propertyList}>
              {properties.slice(0, 2).map((property) => (
                <PropertyCard
                  key={property.id}
                  property={property}
                  tenantCount={property.tenantIds.length}
                />
              ))}
            </View>
          ) : (
            <ListEmptyState
              description="Créez d’abord un bien puis une unité pour générer des invitations locataires."
              title="Aucun bien connecté"
            />
          )}
        </View>
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
  bellButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    height: 44,
    justifyContent: 'center',
    position: 'relative',
    width: 44,
  },
  badge: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    height: 18,
    justifyContent: 'center',
    minWidth: 18,
    paddingHorizontal: 4,
    position: 'absolute',
    right: -2,
    top: -4,
  },
  badgeText: {
    color: colors.surface,
    ...typography.caption,
  },
  statsGrid: {
    gap: spacing.sm,
  },
  section: {
    gap: spacing.sm,
  },
  actionList: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  actionRow: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
    padding: spacing.sm,
  },
  actionCopy: {
    flex: 1,
    gap: 4,
  },
  actionTitle: {
    color: colors.text,
    ...typography.bodyStrong,
  },
  actionDescription: {
    color: colors.textMuted,
    ...typography.caption,
  },
  actionAmount: {
    color: colors.text,
    flexShrink: 1,
    ...typography.bodyStrong,
  },
  propertyList: {
    gap: spacing.sm,
  },
  pressed: {
    opacity: 0.85,
  },
});
