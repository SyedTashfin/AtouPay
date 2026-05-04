import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useI18n } from '@/src/i18n/I18nProvider';
import { colors } from '@/src/theme/colors';
import { spacing } from '@/src/theme/spacing';
import { typography } from '@/src/theme/typography';

interface AuthHeaderProps {
  onBackPress: () => void;
}

export function AuthHeader({ onBackPress }: AuthHeaderProps) {
  const { copy, isRtl } = useI18n();

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityHint={copy('Revient à l’étape précédente')}
        accessibilityLabel={copy('Retour')}
        accessibilityRole="button"
        hitSlop={8}
        onPress={onBackPress}
        style={({ pressed }) => [styles.button, isRtl && styles.buttonRtl, pressed && styles.pressed]}>
        <Feather color={colors.primaryDark} name="chevron-left" size={18} />
        <Text style={styles.label}>{copy('Retour')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'flex-start',
  },
  button: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  buttonRtl: {
    flexDirection: 'row-reverse',
  },
  label: {
    color: colors.primaryDark,
    ...typography.bodyStrong,
  },
  pressed: {
    opacity: 0.75,
  },
});
