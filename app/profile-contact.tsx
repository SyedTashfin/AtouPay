import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BannerNotice } from '@/src/components/BannerNotice';
import { AppPinSettingsCard } from '@/src/components/AppPinSettingsCard';
import { JourneyCard } from '@/src/components/JourneyCard';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { ScreenHeader } from '@/src/components/ScreenHeader';
import { AuthCard } from '@/src/components/auth/AuthCard';
import { AuthField } from '@/src/components/auth/AuthField';
import {
  getProfileContactViaBackend,
  mapBackendErrorToMessage,
  updateProfileContactViaBackend,
} from '@/src/services/backendApi';
import { RecoveryContactPreference } from '@/src/types';
import { sendPhoneOtp, verifyPhoneOtp, type PhoneOtpChallenge } from '@/src/services/phoneOtp';
import { colors } from '@/src/theme/colors';
import { spacing } from '@/src/theme/spacing';
import { typography } from '@/src/theme/typography';

interface FeedbackState {
  description: string;
  title: string;
  tone: 'error' | 'info' | 'success';
}

const preferences: RecoveryContactPreference[] = ['email', 'phone'];

export default function ProfileContactScreen() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneStatus, setPhoneStatus] = useState<'unverified' | 'verified' | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [otpChallenge, setOtpChallenge] = useState<PhoneOtpChallenge | null>(null);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [preference, setPreference] = useState<RecoveryContactPreference>('email');
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;

    void getProfileContactViaBackend()
      .then((profileContact) => {
        if (!isMounted) {
          return;
        }

        setPhoneNumber(profileContact.phoneNumber ?? '');
        setPhoneStatus(profileContact.phoneVerificationStatus);
        setOtpChallenge(null);
        setOtpCode('');
        setPreference(profileContact.recoveryContactPreference ?? 'email');
      })
      .catch((error) => {
        if (!isMounted) {
          return;
        }

        setFeedback({
          description: mapBackendErrorToMessage(error, 'Les coordonnées de récupération sont indisponibles.'),
          title: 'Chargement impossible',
          tone: 'error',
        });
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSendOtp = async () => {
    setIsSendingOtp(true);
    setFeedback(null);

    try {
      const challenge = await sendPhoneOtp(phoneNumber);
      setOtpChallenge(challenge);
      setPhoneStatus('unverified');
      setFeedback({
        description: 'Code SMS envoyé. Entrez le code reçu pour associer ce numéro à votre compte Firebase.',
        title: 'Vérification envoyée',
        tone: 'success',
      });
    } catch (error) {
      setFeedback({
        description: error instanceof Error ? error.message : 'Le SMS de vérification n’a pas pu être envoyé.',
        title: 'Envoi OTP impossible',
        tone: 'error',
      });
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpChallenge) {
      setFeedback({
        description: 'Demandez d’abord un code SMS pour ce numéro.',
        title: 'Code manquant',
        tone: 'error',
      });
      return;
    }

    setIsVerifyingOtp(true);
    setFeedback(null);

    try {
      const verifiedPhoneNumber = await verifyPhoneOtp(otpChallenge, otpCode);
      const updated = await updateProfileContactViaBackend({
        phoneNumber: verifiedPhoneNumber ?? phoneNumber.trim(),
        recoveryContactPreference: preference,
      });

      setPhoneNumber(updated.phoneNumber ?? verifiedPhoneNumber ?? phoneNumber.trim());
      setPhoneStatus(updated.phoneVerificationStatus);
      setPreference(updated.recoveryContactPreference ?? preference);
      setOtpChallenge(null);
      setOtpCode('');
      setFeedback({
        description: 'Le numéro est vérifié par Firebase Phone Auth et enregistré comme contact de récupération.',
        title: 'Téléphone vérifié',
        tone: 'success',
      });
    } catch (error) {
      setFeedback({
        description: error instanceof Error ? error.message : 'Le code SMS n’a pas pu être confirmé.',
        title: 'Vérification impossible',
        tone: 'error',
      });
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setFeedback(null);

    try {
      const updated = await updateProfileContactViaBackend({
        phoneNumber: phoneNumber.trim() || null,
        recoveryContactPreference: preference,
      });

      setPhoneNumber(updated.phoneNumber ?? '');
      setPhoneStatus(updated.phoneVerificationStatus);
      setPreference(updated.recoveryContactPreference ?? 'email');
      setFeedback({
        description:
          updated.phoneVerificationStatus === 'verified'
            ? 'Les coordonnées vérifiées par Firebase Phone Auth ont été enregistrées.'
            : 'Les coordonnées ont été enregistrées. Envoyez et confirmez le code SMS pour activer la récupération par téléphone.',
        title: 'Coordonnées enregistrées',
        tone: 'success',
      });
    } catch (error) {
      setFeedback({
        description: mapBackendErrorToMessage(error, "Les coordonnées n’ont pas pu être enregistrées."),
        title: 'Enregistrement impossible',
        tone: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader
          onBackPress={() => router.back()}
          showBackButton
          subtitle="Coordonnées utilisées pour vous recontacter en cas de récupération assistée."
          title="Récupération du compte"
        />

        {feedback ? (
          <BannerNotice
            description={feedback.description}
            title={feedback.title}
            tone={feedback.tone}
          />
        ) : null}

        <JourneyCard
          description="Cette page sert à préparer une récupération propre sans créer de prise de contrôle risquée."
          steps={[
            {
              description: 'L’e-mail reste le canal de récupération actif via Firebase.',
              iconName: 'mail',
              title: 'Récupération e-mail',
            },
            {
              description: 'Le téléphone vérifié par SMS peut être enregistré comme canal de récupération.',
              iconName: 'phone',
              title: 'Contact de rappel',
            },
            {
              description: 'En cas de blocage, créez une demande de support assistée.',
              iconName: 'life-buoy',
              title: 'Assistance agence',
            },
          ]}
          title="Options de récupération"
          tone="neutral"
        />

        <AppPinSettingsCard />

        <AuthCard
          description="La réinitialisation e-mail reste disponible via Firebase. Le téléphone peut maintenant être confirmé par SMS avec Firebase Phone Auth avant d’être utilisé comme contact de récupération."
          title="Coordonnées de récupération">
          <AuthField
            autoCapitalize="none"
            helper="Optionnel. Utilisé par l’agence pour vous recontacter si besoin."
            keyboardType="phone-pad"
            label="Téléphone"
            onChangeText={(value) => {
              setPhoneNumber(value);
              setPhoneStatus(value.trim() ? 'unverified' : null);
              setOtpChallenge(null);
              setOtpCode('');
            }}
            placeholder="+222 36 00 00 00"
            value={phoneNumber}
          />

          <View style={styles.preferenceRow}>
            <PrimaryButton
              accessibilityHint="Envoie un SMS OTP Firebase pour vérifier ce numéro"
              disabled={isLoading || !phoneNumber.trim() || phoneStatus === 'verified'}
              label={phoneStatus === 'verified' ? 'Téléphone déjà vérifié' : 'Envoyer un code SMS'}
              loading={isSendingOtp}
              onPress={() => {
                void handleSendOtp();
              }}
              variant="secondary"
            />
            {otpChallenge ? (
              <>
                <AuthField
                  autoCapitalize="none"
                  helper="Code reçu par SMS via Firebase Phone Auth."
                  keyboardType="number-pad"
                  label="Code SMS"
                  onChangeText={setOtpCode}
                  placeholder="123456"
                  value={otpCode}
                />
                <PrimaryButton
                  accessibilityHint="Confirme le code SMS et lie le numéro au compte Firebase"
                  disabled={!otpCode.trim()}
                  label="Confirmer le code SMS"
                  loading={isVerifyingOtp}
                  onPress={() => {
                    void handleVerifyOtp();
                  }}
                />
              </>
            ) : null}
          </View>

          <View style={styles.preferenceRow}>
            {preferences.map((item) => (
              <PrimaryButton
                key={item}
                label={item === 'email' ? 'Préférence e-mail' : 'Préférence téléphone'}
                onPress={() => setPreference(item)}
                variant={preference === item ? 'primary' : 'secondary'}
              />
            ))}
          </View>

          <Text style={styles.helperText}>
            {`Statut téléphone: ${phoneStatus === 'verified' ? 'vérifié Firebase' : phoneStatus === 'unverified' ? 'code SMS non confirmé' : 'non renseigné'}. Pour activer la récupération par téléphone, envoyez le code SMS puis confirmez-le; le serveur vérifie ensuite que le numéro correspond au numéro Firebase du compte.`}
          </Text>

          <PrimaryButton
            accessibilityHint="Enregistre le téléphone et la préférence de récupération"
            disabled={isLoading}
            label={isLoading ? 'Chargement...' : 'Enregistrer mes coordonnées'}
            loading={isSaving}
            onPress={() => {
              void handleSave();
            }}
          />

          <PrimaryButton
            accessibilityHint="Ouvre la page d’aide et de support"
            label="Besoin d’aide supplémentaire"
            onPress={() => router.push('/support?mode=recovery')}
            variant="secondary"
          />
        </AuthCard>
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
  preferenceRow: {
    gap: spacing.sm,
  },
  helperText: {
    color: colors.textMuted,
    ...typography.body,
  },
});
