import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { BannerNotice } from '@/src/components/BannerNotice';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { AuthCard } from '@/src/components/auth/AuthCard';
import { AuthField, AuthFieldAccessoryButton } from '@/src/components/auth/AuthField';
import { AuthScreen } from '@/src/components/auth/AuthScreen';
import { useSession } from '@/src/context/SessionProvider';
import { linkPasswordToCurrentUser } from '@/src/services/firebaseAuth';
import { colors } from '@/src/theme/colors';
import { typography } from '@/src/theme/typography';
import { isValidPassword } from '@/src/utils/auth';

export default function LinkPasswordScreen() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const { session, switchRole } = useSession();

  const accountEmail = session?.profile?.email ?? '';
  const alreadyLinked = session?.authProviders?.includes('password') ?? false;

  const handleSubmit = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!isValidPassword(password)) {
      setErrorMessage('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Les mots de passe doivent être identiques.');
      return;
    }

    setIsSubmitting(true);

    try {
      await linkPasswordToCurrentUser(accountEmail, password);
      setSuccessMessage(
        'Le mot de passe a été ajouté au même compte Firebase. Vous pourrez ensuite utiliser Google ou e-mail pour la même session.',
      );

      if (session?.role) {
        await switchRole(session.role);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Le mot de passe n’a pas pu être associé à ce compte.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthScreen
      subtitle="Ajoutez un mot de passe à votre compte Google existant pour éviter les doublons d’identité."
      title="Ajouter un mot de passe">
      <AuthCard
        description={accountEmail || 'compte connecté requis'}
        title="Liaison sécurisée">
        <BannerNotice
          description="Cette action relie le mot de passe au même utilisateur Firebase. Aucun second profil ATouPay n’est créé."
          title="Compte unique"
        />

        {alreadyLinked ? (
          <BannerNotice
            description="Ce compte possède déjà une connexion e-mail et mot de passe."
            title="Mot de passe déjà lié"
            tone="success"
          />
        ) : null}

        {successMessage ? (
          <BannerNotice
            description={successMessage}
            title="Liaison réussie"
            tone="success"
          />
        ) : null}

        {errorMessage ? (
          <BannerNotice
            description={errorMessage}
            title="Liaison impossible"
            tone="error"
          />
        ) : null}

        <AuthField
          autoComplete="new-password"
          label="Mot de passe"
          onChangeText={setPassword}
          placeholder="Choisissez un mot de passe"
          rightAccessory={
            <AuthFieldAccessoryButton
              accessibilityHint="Affiche ou masque le mot de passe"
              accessibilityLabel={passwordVisible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              onPress={() => setPasswordVisible((value) => !value)}>
              <Feather
                color={colors.textMuted}
                name={passwordVisible ? 'eye-off' : 'eye'}
                size={18}
              />
            </AuthFieldAccessoryButton>
          }
          secureTextEntry={!passwordVisible}
          textContentType="newPassword"
          value={password}
          editable={!alreadyLinked}
        />

        <AuthField
          autoComplete="new-password"
          label="Confirmer le mot de passe"
          onChangeText={setConfirmPassword}
          placeholder="Répétez le mot de passe"
          rightAccessory={
            <AuthFieldAccessoryButton
              accessibilityHint="Affiche ou masque la confirmation du mot de passe"
              accessibilityLabel={
                confirmPasswordVisible
                  ? 'Masquer la confirmation du mot de passe'
                  : 'Afficher la confirmation du mot de passe'
              }
              onPress={() => setConfirmPasswordVisible((value) => !value)}>
              <Feather
                color={colors.textMuted}
                name={confirmPasswordVisible ? 'eye-off' : 'eye'}
                size={18}
              />
            </AuthFieldAccessoryButton>
          }
          secureTextEntry={!confirmPasswordVisible}
          textContentType="newPassword"
          value={confirmPassword}
          editable={!alreadyLinked}
        />

        <PrimaryButton
          accessibilityHint="Relie ce mot de passe au compte Firebase déjà connecté"
          disabled={alreadyLinked || !accountEmail}
          label="Lier ce mot de passe"
          loading={isSubmitting}
          onPress={handleSubmit}
        />

        <Pressable accessibilityRole="button" onPress={() => router.back()} style={({ pressed }) => pressed && styles.pressed}>
          <Text style={styles.linkText}>Retour au profil</Text>
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
