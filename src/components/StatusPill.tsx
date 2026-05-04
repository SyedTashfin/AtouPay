import { StyleSheet, Text, View } from 'react-native';

import { OccupancyStatus, PaymentStatus } from '@/src/types';
import { useI18n } from '@/src/i18n/I18nProvider';
import { colors } from '@/src/theme/colors';
import { radius } from '@/src/theme/radius';
import { spacing } from '@/src/theme/spacing';
import { typography } from '@/src/theme/typography';

interface StatusPillProps {
  status: PaymentStatus | OccupancyStatus;
  type: 'payment' | 'occupancy';
}

const paymentConfig = {
  paid: {
    label: 'Payé',
    backgroundColor: colors.successSoft,
    borderColor: colors.successSoft,
    color: colors.success,
  },
  pending: {
    label: 'En attente',
    backgroundColor: colors.warningSoft,
    borderColor: colors.warningSoft,
    color: colors.warning,
  },
  late: {
    label: 'En retard',
    backgroundColor: colors.dangerSoft,
    borderColor: colors.dangerSoft,
    color: colors.danger,
  },
  failed: {
    label: 'Échec',
    backgroundColor: colors.dangerSoft,
    borderColor: colors.dangerSoft,
    color: colors.danger,
  },
  cancelled: {
    label: 'Annulé',
    backgroundColor: colors.neutralSoft,
    borderColor: colors.border,
    color: colors.neutral,
  },
  disputed: {
    label: 'Contesté',
    backgroundColor: colors.warningSoft,
    borderColor: colors.warningSoft,
    color: colors.warning,
  },
};

const occupancyConfig = {
  invited: {
    label: 'Invité',
    backgroundColor: colors.warningSoft,
    borderColor: colors.warningSoft,
    color: colors.warning,
  },
  occupied: {
    label: 'Occupé',
    backgroundColor: colors.primarySoft,
    borderColor: colors.primarySoft,
    color: colors.primaryDark,
  },
  vacant: {
    label: 'Vacant',
    backgroundColor: colors.neutralSoft,
    borderColor: colors.border,
    color: colors.neutral,
  },
};

export function StatusPill({ status, type }: StatusPillProps) {
  const config = type === 'payment' ? paymentConfig[status as PaymentStatus] : occupancyConfig[status as OccupancyStatus];
  const { copy } = useI18n();

  return (
    <View
      style={[
        styles.pill,
        {
          backgroundColor: config.backgroundColor,
          borderColor: config.borderColor,
        },
      ]}>
      <Text style={[styles.label, { color: config.color }]}>{copy(config.label)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    borderWidth: 1,
    minHeight: 30,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  label: {
    letterSpacing: 0.2,
    ...typography.caption,
  },
});
