import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { BannerNotice } from '@/src/components/BannerNotice';
import { JourneyCard } from '@/src/components/JourneyCard';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { AuthCard } from '@/src/components/auth/AuthCard';
import { AuthField } from '@/src/components/auth/AuthField';
import { AuthScreen } from '@/src/components/auth/AuthScreen';
import { useSession } from '@/src/context/SessionProvider';
import {
  getFirebaseAuthUnavailableMessage,
  isFirebaseAuthAvailable,
  sendPasswordReset,
} from '@/src/services/firebaseAuth';
import { colors } from '@/src/theme/colors';
import { typography } from '@/src/theme/typography';
import { isValidEmail } from '@/src/utils/auth';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { clearAuthDebug, reportAuthEvent } = useSession();

  const firebaseAvailable = isFirebaseAuthAvailable();
  const firebaseUnavailableMessage = getFirebaseAuthUnavailableMessage();

  const handleSubmit = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    setEmailError(null);
    setErrorMessage(null);
    setSuccessMessage(null);
    clearAuthDebug();

    if (!isValidEmail(normalizedEmail)) {
      setEmailError('Saisissez une adresse e-mail valide.');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await sendPasswordReset({ email: normalizedEmail });

      if (result.status === 'success') {
        reportAuthEvent({
          action: 'password-reset',
          message: result.message,
          scope: 'auth',
          status: 'success',
          title: 'E-mail envoyé',
        });
        setSuccessMessage(result.message);
        return;
      }

      reportAuthEvent({
        action: 'password-reset',
        message: result.message,
        scope: 'auth',
        status: result.status === 'error' ? 'error' : 'info',
        title: 'Réinitialisation impossible',
      });
      setErrorMessage(result.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthScreen
      subtitle="Envoyez un e-mail de réinitialisation pour récupérer l’accès à votre compte ATouPay."
      title="Mot de passe oublié">
      <JourneyCard
        description="La récupération doit rester simple et sécurisée, sans détour inutile."
        steps={[
          {
            description: 'Saisissez l’adresse utilisée pour créer le compte.',
            iconName: 'mail',
            title: 'Entrer l’e-mail',
          },
          {
            description: 'Ouvrez le lien Firebase reçu dans votre boîte mail.',
            iconName: 'external-link',
            title: 'Réinitialiser',
          },
          {
            description: 'Si l’e-mail n’arrive pas, passez par la récupération assistée.',
            iconName: 'life-buoy',
            title: 'Assistance',
          },
        ]}
        title="Récupération guidée"
        tone="warning"
      />

      <AuthCard
        description="Le lien est envoyé par Firebase Authentication. Les paiements restent simulés dans cette application."
        title="Réinitialisation">
        {!firebaseAvailable && firebaseUnavailableMessage ? (
          <BannerNotice
            description={firebaseUnavailableMessage}
            title="Configuration Firebase incomplète"
          />
        ) : null}

        {successMessage ? (
          <BannerNotice
            description={successMessage}
            title="E-mail envoyé"
            tone="success"
          />
        ) : null}

        {errorMessage ? (
          <BannerNotice
            description={errorMessage}
            title="Réinitialisation impossible"
            tone="error"
          />
        ) : null}

        <AuthField
          autoComplete="email"
          error={emailError}
          keyboardType="email-address"
          label="E-mail"
          onChangeText={setEmail}
          placeholder="vous@exemple.com"
          textContentType="emailAddress"
          value={email}
          editable={firebaseAvailable}
        />

        <PrimaryButton
          accessibilityHint="Envoie l'e-mail de réinitialisation du mot de passe"
          disabled={!firebaseAvailable}
          label="Envoyer le lien"
          loading={isSubmitting}
          onPress={handleSubmit}
        />

        <Link href="/auth/login" asChild>
          <Pressable accessibilityRole="button" style={({ pressed }) => pressed && styles.pressed}>
            <Text style={styles.linkText}>Retour à la connexion</Text>
          </Pressable>
        </Link>

        <Link href="/support?mode=recovery" asChild>
          <Pressable accessibilityRole="button" style={({ pressed }) => pressed && styles.pressed}>
            <Text style={styles.linkText}>Besoin d’une récupération assistée ?</Text>
          </Pressable>
        </Link>
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
