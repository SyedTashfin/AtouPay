import { Alert, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { AvatarBadge } from '@/src/components/AvatarBadge';
import { InfoRow } from '@/src/components/InfoRow';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { ScreenHeader } from '@/src/components/ScreenHeader';
import { SummaryCard } from '@/src/components/SummaryCard';
import { isDebugToolsEnabled } from '@/src/config/env';
import { useAppContext } from '@/src/context/AppProvider';
import { useSession } from '@/src/context/SessionProvider';
import { colors } from '@/src/theme/colors';
import { spacing } from '@/src/theme/spacing';
import { typography } from '@/src/theme/typography';
import { formatCurrency } from '@/src/utils/currency';

export default function OwnerProfileScreen() {
  const { ownerPayments, ownerUser, properties, tenantContacts } = useAppContext();
  const { signOut } = useSession();

  const totalCollected = ownerPayments
    .filter((payment) => payment.status === 'paid')
    .reduce((total, payment) => total + payment.amount, 0);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader subtitle="Votre compte propriétaire" title="Profil" />

        <View style={styles.profileCard}>
          <AvatarBadge initials={ownerUser.initials} size={80} />
          <View style={styles.profileCopy}>
            <Text style={styles.name}>{ownerUser.fullName}</Text>
            <Text style={styles.role}>Propriétaire</Text>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <SummaryCard compact title="Biens" value={String(properties.length)} />
          <SummaryCard compact title="Locataires" value={String(tenantContacts.length)} />
          <SummaryCard
            compact
            title="Total encaissé"
            value={formatCurrency(totalCollected)}
          />
        </View>

        <View style={styles.section}>
          <InfoRow label="Téléphone" value={ownerUser.phone} />
          <InfoRow label="Email" value={ownerUser.email} />
          <InfoRow
            label="Paramètres du compte"
            onPress={() =>
              Alert.alert(
                'Paramètres',
                'Les réglages avancés du compte seront ajoutés après la phase MVP.',
              )
            }
            value="Notifications, préférences, sécurité"
          />
          {isDebugToolsEnabled ? (
            <InfoRow
              label="QA & debug"
              onPress={() => router.push('/dev-tools')}
              value="Validation native et données locales"
            />
          ) : null}
        </View>

        <PrimaryButton
          label="Se déconnecter"
          onPress={async () => {
            await signOut();
            router.replace('/auth/login');
          }}
          variant="secondary"
        />
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
  profileCard: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  profileCopy: {
    alignItems: 'center',
    gap: 4,
  },
  name: {
    color: colors.text,
    ...typography.heading,
  },
  role: {
    color: colors.textMuted,
    ...typography.body,
  },
  statsGrid: {
    gap: spacing.sm,
  },
  section: {
    gap: spacing.sm,
  },
});
