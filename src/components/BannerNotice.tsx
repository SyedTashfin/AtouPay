import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BannerTone } from '@/src/types';
import { useI18n } from '@/src/i18n/I18nProvider';
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
    borderColor: colors.dangerSoft,
    icon: 'alert-circle',
    iconColor: colors.danger,
    textColor: colors.danger,
  },
  info: {
    backgroundColor: colors.infoSoft,
    borderColor: colors.infoSoft,
    icon: 'info',
    iconColor: colors.info,
    textColor: colors.info,
  },
  success: {
    backgroundColor: colors.successSoft,
    borderColor: colors.successSoft,
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
  const { copy, isRtl } = useI18n();
  const toneStyle = toneStyles[tone];
  const localizedTitle = copy(title);
  const localizedDescription = copy(description);

  return (
    <View
      accessibilityLabel={localizedTitle}
      style={[
        styles.container,
        isRtl && styles.containerRtl,
        {
          backgroundColor: toneStyle.backgroundColor,
          borderColor: toneStyle.borderColor,
        },
      ]}>
      <Feather color={toneStyle.iconColor} name={toneStyle.icon} size={18} />
      <View style={styles.copy}>
        <Text style={[styles.title, isRtl && styles.rtlText, { color: toneStyle.textColor }]}>
          {localizedTitle}
        </Text>
        <Text style={[styles.description, isRtl && styles.rtlText]}>
          {localizedDescription}
        </Text>
      </View>
      {onDismiss ? (
        <Pressable
          accessibilityHint={copy('Masque cette information dans les prochaines visites')}
          accessibilityLabel={`${copy('Fermer')} ${localizedTitle}`}
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
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.sm,
  },
  containerRtl: {
    flexDirection: 'row-reverse',
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
  rtlText: {
    writingDirection: 'rtl',
  },
});
