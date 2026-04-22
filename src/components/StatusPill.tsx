import { StyleSheet, Text, View } from 'react-native';

import { OccupancyStatus, PaymentStatus } from '@/src/types';
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
    borderColor: '#B8DECA',
    color: colors.success,
  },
  pending: {
    label: 'En attente',
    backgroundColor: colors.warningSoft,
    borderColor: '#F0D59C',
    color: colors.warning,
  },
  late: {
    label: 'En retard',
    backgroundColor: colors.dangerSoft,
    borderColor: '#E8B2B2',
    color: colors.danger,
  },
};

const occupancyConfig = {
  occupied: {
    label: 'Occupé',
    backgroundColor: colors.primarySoft,
    borderColor: '#BFE4D0',
    color: colors.primaryDark,
  },
  vacant: {
    label: 'Vacant',
    backgroundColor: colors.neutralSoft,
    borderColor: '#D4DDD8',
    color: colors.neutral,
  },
};

export function StatusPill({ status, type }: StatusPillProps) {
  const config = type === 'payment' ? paymentConfig[status as PaymentStatus] : occupancyConfig[status as OccupancyStatus];

  return (
    <View
      style={[
        styles.pill,
        {
          backgroundColor: config.backgroundColor,
          borderColor: config.borderColor,
        },
      ]}>
      <Text style={[styles.label, { color: config.color }]}>{config.label}</Text>
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
