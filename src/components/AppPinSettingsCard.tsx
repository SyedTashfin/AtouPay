import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AuthCard } from '@/src/components/auth/AuthCard';
import { AuthField } from '@/src/components/auth/AuthField';
import { useSession } from '@/src/context/SessionProvider';
import { useI18n } from '@/src/i18n/I18nProvider';
import { clearAppPin, getAppPinStatus, setAppPin } from '@/src/services/appPin';
import { colors } from '@/src/theme/colors';
import { typography } from '@/src/theme/typography';
import { PrimaryButton } from '@/src/components/PrimaryButton';

export function AppPinSettingsCard() {
  const { session } = useSession();
  const { copy } = useI18n();
  const [pin, setPin] = useState('');
  const [pinConfirmation, setPinConfirmation] = useState('');
  const [isEnabled, setIsEnabled] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const userKey = session?.firebaseUid ?? session?.profile?.email ?? null;

  useEffect(() => {
    let isMounted = true;

    async function loadPinStatus() {
      if (!userKey) {
        return;
      }

      const status = await getAppPinStatus(userKey);

      if (isMounted) {
        setIsEnabled(status.enabled);
      }
    }

    void loadPinStatus();

    return () => {
      isMounted = false;
    };
  }, [userKey]);

  const handleSave = async () => {
    if (!userKey || isSaving) {
      return;
    }

    if (!/^\d{4}$/.test(pin)) {
      setFeedback('Le code PIN doit contenir exactement 4 chiffres.');
      return;
    }

    if (pin !== pinConfirmation) {
      setFeedback('Les deux codes PIN ne correspondent pas.');
      return;
    }

    setIsSaving(true);
    setFeedback(null);

    try {
      await setAppPin(userKey, pin);
      setIsEnabled(true);
      setPin('');
      setPinConfirmation('');
      setFeedback('Code PIN local activé pour ce compte sur ce téléphone.');
    } catch {
      setFeedback('Impossible d’enregistrer le code PIN pour le moment.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = async () => {
    if (!userKey || isSaving) {
      return;
    }

    setIsSaving(true);
    setFeedback(null);

    try {
      await clearAppPin(userKey);
      setIsEnabled(false);
      setPin('');
      setPinConfirmation('');
      setFeedback('Code PIN supprimé sur ce téléphone.');
    } catch {
      setFeedback('Impossible de supprimer le code PIN pour le moment.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!userKey) {
    return null;
  }

  return (
    <AuthCard
      description="Code local simple pour confirmer les actions sensibles dans l’app. Il ne remplace pas une authentification bancaire."
      title="Code PIN local">
      <View style={styles.statusRow}>
        <Text style={styles.statusLabel}>{copy('Statut')}</Text>
        <Text style={styles.statusValue}>{copy(isEnabled ? 'Activé' : 'Non configuré')}</Text>
      </View>

      <AuthField
        autoComplete="off"
        helper="4 chiffres"
        keyboardType="number-pad"
        label={isEnabled ? 'Nouveau code PIN' : 'Code PIN'}
        maxLength={4}
        onChangeText={(value) => {
          setFeedback(null);
          setPin(value.replace(/\D/g, '').slice(0, 4));
        }}
        placeholder="••••"
        secureTextEntry
        textContentType="oneTimeCode"
        value={pin}
      />
      <AuthField
        autoComplete="off"
        keyboardType="number-pad"
        label="Confirmer le code PIN"
        maxLength={4}
        onChangeText={(value) => {
          setFeedback(null);
          setPinConfirmation(value.replace(/\D/g, '').slice(0, 4));
        }}
        placeholder="••••"
        secureTextEntry
        textContentType="oneTimeCode"
        value={pinConfirmation}
      />

      {feedback ? <Text style={styles.feedback}>{feedback}</Text> : null}

      <PrimaryButton
        label={isEnabled ? 'Modifier le PIN' : 'Activer le PIN'}
        loading={isSaving}
        onPress={() => {
          void handleSave();
        }}
      />
      {isEnabled ? (
        <PrimaryButton
          label="Supprimer le PIN"
          loading={isSaving}
          onPress={() => {
            void handleClear();
          }}
          variant="secondary"
        />
      ) : null}
    </AuthCard>
  );
}

const styles = StyleSheet.create({
  statusRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statusLabel: {
    color: colors.textMuted,
    ...typography.caption,
  },
  statusValue: {
    color: colors.text,
    ...typography.bodyStrong,
  },
  feedback: {
    color: colors.textMuted,
    ...typography.caption,
  },
});
