import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PaymentCard } from '@/src/components/PaymentCard';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { ScreenHeader } from '@/src/components/ScreenHeader';
import { SectionTitle } from '@/src/components/SectionTitle';
import { StatusPill } from '@/src/components/StatusPill';
import { SummaryCard } from '@/src/components/SummaryCard';
import { useAppContext } from '@/src/context/AppProvider';
import { colors } from '@/src/theme/colors';
import { radius } from '@/src/theme/radius';
import { shadows } from '@/src/theme/shadows';
import { spacing } from '@/src/theme/spacing';
import { typography } from '@/src/theme/typography';
import { formatCurrency } from '@/src/utils/currency';
import { formatDateLabel, formatMonthLabel } from '@/src/utils/dates';

function NotificationBell({ count }: { count: number }) {
  return (
    <Pressable
      accessibilityHint="Affiche les alertes de paiement à venir"
      accessibilityLabel="Notifications de paiement"
      accessibilityRole="button"
      onPress={() => {}}
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

export default function TenantHomeScreen() {
  const { currentTenantPayment, getPropertyById, ownerUser, tenantPayments, tenantUser } =
    useAppContext();

  const property = getPropertyById(tenantUser.propertyId);
  const recentPayments = tenantPayments.slice(0, 3);
  const canPay = currentTenantPayment?.status !== 'paid';

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader
          rightAccessory={<NotificationBell count={1} />}
          subtitle="Votre loyer du mois reste au centre de l'écran"
          title={`Bonjour, ${tenantUser.fullName.split(' ')[0]}`}
        />

        {currentTenantPayment ? (
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
              <Text style={styles.detailValue}>{property?.name ?? 'Votre logement'}</Text>
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
        ) : null}

        {property ? (
          <SummaryCard
            accent="neutral"
            helper={`Propriétaire: ${ownerUser.fullName}`}
            subtitle={property.address}
            title="Votre logement"
            value={property.name}
          />
        ) : null}

        <View style={styles.section}>
          <SectionTitle
            actionLabel="Voir tout"
            onActionPress={() => router.push('/(tenant)/payments')}
            subtitle="Vos derniers loyers et leur statut"
            title="Paiements récents"
          />

          {recentPayments.map((payment) => (
            <PaymentCard
              key={payment.id}
              onPress={
                payment.status !== 'paid'
                  ? () => router.push(`/(tenant)/pay-rent?paymentId=${payment.id}`)
                  : undefined
              }
              payment={payment}
              propertyName={property?.name ?? 'Logement'}
            />
          ))}
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
  bellButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
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
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
    padding: spacing.md,
    ...shadows.card,
  },
  mainCardTop: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
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
    justifyContent: 'space-between',
    gap: spacing.sm,
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
