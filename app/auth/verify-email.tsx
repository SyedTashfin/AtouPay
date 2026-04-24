import { router } from 'expo-router';
import { useState } from 'react';

import { BannerNotice } from '@/src/components/BannerNotice';
import { JourneyCard } from '@/src/components/JourneyCard';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { AuthCard } from '@/src/components/auth/AuthCard';
import { AuthScreen } from '@/src/components/auth/AuthScreen';
import { useSession } from '@/src/context/SessionProvider';
import { resendVerificationEmail } from '@/src/services/firebaseAuth';
import { BannerTone } from '@/src/types';

interface VerificationFeedbackState {
  description: string;
  title: string;
  tone: BannerTone;
}

export default function VerifyEmailScreen() {
  const [feedback, setFeedback] = useState<VerificationFeedbackState | null>(null);
  const [activeAction, setActiveAction] = useState<'refresh' | 'resend' | null>(null);
  const {
    clearAuthDebug,
    homeRoute,
    pendingProfile,
    refreshVerification,
    reportAuthEvent,
    session,
    signOut,
  } = useSession();

  const accountEmail =
    pendingProfile?.email ??
    session?.profile?.email ??
    'adresse indisponible';

  const handleRefresh = async () => {
    setActiveAction('refresh');
    setFeedback(null);
    clearAuthDebug();

    try {
      await refreshVerification();
      reportAuthEvent({
        action: 'verification-refresh',
        message: 'La vérification a été relancée depuis l’écran de confirmation.',
        scope: 'auth',
        status: 'info',
        title: 'Actualisation demandée',
      });
      router.replace(homeRoute as never);
    } finally {
      setActiveAction(null);
    }
  };

  const handleResend = async () => {
    setActiveAction('resend');
    setFeedback(null);

    try {
      const result = await resendVerificationEmail();

      reportAuthEvent({
        action: 'verification-resend',
        message: result.message,
        scope: 'auth',
        status: result.status === 'success' ? 'success' : result.status === 'error' ? 'error' : 'info',
        title:
          result.status === 'success'
            ? 'E-mail renvoyé'
            : result.status === 'unavailable'
              ? 'Firebase indisponible'
              : 'Envoi impossible',
      });

      setFeedback({
        description: result.message,
        title:
          result.status === 'success'
            ? 'E-mail renvoyé'
            : result.status === 'unavailable'
              ? 'Firebase indisponible'
              : 'Envoi impossible',
        tone: result.status === 'success' ? 'success' : result.status === 'error' ? 'error' : 'info',
      });
    } finally {
      setActiveAction(null);
    }
  };

  return (
    <AuthScreen
      subtitle="Confirmez votre adresse e-mail avant d’ouvrir les tableaux de bord ATouPay."
      title="Vérifier l’e-mail">
      <JourneyCard
        description="Cet écran doit vous dire exactement pourquoi vous êtes bloqué et comment avancer."
        steps={[
          {
            description: 'Ouvrez l’e-mail de vérification envoyé par Firebase.',
            iconName: 'mail',
            title: 'Vérifier',
          },
          {
            description: 'Revenez ici et actualisez l’état du compte.',
            iconName: 'refresh-cw',
            title: 'Actualiser',
          },
          {
            description: 'Demandez un renvoi ou contactez le support si nécessaire.',
            iconName: 'life-buoy',
            title: 'Débloquer',
          },
        ]}
        title="Étapes de validation"
      />

      <AuthCard
        description={accountEmail}
        title="Activation du compte">
        <BannerNotice
          description="Firebase a créé votre compte, mais l’application reste bloquée côté auth tant que l’adresse e-mail n’est pas confirmée."
          title="Vérification requise"
        />

        {feedback ? (
          <BannerNotice
            description={feedback.description}
            title={feedback.title}
            tone={feedback.tone}
          />
        ) : null}

        <PrimaryButton
          accessibilityHint="Vérifie à nouveau l'état de validation de l'adresse e-mail"
          label="J’ai vérifié mon e-mail"
          loading={activeAction === 'refresh'}
          onPress={handleRefresh}
        />
        <PrimaryButton
          accessibilityHint="Renvoye un e-mail de vérification via Firebase"
          label="Renvoyer l’e-mail"
          loading={activeAction === 'resend'}
          onPress={handleResend}
          variant="secondary"
        />
        <PrimaryButton
          accessibilityHint="Ferme la session actuelle et revient à l'écran de connexion"
          label="Se déconnecter"
          onPress={async () => {
            reportAuthEvent({
              action: 'verification-sign-out',
              message: 'La session a été fermée depuis l’écran de vérification.',
              scope: 'auth',
              status: 'info',
              title: 'Déconnexion',
            });
            await signOut();
            router.replace('/auth/login');
          }}
          variant="ghost"
        />
        <PrimaryButton
          accessibilityHint="Ouvre l’aide et le support si l’e-mail n’arrive pas"
          label="Besoin d’aide ?"
          onPress={() => router.push('/support?mode=recovery')}
          variant="secondary"
        />
      </AuthCard>
    </AuthScreen>
  );
}
