import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BannerNotice } from '@/src/components/BannerNotice';
import { ListEmptyState } from '@/src/components/ListEmptyState';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { ScreenHeader } from '@/src/components/ScreenHeader';
import { StatusPill } from '@/src/components/StatusPill';
import { AgencyOwnerBillingSummary, AgencyUserSummary, OwnerBillingStatus } from '@/src/types';
import {
  listAgencyOwnerBillingViaBackend,
  listAgencyOwnersViaBackend,
  listAgencyUsersViaBackend,
  markAgencyOwnerBillingPaidViaBackend,
  mapBackendErrorToMessage,
  reactivateAgencyOwnerBillingViaBackend,
  suspendAgencyOwnerBillingViaBackend,
  updateAgencyUserStatusViaBackend,
} from '@/src/services/backendApi';
import { colors } from '@/src/theme/colors';
import { radius } from '@/src/theme/radius';
import { spacing } from '@/src/theme/spacing';
import { typography } from '@/src/theme/typography';
import { formatDateLabel } from '@/src/utils/dates';

function statusTone(status: AgencyUserSummary['status']) {
  return status === 'suspended' ? 'late' : status === 'active' ? 'paid' : 'pending';
}

function roleLabel(role: AgencyUserSummary['role']) {
  if (role === 'owner') {
    return 'Propriétaire';
  }

  if (role === 'tenant') {
    return 'Locataire';
  }

  return 'Agence';
}

function billingStatusLabel(status: OwnerBillingStatus) {
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

function billingStatusTone(status: OwnerBillingStatus) {
  if (status === 'active') {
    return 'paid';
  }

  if (status === 'suspended') {
    return 'late';
  }

  return 'pending';
}

function OwnerRow({
  billing,
  isUpdating,
  onMarkPaid,
  onReactivateBilling,
  onSuspendBilling,
  onToggleStatus,
  user,
}: {
  billing?: AgencyOwnerBillingSummary;
  isUpdating: boolean;
  onMarkPaid: (user: AgencyUserSummary) => void;
  onReactivateBilling: (user: AgencyUserSummary) => void;
  onSuspendBilling: (user: AgencyUserSummary) => void;
  onToggleStatus: (user: AgencyUserSummary) => void;
  user: AgencyUserSummary;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.rowTop}>
        <View style={styles.copy}>
          <Text style={styles.title}>{user.displayName}</Text>
          <Text style={styles.subtitle}>{`${roleLabel(user.role)} • ${user.email}`}</Text>
        </View>
        <StatusPill status={statusTone(user.status)} type="payment" />
      </View>

      <Text style={styles.meta}>
        {user.role === 'owner'
          ? `Owner ID: ${user.ownerId ?? 'non activé'}`
          : `Tenant ID: ${user.tenantId ?? 'non attribué'}`}
      </Text>
      <Text style={styles.meta}>
        {`Créé le ${formatDateLabel(user.createdAt)}`}
      </Text>
      {user.role === 'owner' && billing ? (
        <View style={styles.billingBox}>
          <View style={styles.rowTop}>
            <Text style={styles.meta}>Facturation propriétaire</Text>
            <StatusPill status={billingStatusTone(billing.account.status)} type="payment" />
          </View>
          <Text style={styles.meta}>{billingStatusLabel(billing.account.status)}</Text>
          <Text style={styles.meta}>{`Actif jusqu’au ${formatDateLabel(billing.activeUntil)}`}</Text>
          <Text style={styles.meta}>{`Prochain paiement ${formatDateLabel(billing.nextPaymentDueAt)}`}</Text>
          <Text style={styles.meta}>
            {`Dernière facture Frais d’accès propriétaire ATouPay: ${billing.latestInvoice?.status ?? 'aucune'}`}
          </Text>
          <PrimaryButton
            label="Marquer les frais payés"
            loading={isUpdating}
            onPress={() => onMarkPaid(user)}
            variant="secondary"
          />
          <PrimaryButton
            label={billing.account.status === 'suspended' ? 'Réactiver la facturation' : 'Suspendre la facturation'}
            loading={isUpdating}
            onPress={() =>
              billing.account.status === 'suspended'
                ? onReactivateBilling(user)
                : onSuspendBilling(user)
            }
            variant={billing.account.status === 'suspended' ? 'secondary' : 'ghost'}
          />
        </View>
      ) : null}

      {user.role !== 'owner' && (user.status === 'active' || user.status === 'suspended') ? (
        <PrimaryButton
          label={user.status === 'suspended' ? 'Réactiver le compte' : 'Suspendre le compte'}
          loading={isUpdating}
          onPress={() => onToggleStatus(user)}
          variant={user.status === 'suspended' ? 'secondary' : 'ghost'}
        />
      ) : null}
    </View>
  );
}

export default function AgencyOwnersScreen() {
  const [users, setUsers] = useState<AgencyUserSummary[]>([]);
  const [billingItems, setBillingItems] = useState<AgencyOwnerBillingSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [updatingUid, setUpdatingUid] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadOwners() {
      try {
        const nextUsers = await listAgencyUsersViaBackend().catch(async () => {
          const owners = await listAgencyOwnersViaBackend();

          return owners.map((owner) => ({
            ...owner,
            role: 'owner' as const,
            tenantId: null,
          }));
        });
        const nextBillingItems = await listAgencyOwnerBillingViaBackend().catch(() => []);

        if (isMounted) {
          setUsers(nextUsers);
          setBillingItems(nextBillingItems);
        }
      } catch (loadError) {
        if (!isMounted) {
          return;
        }

        setError(
          mapBackendErrorToMessage(
            loadError,
            'Le registre propriétaire est indisponible.',
          ),
        );
      }
    }

    void loadOwners();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleToggleStatus = async (user: AgencyUserSummary) => {
    const nextStatus = user.status === 'suspended' ? 'active' : 'suspended';

    setUpdatingUid(user.uid);
    setFeedback(null);
    setError(null);

    try {
      const updatedUser = await updateAgencyUserStatusViaBackend({
        status: nextStatus,
        uid: user.uid,
      });

      setUsers((currentUsers) =>
        currentUsers.map((currentUser) =>
          currentUser.uid === updatedUser.uid ? updatedUser : currentUser,
        ),
      );
      setFeedback(
        nextStatus === 'suspended'
          ? 'Le compte est suspendu et ne peut plus accéder à son espace normal.'
          : 'Le compte est réactivé et peut de nouveau utiliser son espace.',
      );
    } catch (toggleError) {
      setError(
        mapBackendErrorToMessage(toggleError, 'Le changement de statut a échoué.'),
      );
    } finally {
      setUpdatingUid(null);
    }
  };

  const replaceBillingSummary = (
    ownerId: string,
    summary: Awaited<ReturnType<typeof markAgencyOwnerBillingPaidViaBackend>>,
  ) => {
    setBillingItems((currentItems) =>
      currentItems.map((item) =>
        item.owner.ownerId === ownerId
          ? {
              ...item,
              account: summary.account,
              activeUntil: summary.activeUntil,
              canCreateInvites: summary.canCreateInvites,
              canManageProperties: summary.canManageProperties,
              latestInvoice: summary.latestInvoice,
              nextPaymentDueAt: summary.nextPaymentDueAt,
              statusMessage: summary.statusMessage,
            }
          : item,
      ),
    );
  };

  const handleMarkBillingPaid = async (user: AgencyUserSummary) => {
    if (!user.ownerId) {
      return;
    }

    setUpdatingUid(user.uid);
    setFeedback(null);
    setError(null);

    try {
      const summary = await markAgencyOwnerBillingPaidViaBackend({
        note: 'Paiement manuel des frais d’accès propriétaire enregistré par l’agence.',
        ownerId: user.ownerId,
        provider: 'manual',
      });
      replaceBillingSummary(user.ownerId, summary);
      setFeedback('Les frais d’accès propriétaire ont été marqués comme payés.');
    } catch (markError) {
      setError(mapBackendErrorToMessage(markError, 'Le paiement manuel a échoué.'));
    } finally {
      setUpdatingUid(null);
    }
  };

  const handleSuspendBilling = async (user: AgencyUserSummary) => {
    if (!user.ownerId) {
      return;
    }

    setUpdatingUid(user.uid);
    setFeedback(null);
    setError(null);

    try {
      const summary = await suspendAgencyOwnerBillingViaBackend({
        ownerId: user.ownerId,
        reason: 'Suspension manuelle par l’agence.',
      });
      replaceBillingSummary(user.ownerId, summary);
      setFeedback('La facturation propriétaire est suspendue.');
    } catch (suspendError) {
      setError(mapBackendErrorToMessage(suspendError, 'La suspension a échoué.'));
    } finally {
      setUpdatingUid(null);
    }
  };

  const handleReactivateBilling = async (user: AgencyUserSummary) => {
    if (!user.ownerId) {
      return;
    }

    setUpdatingUid(user.uid);
    setFeedback(null);
    setError(null);

    try {
      const summary = await reactivateAgencyOwnerBillingViaBackend(user.ownerId);
      replaceBillingSummary(user.ownerId, summary);
      setFeedback('La facturation propriétaire est réactivée.');
    } catch (reactivateError) {
      setError(mapBackendErrorToMessage(reactivateError, 'La réactivation a échoué.'));
    } finally {
      setUpdatingUid(null);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        contentContainerStyle={styles.content}
        data={users}
        keyExtractor={(item) => item.uid}
        ListEmptyComponent={
          <ListEmptyState
            description="Les propriétaires activés apparaîtront ici après avoir utilisé une invitation agence valide."
            title="Aucun compte opérable"
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <ScreenHeader
              subtitle="Registre minimal des comptes propriétaires activés pour cette agence."
              title="Propriétaires"
            />
            {error ? (
              <BannerNotice
                description={error}
                title="Chargement impossible"
                tone="error"
              />
            ) : null}
            {feedback ? (
              <BannerNotice
                description={feedback}
                title="Statut mis à jour"
                tone="success"
              />
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <OwnerRow
            billing={
              item.role === 'owner'
                ? billingItems.find((billing) => billing.owner.ownerId === item.ownerId)
                : undefined
            }
            isUpdating={updatingUid === item.uid}
            onMarkPaid={(selectedUser) => {
              void handleMarkBillingPaid(selectedUser);
            }}
            onReactivateBilling={(selectedUser) => {
              void handleReactivateBilling(selectedUser);
            }}
            onSuspendBilling={(selectedUser) => {
              void handleSuspendBilling(selectedUser);
            }}
            onToggleStatus={(selectedUser) => {
              void handleToggleStatus(selectedUser);
            }}
            user={item}
          />
        )}
        showsVerticalScrollIndicator={false}
      />
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
  header: {
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.sm,
  },
  rowTop: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: colors.text,
    ...typography.bodyStrong,
  },
  subtitle: {
    color: colors.textMuted,
    ...typography.body,
  },
  meta: {
    color: colors.textMuted,
    ...typography.caption,
  },
  billingBox: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.sm,
  },
});
