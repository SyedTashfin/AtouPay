import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PaymentRecord } from '@/src/types';
import { useI18n } from '@/src/i18n/I18nProvider';
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
  const { copy, isRtl } = useI18n();
  const Wrapper = onPress ? Pressable : View;

  return (
    <Wrapper
      {...(onPress
        ? {
            accessibilityHint:
              payment.status === 'paid' && payment.receiptId
                ? copy('Ouvre le reçu lié à ce paiement')
                : copy('Ouvre le détail et le paiement simulé du loyer'),
            accessibilityLabel: `${copy('Paiement')} ${formatMonthLabel(payment.monthKey)} ${propertyName}`,
            accessibilityRole: 'button' as const,
            onPress,
            style: ({ pressed }: { pressed: boolean }) => [styles.card, pressed && styles.pressed],
          }
        : { style: styles.card })}>
      <View style={[styles.topRow, isRtl && styles.topRowRtl]}>
        <View style={styles.copy}>
          <Text style={styles.month}>{formatMonthLabel(payment.monthKey)}</Text>
          <Text style={styles.amount}>{formatCurrency(payment.amount)}</Text>
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
          {tenantName ? <Text style={styles.secondary}>{copy('Loyer sans frais ATouPay pour le locataire')}</Text> : null}
          <Text style={styles.secondary}>
            {payment.status === 'paid' && payment.provider
              ? `${copy('Payé via')} ${payment.provider}`
              : `${copy('Échéance')} ${formatCompactDate(payment.dueDate)}`}
          </Text>
        </View>
        <Text style={styles.reference}>{copy('Réf.')} {payment.referenceId}</Text>
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
  topRowRtl: {
    flexDirection: 'row-reverse',
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
