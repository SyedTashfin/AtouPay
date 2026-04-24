import { useEffect, useMemo, useState } from 'react';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { BannerNotice } from '@/src/components/BannerNotice';
import { InfoRow } from '@/src/components/InfoRow';
import { ListEmptyState } from '@/src/components/ListEmptyState';
import { ScreenHeader } from '@/src/components/ScreenHeader';
import { SummaryCard } from '@/src/components/SummaryCard';
import { useSession } from '@/src/context/SessionProvider';
import {
  getAgencyDashboardViaBackend,
  getAgencySettingsViaBackend,
  listAgencyOwnersViaBackend,
  listOwnerAccessInvitesViaBackend,
  mapBackendErrorToMessage,
} from '@/src/services/backendApi';
import { colors } from '@/src/theme/colors';
import { spacing } from '@/src/theme/spacing';
import { formatCurrency } from '@/src/utils/currency';

export default function AgencyHomeScreen() {
  const { session, signOut } = useSession();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ownersCount, setOwnersCount] = useState(0);
  const [tenantsCount, setTenantsCount] = useState(0);
  const [propertiesCount, setPropertiesCount] = useState(0);
  const [unitsCount, setUnitsCount] = useState(0);
  const [occupiedUnitsCount, setOccupiedUnitsCount] = useState(0);
  const [vacantUnitsCount, setVacantUnitsCount] = useState(0);
  const [pendingInvitesCount, setPendingInvitesCount] = useState(0);
  const [claimedInvitesCount, setClaimedInvitesCount] = useState(0);
  const [pendingPaymentsCount, setPendingPaymentsCount] = useState(0);
  const [paidPaymentsCount, setPaidPaymentsCount] = useState(0);
  const [latePaymentsCount, setLatePaymentsCount] = useState(0);
  const [supportSubmittedCount, setSupportSubmittedCount] = useState(0);
  const [supportInProgressCount, setSupportInProgressCount] = useState(0);
  const [commissionAmount, setCommissionAmount] = useState(0);
  const [grossAmount, setGrossAmount] = useState(0);
  const [ownerNetAmount, setOwnerNetAmount] = useState(0);
  const [suspendedUsersCount, setSuspendedUsersCount] = useState(0);
  const [commissionRate, setCommissionRate] = useState(0);
  const [agencyName, setAgencyName] = useState('Agence ATouPay');

  useEffect(() => {
    let isMounted = true;

    async function loadAgencyOverview() {
      setIsLoading(true);
      setError(null);

      try {
        const [owners, invites, settings, dashboard] = await Promise.all([
          listAgencyOwnersViaBackend(),
          listOwnerAccessInvitesViaBackend(),
          getAgencySettingsViaBackend(),
          getAgencyDashboardViaBackend('this_month').catch(() => null),
        ]);

        if (!isMounted) {
          return;
        }

        setOwnersCount(dashboard?.activeOwnersCount ?? owners.length);
        setTenantsCount(dashboard?.activeTenantsCount ?? 0);
        setPropertiesCount(dashboard?.totalPropertiesCount ?? 0);
        setUnitsCount(dashboard?.totalUnitsCount ?? 0);
        setOccupiedUnitsCount(dashboard?.occupiedUnitsCount ?? 0);
        setVacantUnitsCount(dashboard?.vacantUnitsCount ?? 0);
        setPendingInvitesCount(invites.filter((invite) => invite.status === 'pending').length);
        setClaimedInvitesCount(invites.filter((invite) => invite.status === 'claimed').length);
        setPendingPaymentsCount(dashboard?.paymentsByStatus.pending ?? 0);
        setPaidPaymentsCount(dashboard?.paymentsByStatus.paid ?? 0);
        setLatePaymentsCount(dashboard?.paymentsByStatus.late ?? 0);
        setSupportSubmittedCount(dashboard?.supportRequestsByStatus.submitted ?? 0);
        setSupportInProgressCount(dashboard?.supportRequestsByStatus.in_progress ?? 0);
        setCommissionAmount(dashboard?.commissionSummary.agencyFeeAmount ?? 0);
        setGrossAmount(dashboard?.rentSummary.grossAmount ?? 0);
        setOwnerNetAmount(dashboard?.rentSummary.ownerNetAmount ?? 0);
        setSuspendedUsersCount(dashboard?.suspendedUsersCount ?? 0);
        setCommissionRate(dashboard?.commissionRate || settings.commissionRate);
        setAgencyName(dashboard?.displayName || settings.displayName);
      } catch (loadError) {
        if (!isMounted) {
          return;
        }

        setError(
          mapBackendErrorToMessage(
            loadError,
            "L’espace agence n’a pas pu être chargé.",
          ),
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadAgencyOverview();

    return () => {
      isMounted = false;
    };
  }, []);

  const commissionLabel = useMemo(
    () => `${Math.round(commissionRate * 100)} %`,
    [commissionRate],
  );

  const handleSignOut = async () => {
    await signOut();
    router.replace('/auth/login');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader
          subtitle="Pilotage opérationnel de l’agence, des invitations propriétaires et de la commission."
          title={agencyName}
          rightAccessory={
            <View style={styles.headerActions}>
              <Pressable
                accessibilityLabel="Ouvrir les notifications"
                accessibilityRole="button"
                onPress={() => router.push('/notifications')}
                style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
              >
                <Feather name="bell" size={18} color={colors.text} />
              </Pressable>
              <Pressable
                accessibilityLabel="Se déconnecter"
                accessibilityRole="button"
                onPress={() => {
                  void handleSignOut();
                }}
                style={({ pressed }) => [styles.logoutPill, pressed && styles.pressed]}
              >
                <Feather name="log-out" size={16} color={colors.danger} />
                <Text style={styles.logoutText}>Sortir</Text>
              </Pressable>
            </View>
          }
        />

        {error ? (
          <BannerNotice
            description={error}
            title="Backend indisponible"
            tone="error"
          />
        ) : null}

        <View style={styles.summaryGrid}>
          <SummaryCard
            compact
            subtitle="Comptes activés"
            title="Propriétaires"
            value={String(ownersCount)}
          />
          <SummaryCard
            accent="warning"
            compact
            subtitle="En attente"
            title="Invitations"
            value={String(pendingInvitesCount)}
          />
          <SummaryCard
            compact
            subtitle="Déjà utilisées"
            title="Invites réclamées"
            value={String(claimedInvitesCount)}
          />
          <SummaryCard
            compact
            subtitle="Locataires actifs"
            title="Locataires"
            value={String(tenantsCount)}
          />
        </View>

        <SummaryCard
          accent="neutral"
          helper={`Brut payé ${formatCurrency(grossAmount)} • Net propriétaires ${formatCurrency(ownerNetAmount)}`}
          subtitle={`Taux actuel ${commissionLabel}`}
          title="Commission simulée ce mois"
          value={formatCurrency(commissionAmount)}
        />

        <View style={styles.summaryGrid}>
          <SummaryCard
            compact
            subtitle="Biens / unités"
            title="Parc"
            value={`${propertiesCount} / ${unitsCount}`}
          />
          <SummaryCard
            compact
            subtitle="Occupées / vacantes"
            title="Unités"
            value={`${occupiedUnitsCount} / ${vacantUnitsCount}`}
          />
          <SummaryCard
            accent="warning"
            compact
            subtitle="À suivre"
            title="Paiements en attente"
            value={String(pendingPaymentsCount)}
          />
          <SummaryCard
            accent="danger"
            compact
            subtitle="Retard"
            title="Paiements en retard"
            value={String(latePaymentsCount)}
          />
        </View>

        <View style={styles.summaryGrid}>
          <SummaryCard
            compact
            subtitle="Paiements confirmés"
            title="Payés"
            value={String(paidPaymentsCount)}
          />
          <SummaryCard
            accent="warning"
            compact
            subtitle="Soumis / en cours"
            title="Support"
            value={`${supportSubmittedCount} / ${supportInProgressCount}`}
          />
          <SummaryCard
            accent="danger"
            compact
            subtitle="À contrôler"
            title="Comptes suspendus"
            value={String(suspendedUsersCount)}
          />
        </View>

        <View style={styles.stack}>
          <InfoRow
            iconName="percent"
            label="Net propriétaire sur 100 000 MRU"
            value={formatCurrency(Math.max(0, 100000 - Math.round(100000 * commissionRate)))}
          />
          <InfoRow
            iconName="briefcase"
            label="Session courante"
            value={session?.profile?.email ?? 'adresse indisponible'}
          />
        </View>

        {!isLoading && !error && ownersCount === 0 && pendingInvitesCount === 0 ? (
          <ListEmptyState
            description="Créez d’abord une invitation propriétaire depuis l’onglet Invitations pour démarrer l’onboarding."
            title="Aucune opération agence pour le moment"
          />
        ) : null}
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
  headerActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  iconButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  logoutPill: {
    alignItems: 'center',
    backgroundColor: colors.dangerSoft,
    borderColor: colors.dangerSoft,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: spacing.sm,
  },
  logoutText: {
    color: colors.danger,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.72,
  },
  summaryGrid: {
    gap: spacing.sm,
  },
  stack: {
    gap: spacing.sm,
  },
});
