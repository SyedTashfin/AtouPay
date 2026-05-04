import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AvatarBadge } from '@/src/components/AvatarBadge';
import { BuildInfoCard } from '@/src/components/BuildInfoCard';
import { InfoRow } from '@/src/components/InfoRow';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { ScreenHeader } from '@/src/components/ScreenHeader';
import { SummaryCard } from '@/src/components/SummaryCard';
import { useAppContext } from '@/src/context/AppProvider';
import { useSession } from '@/src/context/SessionProvider';
import { colors } from '@/src/theme/colors';
import { spacing } from '@/src/theme/spacing';
import { typography } from '@/src/theme/typography';
import { getAuthProviderLabel } from '@/src/utils/auth';
import { getInitialsFromName } from '@/src/utils/session';

export default function TenantProfileScreen() {
  const { getPropertyById, tenantAssignmentRequired, tenantUser } = useAppContext();
  const { isFirebaseEnabled, session, signOut } = useSession();
  const property = tenantUser.propertyId ? getPropertyById(tenantUser.propertyId) : undefined;
  const propertyLabel = property ? [property.name, property.unitLabel].filter(Boolean).join(' • ') : undefined;
  const accountName = session?.profile?.displayName ?? tenantUser.fullName;
  const accountEmail = session?.profile?.email ?? tenantUser.email;
  const accountPhone = session?.profile?.phoneNumber ?? tenantUser.phone;
  const accountInitials = getInitialsFromName(accountName, tenantUser.initials);
  const providerLabel = getAuthProviderLabel(session?.authProvider, session?.authProviders);
  const canLinkPassword =
    isFirebaseEnabled &&
    session?.authProvider === 'google' &&
    !(session.authProviders?.includes('password') ?? false);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader subtitle="Vos informations et accès utiles" title="Profil" />

        <View style={styles.profileCard}>
          <AvatarBadge
            imageUrl={session?.profile?.photoUrl}
            initials={accountInitials}
            label={accountName}
            size={80}
          />
          <View style={styles.profileCopy}>
            <Text style={styles.name}>{accountName}</Text>
            <Text style={styles.role}>{`Locataire • ${providerLabel}`}</Text>
          </View>
        </View>

        {property ? (
          <SummaryCard
            accent="neutral"
            helper={property.address}
            subtitle={property.unitLabel}
            title="Logement principal"
            value={propertyLabel ?? property.name}
          />
        ) : tenantAssignmentRequired ? (
          <SummaryCard
            accent="warning"
            helper="Saisissez un code d’invitation sur l’accueil locataire pour rattacher ce compte."
            subtitle="Aucun logement lié"
            title="Invitation en attente"
            value="Compte locataire non attribué"
          />
        ) : null}

        <View style={styles.section}>
          <InfoRow label="Téléphone" value={accountPhone} />
          <InfoRow label="Compte connecté" value={accountEmail} />
          <InfoRow label="Connexion" value={providerLabel} />
          <InfoRow
            label="Langue"
            onPress={() => router.push('/language' as never)}
            value="Français, العربية, English"
          />
          {canLinkPassword ? (
            <InfoRow
              label="Ajouter un mot de passe"
              onPress={() => router.push('/link-password')}
              value="Lier un accès e-mail à ce compte Google"
            />
          ) : null}
          <InfoRow
            label="Coordonnées de récupération"
            onPress={() => router.push('/profile-contact')}
            value="Téléphone et préférence de rappel"
          />
          <InfoRow
            label="Conditions d’utilisation"
            onPress={() => router.push('/terms')}
            value="Responsabilités et limites de la plateforme"
          />
          <InfoRow
            label="Aide & support"
            onPress={() => router.push('/support')}
            value="Incident, litige, récupération assistée"
          />
          <InfoRow
            label="Responsabilité & aide"
            onPress={() => router.push('/help')}
            value="Conduites à tenir et canal agence"
          />
        </View>

        <BuildInfoCard onOpenPreviewTools={() => router.push('/dev-tools')} />

        <PrimaryButton
          accessibilityHint="Supprime la session locale puis revient à l'écran de connexion"
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
    backgroundColor: colors.role.tenant.background,
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
