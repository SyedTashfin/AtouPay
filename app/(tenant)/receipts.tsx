import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FilterChip } from '@/src/components/FilterChip';
import { ListEmptyState } from '@/src/components/ListEmptyState';
import { ScreenHeader } from '@/src/components/ScreenHeader';
import { useAppContext } from '@/src/context/AppProvider';
import { PaymentRecord } from '@/src/types';
import { colors } from '@/src/theme/colors';
import { radius } from '@/src/theme/radius';
import { shadows } from '@/src/theme/shadows';
import { spacing } from '@/src/theme/spacing';
import { typography } from '@/src/theme/typography';
import { formatCurrency } from '@/src/utils/currency';
import { formatDateLabel, formatMonthLabel } from '@/src/utils/dates';

function getReceiptDate(payment: PaymentRecord) {
  return payment.paidAt ?? payment.dueDate;
}

function getReceiptYear(payment: PaymentRecord) {
  return getReceiptDate(payment).slice(0, 4);
}

function ReceiptRow({
  payment,
  propertyName,
}: {
  payment: PaymentRecord;
  propertyName: string;
}) {
  const receiptDate = getReceiptDate(payment);

  return (
    <Pressable
      accessibilityHint="Ouvre la quittance détaillée et le PDF"
      accessibilityLabel={`Quittance ${formatMonthLabel(payment.monthKey)}`}
      accessibilityRole="button"
      onPress={() => {
        if (payment.receiptId) {
          router.push(`/receipt/${payment.receiptId}` as never);
        }
      }}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={styles.fileIcon}>
        <Feather color={colors.primary} name="file-text" size={30} />
      </View>

      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle}>{`Quittance de ${formatMonthLabel(payment.monthKey)}`}</Text>
        <Text style={styles.rowMeta}>{`Émise le ${formatDateLabel(receiptDate)}`}</Text>
        <Text style={styles.rowMeta}>{propertyName}</Text>
        <Text style={styles.rowAmount}>{formatCurrency(payment.amount)}</Text>
      </View>

      <Feather color={colors.primary} name="chevron-right" size={26} />
    </Pressable>
  );
}

export default function TenantReceiptsScreen() {
  const { getPropertyById, tenantAssignmentRequired, tenantPayments, tenantUser } = useAppContext();
  const [selectedYear, setSelectedYear] = useState<string | null>(null);

  const property = tenantUser.propertyId ? getPropertyById(tenantUser.propertyId) : undefined;
  const propertyLabel = property ? [property.name, property.unitLabel].filter(Boolean).join(' • ') : 'Votre logement';
  const receiptPayments = tenantPayments
    .filter((payment) => payment.status === 'paid' && payment.receiptId)
    .sort((left, right) => getReceiptDate(right).localeCompare(getReceiptDate(left)));
  const years = Array.from(new Set(receiptPayments.map(getReceiptYear))).sort((left, right) =>
    right.localeCompare(left),
  );
  const activeYear = selectedYear && years.includes(selectedYear) ? selectedYear : years[0];
  const filteredReceipts = activeYear
    ? receiptPayments.filter((payment) => getReceiptYear(payment) === activeYear)
    : receiptPayments;

  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        contentContainerStyle={styles.content}
        data={filteredReceipts}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <ListEmptyState
            description={
              tenantAssignmentRequired
                ? "Rattachez d'abord ce compte à une unité avec le code du propriétaire."
                : 'Les quittances apparaîtront ici mois par mois après chaque paiement enregistré.'
            }
            title={tenantAssignmentRequired ? 'Aucun logement rattaché' : 'Aucune quittance'}
          />
        }
        ListHeaderComponent={
          <View style={styles.headerContent}>
            <ScreenHeader
              subtitle="Retrouvez vos quittances mensuelles et ouvrez le PDF correspondant."
              title="Mes quittances"
            />

            <View style={styles.filterBox}>
              <Text style={styles.filterLabel}>Filtre</Text>
              {years.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.filterRow}>
                    {years.map((year) => (
                      <FilterChip
                        key={year}
                        label={year}
                        onPress={() => setSelectedYear(year)}
                        selected={activeYear === year}
                      />
                    ))}
                  </View>
                </ScrollView>
              ) : (
                <Text style={styles.filterValue}>Aucune année disponible</Text>
              )}
            </View>
          </View>
        }
        renderItem={({ item }) => <ReceiptRow payment={item} propertyName={propertyLabel} />}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.role.tenant.background,
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
  filterBox: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.sm,
    ...shadows.card,
  },
  filterLabel: {
    color: colors.textMuted,
    ...typography.caption,
  },
  filterValue: {
    color: colors.textMuted,
    ...typography.body,
  },
  filterRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  row: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 112,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
  },
  pressed: {
    opacity: 0.82,
  },
  fileIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 48,
  },
  rowCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  rowTitle: {
    color: colors.primary,
    ...typography.subheading,
  },
  rowMeta: {
    color: colors.textMuted,
    ...typography.body,
  },
  rowAmount: {
    color: colors.text,
    marginTop: 2,
    ...typography.bodyStrong,
  },
});
