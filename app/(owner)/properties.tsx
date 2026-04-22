import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, FlatList, Pressable, SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';

import { FilterChip } from '@/src/components/FilterChip';
import { ListEmptyState } from '@/src/components/ListEmptyState';
import { PropertyCard } from '@/src/components/PropertyCard';
import { ScreenHeader } from '@/src/components/ScreenHeader';
import { SectionTitle } from '@/src/components/SectionTitle';
import { SummaryCard } from '@/src/components/SummaryCard';
import { useAppContext } from '@/src/context/AppProvider';
import { OccupancyStatus } from '@/src/types';
import { colors } from '@/src/theme/colors';
import { radius } from '@/src/theme/radius';
import { spacing } from '@/src/theme/spacing';
import { formatCurrency } from '@/src/utils/currency';

type PropertyFilter = 'all' | OccupancyStatus;

const filters: { label: string; value: PropertyFilter }[] = [
  { label: 'Tous', value: 'all' },
  { label: 'Occupés', value: 'occupied' },
  { label: 'Vacants', value: 'vacant' },
];

export default function OwnerPropertiesScreen() {
  const { ownerDashboardSummary, properties } = useAppContext();
  const [activeFilter, setActiveFilter] = useState<PropertyFilter>('all');

  const filteredProperties = properties.filter((property) =>
    activeFilter === 'all' ? true : property.occupancyStatus === activeFilter,
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        contentContainerStyle={styles.content}
        data={filteredProperties}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <ListEmptyState
            description="Aucun bien ne correspond à ce filtre."
            title="Aucun bien"
          />
        }
        ListHeaderComponent={
          <View style={styles.headerContent}>
            <ScreenHeader
              rightAccessory={
                <Pressable
                  accessibilityHint="Fonction visuelle non active dans ce MVP"
                  accessibilityLabel="Ajouter un bien"
                  accessibilityRole="button"
                  onPress={() =>
                    Alert.alert(
                      'Ajout bientôt disponible',
                      "L'ajout de biens sera connecté au back-office dans une prochaine version.",
                    )
                  }
                  style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}>
                  <Feather color={colors.text} name="plus" size={18} />
                </Pressable>
              }
              subtitle="Vue portefeuille et niveau d'occupation"
              title="Biens"
            />

            <SummaryCard
              helper={`${properties.length} biens • ${ownerDashboardSummary.occupiedCount} occupés`}
              subtitle="Revenu mensuel potentiel"
              title="Résumé du parc"
              value={formatCurrency(ownerDashboardSummary.monthlyPotentialIncome)}
            />

            <View style={styles.filterSection}>
              <SectionTitle subtitle="Filtrer par statut d'occupation" title="Liste des biens" />
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.filterRow}>
                  {filters.map((filter) => (
                    <FilterChip
                      key={filter.value}
                      label={filter.label}
                      onPress={() => setActiveFilter(filter.value)}
                      selected={activeFilter === filter.value}
                    />
                  ))}
                </View>
              </ScrollView>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <PropertyCard property={item} tenantCount={item.tenantIds.length} />
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
  addButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  filterSection: {
    gap: spacing.sm,
  },
  filterRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  pressed: {
    opacity: 0.85,
  },
});
