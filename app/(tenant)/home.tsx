import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';

import { BannerNotice } from '@/src/components/BannerNotice';
import { InviteClaimCard } from '@/src/components/InviteClaimCard';
import { ListEmptyState } from '@/src/components/ListEmptyState';
import { PaymentCard } from '@/src/components/PaymentCard';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { ScreenHeader } from '@/src/components/ScreenHeader';
import { SectionTitle } from '@/src/components/SectionTitle';
import { StatusPill } from '@/src/components/StatusPill';
import { SummaryCard } from '@/src/components/SummaryCard';
import { useAppContext } from '@/src/context/AppProvider';
import { useSession } from '@/src/context/SessionProvider';
import { redeemTenantInvite } from '@/src/services/rentalData';
import { colors } from '@/src/theme/colors';
import { radius } from '@/src/theme/radius';
import { shadows } from '@/src/theme/shadows';
import { spacing } from '@/src/theme/spacing';
import { typography } from '@/src/theme/typography';
import { getFirstName } from '@/src/utils/auth';
import { formatCurrency } from '@/src/utils/currency';
import { formatDateLabel, formatMonthLabel } from '@/src/utils/dates';

function NotificationBell({ count }: { count: number }) {
  return (
    <Pressable
      accessibilityHint="Ouvre la liste de vos paiements pour suivre les loyers à traiter"
      accessibilityLabel="Notifications de paiement"
      accessibilityRole="button"
      onPress={() => router.push('/notifications')}
      style={({ pressed }) => [styles.bellButton, pressed && styles.pressed]}>
      <Feather color={colors.text} name="bell" size={18} />
      {count > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

interface InviteFeedbackState {
  description: string;
  title: string;
  tone: 'info' | 'success' | 'error';
}

export default function TenantHomeScreen() {
  const {
    clearPendingInviteCode,
    currentTenantPayment,
    getPropertyById,
    ownerUser,
    pendingInviteCode,
    reportDataEvent,
    savePendingInviteCode,
    tenantAssignmentRequired,
    tenantPayments,
    tenantUser,
  } = useAppContext();
  const { session } = useSession();
  const [inviteCode, setInviteCode] = useState(pendingInviteCode ?? '');
  const [inviteFeedback, setInviteFeedback] = useState<InviteFeedbackState | null>(null);
  const [isRedeemingInvite, setIsRedeemingInvite] = useState(false);

  useEffect(() => {
    setInviteCode(pendingInviteCode ?? '');
  }, [pendingInviteCode]);

  const property = tenantUser.propertyId ? getPropertyById(tenantUser.propertyId) : undefined;
  const propertyLabel = property
    ? [property.name, property.unitLabel].filter(Boolean).join(' • ')
    : undefined;
  const recentPayments = tenantPayments.slice(0, 3);
  const canPay = currentTenantPayment?.status !== 'paid';
  const firstName = getFirstName(
    session?.profile?.displayName ?? tenantUser.fullName,
    tenantUser.fullName.split(' ')[0],
  );

  const handleRedeemInvite = async () => {
    if (!session?.firebaseUid || !session.profile?.email) {
      const feedbackState = {
        description:
          'Connectez-vous avec un compte Firebase locataire avant de réclamer une invitation.',
        title: 'Session requise',
        tone: 'error',
      } as const;
      setInviteFeedback(feedbackState);
      reportDataEvent({
        action: 'redeem-invite',
        message: feedbackState.description,
        scope: 'invite',
        status: 'error',
        title: feedbackState.title,
      });
      return;
    }

    setInviteFeedback(null);
    setIsRedeemingInvite(true);

    try {
      const result = await redeemTenantInvite({
        code: inviteCode,
        displayName: session.profile.displayName,
        email: session.profile.email,
        userId: session.firebaseUid,
      });

      setInviteFeedback({
        description: result.message,
        title: result.title,
        tone: result.ok ? 'success' : 'error',
      });
      reportDataEvent({
        action: 'redeem-invite',
        message: result.message,
        scope: 'invite',
        status: result.ok ? 'success' : 'error',
        title: result.title,
      });

      if (result.ok) {
        await clearPendingInviteCode();
        setInviteCode('');
      }
    } finally {
      setIsRedeemingInvite(false);
    }
  };

  const handlePasteInviteCode = async () => {
    const clipboardValue = await Clipboard.getStringAsync();
    setInviteFeedback(null);
    setInviteCode(clipboardValue);
    await savePendingInviteCode(clipboardValue);
    reportDataEvent({
      action: 'paste-invite-code',
      message:
        clipboardValue.trim().length > 0
          ? 'Le code du presse-papiers a été collé dans le champ d’invitation.'
          : 'Le presse-papiers était vide.',
      scope: 'invite',
      status: clipboardValue.trim().length > 0 ? 'info' : 'error',
      title: clipboardValue.trim().length > 0 ? 'Code collé' : 'Presse-papiers vide',
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader
          rightAccessory={<NotificationBell count={tenantPayments.filter((payment) => payment.status !== 'paid').length} />}
          subtitle="Votre loyer du mois reste au centre de l'écran"
          title={`Bonjour, ${firstName}`}
        />

        {tenantAssignmentRequired ? (
          <View style={styles.assignmentSection}>
            <BannerNotice
              description="Le propriétaire doit vous inviter sur une unité précise. Vous ne pouvez pas choisir librement un logement dans cette version."
              title="Invitation requise"
            />

            {inviteFeedback ? (
              <BannerNotice
                description={inviteFeedback.description}
                title={inviteFeedback.title}
                tone={inviteFeedback.tone}
              />
            ) : null}

            <InviteClaimCard
              code={inviteCode}
              errorMessage={inviteFeedback?.tone === 'error' ? inviteFeedback.description : null}
              helperMessage={
                pendingInviteCode
                  ? 'Un code détecté depuis un lien profond a été prérempli.'
                  : 'Demandez un code ou un lien unique au propriétaire du logement.'
              }
              loading={isRedeemingInvite}
              onChangeCode={(value) => {
                setInviteFeedback(null);
                setInviteCode(value);
                void savePendingInviteCode(value);
              }}
              onClearDetectedCode={
                pendingInviteCode
                  ? () => {
                      void clearPendingInviteCode();
                      setInviteCode('');
                    }
                  : undefined
              }
              onPasteCode={() => {
                void handlePasteInviteCode();
              }}
              onSubmit={() => void handleRedeemInvite()}
            />
          </View>
        ) : currentTenantPayment ? (
          <>
            <View style={styles.mainCard}>
              <View style={styles.mainCardTop}>
                <View style={styles.mainCardCopy}>
                  <Text style={styles.cardEyebrow}>Loyer du mois</Text>
                  <Text style={styles.cardMonth}>{formatMonthLabel(currentTenantPayment.monthKey)}</Text>
                  <Text style={styles.cardAmount}>{formatCurrency(currentTenantPayment.amount)}</Text>
                </View>
                <StatusPill status={currentTenantPayment.status} type="payment" />
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Échéance</Text>
                <Text style={styles.detailValue}>{formatDateLabel(currentTenantPayment.dueDate)}</Text>
              </View>
              <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Propriété</Text>
              <Text style={styles.detailValue}>{propertyLabel ?? 'Votre logement'}</Text>
            </View>

              <PrimaryButton
                accessibilityHint="Ouvre l'écran de paiement du loyer courant"
                disabled={!canPay}
                label={canPay ? 'Payer maintenant' : 'Paiement enregistré'}
                onPress={() =>
                  router.push(`/(tenant)/pay-rent?paymentId=${currentTenantPayment.id}`)
                }
              />
            </View>

            {property ? (
              <SummaryCard
                accent="neutral"
                helper={`Propriétaire: ${ownerUser.fullName}`}
                subtitle={property.address}
                title="Votre logement"
                value={propertyLabel ?? property.name}
              />
            ) : null}

            <View style={styles.section}>
              <SectionTitle
                actionLabel="Voir tout"
                onActionPress={() => router.push('/(tenant)/payments')}
                subtitle="Vos derniers loyers et leur statut"
                title="Paiements récents"
              />

              {recentPayments.length > 0 ? (
                recentPayments.map((payment) => (
                  <PaymentCard
                    key={payment.id}
                    onPress={
                      payment.status !== 'paid'
                        ? () => router.push(`/(tenant)/pay-rent?paymentId=${payment.id}`)
                        : undefined
                    }
                    payment={payment}
                    propertyName={propertyLabel ?? 'Logement'}
                  />
                ))
              ) : (
                <ListEmptyState
                  description="Aucun historique n’est encore disponible pour cette unité."
                  title="Paiements à venir"
                />
              )}
            </View>
          </>
        ) : (
          <ListEmptyState
            description="Aucun loyer actif n’est disponible dans cette session. Une invitation valide crée le premier loyer simulé du mois."
            title="Aucun loyer à afficher"
          />
        )}
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
  assignmentSection: {
    gap: spacing.sm,
  },
  bellButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    position: 'relative',
    width: 44,
  },
  badge: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    height: 18,
    justifyContent: 'center',
    minWidth: 18,
    paddingHorizontal: 4,
    position: 'absolute',
    right: -2,
    top: -4,
  },
  badgeText: {
    color: colors.surface,
    ...typography.caption,
  },
  mainCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
    ...shadows.card,
  },
  mainCardTop: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  mainCardCopy: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  cardEyebrow: {
    color: colors.textMuted,
    ...typography.caption,
  },
  cardMonth: {
    color: colors.text,
    ...typography.subheading,
  },
  cardAmount: {
    color: colors.primaryDark,
    marginTop: spacing.xs,
    ...typography.display,
  },
  detailRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  detailLabel: {
    color: colors.textMuted,
    ...typography.body,
  },
  detailValue: {
    color: colors.text,
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    textAlign: 'right',
    ...typography.bodyStrong,
  },
  section: {
    gap: spacing.sm,
  },
  pressed: {
    opacity: 0.85,
  },
});
