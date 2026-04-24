import * as Clipboard from 'expo-clipboard';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BannerNotice } from '@/src/components/BannerNotice';
import { ListEmptyState } from '@/src/components/ListEmptyState';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { ScreenHeader } from '@/src/components/ScreenHeader';
import { StatusPill } from '@/src/components/StatusPill';
import { AuthCard } from '@/src/components/auth/AuthCard';
import { AuthField } from '@/src/components/auth/AuthField';
import { InviteType, OwnerAccessInviteSummary } from '@/src/types';
import {
  createOwnerAccessInviteViaBackend,
  listOwnerAccessInvitesViaBackend,
  mapBackendErrorToMessage,
  revokeOwnerAccessInviteViaBackend,
} from '@/src/services/backendApi';
import { colors } from '@/src/theme/colors';
import { radius } from '@/src/theme/radius';
import { spacing } from '@/src/theme/spacing';
import { typography } from '@/src/theme/typography';
import { formatDateLabel } from '@/src/utils/dates';

interface FeedbackState {
  description: string;
  title: string;
  tone: 'error' | 'info' | 'success';
}

function InviteRow({
  invite,
  onCopy,
  onRevoke,
}: {
  invite: OwnerAccessInviteSummary;
  onCopy: (value: string, label: string) => void;
  onRevoke: (inviteId: string) => void;
}) {
  const inviteValue = invite.ownerInviteCode ?? invite.inviteLink;
  const inviteAccessibilityName = invite.email ?? invite.id.slice(0, 8);
  const missingValueMessage =
    invite.status === 'pending'
      ? 'Code non conservé après rechargement. Révoquez puis recréez l’invitation si vous devez la repartager.'
      : 'Valeur de partage indisponible pour cette invitation.';

  return (
    <View style={styles.inviteCard}>
      <View style={styles.inviteTop}>
        <View style={styles.inviteCopy}>
          <Text style={styles.inviteTitle}>{invite.email ?? 'Invitation propriétaire ouverte'}</Text>
          <Text style={styles.inviteMeta}>
            {`Expire le ${formatDateLabel(invite.expiresAt)}`}
          </Text>
        </View>
        <StatusPill status={invite.status === 'claimed' ? 'paid' : invite.status === 'pending' ? 'pending' : 'late'} type="payment" />
      </View>

      <Text style={[styles.inviteValue, !inviteValue && styles.inviteValueMuted]}>
        {inviteValue ?? missingValueMessage}
      </Text>

      <View style={styles.inviteActions}>
        {inviteValue ? (
          <PrimaryButton
            accessibilityLabel={`Copier l’invitation propriétaire ${inviteAccessibilityName}`}
            accessibilityHint="Copie le code ou le lien d’accès propriétaire"
            label={invite.ownerInviteCode ? 'Copier le code' : 'Copier le lien'}
            onPress={() => onCopy(inviteValue, invite.ownerInviteCode ? 'Code copié' : 'Lien copié')}
            variant="secondary"
          />
        ) : null}
        {invite.status === 'pending' ? (
          <PrimaryButton
            accessibilityLabel={`Révoquer l’invitation propriétaire ${inviteAccessibilityName}`}
            accessibilityHint="Révoque cette invitation propriétaire"
            label="Révoquer"
            onPress={() => onRevoke(invite.id)}
            variant="ghost"
          />
        ) : null}
      </View>
    </View>
  );
}

export default function AgencyInvitesScreen() {
  const [invites, setInvites] = useState<OwnerAccessInviteSummary[]>([]);
  const [inviteType, setInviteType] = useState<InviteType>('code');
  const [email, setEmail] = useState('');
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadInvites = async () => {
    const nextInvites = await listOwnerAccessInvitesViaBackend();
    setInvites(nextInvites);
  };

  useEffect(() => {
    void loadInvites().catch((error) => {
      setFeedback({
        description: mapBackendErrorToMessage(error, 'La liste des invitations agence est indisponible.'),
        title: 'Chargement impossible',
        tone: 'error',
      });
    });
  }, []);

  const handleCopy = async (value: string, title: string) => {
    await Clipboard.setStringAsync(value);
    setFeedback({
      description: 'La valeur a été copiée dans le presse-papiers pour être partagée.',
      title,
      tone: 'success',
    });
  };

  const handleCreateInvite = async () => {
    setFeedback(null);
    setIsSubmitting(true);

    try {
      const invite = await createOwnerAccessInviteViaBackend({
        email: email.trim() || undefined,
        inviteType,
      });
      const inviteValue = invite.ownerInviteCode ?? invite.inviteLink;

      if (inviteValue) {
        await Clipboard.setStringAsync(inviteValue);
      }

      setInvites((currentInvites) => [invite, ...currentInvites]);
      setEmail('');
      setFeedback({
        description: inviteValue
          ? 'L’invitation propriétaire est prête à être partagée et sa valeur a été copiée dans le presse-papiers.'
          : 'L’invitation propriétaire est prête à être partagée.',
        title: 'Invitation créée',
        tone: 'success',
      });
    } catch (error) {
      setFeedback({
        description: mapBackendErrorToMessage(error, "L’invitation propriétaire n’a pas pu être créée."),
        title: 'Création impossible',
        tone: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevoke = async (inviteId: string) => {
    setFeedback(null);

    try {
      const revokedInvite = await revokeOwnerAccessInviteViaBackend(inviteId);
      setInvites((currentInvites) =>
        currentInvites.map((invite) => (invite.id === inviteId ? revokedInvite : invite)),
      );
      setFeedback({
        description: 'Cette invitation ne peut plus être utilisée par un propriétaire.',
        title: 'Invitation révoquée',
        tone: 'info',
      });
    } catch (error) {
      setFeedback({
        description: mapBackendErrorToMessage(error, "La révocation n’a pas pu être appliquée."),
        title: 'Révocation impossible',
        tone: 'error',
      });
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        contentContainerStyle={styles.content}
        data={invites}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <ListEmptyState
            description="Créez la première invitation propriétaire depuis ce même écran."
            title="Aucune invitation propriétaire"
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <ScreenHeader
              subtitle="Émission, suivi et révocation des accès propriétaires gérés par l’agence."
              title="Invitations propriétaires"
            />

            {feedback ? (
              <BannerNotice
                description={feedback.description}
                title={feedback.title}
                tone={feedback.tone}
              />
            ) : null}

            <AuthCard
              description="L’adresse e-mail reste recommandée pour verrouiller l’invitation sur le bon propriétaire."
              title="Créer une invitation">
              <AuthField
                autoCapitalize="none"
                autoCorrect={false}
                helper="Laissez vide pour un code non lié à une adresse précise."
                keyboardType="email-address"
                label="E-mail du propriétaire"
                onChangeText={setEmail}
                placeholder="owner@example.com"
                value={email}
              />

              <View style={styles.typeRow}>
                {([
                  { label: 'Code', value: 'code' },
                  { label: 'Lien', value: 'link' },
                ] as Array<{ label: string; value: InviteType }>).map((option) => {
                  const selected = inviteType === option.value;

                  return (
                    <Pressable
                      accessibilityLabel={option.label}
                      accessibilityRole="button"
                      key={option.value}
                      onPress={() => setInviteType(option.value)}
                      style={({ pressed }) => [
                        styles.typeChip,
                        selected && styles.typeChipSelected,
                        pressed && styles.pressed,
                      ]}>
                      <Text
                        style={[
                          styles.typeChipText,
                          selected && styles.typeChipTextSelected,
                        ]}>
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <PrimaryButton
                accessibilityHint="Émet une nouvelle invitation propriétaire depuis le backend agence"
                label="Créer l’invitation"
                loading={isSubmitting}
                onPress={() => {
                  void handleCreateInvite();
                }}
              />
            </AuthCard>
          </View>
        }
        renderItem={({ item }) => (
          <InviteRow invite={item} onCopy={handleCopy} onRevoke={handleRevoke} />
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
  typeRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  typeChip: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  typeChipSelected: {
    backgroundColor: colors.surface,
    borderColor: colors.primary,
  },
  typeChipText: {
    color: colors.textMuted,
    ...typography.bodyStrong,
  },
  typeChipTextSelected: {
    color: colors.primaryDark,
  },
  inviteCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.sm,
  },
  inviteTop: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  inviteCopy: {
    flex: 1,
    gap: 2,
  },
  inviteTitle: {
    color: colors.text,
    ...typography.bodyStrong,
  },
  inviteMeta: {
    color: colors.textMuted,
    ...typography.caption,
  },
  inviteValue: {
    color: colors.text,
    ...typography.body,
  },
  inviteValueMuted: {
    color: colors.textMuted,
  },
  inviteActions: {
    gap: spacing.sm,
  },
  pressed: {
    opacity: 0.85,
  },
});
