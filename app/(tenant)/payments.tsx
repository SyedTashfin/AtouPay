import { FlatList, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FilterChip } from '@/src/components/FilterChip';
import { ListEmptyState } from '@/src/components/ListEmptyState';
import { PaymentCard } from '@/src/components/PaymentCard';
import { ScreenHeader } from '@/src/components/ScreenHeader';
import { SectionTitle } from '@/src/components/SectionTitle';
import { SummaryCard } from '@/src/components/SummaryCard';
import { useAppContext } from '@/src/context/AppProvider';
import { PaymentStatusFilter } from '@/src/types';
import { colors } from '@/src/theme/colors';
import { spacing } from '@/src/theme/spacing';
import { formatCurrency } from '@/src/utils/currency';

const filters: { label: string; value: PaymentStatusFilter }[] = [
  { label: 'Tous', value: 'all' },
  { label: 'Payés', value: 'paid' },
  { label: 'En attente', value: 'pending' },
  { label: 'En retard', value: 'late' },
];

export default function TenantPaymentsScreen() {
  const {
    getPropertyById,
    setTenantPaymentsFilter,
    tenantAssignmentRequired,
    tenantPayments,
    tenantPaymentsFilter,
    tenantUser,
  } = useAppContext();

  const property = tenantUser.propertyId ? getPropertyById(tenantUser.propertyId) : undefined;
  const propertyLabel = property ? [property.name, property.unitLabel].filter(Boolean).join(' • ') : undefined;

  const filteredPayments = tenantPayments.filter((payment) =>
    tenantPaymentsFilter === 'all' ? true : payment.status === tenantPaymentsFilter,
  );

  const totalPaid = tenantPayments
    .filter((payment) => payment.status === 'paid')
    .reduce((total, payment) => total + payment.amount, 0);
  const totalPending = tenantPayments
    .filter((payment) => payment.status === 'pending')
    .reduce((total, payment) => total + payment.amount, 0);
  const totalLate = tenantPayments
    .filter((payment) => payment.status === 'late')
    .reduce((total, payment) => total + payment.amount, 0);

  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        contentContainerStyle={styles.content}
        data={filteredPayments}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <ListEmptyState
            description={
              tenantAssignmentRequired
                ? "Rattachez d'abord ce compte à une unité via une invitation propriétaire pour afficher les loyers."
                : 'Aucun paiement ne correspond au filtre sélectionné.'
            }
            title={tenantAssignmentRequired ? 'Aucune unité attribuée' : 'Aucun paiement'}
          />
        }
        ListHeaderComponent={
          <View style={styles.headerContent}>
            <ScreenHeader
              subtitle="Historique et suivi de vos loyers"
              title="Paiements"
            />

            <View style={styles.summaryGrid}>
              <SummaryCard
                compact
                subtitle="Historique encaissé"
                title="Total payé"
                value={formatCurrency(totalPaid)}
              />
              <SummaryCard
                accent="warning"
                compact
                subtitle="À régler"
                title="En attente"
                value={formatCurrency(totalPending)}
              />
              <SummaryCard
                accent="danger"
                compact
                subtitle="À relancer"
                title="En retard"
                value={formatCurrency(totalLate)}
              />
            </View>

            <View style={styles.filterSection}>
              <SectionTitle subtitle="Filtrer par statut" title="Historique" />
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.filterRow}>
                  {filters.map((filter) => (
                    <FilterChip
                      key={filter.value}
                      label={filter.label}
                      onPress={() => setTenantPaymentsFilter(filter.value)}
                      selected={tenantPaymentsFilter === filter.value}
                    />
                  ))}
                </View>
              </ScrollView>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <PaymentCard
            onPress={
              item.status === 'paid' && item.receiptId
                ? () => router.push(`/receipt/${item.receiptId}` as never)
                : item.status !== 'paid'
                  ? () => router.push(`/(tenant)/pay-rent?paymentId=${item.id}`)
                  : undefined
            }
            payment={item}
            propertyName={propertyLabel ?? 'Votre logement'}
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
  headerContent: {
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  summaryGrid: {
    gap: spacing.sm,
  },
  filterSection: {
    gap: spacing.sm,
  },
  filterRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
});
