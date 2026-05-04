import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BannerNotice } from '@/src/components/BannerNotice';
import { InfoRow } from '@/src/components/InfoRow';
import { JourneyCard } from '@/src/components/JourneyCard';
import { ListEmptyState } from '@/src/components/ListEmptyState';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { ScreenHeader } from '@/src/components/ScreenHeader';
import { AuthCard } from '@/src/components/auth/AuthCard';
import { AuthField } from '@/src/components/auth/AuthField';
import { verifyReceiptViaBackend } from '@/src/services/backendApi';
import { ReceiptRecord } from '@/src/types';
import { colors } from '@/src/theme/colors';
import { spacing } from '@/src/theme/spacing';
import { typography } from '@/src/theme/typography';
import { formatCurrency } from '@/src/utils/currency';
import { formatDateTimeLabel } from '@/src/utils/dates';
import { formatPaymentStatusLabel } from '@/src/utils/paymentStatus';
import { isReceiptSimulated } from '@/src/utils/receipts';

function extractReceiptToken(value: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return '';
  }

  const match = trimmedValue.match(/verify\/([^/?#]+)/);

  if (match?.[1]) {
    return decodeURIComponent(match[1]);
  }

  return trimmedValue;
}

export default function ReceiptVerificationScreen() {
  const params = useLocalSearchParams<{ token?: string }>();
  const [inputValue, setInputValue] = useState(typeof params.token === 'string' ? params.token : '');
  const [receipt, setReceipt] = useState<ReceiptRecord | null>(null);
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const token = useMemo(() => extractReceiptToken(inputValue), [inputValue]);

  const verify = async (value: string) => {
    const normalizedToken = extractReceiptToken(value);

    if (!normalizedToken) {
      setError('Saisissez ou collez le jeton de vérification du reçu.');
      setIsValid(null);
      setReceipt(null);
      return;
    }

    setError(null);

    try {
      const result = await verifyReceiptViaBackend(normalizedToken);
      setReceipt(result.receipt);
      setIsValid(result.valid);
    } catch (verificationError) {
      setError(
        verificationError instanceof Error
          ? verificationError.message
          : 'La vérification du reçu a échoué.',
      );
      setIsValid(false);
      setReceipt(null);
    }
  };

  useEffect(() => {
    if (typeof params.token === 'string' && params.token.trim().length > 0) {
      void verify(params.token);
    }
  }, [params.token]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader
          subtitle="Contrôle public d’une quittance AtouPay générée depuis le backend."
          title="Vérifier un reçu"
        />

        <JourneyCard
          description="La vérification publique doit être rapide: coller, contrôler, lire le résultat."
          steps={[
            {
              description: 'Collez le jeton ou scannez le QR depuis une quittance.',
              iconName: 'copy',
              title: 'Coller',
            },
            {
              description: 'Le backend confirme si le reçu existe dans ATouPay.',
              iconName: 'shield',
              title: 'Contrôler',
            },
            {
              description: 'Le résultat indique clairement si le reçu concerne un paiement simulé.',
              iconName: 'info',
              title: 'Comprendre',
            },
          ]}
          title="Vérification en trois gestes"
          tone="neutral"
        />

        <AuthCard
          description="Collez un jeton ou un lien complet de vérification pour confirmer qu’un reçu existe bien dans ATouPay."
          title="Jeton de vérification">
          <AuthField
            autoCapitalize="none"
            autoCorrect={false}
            helper="Vous pouvez coller soit le jeton brut, soit le lien complet."
            label="Jeton ou lien"
            onChangeText={setInputValue}
            placeholder="Collez ici le jeton ou le lien"
            value={inputValue}
          />

          <View style={styles.actions}>
            <PrimaryButton
              accessibilityHint="Vérifie publiquement le reçu depuis le backend"
              label="Vérifier le reçu"
              onPress={() => {
                void verify(inputValue);
              }}
            />
            <PrimaryButton
              accessibilityHint="Colle un lien ou un jeton depuis le presse-papiers"
              label="Coller depuis le presse-papiers"
              onPress={async () => {
                const clipboardValue = await Clipboard.getStringAsync();
                setInputValue(clipboardValue);
                await verify(clipboardValue);
              }}
              variant="secondary"
            />
          </View>
        </AuthCard>

        {error ? (
          <BannerNotice
            description={error}
            title="Vérification impossible"
            tone="error"
          />
        ) : null}

        {isValid === false ? (
          <ListEmptyState
            description="Le reçu est introuvable ou le jeton ne correspond à aucun enregistrement valide."
            title="Reçu invalide"
          />
        ) : null}

        {isValid && receipt ? (
          <>
            <BannerNotice
              description={
                isReceiptSimulated(receipt)
                  ? 'La quittance existe dans ATouPay. Elle peut servir de justificatif selon les informations enregistrées dans le système. Ce reçu indique un paiement simulé: aucun débit bancaire réel n’est confirmé.'
                  : 'La quittance existe dans ATouPay. Elle peut servir de justificatif selon les informations enregistrées dans le système.'
              }
              title="Reçu valide"
              tone="success"
            />

            <View style={styles.stack}>
              <InfoRow iconName="hash" label="Quittance" value={receipt.receiptNumber} />
              <InfoRow iconName="calendar" label="Date de paiement" value={formatDateTimeLabel(receipt.paidAt ?? receipt.issuedAt)} />
              <InfoRow iconName="clock" label="Date d’émission" value={formatDateTimeLabel(receipt.issuedAt)} />
              <InfoRow iconName="users" label="Locataire" value={receipt.tenantDisplayName ?? receipt.tenantEmail ?? receipt.tenantId} />
              <InfoRow iconName="briefcase" label="Propriétaire" value={receipt.ownerDisplayName ?? receipt.ownerEmail ?? receipt.ownerId} />
              <InfoRow iconName="shield" label="Agence" value={receipt.agencyDisplayName ?? 'Agence non renseignée'} />
              <InfoRow
                iconName="home"
                label="Logement"
                value={[receipt.propertyLabel, receipt.unitLabel].filter(Boolean).join(' • ') || receipt.unitId}
              />
              <InfoRow iconName="dollar-sign" label="Loyer payé" value={formatCurrency(receipt.grossAmount)} />
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
            </View>

            <Text style={styles.disclaimer}>
              Cette vérification confirme uniquement que la quittance a été émise par AtouPay sur la base des données du système. Elle ne prouve pas un débit bancaire réel et ne vaut pas certification bancaire ou gouvernementale automatique.
            </Text>
          </>
        ) : null}

        {!error && isValid == null && token.length === 0 ? (
          <ListEmptyState
            description="Aucun jeton n’a encore été soumis pour contrôle."
            title="En attente de vérification"
          />
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
  actions: {
    gap: spacing.sm,
  },
  stack: {
    gap: spacing.sm,
  },
  disclaimer: {
    color: colors.textMuted,
    ...typography.body,
  },
});
