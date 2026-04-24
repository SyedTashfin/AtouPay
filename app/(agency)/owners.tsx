import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BannerNotice } from '@/src/components/BannerNotice';
import { ListEmptyState } from '@/src/components/ListEmptyState';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { ScreenHeader } from '@/src/components/ScreenHeader';
import { StatusPill } from '@/src/components/StatusPill';
import { AgencyUserSummary } from '@/src/types';
import {
  listAgencyOwnersViaBackend,
  listAgencyUsersViaBackend,
  mapBackendErrorToMessage,
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

function OwnerRow({
  isUpdating,
  onToggleStatus,
  user,
}: {
  isUpdating: boolean;
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

      {user.status === 'active' || user.status === 'suspended' ? (
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

        if (isMounted) {
          setUsers(nextUsers);
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
            isUpdating={updatingUid === item.uid}
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
});
