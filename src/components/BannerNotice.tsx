import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BannerTone } from '@/src/types';
import { colors } from '@/src/theme/colors';
import { radius } from '@/src/theme/radius';
import { spacing } from '@/src/theme/spacing';
import { typography } from '@/src/theme/typography';

interface BannerNoticeProps {
  description: string;
  onDismiss?: () => void;
  title: string;
  tone?: BannerTone;
}

const toneStyles: Record<
  BannerTone,
  {
    backgroundColor: string;
    borderColor: string;
    icon: keyof typeof Feather.glyphMap;
    iconColor: string;
    textColor: string;
  }
> = {
  error: {
    backgroundColor: colors.dangerSoft,
    borderColor: '#F1CACA',
    icon: 'alert-circle',
    iconColor: colors.danger,
    textColor: colors.danger,
  },
  info: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.border,
    icon: 'info',
    iconColor: colors.primaryDark,
    textColor: colors.primaryDark,
  },
  success: {
    backgroundColor: colors.successSoft,
    borderColor: colors.border,
    icon: 'check-circle',
    iconColor: colors.success,
    textColor: colors.success,
  },
};

export function BannerNotice({
  description,
  onDismiss,
  title,
  tone = 'info',
}: BannerNoticeProps) {
  const toneStyle = toneStyles[tone];

  return (
    <View
      accessibilityLabel={title}
      style={[
        styles.container,
        {
          backgroundColor: toneStyle.backgroundColor,
          borderColor: toneStyle.borderColor,
        },
      ]}>
      <Feather color={toneStyle.iconColor} name={toneStyle.icon} size={18} />
      <View style={styles.copy}>
        <Text style={[styles.title, { color: toneStyle.textColor }]}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
      {onDismiss ? (
        <Pressable
          accessibilityHint="Masque cette information dans les prochaines visites"
          accessibilityLabel={`Fermer ${title}`}
          accessibilityRole="button"
          hitSlop={8}
          onPress={onDismiss}
          style={({ pressed }) => [styles.dismissButton, pressed && styles.pressed]}>
          <Feather color={colors.textMuted} name="x" size={18} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'flex-start',
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.sm,
  },
  copy: {
    flex: 1,
    gap: 4,
  },
  title: {
    ...typography.label,
  },
  description: {
    color: colors.textMuted,
    ...typography.caption,
  },
  dismissButton: {
    alignItems: 'center',
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  pressed: {
    opacity: 0.7,
  },
});

