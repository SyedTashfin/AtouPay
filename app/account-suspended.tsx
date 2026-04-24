import { router } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BannerNotice } from '@/src/components/BannerNotice';
import { JourneyCard } from '@/src/components/JourneyCard';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { ScreenHeader } from '@/src/components/ScreenHeader';
import { AuthCard } from '@/src/components/auth/AuthCard';
import { useSession } from '@/src/context/SessionProvider';
import { colors } from '@/src/theme/colors';
import { spacing } from '@/src/theme/spacing';

export default function AccountSuspendedScreen() {
  const { session, signOut } = useSession();

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader
          subtitle="L’accès applicatif est désactivé jusqu’à réactivation par l’agence."
          title="Compte suspendu"
        />

        <BannerNotice
          description="Votre compte reste authentifié côté Firebase, mais il ne peut plus accéder aux espaces ATouPay tant que l’agence ne l’a pas réactivé."
          title="Accès bloqué"
          tone="error"
        />

        <JourneyCard
          description="Le blocage doit être clair et réversible par un chemin support, sans laisser l’utilisateur coincé."
          steps={[
            {
              description: 'Votre session existe, mais les routes applicatives sont verrouillées.',
              iconName: 'lock',
              title: 'Accès suspendu',
            },
            {
              description: 'Contactez l’agence avec le compte affiché ci-dessous.',
              iconName: 'message-circle',
              title: 'Demander un suivi',
            },
            {
              description: 'Déconnectez-vous si vous devez utiliser un autre compte.',
              iconName: 'log-out',
              title: 'Changer de session',
            },
          ]}
          title="Que faire maintenant ?"
          tone="danger"
        />

        <AuthCard
          description="Contactez votre agence ou ouvrez une demande de support. Aucun paiement réel n’est bloqué dans AtouPay, car les paiements de cette version restent simulés."
          title={session?.profile?.email ?? 'Compte ATouPay'}>
          <PrimaryButton
            label="Contacter le support"
            onPress={() => router.push('/support?category=general_help')}
          />
          <PrimaryButton
            label="Se déconnecter"
            onPress={async () => {
              await signOut();
              router.replace('/auth/login');
            }}
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
});
