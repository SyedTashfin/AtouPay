import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useI18n } from '@/src/i18n/I18nProvider';
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
  const { copy, isRtl } = useI18n();
  const localizedLabel = copy(label);
  const localizedActionLabel = copy(actionLabel);

  return (
    <View style={styles.row}>
      <Text style={[styles.label, isRtl && styles.rtlText]}>{localizedLabel}</Text>
      <Text selectable style={styles.value}>
        {value}
      </Text>
      {onPress ? (
        <Pressable
          accessibilityHint={`${copy('Copie')} ${localizedLabel.toLowerCase()} ${copy('dans le presse-papiers')}`}
          accessibilityLabel={localizedActionLabel}
          accessibilityRole="button"
          onPress={onPress}
          style={({ pressed }) => [styles.copyButton, pressed && styles.pressed]}>
          <Text style={styles.copyText}>{localizedActionLabel}</Text>
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
  const { copy, isRtl } = useI18n();

  return (
    <View style={styles.card}>
      <View style={styles.copy}>
        <Text style={[styles.title, isRtl && styles.rtlText]}>{copy('Code logement prêt')}</Text>
        <Text style={[styles.description, isRtl && styles.rtlText]}>
          {copy('Envoyez le code ou le lien au locataire. Une seule utilisation, expiration le')}{' '}
          {formatDateLabel(expiresAt)}.
        </Text>
      </View>

      <InviteRow actionLabel="Copier le code" label="Code à envoyer" onPress={onCopyCode} value={code} />
      <InviteRow actionLabel="Copier le lien" label="Lien ouvrant l’app" onPress={onCopyLink} value={inviteLink} />
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
  rtlText: {
    writingDirection: 'rtl',
  },
});
