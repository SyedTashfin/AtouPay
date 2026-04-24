import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppLanguage, useI18n } from '@/src/i18n/I18nProvider';
import { colors } from '@/src/theme/colors';
import { radius } from '@/src/theme/radius';
import { shadows } from '@/src/theme/shadows';
import { spacing } from '@/src/theme/spacing';
import { typography } from '@/src/theme/typography';

const options: Array<{ label: string; value: AppLanguage }> = [
  { label: 'Français', value: 'fr' },
  { label: 'العربية', value: 'ar' },
  { label: 'English', value: 'en' },
];

export function LanguageSelector() {
  const { language, setLanguage, t } = useI18n();

  return (
    <View style={styles.card}>
      <Text style={styles.label}>{t('common.language')}</Text>
      <View style={styles.row}>
        {options.map((option) => {
          const selected = option.value === language;

          return (
            <Pressable
              accessibilityRole="button"
              key={option.value}
              onPress={() => {
                void setLanguage(option.value);
              }}
              style={({ pressed }) => [
                styles.chip,
                selected && styles.chipSelected,
                pressed && styles.pressed,
              ]}>
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
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
  label: {
    color: colors.text,
    ...typography.bodyStrong,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chip: {
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  chipSelected: {
    backgroundColor: colors.primaryDark,
    borderColor: colors.primaryDark,
  },
  chipText: {
    color: colors.textMuted,
    ...typography.caption,
  },
  chipTextSelected: {
    color: colors.surface,
  },
  pressed: {
    opacity: 0.8,
  },
});
