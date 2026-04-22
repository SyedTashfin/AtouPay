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

export default function TenantProfileScreen() {
  const { getPropertyById, tenantUser } = useAppContext();
  const { signOut } = useSession();
  const property = getPropertyById(tenantUser.propertyId);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader subtitle="Vos informations et accès utiles" title="Profil" />

        <View style={styles.profileCard}>
          <AvatarBadge initials={tenantUser.initials} size={80} />
          <View style={styles.profileCopy}>
            <Text style={styles.name}>{tenantUser.fullName}</Text>
            <Text style={styles.role}>Locataire</Text>
          </View>
        </View>

        {property ? (
          <SummaryCard
            accent="neutral"
            helper={property.address}
            subtitle={property.unitLabel}
            title="Logement principal"
            value={property.name}
          />
        ) : null}

        <View style={styles.section}>
          <InfoRow label="Téléphone" value={tenantUser.phone} />
          <InfoRow label="Email" value={tenantUser.email} />
          <InfoRow
            label="Aide & support"
            onPress={() => Alert.alert('Support', 'Le centre d’aide sera relié dans une prochaine version.')}
            value="FAQ, contact et assistance"
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
  section: {
    gap: spacing.sm,
  },
});
