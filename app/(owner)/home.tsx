import { Feather } from '@expo/vector-icons';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PropertyCard } from '@/src/components/PropertyCard';
import { ScreenHeader } from '@/src/components/ScreenHeader';
import { SectionTitle } from '@/src/components/SectionTitle';
import { SummaryCard } from '@/src/components/SummaryCard';
import { useAppContext } from '@/src/context/AppProvider';
import { colors } from '@/src/theme/colors';
import { radius } from '@/src/theme/radius';
import { spacing } from '@/src/theme/spacing';
import { typography } from '@/src/theme/typography';
import { formatCurrency } from '@/src/utils/currency';

function NotificationBell({ count }: { count: number }) {
  return (
    <Pressable
      accessibilityHint="Affiche les alertes liées aux paiements"
      accessibilityLabel="Notifications du propriétaire"
      accessibilityRole="button"
      onPress={() => {}}
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader
          rightAccessory={
            <NotificationBell count={ownerDashboardSummary.pendingCount + ownerDashboardSummary.lateCount} />
          }
          subtitle="Suivi des revenus, priorités et parc locatif"
          title={`Bonjour, ${ownerUser.fullName.split(' ')[0]}`}
        />

        <SummaryCard
          helper={`Objectif du mois: ${formatCurrency(ownerDashboardSummary.expectedThisMonth)}`}
          progress={ownerDashboardSummary.progressPercentage}
          subtitle="Revenu collecté ce mois-ci"
          title="Revenus mensuels"
          value={formatCurrency(ownerDashboardSummary.collectedThisMonth)}
        />

        <View style={styles.statsGrid}>
          <SummaryCard
            compact
            subtitle="Biens suivis"
            title="Propriétés"
            value={String(ownerDashboardSummary.propertiesCount)}
          />
          <SummaryCard
            compact
            subtitle="Locataires actifs"
            title="Locataires"
            value={String(ownerDashboardSummary.tenantsCount)}
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
          <View style={styles.propertyList}>
            {properties.slice(0, 2).map((property) => (
              <PropertyCard
                key={property.id}
                property={property}
                tenantCount={property.tenantIds.length}
              />
            ))}
          </View>
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
