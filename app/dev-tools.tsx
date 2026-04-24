import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, usePathname } from 'expo-router';
import { ReactNode } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BannerNotice } from '@/src/components/BannerNotice';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { ScreenHeader } from '@/src/components/ScreenHeader';
import { appConfig } from '@/src/config/env';
import { useAppContext } from '@/src/context/AppProvider';
import { useSession } from '@/src/context/SessionProvider';
import { colors } from '@/src/theme/colors';
import { radius } from '@/src/theme/radius';
import { spacing } from '@/src/theme/spacing';
import { typography } from '@/src/theme/typography';
import { getAuthProviderLabel } from '@/src/utils/auth';
import { formatCurrency } from '@/src/utils/currency';
import { formatDateLabel } from '@/src/utils/dates';
import { getHomeRouteForRole } from '@/src/utils/session';

function DebugCard({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      <View style={styles.cardBody}>{children}</View>
    </View>
  );
}

function DebugRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

export default function DevToolsScreen() {
  const {
    currentOwnerId,
    currentTenantId,
    currentUnitId,
    currentMonthKey,
    currentTenantPayment,
    isHintDismissed,
    isHydrated,
    isSimulatedPaymentMode,
    lastDataEvent,
    ownerDashboardSummary,
    ownerPaymentsFilter,
    payments,
    pendingInviteCode,
    reportDataEvent,
    resetPaymentFilters,
    resetPersistedAppData,
    restoreSeededDemoData,
    restoreMockPayments,
    tenantPaymentsFilter,
  } = useAppContext();
  const {
    clearSessionStorage,
    clearAuthDebug,
    hasSelectedRole,
    homeRoute,
    isAuthenticated,
    isFirebaseEnabled,
    isHydrated: isSessionHydrated,
    lastAuthEvent,
    needsEmailVerification,
    needsRoleSelection,
    pendingProfile,
    reportAuthEvent,
    selectedDemoRole,
    session,
    sessionStatus,
    signOut,
    switchRole,
  } = useSession();
  const pathname = usePathname();

  const currentMonthPayments = payments.filter((payment) => payment.monthKey === currentMonthKey);
  const pendingThisMonth = currentMonthPayments.filter((payment) => payment.status === 'pending');
  const authLabel = session
    ? getAuthProviderLabel(session.authProvider, session.authProviders)
    : 'aucun';

  const handleSwitchRole = async (role: 'tenant' | 'owner') => {
    await switchRole(role);
    router.replace(getHomeRouteForRole(role) as never);
  };

  const handleClearSession = async () => {
    reportAuthEvent({
      action: 'debug-clear-session',
      message: 'La session a été effacée depuis les outils QA.',
      scope: 'auth',
      status: 'info',
      title: 'Session effacée',
    });
    await signOut();
    router.replace('/auth/login');
  };

  const handleResetLocalData = () => {
    Alert.alert(
      'Réinitialiser la démo',
      'Cette action remet les paiements, filtres et astuces au seed local, puis efface la session active.',
      [
        { style: 'cancel', text: 'Annuler' },
        {
          style: 'destructive',
          text: 'Réinitialiser',
          onPress: async () => {
            await resetPersistedAppData();
            clearAuthDebug();
            reportDataEvent({
              action: 'debug-reset-demo',
              message: 'Les données locales ont été remises à zéro depuis les outils QA.',
              scope: 'storage',
              status: 'info',
              title: 'Démo réinitialisée',
            });
            await clearSessionStorage();
            router.replace('/auth/login');
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader
          onBackPress={() => router.back()}
          showBackButton
          subtitle="Validation native, persistance locale et état de session"
          title="QA & Debug"
        />

        <BannerNotice
          description="Visible uniquement dans les builds de développement ou de validation interne. Aucun périmètre produit n’est ajouté."
          title={`Variant ${appConfig.appVariant}`}
        />

        <DebugCard title="Configuration">
          <DebugRow label="Backend activé" value={appConfig.useBackend ? 'oui' : 'non'} />
          <DebugRow label="API backend" value={appConfig.apiBaseUrl} />
          <DebugRow label="Projet EAS" value={appConfig.easProjectId ?? 'non configuré'} />
          <DebugRow
            label="Debug activé"
            value={appConfig.enableDevTools ? 'oui' : 'non'}
          />
          <DebugRow
            label="Google web client"
            value={appConfig.googleWebClientId ? 'configuré' : 'absent'}
          />
          <DebugRow
            label="Google iOS client"
            value={appConfig.googleIosClientId ? 'configuré' : 'absent'}
          />
          <DebugRow
            label="Google iOS scheme"
            value={appConfig.googleIosUrlScheme ? 'configuré' : 'absent'}
          />
          <DebugRow label="URL updates" value={appConfig.updatesUrl ?? 'non configurée'} />
        </DebugCard>

        <DebugCard title="Session">
          <DebugRow label="Hydratation session" value={isSessionHydrated ? 'ok' : 'en cours'} />
          <DebugRow label="Authentifié" value={isAuthenticated ? 'oui' : 'non'} />
          <DebugRow label="Mode auth" value={isFirebaseEnabled ? 'firebase' : 'local'} />
          <DebugRow label="Statut session" value={sessionStatus} />
          <DebugRow label="Rôle courant" value={session?.role ?? 'aucun'} />
          <DebugRow label="Connexion" value={authLabel} />
          <DebugRow label="UID Firebase" value={session?.firebaseUid ?? 'absent'} />
          <DebugRow
            label="Providers liés"
            value={session?.authProviders?.join(', ') ?? session?.authProvider ?? 'aucun'}
          />
          <DebugRow label="Profil Google" value={session?.profile?.email ?? 'absent'} />
          <DebugRow
            label="Profil en attente"
            value={pendingProfile?.email ?? 'aucun'}
          />
          <DebugRow
            label="Vérification e-mail"
            value={needsEmailVerification ? 'requise' : 'ok'}
          />
          <DebugRow label="Rôle requis" value={needsRoleSelection ? 'oui' : 'non'} />
          <DebugRow label="Rôle démo mémorisé" value={selectedDemoRole} />
          <DebugRow label="Rôle mémorisé" value={hasSelectedRole ? 'oui' : 'non'} />
          <DebugRow label="Retour par défaut" value={homeRoute} />
          <DebugRow label="Route courante" value={pathname} />
          <DebugRow label="Token placeholder" value={session?.token ?? 'absent'} />
          <DebugRow label="ownerId" value={currentOwnerId ?? 'absent'} />
          <DebugRow label="tenantId" value={currentTenantId ?? 'absent'} />
          <DebugRow label="unitId" value={currentUnitId ?? 'absent'} />
        </DebugCard>

        <DebugCard title="Persistance locale">
          <DebugRow label="Hydratation app" value={isHydrated ? 'ok' : 'en cours'} />
          <DebugRow label="Filtre locataire" value={tenantPaymentsFilter} />
          <DebugRow
            label="Filtre propriétaire"
            value={`${ownerPaymentsFilter.status} / ${ownerPaymentsFilter.propertyId}`}
          />
          <DebugRow
            label="Astuce paiement masquée"
            value={isHintDismissed('payment-demo') ? 'oui' : 'non'}
          />
          <DebugRow label="Paiements persistés" value={String(payments.length)} />
          <DebugRow label="Invite mémorisée" value={pendingInviteCode ?? 'aucune'} />
          <DebugRow label="Paiement simulé" value={isSimulatedPaymentMode ? 'oui' : 'non'} />
        </DebugCard>

        <DebugCard title="Derniers diagnostics">
          <DebugRow
            label="Auth"
            value={
              lastAuthEvent
                ? `${lastAuthEvent.title} • ${lastAuthEvent.message}`
                : 'aucun événement'
            }
          />
          <DebugRow
            label="Firestore / invite"
            value={
              lastDataEvent
                ? `${lastDataEvent.title} • ${lastDataEvent.message}`
                : 'aucun événement'
            }
          />
        </DebugCard>

        <DebugCard title="Paiement du mois">
          <DebugRow label="Mois courant" value={currentMonthKey} />
          <DebugRow
            label="Paiement locataire"
            value={
              currentTenantPayment
                ? `${currentTenantPayment.status} • ${formatCurrency(currentTenantPayment.amount)}`
                : 'absent'
            }
          />
          <DebugRow
            label="Échéance locataire"
            value={currentTenantPayment ? formatDateLabel(currentTenantPayment.dueDate) : 'n/a'}
          />
          <DebugRow
            label="Paiements en attente"
            value={`${pendingThisMonth.length} • ${formatCurrency(
              pendingThisMonth.reduce((total, payment) => total + payment.amount, 0),
            )}`}
          />
          <DebugRow
            label="Compteurs owner"
            value={`pending ${ownerDashboardSummary.pendingCount} / late ${ownerDashboardSummary.lateCount}`}
          />
        </DebugCard>

        <View style={styles.actions}>
          <Text style={styles.actionsTitle}>Basculer la démo</Text>
          <PrimaryButton
            label="Passer en locataire"
            onPress={() => {
              void handleSwitchRole('tenant');
            }}
            variant="secondary"
          />
          <PrimaryButton
            label="Passer en propriétaire"
            onPress={() => {
              void handleSwitchRole('owner');
            }}
            variant="secondary"
          />
          <PrimaryButton
            accessibilityHint="Efface uniquement la session active puis revient à la connexion"
            label="Vider la session"
            onPress={() => {
              void handleClearSession();
            }}
            variant="ghost"
          />
        </View>

        <View style={styles.actions}>
          <Text style={styles.actionsTitle}>Données locales</Text>
          <PrimaryButton
            label="Réinitialiser les filtres"
            onPress={() => {
              void resetPaymentFilters();
            }}
            variant="secondary"
          />
          <PrimaryButton
            label="Restaurer les données seed"
            onPress={() => {
              void restoreSeededDemoData();
            }}
            variant="secondary"
          />
          <PrimaryButton
            label="Restaurer les paiements mock"
            onPress={() => {
              void restoreMockPayments();
            }}
            variant="secondary"
          />
          <PrimaryButton
            accessibilityHint="Efface les données locales persistées puis revient à l'écran de connexion"
            label="Réinitialiser la démo"
            onPress={handleResetLocalData}
            variant="ghost"
          />
        </View>
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
    gap: spacing.sm,
    padding: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
    padding: spacing.sm,
  },
  cardTitle: {
    color: colors.text,
    ...typography.subheading,
  },
  cardBody: {
    gap: spacing.xs,
  },
  row: {
    gap: 4,
  },
  rowLabel: {
    color: colors.textMuted,
    ...typography.caption,
  },
  rowValue: {
    color: colors.text,
    ...typography.bodyStrong,
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  actionsTitle: {
    color: colors.text,
    ...typography.label,
  },
});
