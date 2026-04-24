import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BannerNotice } from '@/src/components/BannerNotice';
import { JourneyCard } from '@/src/components/JourneyCard';
import { LanguageSelector } from '@/src/components/LanguageSelector';
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
          'Les coordonnées ont été enregistrées. La récupération par téléphone reste conditionnée à l’activation future de Firebase Phone Auth.',
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
              description: 'Le téléphone aide l’agence à vous rappeler, mais il ne vérifie pas encore le compte.',
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

        <LanguageSelector />

        <AuthCard
          description="La réinitialisation e-mail reste disponible via Firebase. Le téléphone est stocké comme contact de rappel agence tant que Firebase Phone Auth n’est pas activé."
          title="Coordonnées de récupération">
          <AuthField
            autoCapitalize="none"
            helper="Optionnel. Utilisé par l’agence pour vous recontacter si besoin."
            keyboardType="phone-pad"
            label="Téléphone"
            onChangeText={setPhoneNumber}
            placeholder="+222 36 00 00 00"
            value={phoneNumber}
          />

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
            {`Statut téléphone: ${phoneStatus === 'verified' ? 'vérifié' : phoneStatus === 'unverified' ? 'non vérifié' : 'non renseigné'}. La récupération par téléphone n’est pas encore activée côté Firebase. Si vous choisissez cette préférence, elle servira à guider l’agence pour un rappel et des instructions sécurisées, sans prise de contrôle directe du compte.`}
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
