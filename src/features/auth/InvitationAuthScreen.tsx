import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { PrimaryButton } from '@/src/components/PrimaryButton';
import { AuthCard } from '@/src/components/auth/AuthCard';
import { AuthField } from '@/src/components/auth/AuthField';
import { AuthHeader } from '@/src/components/auth/AuthHeader';
import { AuthScreen } from '@/src/components/auth/AuthScreen';
import { useAppContext } from '@/src/context/AppProvider';
import { useI18n } from '@/src/i18n/I18nProvider';
import { colors } from '@/src/theme/colors';
import { typography } from '@/src/theme/typography';

function normalizeInviteCode(value: string) {
  return value.trim().toUpperCase();
}

export function InvitationAuthScreen() {
  const { copy } = useI18n();
  const { invite } = useLocalSearchParams<{ invite?: string }>();
  const { pendingInviteCode, savePendingInviteCode } = useAppContext();
  const [inviteCode, setInviteCode] = useState('');

  useEffect(() => {
    if (typeof invite === 'string' && invite.trim().length > 0) {
      const normalizedInviteCode = normalizeInviteCode(invite);
      setInviteCode(normalizedInviteCode);
      void savePendingInviteCode(normalizedInviteCode);
      return;
    }

    if (pendingInviteCode) {
      setInviteCode(pendingInviteCode);
    }
  }, [invite, pendingInviteCode, savePendingInviteCode]);

  const handleBackPress = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/auth');
  };

  const handleContinue = async (mode: 'signin' | 'signup') => {
    const normalizedInviteCode = normalizeInviteCode(inviteCode);

    await savePendingInviteCode(normalizedInviteCode);
    router.push({
      pathname: '/auth/tenant',
      params: {
        invite: normalizedInviteCode,
        mode,
      },
    });
  };

  return (
    <AuthScreen
      subtitle="Vous pouvez créer votre compte maintenant. Le code du propriétaire peut être ajouté ici ou plus tard depuis l’accueil locataire."
      title="Code logement"
      topSlot={<AuthHeader onBackPress={handleBackPress} />}>
      <AuthCard>
        <AuthField
          autoCapitalize="characters"
          autoCorrect={false}
          helper="Optionnel maintenant. Si vous n’avez pas encore le code, continuez sans le remplir."
          label="Code logement du propriétaire"
          onChangeText={(value) => {
            setInviteCode(value);
            void savePendingInviteCode(value);
          }}
          placeholder="ABCD-1234-EFGH-5678"
          value={inviteCode}
        />

        <PrimaryButton
          accessibilityHint="Ouvre l’inscription locataire avec ou sans code logement"
          label={inviteCode.trim().length > 0 ? 'Continuer avec ce code' : 'Créer un compte locataire'}
          onPress={() => {
            void handleContinue('signup');
          }}
        />

        <Pressable
          accessibilityHint={copy('Ouvre la connexion locataire pour un compte existant')}
          accessibilityRole="button"
          onPress={() => {
            void handleContinue('signin');
          }}
          style={({ pressed }) => pressed && styles.pressed}>
          <Text style={styles.linkText}>{copy('Se connecter à mon compte')}</Text>
        </Pressable>
      </AuthCard>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  linkText: {
    color: colors.primaryDark,
    textAlign: 'center',
    ...typography.bodyStrong,
  },
  pressed: {
    opacity: 0.75,
  },
});
