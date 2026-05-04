import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BannerNotice } from '@/src/components/BannerNotice';
import { ScreenHeader } from '@/src/components/ScreenHeader';
import { SummaryCard } from '@/src/components/SummaryCard';
import { useI18n } from '@/src/i18n/I18nProvider';
import { useSession } from '@/src/context/SessionProvider';
import {
  getAgencySettingsViaBackend,
  listAgencyOwnerBillingViaBackend,
  listAgencyOwnersViaBackend,
  listOwnerAccessInvitesViaBackend,
  mapBackendErrorToMessage,
} from '@/src/services/backendApi';
import { colors } from '@/src/theme/colors';
import { radius } from '@/src/theme/radius';
import { spacing } from '@/src/theme/spacing';
import { typography } from '@/src/theme/typography';

interface AgencyActionProps {
  description: string;
  icon: keyof typeof Feather.glyphMap;
  onPress: () => void;
  title: string;
}

function AgencyAction({ description, icon, onPress, title }: AgencyActionProps) {
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

export default function AgencyHomeScreen() {
  const { session, signOut } = useSession();
  const { copy } = useI18n();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ownersCount, setOwnersCount] = useState(0);
  const [pendingInvitesCount, setPendingInvitesCount] = useState(0);
  const [billingAttentionCount, setBillingAttentionCount] = useState(0);
  const [agencyName, setAgencyName] = useState('Agence ATouPay');

  useEffect(() => {
    let isMounted = true;

    async function loadAgencyOverview() {
      setIsLoading(true);
      setError(null);

      try {
        const [owners, invites, settings, billing] = await Promise.all([
          listAgencyOwnersViaBackend(),
          listOwnerAccessInvitesViaBackend(),
          getAgencySettingsViaBackend(),
          listAgencyOwnerBillingViaBackend(),
        ]);

        if (!isMounted) {
          return;
        }

        setOwnersCount(owners.length);
        setPendingInvitesCount(invites.filter((invite) => invite.status === 'pending').length);
        setBillingAttentionCount(
          billing.filter(
            (item) =>
              item.account.status === 'past_due' ||
              item.account.status === 'grace_period' ||
              item.account.status === 'suspended',
          ).length,
        );
        setAgencyName(settings.displayName);
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

  const handleSignOut = async () => {
    await signOut();
    router.replace('/auth/login');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader
          rightAccessory={
            <View style={styles.headerActions}>
              <Pressable
                accessibilityLabel={copy('Ouvrir les notifications')}
                accessibilityRole="button"
                onPress={() => router.push('/notifications')}
                style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
                <Feather color={colors.text} name="bell" size={18} />
              </Pressable>
              <Pressable
                accessibilityLabel={copy('Se déconnecter')}
                accessibilityRole="button"
                onPress={() => {
                  void handleSignOut();
                }}
                style={({ pressed }) => [styles.logoutPill, pressed && styles.pressed]}>
                <Feather color={colors.danger} name="log-out" size={16} />
                <Text style={styles.logoutText}>{copy('Sortir')}</Text>
              </Pressable>
            </View>
          }
          subtitle="Ajouter des propriétaires, suivre les comptes, aider les clients"
          title={agencyName}
        />

        {error ? (
          <BannerNotice
            description={error}
            title="Backend indisponible"
            tone="error"
          />
        ) : null}

        <View style={styles.actions}>
          <AgencyAction
            description="Créer un code d’accès propriétaire"
            icon="user-plus"
            onPress={() => router.push('/(agency)/invites')}
            title="Ajouter un propriétaire"
          />
          <AgencyAction
            description="Voir les propriétaires et leur statut"
            icon="users"
            onPress={() => router.push('/(agency)/owners')}
            title="Voir les comptes"
          />
          <AgencyAction
            description="Traiter support, récupération et problèmes de paiement"
            icon="life-buoy"
            onPress={() => router.push('/(agency)/support')}
            title="Aider les clients"
          />
        </View>

        <View style={styles.summaryGrid}>
          <SummaryCard
            compact
            subtitle="Comptes activés"
            title="Propriétaires"
            value={isLoading ? '...' : String(ownersCount)}
          />
          <SummaryCard
            accent="warning"
            compact
            subtitle="À envoyer ou utiliser"
            title="Invitations"
            value={isLoading ? '...' : String(pendingInvitesCount)}
          />
          <SummaryCard
            accent="neutral"
            compact
            subtitle="10 EUR / 6 semaines"
            title="Frais propriétaire"
            value={isLoading ? '...' : String(billingAttentionCount)}
          />
        </View>

        <View style={styles.secondaryCard}>
          <Text style={styles.secondaryTitle}>{copy('Opérations secondaires')}</Text>
          <Text style={styles.secondaryText}>
            {copy(
              'Les frais d’accès propriétaire sont séparés des loyers. Les locataires paient uniquement leur loyer.',
            )}
          </Text>
          <View style={styles.secondaryActions}>
            <Pressable
              accessibilityLabel={copy('Réglages agence')}
              accessibilityRole="button"
              onPress={() => router.push('/(agency)/settings')}
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
              <Text style={styles.secondaryButtonText}>{copy('Réglages')}</Text>
            </Pressable>
            <Text style={styles.sessionText}>{session?.profile?.email ?? copy('Session agence')}</Text>
          </View>
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
  actions: {
    gap: spacing.sm,
  },
  actionTile: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 76,
    padding: spacing.sm,
  },
  actionIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
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
  summaryGrid: {
    gap: spacing.sm,
  },
  secondaryCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.sm,
  },
  secondaryTitle: {
    color: colors.text,
    ...typography.bodyStrong,
  },
  secondaryText: {
    color: colors.textMuted,
    ...typography.body,
  },
  secondaryActions: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  secondaryButton: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  secondaryButtonText: {
    color: colors.primaryDark,
    ...typography.bodyStrong,
  },
  sessionText: {
    color: colors.textMuted,
    flexShrink: 1,
    ...typography.caption,
  },
  pressed: {
    opacity: 0.82,
  },
  rtlText: {
    writingDirection: 'rtl',
  },
});
