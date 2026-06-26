import { AppState, Image, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { BannerNotice } from '@/src/components/BannerNotice';
import { ListEmptyState } from '@/src/components/ListEmptyState';
import { PaymentMethodRow } from '@/src/components/PaymentMethodRow';
import { PaymentReceiptCard } from '@/src/components/PaymentReceiptCard';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { ScreenHeader } from '@/src/components/ScreenHeader';
import { StatusPill } from '@/src/components/StatusPill';
import { AuthField } from '@/src/components/auth/AuthField';
import { useAppContext } from '@/src/context/AppProvider';
import { useSession } from '@/src/context/SessionProvider';
import { useI18n } from '@/src/i18n/I18nProvider';
import { appConfig, isBackendEnabled } from '@/src/config/env';
import { getAppPinStatus, isValidAppPin, setAppPin, verifyAppPin } from '@/src/services/appPin';
import {
  getRentPaymentStatusViaBackend,
  submitManualPaymentProofViaBackend,
} from '@/src/services/backendApi';
import {
  getBankilyPaymentReference,
  getOwnerBankilyIntegrationMode,
  isUnverifiedBankilyDeepLinkAllowed,
  resolveBankilyOpenUrl,
} from '@/src/services/bankily';
import { uploadManualPaymentProofImage } from '@/src/services/paymentProofUpload';
import { exportReceiptPdf, getReceiptPdfFailureMessage } from '@/src/services/receiptDocument';
import {
  PaymentProvider,
  PaymentRecord,
  ReceiptRecord,
  RentPaymentIntentSummary,
} from '@/src/types';
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
  const [pendingIntent, setPendingIntent] = useState<RentPaymentIntentSummary | null>(null);
  const [bankilyAtouPayReferenceInput, setBankilyAtouPayReferenceInput] = useState('');
  const [bankilyProofAmount, setBankilyProofAmount] = useState('');
  const [bankilyProofDate, setBankilyProofDate] = useState(new Date().toISOString().slice(0, 10));
  const [bankilyProofTime, setBankilyProofTime] = useState('');
  const [bankilyProofReference, setBankilyProofReference] = useState('');
  const [bankilyProofNote, setBankilyProofNote] = useState('');
  const [bankilyProofImage, setBankilyProofImage] =
    useState<ImagePicker.ImagePickerAsset | null>(null);
  const [bankilyFlowNotice, setBankilyFlowNotice] = useState<string | null>(null);
  const [bankilyAwaitingReturn, setBankilyAwaitingReturn] = useState(false);
  const [isPickingProofImage, setIsPickingProofImage] = useState(false);
  const [isExportingReceipt, setIsExportingReceipt] = useState(false);
  const [isPinEnabled, setIsPinEnabled] = useState(false);
  const [isPinLoaded, setIsPinLoaded] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [newPin, setNewPin] = useState('');
  const [newPinConfirmation, setNewPinConfirmation] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  const { session } = useSession();
  const { copy } = useI18n();

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
  const userKey = session?.firebaseUid ?? session?.profile?.email ?? null;
  const rentAmount = targetPayment.rentAmount ?? targetPayment.grossAmount ?? targetPayment.amount;
  const tenantFeeAmount = targetPayment.tenantFeeAmount ?? 0;
  const totalToPay = rentAmount + tenantFeeAmount;
  const bankilyIntegrationMode = getOwnerBankilyIntegrationMode(ownerUser);
  const bankilyReference = getBankilyPaymentReference(targetPayment);
  const bankilyPaymentMethodVerified = ownerUser.bankilyPaymentMethodStatus === 'verified';
  const isBankilySelected = selectedMethod === 'Bankily';
  const isDirectBankilyMode =
    isBankilySelected &&
    bankilyPaymentMethodVerified &&
    bankilyIntegrationMode !== 'moosyl_provider' &&
    bankilyIntegrationMode !== 'not_configured';
  const bankilyRecipient =
    ownerUser.bankilyMerchantCode ?? ownerUser.bankilyPhoneNumber ?? 'Needs confirmation';
  const submittedAmount = Number(bankilyProofAmount.replace(/\s/g, '').replace(',', '.'));
  const proofReferenceMismatch =
    bankilyAtouPayReferenceInput.trim().length > 0 &&
    bankilyAtouPayReferenceInput.trim().toUpperCase() !== bankilyReference.toUpperCase();
  const proofAmountMismatch =
    bankilyProofAmount.trim().length > 0 &&
    Number.isFinite(submittedAmount) &&
    submittedAmount !== totalToPay;

  useEffect(() => {
    let isMounted = true;

    async function loadPinStatus() {
      if (!userKey) {
        if (isMounted) {
          setIsPinLoaded(true);
        }
        return;
      }

      const status = await getAppPinStatus(userKey);

      if (isMounted) {
        setIsPinEnabled(status.enabled);
        setIsPinLoaded(true);
      }
    }

    void loadPinStatus();

    return () => {
      isMounted = false;
    };
  }, [userKey]);

  useEffect(() => {
    if (!bankilyAwaitingReturn || bankilyIntegrationMode !== 'deep_link_confirmed') {
      return undefined;
    }

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        setBankilyAwaitingReturn(false);
        void refreshBankilyStatusAfterReturn();
      }
    });

    return () => subscription.remove();
  }, [bankilyAwaitingReturn, bankilyIntegrationMode]);

  useEffect(() => {
    setBankilyAtouPayReferenceInput(bankilyReference);
    setBankilyProofAmount(String(totalToPay));
  }, [bankilyReference, totalToPay]);

  const normalizePinInput = (value: string) => value.replace(/\D/g, '').slice(0, 4);

  const verifyOrCreatePin = async () => {
    if (!userKey) {
      setPinError('Session introuvable. Reconnectez-vous avant de payer.');
      return false;
    }

    if (!isPinLoaded) {
      setPinError('Chargement du code PIN. Réessayez dans un instant.');
      return false;
    }

    if (isPinEnabled) {
      const verified = await verifyAppPin(userKey, pinInput);

      if (!verified) {
        setPinError('Code PIN incorrect.');
        return false;
      }

      setPinInput('');
      setPinError(null);
      return true;
    }

    if (!isValidAppPin(newPin)) {
      setPinError('Choisissez un code PIN de 4 chiffres.');
      return false;
    }

    if (newPin !== newPinConfirmation) {
      setPinError('Les deux codes PIN ne correspondent pas.');
      return false;
    }

    await setAppPin(userKey, newPin);
    setIsPinEnabled(true);
    setNewPin('');
    setNewPinConfirmation('');
    setPinError(null);

    return true;
  };

  async function refreshBankilyStatusAfterReturn() {
    if (!targetPayment) {
      return;
    }

    if (!isBackendEnabled) {
      setBankilyFlowNotice(
        'Retour détecté. Aucun backend de vérification Bankily n’est activé dans cette build.',
      );
      return;
    }

    try {
      const status = await getRentPaymentStatusViaBackend(targetPayment.id);
      setBankilyFlowNotice(
        status.paymentStatus === 'paid' && status.receiptId
          ? 'Paiement confirmé par le backend. Le reçu est disponible dans vos quittances.'
          : 'Retour détecté. Aucun paiement confirmé par le backend pour le moment.',
      );
    } catch {
      setBankilyFlowNotice(
        'Retour détecté, mais ATouPay n’a pas pu vérifier le statut backend.',
      );
    }
  }

  const handleOpenBankily = async () => {
    if (!isBankilySelected || alreadyPaid || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setSubmissionError(null);
    setBankilyFlowNotice(null);

    try {
      if (!bankilyPaymentMethodVerified) {
        setSubmissionError(
          'Le paiement direct n’est pas encore configuré pour ce logement. Contactez l’agence.',
        );
        return;
      }

      const pinReady = await verifyOrCreatePin();

      if (!pinReady) {
        return;
      }

      if (
        !isUnverifiedBankilyDeepLinkAllowed({
          appVariant: appConfig.appVariant,
          mode: bankilyIntegrationMode,
        })
      ) {
        setSubmissionError(
          'Le test de lien Bankily non vérifié est bloqué en production.',
        );
        return;
      }

      const url = resolveBankilyOpenUrl({
        amount: totalToPay,
        mode: bankilyIntegrationMode,
        owner: ownerUser,
        reference: bankilyReference,
      });

      if (!url) {
        setSubmissionError(
          'Aucun modèle de lien Bankily confirmé n’est configuré pour ce propriétaire.',
        );
        return;
      }

      if (url === 'bankily://') {
        const canOpenBankily = await Linking.canOpenURL(url);

        if (!canOpenBankily) {
          setSubmissionError(
            'Bankily ne peut pas être ouvert automatiquement sur cet appareil. Ouvrez Bankily manuellement puis ajoutez la référence ou une preuve.',
          );
          return;
        }
      }

      await Linking.openURL(url);
      setBankilyFlowNotice('Après paiement, ajoutez la référence ou une preuve.');
      setBankilyAwaitingReturn(bankilyIntegrationMode === 'deep_link_confirmed');
    } catch {
      setSubmissionError(
        'ATouPay n’a pas pu ouvrir Bankily. Ouvrez Bankily manuellement puis ajoutez la référence ou une preuve.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePickBankilyProofImage = async () => {
    setIsPickingProofImage(true);
    setSubmissionError(null);

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        setSubmissionError(
          'Autorisez l’accès aux photos pour joindre une capture de paiement.',
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: false,
        mediaTypes: ['images'],
        quality: 0.7,
      });

      if (!result.canceled && result.assets[0]) {
        setBankilyProofImage(result.assets[0]);
        setBankilyFlowNotice(
          'Capture sélectionnée. Elle sera transmise comme preuve de revue, pas comme confirmation bancaire.',
        );
      }
    } catch {
      setSubmissionError('La capture n’a pas pu être sélectionnée.');
    } finally {
      setIsPickingProofImage(false);
    }
  };

  const handleCopyBankilyReference = async () => {
    await Clipboard.setStringAsync(bankilyReference);
    setBankilyFlowNotice('Référence ATouPay copiée.');
  };

  const handleSubmitBankilyProof = async () => {
    const atouPayReference = bankilyAtouPayReferenceInput.trim();
    const transactionReference = bankilyProofReference.trim();
    const note = bankilyProofNote.trim();
    const paymentDate = bankilyProofDate.trim();
    const paymentTime = bankilyProofTime.trim();

    if (!atouPayReference) {
      setSubmissionError('Saisissez la référence ATouPay du paiement.');
      return;
    }

    if (!Number.isFinite(submittedAmount) || submittedAmount <= 0) {
      setSubmissionError('Saisissez le montant payé déclaré.');
      return;
    }

    if (!paymentDate) {
      setSubmissionError('Saisissez la date du paiement déclaré.');
      return;
    }

    if (!transactionReference && !note && !bankilyProofImage) {
      setSubmissionError('Ajoutez une référence transactionnelle, une note ou une capture de preuve.');
      return;
    }

    if (!isBackendEnabled) {
      setSubmissionError(
        'Le backend ATouPay doit être activé pour transmettre une preuve image.',
      );
      return;
    }

    setIsSubmitting(true);
    setSubmissionError(null);

    try {
      if (bankilyProofImage && !targetPayment.agencyId) {
        setSubmissionError(
          'Le rattachement agence du paiement est requis pour joindre une capture sécurisée.',
        );
        return;
      }

      const proofImageMetadata = bankilyProofImage
        ? await uploadManualPaymentProofImage({
            agencyId: targetPayment.agencyId!,
            asset: bankilyProofImage,
            paymentId: targetPayment.id,
            tenantId: targetPayment.tenantId,
          })
        : null;

      await submitManualPaymentProofViaBackend({
        note,
        paymentId: targetPayment.id,
        paymentMethod: 'Bankily',
        ...(proofImageMetadata ?? {}),
        providerReference: transactionReference,
        submittedAmount,
        submittedCurrency: 'MRU',
        submittedNote: note,
        submittedPaymentDate: paymentDate,
        submittedPaymentMethod: 'bankily',
        submittedPaymentReference: atouPayReference,
        ...(paymentTime ? { submittedPaymentTime: paymentTime } : {}),
        ...(transactionReference ? { submittedTransactionReference: transactionReference } : {}),
      });

      setBankilyFlowNotice(
        'Preuve enregistrée pour revue. Le reçu sera généré uniquement après confirmation propriétaire ou agence.',
      );
      setBankilyAtouPayReferenceInput(bankilyReference);
      setBankilyProofAmount(String(totalToPay));
      setBankilyProofDate(new Date().toISOString().slice(0, 10));
      setBankilyProofTime('');
      setBankilyProofReference('');
      setBankilyProofNote('');
      setBankilyProofImage(null);
    } catch {
      setSubmissionError(
        'La preuve n’a pas pu être transmise. Réessayez ou contactez l’agence.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedMethod || alreadyPaid || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setSubmissionError(null);

    try {
      const pinReady = await verifyOrCreatePin();

      if (!pinReady) {
        return;
      }

      const result = await payRent(targetPayment.id, selectedMethod);

      if (!result.ok) {
        setSubmissionError(result.message);
        return;
      }

      setPendingIntent(result.intent ?? null);
      setSuccessPayment(result.payment ?? null);
      setSuccessReceipt(result.receipt ?? null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExportSuccessReceiptPdf = async () => {
    if (!successReceipt || isExportingReceipt) {
      return;
    }

    setIsExportingReceipt(true);
    setSubmissionError(null);

    try {
      await exportReceiptPdf(successReceipt);
    } catch (exportError) {
      console.error('[receipt-pdf] Export failed after payment', exportError);
      setSubmissionError(getReceiptPdfFailureMessage());
    } finally {
      setIsExportingReceipt(false);
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
                <Text style={styles.eyebrow}>{copy('Montant dû')}</Text>
                <Text style={styles.amount}>{formatCurrency(totalToPay)}</Text>
              </View>
              <StatusPill status={targetPayment.status} type="payment" />
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{copy('Loyer')}</Text>
              <Text style={styles.detailValue}>{formatCurrency(rentAmount)}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{copy('Frais locataire ATouPay')}</Text>
              <Text style={styles.detailValue}>{formatCurrency(tenantFeeAmount)}</Text>
            </View>
            <Text style={styles.feeNotice}>
              Aucun frais supplémentaire n’est facturé au locataire par ATouPay.
            </Text>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{copy('Mois')}</Text>
              <Text style={styles.detailValue}>{formatMonthLabel(targetPayment.monthKey)}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{copy('Propriété')}</Text>
              <Text style={styles.detailValue}>{propertyLabel}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{copy('Propriétaire')}</Text>
              <Text style={styles.detailValue}>{ownerUser.fullName}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{copy('Échéance')}</Text>
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
          ) : pendingIntent ? (
            <View style={styles.successSection}>
              <BannerNotice
                description={
                  pendingIntent.provider === 'moosyl'
                    ? 'Paiement en cours. ATouPay attend la confirmation backend du prestataire avant de générer le reçu.'
                    : 'Paiement en cours de validation.'
                }
                title="Paiement en cours"
                tone="success"
              />
              <View style={styles.pendingCard}>
                <Text style={styles.sectionTitle}>Statut prestataire</Text>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Statut</Text>
                  <Text style={styles.detailValue}>
                    {pendingIntent.status === 'paid'
                      ? 'Paiement confirmé'
                      : pendingIntent.status === 'failed'
                        ? 'Paiement échoué'
                        : pendingIntent.status === 'cancelled'
                          ? 'Paiement annulé'
                          : 'Paiement en cours'}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Prestataire</Text>
                  <Text style={styles.detailValue}>{pendingIntent.provider}</Text>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.methodSection}>
              <Text style={styles.sectionTitle}>{copy('Moyen de paiement')}</Text>
              <View style={styles.methodList}>
                {paymentMethods.map((method) => (
                  <PaymentMethodRow
                    disabled={isSubmitting}
                    key={method}
                    method={method}
                    onPress={() => {
                      setSelectedMethod(method);
                      setPendingIntent(null);
                      setSubmissionError(null);
                    }}
                    selected={selectedMethod === method}
                  />
                ))}
              </View>

              {isBankilySelected ? (
                <View style={styles.bankilyCard}>
                  <Text style={styles.sectionTitle}>Bankily</Text>
                  <Text style={styles.bankilyHelper}>
                    {!bankilyPaymentMethodVerified && bankilyIntegrationMode !== 'moosyl_provider'
                      ? 'Le paiement direct n’est pas encore configuré pour ce logement. Contactez l’agence.'
                      : bankilyIntegrationMode === 'qr_or_code_manual'
                      ? 'Mode QR/code manuel. ATouPay ne marque pas le loyer payé après le retour de Bankily.'
                      : bankilyIntegrationMode === 'deep_link_unverified'
                        ? 'Lien Bankily expérimental. Test autorisé uniquement en développement ou preview.'
                        : bankilyIntegrationMode === 'deep_link_confirmed'
                          ? 'Lien Bankily confirmé requis. ATouPay vérifiera le backend au retour.'
                          : bankilyIntegrationMode === 'moosyl_provider'
                            ? 'Ce paiement passera par le flux prestataire Moosyl existant.'
                            : 'Bankily n’est pas configuré pour ce propriétaire.'}
                  </Text>

                  {bankilyIntegrationMode !== 'moosyl_provider' && bankilyPaymentMethodVerified ? (
                    <>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Destinataire</Text>
                        <Text style={styles.detailValue}>{bankilyRecipient}</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Montant</Text>
                        <Text style={styles.detailValue}>{formatCurrency(totalToPay)}</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Référence unique</Text>
                        <Text style={styles.detailValue}>{bankilyReference}</Text>
                      </View>
                      <PrimaryButton
                        accessibilityHint="Copie la référence ATouPay du paiement"
                        label="Copier la référence"
                        onPress={() => {
                          void handleCopyBankilyReference();
                        }}
                        variant="ghost"
                      />
                      <Text style={styles.bankilyHelper}>
                        Ajoutez cette référence au paiement Bankily si possible.
                      </Text>
                      {ownerUser.bankilyQrImageUrl ? (
                        <Text style={styles.bankilyHelper}>
                          QR Bankily configuré: {ownerUser.bankilyQrImageUrl}
                        </Text>
                      ) : null}
                      {bankilyFlowNotice ? (
                        <Text style={styles.bankilyNotice}>{bankilyFlowNotice}</Text>
                      ) : null}
                      <AuthField
                        autoCapitalize="characters"
                        helper={proofReferenceMismatch ? 'Attention: cette référence ne correspond pas au paiement affiché.' : 'Référence ATouPay obligatoire.'}
                        label="Référence ATouPay"
                        onChangeText={setBankilyAtouPayReferenceInput}
                        placeholder={bankilyReference}
                        value={bankilyAtouPayReferenceInput}
                      />
                      <AuthField
                        helper={proofAmountMismatch ? 'Attention: ce montant ne correspond pas au loyer attendu.' : 'Montant payé déclaré en MRU.'}
                        keyboardType="numeric"
                        label="Montant payé"
                        onChangeText={setBankilyProofAmount}
                        placeholder={String(totalToPay)}
                        value={bankilyProofAmount}
                      />
                      <AuthField
                        helper="Date du paiement déclaré."
                        label="Date du paiement"
                        onChangeText={setBankilyProofDate}
                        placeholder="AAAA-MM-JJ"
                        value={bankilyProofDate}
                      />
                      <AuthField
                        helper="Optionnel."
                        label="Heure du paiement"
                        onChangeText={setBankilyProofTime}
                        placeholder="HH:MM"
                        value={bankilyProofTime}
                      />
                      <AuthField
                        autoCapitalize="characters"
                        helper="Référence transactionnelle Bankily si disponible. Aucun reçu n’est généré depuis cette déclaration seule."
                        label="Référence transactionnelle"
                        onChangeText={setBankilyProofReference}
                        placeholder="Ex: BKY-123456"
                        value={bankilyProofReference}
                      />
                      <AuthField
                        helper="Décrivez la preuve ou indiquez qu’une capture sera transmise au support agence."
                        label="Note de preuve"
                        multiline
                        onChangeText={setBankilyProofNote}
                        placeholder="Capture, horodatage ou commentaire"
                        value={bankilyProofNote}
                      />
                      <View style={styles.proofImageBox}>
                        <View style={styles.proofImageCopy}>
                          <Text style={styles.proofImageTitle}>
                            Capture / preuve photo
                          </Text>
                          <Text style={styles.bankilyHelper}>
                            La capture aide la revue propriétaire/agence. Elle ne confirme pas le paiement bancaire.
                          </Text>
                          {bankilyProofImage ? (
                            <Text style={styles.bankilyHelper}>
                              {bankilyProofImage.fileName ?? 'Image sélectionnée'}
                            </Text>
                          ) : null}
                        </View>
                        {bankilyProofImage ? (
                          <Image
                            accessibilityIgnoresInvertColors
                            source={{ uri: bankilyProofImage.uri }}
                            style={styles.proofPreview}
                          />
                        ) : null}
                        <PrimaryButton
                          accessibilityHint="Ouvre la galerie pour sélectionner une capture de paiement"
                          label="Joindre une capture / preuve"
                          loading={isPickingProofImage}
                          onPress={() => {
                            void handlePickBankilyProofImage();
                          }}
                          variant="secondary"
                        />
                      </View>
                      <PrimaryButton
                        accessibilityHint="Transmet la référence ou la preuve sans marquer le paiement comme payé"
                        label="Ajouter la référence ou la preuve"
                        loading={isSubmitting}
                        onPress={() => {
                          void handleSubmitBankilyProof();
                        }}
                        variant="secondary"
                      />
                    </>
                  ) : null}
                </View>
              ) : null}

              <View style={styles.pinCard}>
                <Text style={styles.sectionTitle}>{copy('Code PIN')}</Text>
                <Text style={styles.pinHelper}>
                  {isPinEnabled
                    ? copy('Entrez votre PIN local pour confirmer ce paiement simulé.')
                    : copy('Choisissez un PIN local de 4 chiffres. Il servira à confirmer les actions sensibles sur ce téléphone.')}
                </Text>
                {isPinEnabled ? (
                  <AuthField
                    autoComplete="off"
                    keyboardType="number-pad"
                    label="PIN"
                    maxLength={4}
                    onChangeText={(value) => {
                      setPinError(null);
                      setPinInput(normalizePinInput(value));
                    }}
                    placeholder="••••"
                    secureTextEntry
                    textContentType="oneTimeCode"
                    value={pinInput}
                  />
                ) : (
                  <>
                    <AuthField
                      autoComplete="off"
                      helper="4 chiffres"
                      keyboardType="number-pad"
                      label="Créer un PIN"
                      maxLength={4}
                      onChangeText={(value) => {
                        setPinError(null);
                        setNewPin(normalizePinInput(value));
                      }}
                      placeholder="••••"
                      secureTextEntry
                      textContentType="oneTimeCode"
                      value={newPin}
                    />
                    <AuthField
                      autoComplete="off"
                      keyboardType="number-pad"
                      label="Confirmer le PIN"
                      maxLength={4}
                      onChangeText={(value) => {
                        setPinError(null);
                        setNewPinConfirmation(normalizePinInput(value));
                      }}
                      placeholder="••••"
                      secureTextEntry
                      textContentType="oneTimeCode"
                      value={newPinConfirmation}
                    />
                  </>
                )}
                {pinError ? <Text style={styles.pinError}>{pinError}</Text> : null}
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
              {successReceipt ? (
                <PrimaryButton
                  accessibilityHint="Génère un PDF du reçu et ouvre le partage natif si disponible"
                  label="Télécharger / partager le PDF"
                  loading={isExportingReceipt}
                  onPress={() => {
                    void handleExportSuccessReceiptPdf();
                  }}
                  variant="secondary"
                />
              ) : null}
              <PrimaryButton
                accessibilityHint="Ouvre la liste des quittances mensuelles"
                label="Voir mes quittances"
                onPress={() => router.replace('/(tenant)/receipts' as never)}
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
          ) : pendingIntent ? (
            <>
              <PrimaryButton
                accessibilityHint="Ouvre la liste de vos paiements"
                label="Voir mes paiements"
                onPress={() => router.replace('/(tenant)/payments' as never)}
              />
              <PrimaryButton
                accessibilityHint="Revient à l'accueil locataire pendant la confirmation"
                label="Retour à l'accueil"
                onPress={() => router.replace('/(tenant)/home')}
                variant="secondary"
              />
              <PrimaryButton
                accessibilityHint="Ouvre l’assistance pour un problème de paiement en cours"
                label="Besoin d’aide sur ce paiement"
                onPress={() => {
                  router.push(`/support?category=payment_problem&paymentId=${targetPayment.id}` as never);
                }}
                variant="secondary"
              />
            </>
          ) : (
            <>
              <PrimaryButton
                accessibilityHint={
                  isDirectBankilyMode
                    ? 'Ouvre Bankily sans confirmer automatiquement le paiement dans ATouPay'
                    : 'Simule un paiement local et met à jour vos écrans de suivi'
                }
                disabled={
                  alreadyPaid ||
                  !selectedMethod ||
                  (isBankilySelected &&
                    (bankilyIntegrationMode === 'not_configured' ||
                      (!bankilyPaymentMethodVerified &&
                        bankilyIntegrationMode !== 'moosyl_provider')))
                }
                label={
                  alreadyPaid
                    ? 'Loyer déjà réglé'
                    : isDirectBankilyMode
                      ? 'Ouvrir Bankily'
                      : isBankilySelected &&
                          !bankilyPaymentMethodVerified &&
                          bankilyIntegrationMode !== 'moosyl_provider'
                        ? 'Paiement direct non configuré'
                      : isBankilySelected && bankilyIntegrationMode === 'not_configured'
                        ? 'Bankily non configuré'
                        : `${copy('Payer')} ${formatCurrency(totalToPay)}`
                }
                loading={isSubmitting}
                onPress={isDirectBankilyMode ? handleOpenBankily : handleSubmit}
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
    backgroundColor: colors.role.tenant.background,
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
    backgroundColor: colors.role.tenant.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.role.tenant.border,
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
    color: colors.role.tenant.active,
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
  feeNotice: {
    color: colors.role.tenant.active,
    ...typography.caption,
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
  pinCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.sm,
  },
  pendingCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.sm,
  },
  bankilyCard: {
    backgroundColor: colors.surface,
    borderColor: colors.role.tenant.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.sm,
  },
  bankilyHelper: {
    color: colors.textMuted,
    ...typography.caption,
  },
  bankilyNotice: {
    color: colors.role.tenant.active,
    ...typography.bodyStrong,
  },
  proofImageBox: {
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.sm,
  },
  proofImageCopy: {
    gap: spacing.xs,
  },
  proofImageTitle: {
    color: colors.text,
    ...typography.bodyStrong,
  },
  proofPreview: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    height: 120,
    width: 120,
  },
  pinHelper: {
    color: colors.textMuted,
    ...typography.caption,
  },
  pinError: {
    color: colors.danger,
    ...typography.caption,
  },
  footer: {
    backgroundColor: colors.role.tenant.background,
    borderTopColor: colors.role.tenant.border,
    borderTopWidth: 1,
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
  },
});
