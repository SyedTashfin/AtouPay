import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';

import { BannerNotice } from '@/src/components/BannerNotice';
import { InfoRow } from '@/src/components/InfoRow';
import { JourneyCard } from '@/src/components/JourneyCard';
import { ListEmptyState } from '@/src/components/ListEmptyState';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { ScreenHeader } from '@/src/components/ScreenHeader';
import { getReceiptViaBackend, mapBackendErrorToMessage } from '@/src/services/backendApi';
import {
  exportReceiptPdf,
  getReceiptPdfFailureMessage,
} from '@/src/services/receiptDocument';
import { ReceiptRecord } from '@/src/types';
import { colors } from '@/src/theme/colors';
import { radius } from '@/src/theme/radius';
import { shadows } from '@/src/theme/shadows';
import { spacing } from '@/src/theme/spacing';
import { typography } from '@/src/theme/typography';
import { formatCurrency } from '@/src/utils/currency';
import { formatDateTimeLabel } from '@/src/utils/dates';
import { formatPaymentStatusLabel } from '@/src/utils/paymentStatus';
import { isReceiptSimulated } from '@/src/utils/receipts';

export default function ReceiptDetailScreen() {
  const { receiptId } = useLocalSearchParams<{ receiptId?: string }>();
  const [receipt, setReceipt] = useState<ReceiptRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportFeedback, setExportFeedback] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadReceipt() {
      if (!receiptId) {
        setError('Le reçu demandé est introuvable.');
        return;
      }

      try {
        const nextReceipt = await getReceiptViaBackend(receiptId);

        if (isMounted) {
          setReceipt(nextReceipt);
        }
      } catch (loadError) {
        if (!isMounted) {
          return;
        }

        setError(
          mapBackendErrorToMessage(loadError, 'Le reçu n’a pas pu être chargé.'),
        );
      }
    }

    void loadReceipt();

    return () => {
      isMounted = false;
    };
  }, [receiptId]);

  const handleExportPdf = async () => {
    if (!receipt) {
      return;
    }

    setIsExporting(true);
    setExportError(null);
    setExportFeedback(null);

    try {
      await exportReceiptPdf(receipt);
      setExportFeedback('Le PDF a été généré. Le partage natif s’ouvre automatiquement si le téléphone le permet.');
    } catch (exportError) {
      console.error('[receipt-pdf] Export failed', exportError);
      setExportError(getReceiptPdfFailureMessage());
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopyVerificationLink = async () => {
    if (!receipt?.verificationUrl) {
      return;
    }

    await Clipboard.setStringAsync(receipt.verificationUrl);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader
          onBackPress={() => router.back()}
          showBackButton
          subtitle="Quittance générée par AtouPay à partir des données enregistrées côté backend."
          title="Détail du reçu"
        />

        {error ? (
          <BannerNotice
            description={error}
            title="Reçu indisponible"
            tone="error"
          />
        ) : null}

        {exportError ? (
          <BannerNotice
            description={exportError}
            title="PDF indisponible"
            tone="error"
          />
        ) : null}

        {exportFeedback ? (
          <BannerNotice
            description={exportFeedback}
            title="PDF prêt"
            tone="success"
          />
        ) : null}

        {!receipt && !error ? (
          <ListEmptyState
            description="Le reçu est en cours de chargement depuis le backend."
            title="Chargement du reçu"
          />
        ) : null}

        {receipt ? (
          <>
            <BannerNotice
              description={
                isReceiptSimulated(receipt)
                  ? 'Cette quittance peut servir de justificatif selon les informations enregistrées dans le système. Le paiement est simulé: aucun débit bancaire réel ni aucune répartition financière réelle n’ont été exécutés.'
                  : 'Cette quittance peut servir de justificatif selon les informations enregistrées dans le système.'
              }
              title={
                isReceiptSimulated(receipt)
                  ? 'Quittance AtouPay • paiement simulé'
                  : 'Quittance AtouPay'
              }
              tone="info"
            />

            <JourneyCard
              description="Les actions importantes sont regroupées pour éviter une page de reçu uniquement composée de lignes techniques."
              steps={[
                {
                  description: 'Consultez le montant du loyer payé et les informations de vérification.',
                  iconName: 'file-text',
                  title: 'Lire le reçu',
                },
                {
                  description: 'Partagez le PDF ou le lien de vérification si nécessaire.',
                  iconName: 'share-2',
                  title: 'Partager',
                },
                {
                  description: 'Signalez un problème si les informations enregistrées sont incorrectes.',
                  iconName: 'alert-circle',
                  title: 'Corriger',
                },
              ]}
              title="Que faire avec ce reçu ?"
            />

            <View style={styles.card}>
              <Text style={styles.title}>{receipt.receiptNumber}</Text>
              <Text style={styles.subtitle}>
                {receipt.propertyLabel
                  ? [receipt.propertyLabel, receipt.unitLabel].filter(Boolean).join(' • ')
                  : receipt.unitLabel ?? 'Logement ATouPay'}
              </Text>
              <Text style={styles.metaText}>
                {`Émise le ${formatDateTimeLabel(receipt.issuedAt)}`}
              </Text>
            </View>

            {receipt.verificationUrl ? (
              <View style={styles.qrCard}>
                <QRCode
                  backgroundColor={colors.surface}
                  color={colors.text}
                  size={168}
                  value={receipt.verificationUrl}
                />
                <Text style={styles.qrText}>
                  Scannez ce QR pour ouvrir la vérification publique du reçu.
                </Text>
              </View>
            ) : null}

            <View style={styles.stack}>
              <InfoRow iconName="hash" label="Quittance" value={receipt.receiptNumber} />
              <InfoRow iconName="calendar" label="Date de paiement" value={formatDateTimeLabel(receipt.paidAt ?? receipt.issuedAt)} />
              <InfoRow iconName="clock" label="Date d’émission" value={formatDateTimeLabel(receipt.issuedAt)} />
              <InfoRow
                iconName="credit-card"
                label="Mode de paiement"
                value={receipt.paymentMethod ?? (isReceiptSimulated(receipt) ? 'Simulation' : 'Non renseigné')}
              />
              <InfoRow
                iconName="check-circle"
                label="Statut"
                value={formatPaymentStatusLabel(receipt.paymentStatus)}
              />
              <InfoRow iconName="users" label="Locataire" value={receipt.tenantDisplayName ?? receipt.tenantEmail ?? receipt.tenantId} />
              <InfoRow iconName="briefcase" label="Propriétaire" value={receipt.ownerDisplayName ?? receipt.ownerEmail ?? receipt.ownerId} />
              <InfoRow iconName="shield" label="Agence" value={receipt.agencyDisplayName ?? 'Agence non renseignée'} />
              <InfoRow iconName="dollar-sign" label="Loyer payé" value={formatCurrency(receipt.grossAmount)} />
              <InfoRow
                iconName="link"
                label="Jeton de vérification"
                value={receipt.qrVerificationToken}
              />
            </View>

            <View style={styles.actions}>
              <PrimaryButton
                accessibilityHint="Génère un PDF du reçu et ouvre le partage natif si disponible"
                label="Télécharger / partager le PDF"
                loading={isExporting}
                onPress={() => {
                  void handleExportPdf();
                }}
              />
              {receipt.verificationUrl ? (
                <PrimaryButton
                  accessibilityHint="Copie le lien public de vérification du reçu"
                  label="Copier le lien de vérification"
                  onPress={() => {
                    void handleCopyVerificationLink();
                  }}
                  variant="secondary"
                />
              ) : null}
              <PrimaryButton
                accessibilityHint="Signale un problème sur ce paiement ou ce reçu"
                label="Signaler un problème"
                onPress={() => {
                  router.push(`/support?category=payment_problem&paymentId=${receipt.paymentId}` as never);
                }}
                variant="secondary"
              />
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  content: {
    gap: spacing.md,
    padding: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  card: {
    gap: spacing.xs,
  },
  qrCard: {
    alignItems: 'center',
    backgroundColor: colors.surfaceGlass,
    borderColor: colors.border,
    borderRadius: radius.xl,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
    ...shadows.soft,
  },
  qrText: {
    color: colors.textMuted,
    textAlign: 'center',
    ...typography.caption,
  },
  title: {
    color: colors.text,
    ...typography.heading,
  },
  subtitle: {
    color: colors.textMuted,
    ...typography.body,
  },
  metaText: {
    color: colors.textMuted,
    ...typography.caption,
  },
  stack: {
    gap: spacing.sm,
  },
  actions: {
    gap: spacing.sm,
  },
});
