import { FlatList, SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';

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

const statusFilters: { label: string; value: PaymentStatusFilter }[] = [
  { label: 'Tous', value: 'all' },
  { label: 'Payés', value: 'paid' },
  { label: 'En attente', value: 'pending' },
  { label: 'En retard', value: 'late' },
];

export default function OwnerPaymentsScreen() {
  const {
    currentMonthKey,
    getPropertyById,
    getTenantById,
    ownerPayments,
    ownerPaymentsFilter,
    properties,
    setOwnerPaymentsFilter,
  } = useAppContext();

  const currentMonthPayments = ownerPayments.filter((payment) => payment.monthKey === currentMonthKey);
  const totalCollected = currentMonthPayments
    .filter((payment) => payment.status === 'paid')
    .reduce((total, payment) => total + payment.amount, 0);
  const totalPending = currentMonthPayments
    .filter((payment) => payment.status === 'pending')
    .reduce((total, payment) => total + payment.amount, 0);
  const totalLate = currentMonthPayments
    .filter((payment) => payment.status === 'late')
    .reduce((total, payment) => total + payment.amount, 0);

  const filteredPayments = ownerPayments.filter((payment) => {
    const propertyMatches =
      ownerPaymentsFilter.propertyId === 'all'
        ? true
        : payment.propertyId === ownerPaymentsFilter.propertyId;
    const statusMatches =
      ownerPaymentsFilter.status === 'all'
        ? true
        : payment.status === ownerPaymentsFilter.status;

    return propertyMatches && statusMatches;
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        contentContainerStyle={styles.content}
        data={filteredPayments}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <ListEmptyState
            description="Aucun règlement ne correspond aux filtres actifs."
            title="Aucun paiement"
          />
        }
        ListHeaderComponent={
          <View style={styles.headerContent}>
            <ScreenHeader
              subtitle="Vision claire des encaissements par bien et par statut"
              title="Suivi des paiements"
            />

            <View style={styles.summaryGrid}>
              <SummaryCard
                compact
                subtitle="Mois en cours"
                title="Encaissé"
                value={formatCurrency(totalCollected)}
              />
              <SummaryCard
                accent="warning"
                compact
                subtitle="À confirmer"
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
              <SectionTitle subtitle="Filtrer par bien" title="Biens" />
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.filterRow}>
                  <FilterChip
                    label="Tous"
                    onPress={() => setOwnerPaymentsFilter({ propertyId: 'all' })}
                    selected={ownerPaymentsFilter.propertyId === 'all'}
                  />
                  {properties.map((property) => (
                    <FilterChip
                      key={property.id}
                      label={property.name}
                      onPress={() => setOwnerPaymentsFilter({ propertyId: property.id })}
                      selected={ownerPaymentsFilter.propertyId === property.id}
                    />
                  ))}
                </View>
              </ScrollView>
            </View>

            <View style={styles.filterSection}>
              <SectionTitle subtitle="Filtrer par statut" title="Statuts" />
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.filterRow}>
                  {statusFilters.map((filter) => (
                    <FilterChip
                      key={filter.value}
                      label={filter.label}
                      onPress={() => setOwnerPaymentsFilter({ status: filter.value })}
                      selected={ownerPaymentsFilter.status === filter.value}
                    />
                  ))}
                </View>
              </ScrollView>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <PaymentCard
            payment={item}
            propertyName={getPropertyById(item.propertyId)?.name ?? 'Bien'}
            tenantName={getTenantById(item.tenantId)?.fullName}
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
