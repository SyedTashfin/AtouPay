import { StyleSheet, Text, View } from 'react-native';

import { PaymentRecord, ReceiptRecord } from '@/src/types';
import { colors } from '@/src/theme/colors';
import { radius } from '@/src/theme/radius';
import { shadows } from '@/src/theme/shadows';
import { spacing } from '@/src/theme/spacing';
import { typography } from '@/src/theme/typography';
import { formatCurrency } from '@/src/utils/currency';
import { formatDateTimeLabel, formatMonthLabel } from '@/src/utils/dates';

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
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

export function PaymentReceiptCard({
  payment,
  propertyName,
  receipt,
}: PaymentReceiptCardProps) {
  const grossAmount = payment.grossAmount ?? payment.amount;
  const agencyFeeAmount = payment.agencyFeeAmount ?? 0;
  const ownerNetAmount = payment.ownerNetAmount ?? payment.amount;

  return (
    <View accessibilityLabel="Reçu de paiement simulé" style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Quittance AtouPay simulée</Text>
        <Text style={styles.subtitle}>
          Peut servir de justificatif selon les informations enregistrées dans le système. Aucun débit réel n&apos;est effectué dans cette version.
        </Text>
      </View>

      <ReceiptRow label="Mois" value={formatMonthLabel(payment.monthKey)} />
      <ReceiptRow label="Montant brut" value={formatCurrency(grossAmount)} />
      <ReceiptRow label="Commission agence" value={formatCurrency(agencyFeeAmount)} />
      <ReceiptRow label="Net propriétaire" value={formatCurrency(ownerNetAmount)} />
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
});
