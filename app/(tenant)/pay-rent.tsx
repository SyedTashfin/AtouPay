import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BannerNotice } from '@/src/components/BannerNotice';
import { ListEmptyState } from '@/src/components/ListEmptyState';
import { PaymentMethodRow } from '@/src/components/PaymentMethodRow';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { ScreenHeader } from '@/src/components/ScreenHeader';
import { StatusPill } from '@/src/components/StatusPill';
import { useAppContext } from '@/src/context/AppProvider';
import { PaymentProvider } from '@/src/types';
import { colors } from '@/src/theme/colors';
import { radius } from '@/src/theme/radius';
import { shadows } from '@/src/theme/shadows';
import { spacing } from '@/src/theme/spacing';
import { typography } from '@/src/theme/typography';
import { formatCurrency } from '@/src/utils/currency';
import { formatDateLabel, formatMonthLabel } from '@/src/utils/dates';

export default function PayRentScreen() {
  const { paymentId } = useLocalSearchParams<{ paymentId?: string }>();
  const {
    currentTenantPayment,
    dismissHint,
    getPropertyById,
    isHintDismissed,
    ownerUser,
    payRent,
    paymentMethods,
    tenantPayments,
  } = useAppContext();
  const [selectedMethod, setSelectedMethod] = useState<PaymentProvider | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const insets = useSafeAreaInsets();

  const targetPayment =
    tenantPayments.find((payment) => payment.id === paymentId) ?? currentTenantPayment;
  const property = targetPayment ? getPropertyById(targetPayment.propertyId) : undefined;

  if (!targetPayment || !property) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <ScreenHeader
            onBackPress={() => router.back()}
            showBackButton
            title="Payer le loyer"
          />
          <ListEmptyState
            description="Le paiement demandé n'a pas été retrouvé dans cette session."
            title="Paiement indisponible"
          />
        </View>
      </SafeAreaView>
    );
  }

  const alreadyPaid = targetPayment.status === 'paid';

  const handleSubmit = async () => {
    if (!selectedMethod || alreadyPaid || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setSubmissionError(null);

    try {
      const result = await payRent(targetPayment.id, selectedMethod);

      if (!result.ok) {
        setSubmissionError(result.message);
        return;
      }

      router.replace('/(tenant)/payments');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <ScreenHeader
            onBackPress={() => router.back()}
            showBackButton
            subtitle="Sélectionnez un moyen de paiement pour finaliser le loyer"
            title="Payer le loyer"
          />

          {!isHintDismissed('payment-demo') ? (
            <BannerNotice
              description="Démo locale: aucun débit réel n'est effectué. La carte bancaire renvoie un échec simulé pour tester la reprise."
              onDismiss={() => dismissHint('payment-demo')}
              title="Paiement de démonstration"
            />
          ) : null}

          <View style={styles.amountCard}>
            <View style={styles.amountHeader}>
              <View style={styles.amountCopy}>
                <Text style={styles.eyebrow}>Montant dû</Text>
                <Text style={styles.amount}>{formatCurrency(targetPayment.amount)}</Text>
              </View>
              <StatusPill status={targetPayment.status} type="payment" />
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Mois</Text>
              <Text style={styles.detailValue}>{formatMonthLabel(targetPayment.monthKey)}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Propriété</Text>
              <Text style={styles.detailValue}>{property.name}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Propriétaire</Text>
              <Text style={styles.detailValue}>{ownerUser.fullName}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Échéance</Text>
              <Text style={styles.detailValue}>{formatDateLabel(targetPayment.dueDate)}</Text>
            </View>
          </View>

          <View style={styles.methodSection}>
            <Text style={styles.sectionTitle}>Moyen de paiement</Text>
            <View style={styles.methodList}>
              {paymentMethods.map((method) => (
                <PaymentMethodRow
                  disabled={isSubmitting}
                  key={method}
                  method={method}
                  onPress={() => {
                    setSelectedMethod(method);
                    setSubmissionError(null);
                  }}
                  selected={selectedMethod === method}
                />
              ))}
            </View>
          </View>
        </ScrollView>

        <View
          style={[
            styles.footer,
            {
              paddingBottom: Math.max(insets.bottom, spacing.sm),
            },
          ]}>
          {submissionError ? (
            <BannerNotice
              description={submissionError}
              title="Paiement non abouti"
              tone="error"
            />
          ) : null}

          <PrimaryButton
            accessibilityHint="Simule un paiement local et met à jour vos écrans de suivi"
            disabled={alreadyPaid || !selectedMethod}
            label={
              alreadyPaid ? 'Loyer déjà réglé' : `Payer ${formatCurrency(targetPayment.amount)}`
            }
            loading={isSubmitting}
            onPress={handleSubmit}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  screen: {
    flex: 1,
  },
  content: {
    gap: spacing.md,
    padding: spacing.sm,
    paddingBottom: spacing.md,
  },
  amountCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
    padding: spacing.sm,
    ...shadows.card,
  },
  amountHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  amountCopy: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    color: colors.textMuted,
    ...typography.caption,
  },
  amount: {
    color: colors.primaryDark,
    marginTop: spacing.xs,
    ...typography.display,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  detailLabel: {
    color: colors.textMuted,
    ...typography.body,
  },
  detailValue: {
    color: colors.text,
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    textAlign: 'right',
    ...typography.bodyStrong,
  },
  methodSection: {
    gap: spacing.sm,
  },
  sectionTitle: {
    color: colors.text,
    ...typography.subheading,
  },
  methodList: {
    gap: spacing.sm,
  },
  footer: {
    backgroundColor: colors.background,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
  },
});
