import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/src/theme/colors';
import { radius } from '@/src/theme/radius';
import { shadows } from '@/src/theme/shadows';
import { spacing } from '@/src/theme/spacing';
import { typography } from '@/src/theme/typography';
import { formatDateLabel } from '@/src/utils/dates';

interface GeneratedInviteCardProps {
  code: string;
  expiresAt: string;
  inviteLink: string;
  onCopyCode?: () => void;
  onCopyLink?: () => void;
}

function InviteRow({
  actionLabel,
  label,
  onPress,
  value,
}: {
  actionLabel: string;
  label: string;
  onPress?: () => void;
  value: string;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text selectable style={styles.value}>
        {value}
      </Text>
      {onPress ? (
        <Pressable
          accessibilityHint={`Copie ${label.toLowerCase()} dans le presse-papiers`}
          accessibilityLabel={actionLabel}
          accessibilityRole="button"
          onPress={onPress}
          style={({ pressed }) => [styles.copyButton, pressed && styles.pressed]}>
          <Text style={styles.copyText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function GeneratedInviteCard({
  code,
  expiresAt,
  inviteLink,
  onCopyCode,
  onCopyLink,
}: GeneratedInviteCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.copy}>
        <Text style={styles.title}>Invitation prête</Text>
        <Text style={styles.description}>
          Cette invitation est à usage unique et expire le {formatDateLabel(expiresAt)}.
        </Text>
      </View>

      <InviteRow actionLabel="Copier le code" label="Code" onPress={onCopyCode} value={code} />
      <InviteRow actionLabel="Copier le lien" label="Lien" onPress={onCopyLink} value={inviteLink} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceGlass,
    borderColor: colors.border,
    borderRadius: radius.xl,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.sm,
    ...shadows.soft,
  },
  copy: {
    gap: 4,
  },
  title: {
    color: colors.text,
    ...typography.bodyStrong,
  },
  description: {
    color: colors.textMuted,
    ...typography.caption,
  },
  row: {
    gap: spacing.xs,
  },
  label: {
    color: colors.textMuted,
    ...typography.caption,
  },
  value: {
    color: colors.text,
    ...typography.bodyStrong,
  },
  copyButton: {
    alignSelf: 'flex-start',
  },
  copyText: {
    color: colors.primaryDark,
    ...typography.bodyStrong,
  },
  pressed: {
    opacity: 0.75,
  },
});
