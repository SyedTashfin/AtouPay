import { Pressable, StyleSheet, Text } from 'react-native';

import { useI18n } from '@/src/i18n/I18nProvider';
import { colors } from '@/src/theme/colors';
import { radius } from '@/src/theme/radius';
import { spacing } from '@/src/theme/spacing';
import { typography } from '@/src/theme/typography';

interface FilterChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
}

export function FilterChip({ label, selected, onPress }: FilterChipProps) {
  const { copy } = useI18n();
  const localizedLabel = copy(label);

  return (
    <Pressable
      accessibilityLabel={`${copy('Filtre')} ${localizedLabel}`}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected ? styles.selected : styles.unselected,
        pressed && styles.pressed,
      ]}>
      <Text style={[styles.text, selected ? styles.selectedText : styles.unselectedText]}>
        {localizedLabel}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    minHeight: 46,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  selected: {
    backgroundColor: colors.primaryDark,
    borderColor: colors.primaryDark,
  },
  unselected: {
    backgroundColor: colors.surfaceGlass,
    borderColor: colors.border,
  },
  pressed: {
    opacity: 0.88,
  },
  text: {
    ...typography.label,
  },
  selectedText: {
    color: colors.surface,
  },
  unselectedText: {
    color: colors.textMuted,
  },
});
