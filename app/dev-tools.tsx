import { Alert, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ReactNode } from 'react';

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
import { formatCurrency } from '@/src/utils/currency';
import { formatDateLabel } from '@/src/utils/dates';

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
    currentMonthKey,
    currentTenantPayment,
    isHintDismissed,
    isHydrated,
    ownerDashboardSummary,
    ownerPaymentsFilter,
    payments,
    resetPaymentFilters,
    resetPersistedAppData,
    restoreMockPayments,
    tenantPaymentsFilter,
  } = useAppContext();
  const {
    clearSessionStorage,
    isAuthenticated,
    isHydrated: isSessionHydrated,
    selectedDemoRole,
    session,
  } = useSession();

  const currentMonthPayments = payments.filter((payment) => payment.monthKey === currentMonthKey);
  const pendingThisMonth = currentMonthPayments.filter((payment) => payment.status === 'pending');

  const handleResetLocalData = () => {
    Alert.alert(
      'Réinitialiser les données locales',
      'Cette action efface les paiements mock persistés, filtres et astuces masquées, puis déconnecte la session.',
      [
        { style: 'cancel', text: 'Annuler' },
        {
          style: 'destructive',
          text: 'Réinitialiser',
          onPress: async () => {
            await resetPersistedAppData();
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
          <DebugRow label="API future" value={appConfig.apiBaseUrl} />
          <DebugRow
            label="Debug activé"
            value={appConfig.enableDevTools ? 'oui' : 'non'}
          />
        </DebugCard>

        <DebugCard title="Session">
          <DebugRow label="Hydratation session" value={isSessionHydrated ? 'ok' : 'en cours'} />
          <DebugRow label="Authentifié" value={isAuthenticated ? 'oui' : 'non'} />
          <DebugRow label="Rôle courant" value={session?.role ?? 'aucun'} />
          <DebugRow label="Rôle démo mémorisé" value={selectedDemoRole} />
          <DebugRow label="Token placeholder" value={session?.token ?? 'absent'} />
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
          <PrimaryButton
            label="Réinitialiser les filtres"
            onPress={() => {
              void resetPaymentFilters();
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
            label="Effacer les données locales"
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
});
