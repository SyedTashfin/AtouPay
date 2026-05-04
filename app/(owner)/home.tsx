import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BannerNotice } from '@/src/components/BannerNotice';
import { ListEmptyState } from '@/src/components/ListEmptyState';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { ScreenHeader } from '@/src/components/ScreenHeader';
import { StatusPill } from '@/src/components/StatusPill';
import { SummaryCard } from '@/src/components/SummaryCard';
import { useAppContext } from '@/src/context/AppProvider';
import { useSession } from '@/src/context/SessionProvider';
import { useI18n } from '@/src/i18n/I18nProvider';
import { isProductionVariant } from '@/src/config/env';
import {
  getOwnerBillingViaBackend,
  mapBackendErrorToMessage,
  payOwnerBillingSimulatedViaBackend,
} from '@/src/services/backendApi';
import { colors } from '@/src/theme/colors';
import { radius } from '@/src/theme/radius';
import { spacing } from '@/src/theme/spacing';
import { typography } from '@/src/theme/typography';
import { OwnerBillingStatus, OwnerBillingSummary, Property } from '@/src/types';
import { getFirstName } from '@/src/utils/auth';
import { formatCurrency } from '@/src/utils/currency';
import { formatDateLabel } from '@/src/utils/dates';

interface OwnerActionProps {
  description: string;
  icon: keyof typeof Feather.glyphMap;
  onPress: () => void;
  title: string;
}

function OwnerAction({ description, icon, onPress, title }: OwnerActionProps) {
  const { copy, isRtl } = useI18n();
  const localizedTitle = copy(title);
  const localizedDescription = copy(description);

  return (
    <Pressable
      accessibilityHint={localizedDescription}
      accessibilityLabel={localizedTitle}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.actionTile, pressed && styles.pressed]}>
      <View style={styles.actionIcon}>
        <Feather color={colors.primaryDark} name={icon} size={20} />
      </View>
      <View style={styles.actionCopy}>
        <Text style={[styles.actionTitle, isRtl && styles.rtlText]}>{localizedTitle}</Text>
        <Text style={[styles.actionDescription, isRtl && styles.rtlText]}>
          {localizedDescription}
        </Text>
      </View>
      <Feather color={colors.textMuted} name="chevron-right" size={18} />
    </Pressable>
  );
}

interface UnitRowProps {
  property: Property;
  tenantName: string;
}

function UnitRow({ property, tenantName }: UnitRowProps) {
  const { copy } = useI18n();
  const label = [property.name, property.unitLabel].filter(Boolean).join(' • ');

  return (
    <Pressable
      accessibilityLabel={`${copy('Unité')} ${label}`}
      accessibilityRole="button"
      onPress={() => router.push('/(owner)/properties')}
      style={({ pressed }) => [styles.unitRow, pressed && styles.pressed]}>
      <View style={styles.unitCopy}>
        <Text style={styles.unitTitle}>{label}</Text>
        <Text style={styles.unitMeta}>
          {tenantName || copy('Aucun locataire')} • {formatCurrency(property.monthlyRent)}
        </Text>
      </View>
      <StatusPill status={property.occupancyStatus} type="occupancy" />
    </Pressable>
  );
}

function ownerBillingStatusLabel(status: OwnerBillingStatus) {
  if (status === 'active') {
    return 'Compte actif';
  }

  if (status === 'grace_period') {
    return 'Délai de grâce';
  }

  if (status === 'past_due') {
    return 'Paiement requis';
  }

  return 'Compte suspendu';
}

export default function OwnerHomeScreen() {
  const {
    currentMonthKey,
    getTenantById,
    ownerDashboardSummary,
    ownerPayments,
    ownerUser,
    properties,
  } = useAppContext();
  const { session } = useSession();
  const { copy } = useI18n();
  const [billingSummary, setBillingSummary] = useState<OwnerBillingSummary | null>(null);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [isPayingOwnerFee, setIsPayingOwnerFee] = useState(false);
  const firstName = getFirstName(
    session?.profile?.displayName ?? ownerUser.fullName,
    ownerUser.fullName.split(' ')[0],
  );

  const currentMonthPayments = ownerPayments.filter(
    (payment) => payment.monthKey === currentMonthKey,
  );
  const paidCount = currentMonthPayments.filter((payment) => payment.status === 'paid').length;
  const pendingCount = currentMonthPayments.filter((payment) => payment.status === 'pending').length;
  const lateCount = currentMonthPayments.filter((payment) => payment.status === 'late').length;
  const visibleUnits = properties.slice(0, 5);

  useEffect(() => {
    let isMounted = true;

    async function loadBilling() {
      try {
        const summary = await getOwnerBillingViaBackend();

        if (isMounted) {
          setBillingSummary(summary);
          setBillingError(null);
        }
      } catch (error) {
        if (isMounted) {
          setBillingError(
            mapBackendErrorToMessage(error, 'La facturation propriétaire est indisponible.'),
          );
        }
      }
    }

    void loadBilling();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSimulateOwnerFeePayment = async () => {
    setIsPayingOwnerFee(true);
    setBillingError(null);

    try {
      setBillingSummary(await payOwnerBillingSimulatedViaBackend());
    } catch (error) {
      setBillingError(
        mapBackendErrorToMessage(error, 'Le paiement simulé des frais d’accès a échoué.'),
      );
    } finally {
      setIsPayingOwnerFee(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader
          subtitle="Vos unités, paiements et invitations au même endroit"
          title={`${copy('Bonjour')}, ${firstName}`}
        />

        <SummaryCard
          helper={`${copy('Loyer encaissé')} ${formatCurrency(ownerDashboardSummary.grossCollectedThisMonth)} • ${copy('Aucun frais locataire')}`}
          progress={ownerDashboardSummary.progressPercentage}
          subtitle="Loyers encaissés ce mois-ci"
          title="Total du mois"
          value={formatCurrency(ownerDashboardSummary.collectedThisMonth)}
        />

        <View style={styles.billingCard}>
          <View style={styles.billingHeader}>
            <View style={styles.actionCopy}>
              <Text style={styles.sectionTitle}>Statut du compte propriétaire</Text>
              <Text style={styles.actionDescription}>
                {billingSummary?.statusMessage ?? 'Votre compte propriétaire est actif.'}
              </Text>
            </View>
            <Text style={styles.billingStatus}>
              {billingSummary ? ownerBillingStatusLabel(billingSummary.account.status) : '...'}
            </Text>
          </View>
          {billingError ? (
            <BannerNotice
              description={billingError}
              title="Facturation indisponible"
              tone="error"
            />
          ) : null}
          <View style={styles.billingGrid}>
            <Text style={styles.billingMeta}>
              {`Actif jusqu’au ${billingSummary ? formatDateLabel(billingSummary.activeUntil) : '...'}`}
            </Text>
            <Text style={styles.billingMeta}>
              {`Prochain paiement ${billingSummary ? formatDateLabel(billingSummary.nextPaymentDueAt) : '...'}`}
            </Text>
            <Text style={styles.billingMeta}>Frais d’accès: 10 EUR</Text>
            <Text style={styles.billingMeta}>Cycle: toutes les 6 semaines</Text>
            <Text style={styles.billingMeta}>
              {`Dernier paiement ${billingSummary?.account.lastPaidAt ? formatDateLabel(billingSummary.account.lastPaidAt) : 'non enregistré'}`}
            </Text>
          </View>
          {!isProductionVariant ? (
            <PrimaryButton
              accessibilityHint="Simule le paiement des frais d’accès propriétaire hors production"
              label="Simuler le paiement des frais d’accès"
              loading={isPayingOwnerFee}
              onPress={() => {
                void handleSimulateOwnerFeePayment();
              }}
              variant="secondary"
            />
          ) : null}
        </View>

        <View style={styles.statusStrip}>
          <View style={styles.statusItem}>
            <Text style={styles.statusValue}>{paidCount}</Text>
            <Text style={styles.statusLabel}>{copy('Payés')}</Text>
          </View>
          <View style={styles.statusItem}>
            <Text style={styles.statusValue}>{pendingCount}</Text>
            <Text style={styles.statusLabel}>{copy('En attente')}</Text>
          </View>
          <View style={styles.statusItem}>
            <Text style={styles.statusValue}>{lateCount}</Text>
            <Text style={styles.statusLabel}>{copy('En retard')}</Text>
          </View>
        </View>

        <View style={styles.actions}>
          <OwnerAction
            description="Ouvre la liste des unités et locataires"
            icon="home"
            onPress={() => router.push('/(owner)/properties')}
            title="Voir mes unités"
          />
          <OwnerAction
            description="Crée ou copie une invitation locataire"
            icon="user-plus"
            onPress={() => router.push('/(owner)/properties')}
            title="Inviter un locataire"
          />
          <OwnerAction
            description="Ouvre les paiements, quittances et retards"
            icon="credit-card"
            onPress={() => router.push('/(owner)/payments')}
            title="Voir les paiements"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{copy('Locataires et unités')}</Text>
          {visibleUnits.length > 0 ? (
            <View style={styles.unitList}>
              {visibleUnits.map((property) => {
                const tenantName = property.tenantIds
                  .map((tenantId) => getTenantById(tenantId)?.fullName)
                  .filter(Boolean)
                  .join(', ');

                return (
                  <UnitRow
                    key={property.id}
                    property={property}
                    tenantName={tenantName}
                  />
                );
              })}
            </View>
          ) : (
            <ListEmptyState
              description="Ajoutez un bien, puis une unité, puis invitez un locataire."
              title="Aucune unité"
            />
          )}
        </View>

        {ownerDashboardSummary.actionItems.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{copy('Priorités')}</Text>
            <View style={styles.priorityList}>
              {ownerDashboardSummary.actionItems.slice(0, 2).map((item) => (
                <View key={item.id} style={styles.priorityRow}>
                  <View style={styles.actionCopy}>
                    <Text style={styles.priorityTitle}>{item.title}</Text>
                    <Text style={styles.actionDescription}>{item.description}</Text>
                  </View>
                  <Text style={styles.priorityAmount}>{formatCurrency(item.amount)}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.role.owner.background,
    flex: 1,
  },
  content: {
    gap: spacing.md,
    padding: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  statusStrip: {
    backgroundColor: colors.surface,
    borderColor: colors.role.owner.border,
    borderRadius: radius.xl,
    borderWidth: 1,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  billingCard: {
    backgroundColor: colors.surface,
    borderColor: colors.role.owner.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.sm,
  },
  billingHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  billingStatus: {
    color: colors.role.owner.active,
    textAlign: 'right',
    ...typography.caption,
  },
  billingGrid: {
    gap: 4,
  },
  billingMeta: {
    color: colors.textMuted,
    ...typography.caption,
  },
  statusItem: {
    alignItems: 'center',
    flex: 1,
    gap: 2,
    padding: spacing.sm,
  },
  statusValue: {
    color: colors.text,
    ...typography.heading,
  },
  statusLabel: {
    color: colors.textMuted,
    textAlign: 'center',
    ...typography.caption,
  },
  actions: {
    gap: spacing.sm,
  },
  actionTile: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.role.owner.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 76,
    padding: spacing.sm,
  },
  actionIcon: {
    alignItems: 'center',
    backgroundColor: colors.role.owner.soft,
    borderRadius: radius.pill,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  actionCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  actionTitle: {
    color: colors.text,
    ...typography.bodyStrong,
  },
  actionDescription: {
    color: colors.textMuted,
    ...typography.caption,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    color: colors.text,
    ...typography.subheading,
  },
  unitList: {
    gap: spacing.xs,
  },
  unitRow: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.role.owner.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
    padding: spacing.sm,
  },
  unitCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  unitTitle: {
    color: colors.text,
    ...typography.bodyStrong,
  },
  unitMeta: {
    color: colors.textMuted,
    ...typography.caption,
  },
  priorityList: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  priorityRow: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
    padding: spacing.sm,
  },
  priorityTitle: {
    color: colors.text,
    ...typography.bodyStrong,
  },
  priorityAmount: {
    color: colors.text,
    flexShrink: 1,
    ...typography.bodyStrong,
  },
  pressed: {
    opacity: 0.85,
  },
  rtlText: {
    writingDirection: 'rtl',
  },
});
