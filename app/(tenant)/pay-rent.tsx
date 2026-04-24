import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { BannerNotice } from '@/src/components/BannerNotice';
import { ListEmptyState } from '@/src/components/ListEmptyState';
import { PaymentMethodRow } from '@/src/components/PaymentMethodRow';
import { PaymentReceiptCard } from '@/src/components/PaymentReceiptCard';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { ScreenHeader } from '@/src/components/ScreenHeader';
import { StatusPill } from '@/src/components/StatusPill';
import { useAppContext } from '@/src/context/AppProvider';
import { PaymentProvider, PaymentRecord, ReceiptRecord } from '@/src/types';
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
  const [successPayment, setSuccessPayment] = useState<PaymentRecord | null>(null);
  const [successReceipt, setSuccessReceipt] = useState<ReceiptRecord | null>(null);
  const insets = useSafeAreaInsets();

  const targetPayment =
    tenantPayments.find((payment) => payment.id === paymentId) ?? currentTenantPayment;
  const property = targetPayment ? getPropertyById(targetPayment.propertyId) : undefined;
  const propertyLabel = property
    ? [property.name, property.unitLabel].filter(Boolean).join(' • ')
    : undefined;

  if (!targetPayment || !property) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
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

      setSuccessPayment(result.payment ?? null);
      setSuccessReceipt(result.receipt ?? null);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <ScreenHeader
            onBackPress={() => router.back()}
            showBackButton
            subtitle="Sélectionnez un moyen de paiement simulé pour finaliser la démonstration"
            title="Payer le loyer"
          />

        {!isHintDismissed('payment-demo') ? (
          <BannerNotice
            description="Paiement simulé pour démonstration. Aucun débit réel n'est effectué dans cette version. La carte bancaire renvoie un échec simulé pour tester la reprise. La quittance générée par AtouPay reflète uniquement les informations enregistrées dans le système."
            onDismiss={() => dismissHint('payment-demo')}
            title="Paiement simulé pour démonstration"
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
              <Text style={styles.detailValue}>{propertyLabel}</Text>
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

          {successPayment ? (
            <View style={styles.successSection}>
              <BannerNotice
                description={
                  successReceipt
                    ? `Le paiement simulé a bien été enregistré. Un reçu ${successReceipt.receiptNumber} est maintenant disponible.`
                    : 'Le paiement simulé a bien été enregistré. Les vues locataire et propriétaire ont été mises à jour.'
                }
                title="Confirmation simulée prête pour revue"
                tone="success"
              />
              <PaymentReceiptCard
                payment={successPayment}
                propertyName={propertyLabel ?? property.name}
                receipt={successReceipt ?? undefined}
              />
            </View>
          ) : (
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
          )}
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

          {successPayment ? (
            <>
              {successReceipt?.id ? (
                <PrimaryButton
                  accessibilityHint="Ouvre le reçu détaillé généré par le backend"
                  label="Voir le reçu"
                  onPress={() => {
                    router.push(`/receipt/${successReceipt.id}` as never);
                  }}
                  variant="secondary"
                />
              ) : null}
              <PrimaryButton
                accessibilityHint="Ouvre l'historique mis à jour après le paiement simulé"
                label="Voir mes paiements"
                onPress={() => router.replace('/(tenant)/payments')}
              />
              <PrimaryButton
                accessibilityHint="Revient à l'accueil locataire après la confirmation"
                label="Retour à l'accueil"
                onPress={() => router.replace('/(tenant)/home')}
                variant="secondary"
              />
              <PrimaryButton
                accessibilityHint="Signale un problème sur ce paiement simulé"
                label="Signaler un problème"
                onPress={() => {
                  router.push(`/support?category=payment_problem&paymentId=${targetPayment.id}` as never);
                }}
                variant="secondary"
              />
            </>
          ) : (
            <>
              <PrimaryButton
                accessibilityHint="Simule un paiement local et met à jour vos écrans de suivi"
                disabled={alreadyPaid || !selectedMethod}
                label={
                  alreadyPaid ? 'Loyer déjà réglé' : `Payer ${formatCurrency(targetPayment.amount)}`
                }
                loading={isSubmitting}
                onPress={handleSubmit}
              />
              <PrimaryButton
                accessibilityHint="Ouvre l’assistance pour un problème de paiement"
                label="Besoin d’aide sur ce paiement"
                onPress={() => {
                  router.push(`/support?category=payment_problem&paymentId=${targetPayment.id}` as never);
                }}
                variant="secondary"
              />
            </>
          )}
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
  successSection: {
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
