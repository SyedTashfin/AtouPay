import { StyleSheet, Text, View } from 'react-native';

import { Property } from '@/src/types';
import { formatCurrency } from '@/src/utils/currency';
import { colors } from '@/src/theme/colors';
import { radius } from '@/src/theme/radius';
import { shadows } from '@/src/theme/shadows';
import { spacing } from '@/src/theme/spacing';
import { typography } from '@/src/theme/typography';
import { StatusPill } from '@/src/components/StatusPill';

interface PropertyCardProps {
  property: Property;
  tenantCount: number;
}

export function PropertyCard({ property, tenantCount }: PropertyCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleWrap}>
          <Text style={styles.title}>{property.name}</Text>
          <Text style={styles.subtitle}>{property.unitLabel}</Text>
        </View>
        <StatusPill status={property.occupancyStatus} type="occupancy" />
      </View>

      <Text style={styles.address}>{property.address}</Text>

      <View style={styles.footer}>
        <View>
          <Text style={styles.metricLabel}>Loyer mensuel</Text>
          <Text style={styles.metricValue}>{formatCurrency(property.monthlyRent)}</Text>
        </View>
        <View>
          <Text style={styles.metricLabel}>Locataires</Text>
          <Text style={styles.metricValue}>{tenantCount}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
    padding: spacing.sm,
    ...shadows.card,
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  titleWrap: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  title: {
    color: colors.text,
    flexShrink: 1,
    ...typography.subheading,
  },
  subtitle: {
    color: colors.textMuted,
    flexShrink: 1,
    ...typography.caption,
  },
  address: {
    color: colors.textMuted,
    flexShrink: 1,
    ...typography.body,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  metricLabel: {
    color: colors.textMuted,
    marginBottom: 4,
    ...typography.caption,
  },
  metricValue: {
    color: colors.text,
    ...typography.bodyStrong,
  },
});
