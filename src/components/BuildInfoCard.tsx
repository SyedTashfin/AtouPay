import { Feather } from '@expo/vector-icons';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { usePathname } from 'expo-router';
import * as Updates from 'expo-updates';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { appConfig, isDebugToolsEnabled } from '@/src/config/env';
import { useSession } from '@/src/context/SessionProvider';
import { colors } from '@/src/theme/colors';
import { radius } from '@/src/theme/radius';
import { spacing } from '@/src/theme/spacing';
import { typography } from '@/src/theme/typography';
import { BuildVariantBadge } from '@/src/components/BuildVariantBadge';
import { getAuthProviderLabel } from '@/src/utils/auth';

interface BuildInfoCardProps {
  onOpenPreviewTools?: () => void;
}

function BuildInfoRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

export function BuildInfoCard({ onOpenPreviewTools }: BuildInfoCardProps) {
  const pathname = usePathname();
  const { session } = useSession();

  if (!isDebugToolsEnabled) {
    return null;
  }

  const appName =
    Application.applicationName ??
    Constants.expoConfig?.name ??
    Constants.manifest2?.extra?.expoClient?.name ??
    'ATouPay';
  const appVersion =
    Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? 'n/a';
  const nativeBuildVersion = Application.nativeBuildVersion ?? 'n/a';
  const configuredRuntime =
    typeof Constants.expoConfig?.runtimeVersion === 'string'
      ? Constants.expoConfig.runtimeVersion
      : null;
  const runtimeVersion = configuredRuntime ?? Updates.runtimeVersion ?? 'n/a';
  const updateChannel = Updates.channel ?? 'dev-client';
  const currentRoute = `${session?.role ?? 'public'} • ${pathname}`;
  const authLabel = session
    ? getAuthProviderLabel(session.authProvider, session.authProviders)
    : 'public';

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Build info</Text>
          <Text style={styles.subtitle}>Métadonnées utiles pour l’identification et la revue</Text>
        </View>
        <BuildVariantBadge />
      </View>

      <View style={styles.infoList}>
        <BuildInfoRow label="App" value={appName} />
        <BuildInfoRow label="Variant" value={appConfig.appVariant} />
        <BuildInfoRow label="Version" value={appVersion} />
        <BuildInfoRow label="Build natif" value={nativeBuildVersion} />
        <BuildInfoRow label="Runtime" value={runtimeVersion} />
        <BuildInfoRow label="Canal updates" value={updateChannel} />
        <BuildInfoRow label="Plateforme" value={Platform.OS} />
        <BuildInfoRow label="Connexion" value={authLabel} />
        <BuildInfoRow label="Route active" value={currentRoute} />
      </View>

      {onOpenPreviewTools ? (
        <Pressable
          accessibilityHint="Ouvre les actions de revue, reset et bascule de rôle"
          accessibilityLabel="Outils de validation"
          accessibilityRole="button"
          onPress={onOpenPreviewTools}
          style={({ pressed }) => [styles.toolsButton, pressed && styles.pressed]}>
          <View style={styles.toolsCopy}>
            <Text style={styles.toolsTitle}>Outils de validation</Text>
            <Text style={styles.toolsDescription}>Reset, rôle de démo et session locale</Text>
          </View>
          <Feather color={colors.textMuted} name="chevron-right" size={18} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  headerCopy: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  title: {
    color: colors.text,
    ...typography.subheading,
  },
  subtitle: {
    color: colors.textMuted,
    ...typography.caption,
  },
  infoList: {
    gap: spacing.xs,
  },
  infoRow: {
    gap: 4,
  },
  infoLabel: {
    color: colors.textMuted,
    ...typography.caption,
  },
  infoValue: {
    color: colors.text,
    flexShrink: 1,
    ...typography.bodyStrong,
  },
  toolsButton: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radius.md,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
    marginTop: spacing.xs,
    paddingTop: spacing.sm,
  },
  toolsCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  toolsTitle: {
    color: colors.text,
    ...typography.bodyStrong,
  },
  toolsDescription: {
    color: colors.textMuted,
    ...typography.caption,
  },
  pressed: {
    opacity: 0.8,
  },
});
