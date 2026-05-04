import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useI18n } from '@/src/i18n/I18nProvider';
import { colors } from '@/src/theme/colors';
import { spacing } from '@/src/theme/spacing';
import { typography } from '@/src/theme/typography';

interface SectionTitleProps {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onActionPress?: () => void;
}

export function SectionTitle({
  title,
  subtitle,
  actionLabel,
  onActionPress,
}: SectionTitleProps) {
  const { copy, isRtl } = useI18n();

  return (
    <View style={[styles.row, isRtl && styles.rowRtl]}>
      <View style={styles.copy}>
        <Text style={[styles.title, isRtl && styles.rtlText]}>{copy(title)}</Text>
        {subtitle ? <Text style={[styles.subtitle, isRtl && styles.rtlText]}>{copy(subtitle)}</Text> : null}
      </View>
      {actionLabel && onActionPress ? (
        <Pressable
          accessibilityLabel={copy(actionLabel)}
          accessibilityRole="button"
          onPress={onActionPress}
          style={({ pressed }) => pressed && styles.pressed}>
          <Text style={styles.action}>{copy(actionLabel)}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  rowRtl: {
    flexDirection: 'row-reverse',
  },
  copy: {
    flex: 1,
    gap: 4,
  },
  title: {
    color: colors.text,
    ...typography.subheading,
  },
  subtitle: {
    color: colors.textMuted,
    ...typography.caption,
  },
  action: {
    color: colors.primaryDark,
    ...typography.label,
  },
  pressed: {
    opacity: 0.7,
  },
  rtlText: {
    writingDirection: 'rtl',
  },
});
