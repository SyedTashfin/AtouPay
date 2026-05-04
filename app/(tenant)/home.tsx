import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';

import { BannerNotice } from '@/src/components/BannerNotice';
import { InviteClaimCard } from '@/src/components/InviteClaimCard';
import { ListEmptyState } from '@/src/components/ListEmptyState';
import { ScreenHeader } from '@/src/components/ScreenHeader';
import { StatusPill } from '@/src/components/StatusPill';
import { useAppContext } from '@/src/context/AppProvider';
import { useSession } from '@/src/context/SessionProvider';
import { useI18n } from '@/src/i18n/I18nProvider';
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
  const { copy } = useI18n();

  return (
    <Pressable
      accessibilityHint={copy('Ouvre la liste de vos paiements pour suivre les loyers à traiter')}
      accessibilityLabel={copy('Notifications de paiement')}
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

interface TenantActionProps {
  description: string;
  disabled?: boolean;
  icon: keyof typeof Feather.glyphMap;
  onPress: () => void;
  tone?: 'default' | 'payment';
  title: string;
}

function TenantAction({
  description,
  disabled = false,
  icon,
  onPress,
  tone = 'default',
  title,
}: TenantActionProps) {
  const { copy, isRtl } = useI18n();
  const isPayment = tone === 'payment';
  const localizedTitle = copy(title);
  const localizedDescription = copy(description);

  return (
    <Pressable
      accessibilityHint={localizedDescription}
      accessibilityLabel={localizedTitle}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionTile,
        isPayment && styles.paymentTile,
        disabled && styles.disabledTile,
        pressed && !disabled && styles.pressed,
      ]}>
      <View style={[styles.actionIcon, isPayment && styles.paymentIcon]}>
        <Feather
          color={disabled ? colors.textMuted : isPayment ? colors.surface : colors.primaryDark}
          name={icon}
          size={20}
        />
      </View>
      <View style={styles.actionCopy}>
        <Text style={[styles.actionTitle, isRtl && styles.rtlText, isPayment && styles.paymentTitle]}>
          {localizedTitle}
        </Text>
        <Text style={[styles.actionDescription, isPayment && styles.paymentDescription]}>
          {localizedDescription}
        </Text>
      </View>
      <Feather color={isPayment ? colors.surface : colors.textMuted} name="chevron-right" size={18} />
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
  const { copy, t } = useI18n();

  useEffect(() => {
    setInviteCode(pendingInviteCode ?? '');
  }, [pendingInviteCode]);

  const property = tenantUser.propertyId ? getPropertyById(tenantUser.propertyId) : undefined;
  const propertyLabel = property
    ? [property.name, property.unitLabel].filter(Boolean).join(' • ')
    : undefined;
  const canPay = currentTenantPayment?.status !== 'paid';
  const hasReceiptHistory = tenantPayments.some((payment) => payment.status === 'paid' && payment.receiptId);
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
          subtitle={t('tenant.home.subtitle')}
          title={`${copy('Bonjour')}, ${firstName}`}
        />

        {tenantAssignmentRequired ? (
          <View style={styles.assignmentSection}>
            <BannerNotice
              description="Votre compte est ouvert. Pour voir le loyer et les quittances, ajoutez le code logement transmis par votre propriétaire."
              title="Compte locataire prêt"
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
                  : 'Si vous n’avez pas encore le code, vous pouvez revenir plus tard: votre compte reste accessible.'
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

            <View style={styles.actions}>
              <TenantAction
                description="Disponible après rattachement du logement."
                disabled
                icon="credit-card"
                onPress={() => undefined}
                tone="payment"
                title={t('tenant.actions.pay.title')}
              />
              <TenantAction
                description="Vos quittances apparaîtront après le premier paiement simulé."
                disabled
                icon="file-text"
                onPress={() => undefined}
                title={t('tenant.actions.receipt.title')}
              />
              <TenantAction
                description={t('tenant.actions.account.description')}
                icon="user"
                onPress={() => router.push('/(tenant)/profile')}
                title={t('tenant.actions.account.title')}
              />
            </View>

            <View style={styles.secondaryLinks}>
              <Pressable
                accessibilityLabel="Aide locataire"
                accessibilityRole="button"
                onPress={() => router.push('/support')}
                style={({ pressed }) => [styles.secondaryLink, pressed && styles.pressed]}>
                <Text style={styles.secondaryLinkText}>{t('common.needHelp')}</Text>
              </Pressable>
              <Text style={styles.secondaryDot}>•</Text>
              <Text style={styles.secondaryText}>
                {t('payments.simulatedShort')}
              </Text>
            </View>
          </View>
        ) : currentTenantPayment ? (
          <>
            <View style={styles.mainCard}>
              <View style={styles.mainCardTop}>
                <View style={styles.mainCardCopy}>
                  <Text style={styles.cardEyebrow}>{copy('Loyer du mois')}</Text>
                  <Text style={styles.cardMonth}>{formatMonthLabel(currentTenantPayment.monthKey)}</Text>
                  <Text style={styles.cardAmount}>{formatCurrency(currentTenantPayment.amount)}</Text>
                </View>
                <StatusPill status={currentTenantPayment.status} type="payment" />
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{copy('Échéance')}</Text>
                <Text style={styles.detailValue}>{formatDateLabel(currentTenantPayment.dueDate)}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{copy('Propriété')}</Text>
                <Text style={styles.detailValue}>{propertyLabel ?? copy('Votre logement')}</Text>
              </View>
            </View>

            <View style={styles.actions}>
              <TenantAction
                description={
                  canPay
                    ? t('tenant.actions.pay.description')
                    : t('tenant.actions.pay.paidDescription')
                }
                disabled={!canPay}
                icon="credit-card"
                onPress={() => {
                  router.push(`/(tenant)/pay-rent?paymentId=${currentTenantPayment.id}`);
                }}
                tone="payment"
                title={t('tenant.actions.pay.title')}
              />
              <TenantAction
                description={
                  hasReceiptHistory
                    ? t('tenant.actions.receipt.description')
                    : t('tenant.actions.receipt.historyDescription')
                }
                icon="file-text"
                onPress={() => {
                  router.push('/(tenant)/receipts' as never);
                }}
                title={t('tenant.actions.receipt.title')}
              />
              <TenantAction
                description={t('tenant.actions.account.description')}
                icon="user"
                onPress={() => router.push('/(tenant)/profile')}
                title={t('tenant.actions.account.title')}
              />
            </View>

            <View style={styles.secondaryLinks}>
              <Pressable
                accessibilityLabel="Aide locataire"
                accessibilityRole="button"
                onPress={() => router.push('/support')}
                style={({ pressed }) => [styles.secondaryLink, pressed && styles.pressed]}>
                <Text style={styles.secondaryLinkText}>{t('common.needHelp')}</Text>
              </Pressable>
              <Text style={styles.secondaryDot}>•</Text>
              <Text style={styles.secondaryText}>
                {t('payments.simulatedShort')}
              </Text>
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
    backgroundColor: colors.role.tenant.background,
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
    backgroundColor: colors.role.tenant.soft,
    borderColor: colors.role.tenant.border,
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
    color: colors.role.tenant.active,
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
  actions: {
    gap: spacing.sm,
  },
  actionTile: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.role.tenant.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 82,
    padding: spacing.sm,
  },
  paymentTile: {
    backgroundColor: colors.primaryDark,
    borderColor: colors.primaryDark,
  },
  disabledTile: {
    opacity: 0.58,
  },
  actionIcon: {
    alignItems: 'center',
    backgroundColor: colors.role.tenant.soft,
    borderRadius: radius.pill,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  paymentIcon: {
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
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
  paymentTitle: {
    color: colors.surface,
  },
  actionDescription: {
    color: colors.textMuted,
    ...typography.caption,
  },
  paymentDescription: {
    color: colors.primarySoft,
  },
  secondaryLinks: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    justifyContent: 'center',
    paddingTop: spacing.xs,
  },
  secondaryLink: {
    padding: spacing.xs,
  },
  secondaryLinkText: {
    color: colors.role.tenant.active,
    ...typography.bodyStrong,
  },
  secondaryDot: {
    color: colors.textMuted,
    ...typography.body,
  },
  secondaryText: {
    color: colors.textMuted,
    ...typography.caption,
  },
  pressed: {
    opacity: 0.85,
  },
  rtlText: {
    writingDirection: 'rtl',
  },
});
