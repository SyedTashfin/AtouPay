import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useI18n } from '@/src/i18n/I18nProvider';
import { colors } from '@/src/theme/colors';
import { radius } from '@/src/theme/radius';
import { spacing } from '@/src/theme/spacing';
import { typography } from '@/src/theme/typography';

export type AuthMode = 'signin' | 'signup';

interface AuthModeToggleProps {
  mode: AuthMode;
  onChange: (value: AuthMode) => void;
}

export function AuthModeToggle({ mode, onChange }: AuthModeToggleProps) {
  const { copy, isRtl } = useI18n();

  return (
    <View style={[styles.container, isRtl && styles.containerRtl]}>
      {[
        { label: 'Se connecter', value: 'signin' as const },
        { label: 'Créer un compte', value: 'signup' as const },
      ].map((option) => {
        const selected = option.value === mode;

        return (
          <Pressable
            accessibilityHint={`${copy('Affiche le formulaire')} ${copy(option.label).toLowerCase()}`}
            accessibilityLabel={copy(option.label)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            key={option.value}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.option,
              selected && styles.optionSelected,
              pressed && styles.pressed,
            ]}>
            <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
              {copy(option.label)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    padding: 4,
  },
  containerRtl: {
    flexDirection: 'row-reverse',
  },
  option: {
    alignItems: 'center',
    borderRadius: radius.md,
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: spacing.sm,
  },
  optionSelected: {
    backgroundColor: colors.surface,
  },
  optionText: {
    color: colors.textMuted,
    ...typography.bodyStrong,
  },
  optionTextSelected: {
    color: colors.text,
  },
  pressed: {
    opacity: 0.75,
  },
});
