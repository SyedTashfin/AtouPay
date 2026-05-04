import { StyleSheet, Text, View } from 'react-native';

import { PaymentRecord, ReceiptRecord } from '@/src/types';
import { useI18n } from '@/src/i18n/I18nProvider';
import { colors } from '@/src/theme/colors';
import { radius } from '@/src/theme/radius';
import { shadows } from '@/src/theme/shadows';
import { spacing } from '@/src/theme/spacing';
import { typography } from '@/src/theme/typography';
import { formatCurrency } from '@/src/utils/currency';
import { formatDateTimeLabel, formatMonthLabel } from '@/src/utils/dates';
import { isReceiptSimulated } from '@/src/utils/receipts';

interface PaymentReceiptCardProps {
  payment: PaymentRecord;
  propertyName: string;
  receipt?: ReceiptRecord;
}

function ReceiptRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  const { copy, isRtl } = useI18n();

  return (
    <View style={styles.row}>
      <Text style={[styles.label, isRtl && styles.rtlText]}>{copy(label)}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

export function PaymentReceiptCard({
  payment,
  propertyName,
  receipt,
}: PaymentReceiptCardProps) {
  const { copy, isRtl } = useI18n();
  const rentAmount = payment.rentAmount ?? payment.grossAmount ?? payment.amount;
  const simulated = receipt ? isReceiptSimulated(receipt) : false;

  return (
    <View
      accessibilityLabel={copy(simulated ? 'Reçu de paiement simulé' : 'Reçu de paiement')}
      style={styles.card}>
      <View style={styles.header}>
        <Text style={[styles.title, isRtl && styles.rtlText]}>
          {copy(simulated ? 'Quittance AtouPay simulée' : 'Quittance AtouPay')}
        </Text>
        <Text style={[styles.subtitle, isRtl && styles.rtlText]}>
          {copy(
            simulated
              ? 'Peut servir de justificatif selon les informations enregistrées dans le système. Aucun débit réel n’est confirmé pour ce paiement simulé.'
              : 'Peut servir de justificatif selon les informations enregistrées dans le système.',
          )}
        </Text>
      </View>

      <ReceiptRow label="Mois" value={formatMonthLabel(payment.monthKey)} />
      <ReceiptRow label="Loyer payé" value={formatCurrency(rentAmount)} />
      <ReceiptRow label="Total payé" value={formatCurrency(rentAmount)} />
      <ReceiptRow label="Bien" value={propertyName} />
      <ReceiptRow label="Opérateur" value={payment.provider ?? 'n/a'} />
      <ReceiptRow label="Référence" value={payment.referenceId} />
      {receipt?.receiptNumber ? <ReceiptRow label="Reçu" value={receipt.receiptNumber} /> : null}
      {receipt?.agencyDisplayName ? <ReceiptRow label="Agence" value={receipt.agencyDisplayName} /> : null}
      <ReceiptRow
        label="Horodatage"
        value={payment.paidAt ? formatDateTimeLabel(payment.paidAt) : 'n/a'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceGlass,
    borderColor: colors.border,
    borderRadius: radius.xl,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.sm,
    ...shadows.glass,
  },
  header: {
    gap: 4,
  },
  title: {
    color: colors.text,
    ...typography.subheading,
  },
  subtitle: {
    color: colors.textMuted,
    ...typography.caption,
  },
  row: {
    gap: 4,
  },
  label: {
    color: colors.textMuted,
    ...typography.caption,
  },
  value: {
    color: colors.text,
    flexShrink: 1,
    ...typography.bodyStrong,
  },
  rtlText: {
    writingDirection: 'rtl',
  },
});
