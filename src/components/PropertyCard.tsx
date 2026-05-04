import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Property } from '@/src/types';
import { useI18n } from '@/src/i18n/I18nProvider';
import { formatCurrency } from '@/src/utils/currency';
import { colors } from '@/src/theme/colors';
import { radius } from '@/src/theme/radius';
import { shadows } from '@/src/theme/shadows';
import { spacing } from '@/src/theme/spacing';
import { typography } from '@/src/theme/typography';
import { StatusPill } from '@/src/components/StatusPill';

interface PropertyCardProps {
  footerContent?: ReactNode;
  property: Property;
  tenantCount: number;
}

export function PropertyCard({ footerContent, property, tenantCount }: PropertyCardProps) {
  const { copy, isRtl } = useI18n();

  return (
    <View style={styles.card}>
      <View style={[styles.header, isRtl && styles.headerRtl]}>
        <View style={styles.titleWrap}>
          <Text style={styles.title}>{property.name}</Text>
          <Text style={styles.subtitle}>{property.unitLabel}</Text>
        </View>
        <StatusPill status={property.occupancyStatus} type="occupancy" />
      </View>

      <Text style={styles.address}>{property.address}</Text>
      {property.notes ? <Text style={styles.notes}>{property.notes}</Text> : null}

      <View style={styles.footer}>
        <View>
          <Text style={[styles.metricLabel, isRtl && styles.rtlText]}>{copy('Loyer mensuel')}</Text>
          <Text style={styles.metricValue}>{formatCurrency(property.monthlyRent)}</Text>
        </View>
        <View>
          <Text style={[styles.metricLabel, isRtl && styles.rtlText]}>{copy('Locataires')}</Text>
          <Text style={styles.metricValue}>{tenantCount}</Text>
        </View>
      </View>

      {footerContent ? <View style={styles.footerContent}>{footerContent}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceGlass,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
    padding: spacing.sm,
    ...shadows.glass,
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  headerRtl: {
    flexDirection: 'row-reverse',
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
    minWidth: 0,
    ...typography.body,
  },
  notes: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    color: colors.textMuted,
    padding: spacing.xs,
    ...typography.caption,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  footerContent: {
    gap: spacing.xs,
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
  rtlText: {
    writingDirection: 'rtl',
  },
});
