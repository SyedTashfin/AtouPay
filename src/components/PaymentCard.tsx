import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PaymentRecord } from '@/src/types';
import { formatCurrency } from '@/src/utils/currency';
import { formatCompactDate, formatMonthLabel } from '@/src/utils/dates';
import { colors } from '@/src/theme/colors';
import { radius } from '@/src/theme/radius';
import { shadows } from '@/src/theme/shadows';
import { spacing } from '@/src/theme/spacing';
import { typography } from '@/src/theme/typography';
import { StatusPill } from '@/src/components/StatusPill';

interface PaymentCardProps {
  payment: PaymentRecord;
  propertyName: string;
  tenantName?: string;
  onPress?: () => void;
}

export function PaymentCard({
  payment,
  propertyName,
  tenantName,
  onPress,
}: PaymentCardProps) {
  const Wrapper = onPress ? Pressable : View;
  const ownerNetAmount = payment.ownerNetAmount ?? payment.amount;
  const agencyFeeAmount = payment.agencyFeeAmount ?? 0;

  return (
    <Wrapper
      {...(onPress
        ? {
            accessibilityHint:
              payment.status === 'paid' && payment.receiptId
                ? 'Ouvre le reçu lié à ce paiement'
                : 'Ouvre le détail et le paiement simulé du loyer',
            accessibilityLabel: `Paiement ${formatMonthLabel(payment.monthKey)} ${propertyName}`,
            accessibilityRole: 'button' as const,
            onPress,
            style: ({ pressed }: { pressed: boolean }) => [styles.card, pressed && styles.pressed],
          }
        : { style: styles.card })}>
      <View style={styles.topRow}>
        <View style={styles.copy}>
          <Text style={styles.month}>{formatMonthLabel(payment.monthKey)}</Text>
          <Text style={styles.amount}>{formatCurrency(payment.amount)}</Text>
          {tenantName && ownerNetAmount !== payment.amount ? (
            <Text style={styles.netAmount}>
              {`Net propriétaire ${formatCurrency(ownerNetAmount)}`}
            </Text>
          ) : null}
        </View>
        <View style={styles.meta}>
          <StatusPill status={payment.status} type="payment" />
          {onPress ? <Feather color={colors.textMuted} name="chevron-right" size={18} /> : null}
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.details}>
          <Text style={styles.property}>{propertyName}</Text>
          {tenantName ? <Text style={styles.secondary}>{tenantName}</Text> : null}
          {tenantName && agencyFeeAmount > 0 ? (
            <Text style={styles.secondary}>
              {`Commission agence ${formatCurrency(agencyFeeAmount)}`}
            </Text>
          ) : null}
          <Text style={styles.secondary}>
            {payment.status === 'paid' && payment.provider
              ? `Payé via ${payment.provider}`
              : `Échéance ${formatCompactDate(payment.dueDate)}`}
          </Text>
        </View>
        <Text style={styles.reference}>Réf. {payment.referenceId}</Text>
      </View>
    </Wrapper>
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
  pressed: {
    opacity: 0.88,
  },
  topRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  copy: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  month: {
    color: colors.textMuted,
    ...typography.caption,
  },
  amount: {
    color: colors.text,
    ...typography.subheading,
  },
  netAmount: {
    color: colors.textMuted,
    ...typography.caption,
  },
  meta: {
    alignItems: 'flex-end',
    gap: spacing.xs,
    maxWidth: '42%',
  },
  body: {
    gap: spacing.xs,
  },
  details: {
    gap: 2,
    minWidth: 0,
  },
  property: {
    color: colors.text,
    flexShrink: 1,
    ...typography.bodyStrong,
  },
  secondary: {
    color: colors.textMuted,
    flexShrink: 1,
    ...typography.body,
  },
  reference: {
    color: colors.textMuted,
    flexShrink: 1,
    ...typography.caption,
  },
});
