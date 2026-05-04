import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/src/theme/colors';
import { radius } from '@/src/theme/radius';
import { shadows } from '@/src/theme/shadows';
import { spacing } from '@/src/theme/spacing';
import { typography } from '@/src/theme/typography';
import { useI18n } from '@/src/i18n/I18nProvider';

interface InfoRowProps {
  label: string;
  value: string;
  onPress?: () => void;
  iconName?: keyof typeof Feather.glyphMap;
}

export function InfoRow({
  label,
  value,
  onPress,
  iconName = 'chevron-right',
}: InfoRowProps) {
  const { copy, isRtl } = useI18n();
  const localizedLabel = copy(label);
  const localizedValue = copy(value);

  const content = (
    <View style={[styles.row, isRtl && styles.rowRtl]}>
      <View style={styles.copy}>
        <Text style={[styles.label, isRtl && styles.rtlText]}>{localizedLabel}</Text>
        <Text style={[styles.value, isRtl && styles.rtlText]}>{localizedValue}</Text>
      </View>
      <Feather color={colors.textMuted} name={iconName} size={18} />
    </View>
  );

  if (!onPress) {
    return <View style={styles.card}>{content}</View>;
  }

  return (
    <Pressable
      accessibilityLabel={localizedLabel}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceGlass,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    ...shadows.soft,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rowRtl: {
    flexDirection: 'row-reverse',
  },
  copy: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  label: {
    color: colors.textMuted,
    ...typography.caption,
  },
  value: {
    color: colors.text,
    flexShrink: 1,
    ...typography.bodyStrong,
  },
  pressed: {
    opacity: 0.85,
  },
  rtlText: {
    writingDirection: 'rtl',
  },
});
