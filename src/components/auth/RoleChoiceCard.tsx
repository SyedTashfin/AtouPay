import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useI18n } from '@/src/i18n/I18nProvider';
import { colors } from '@/src/theme/colors';
import { radius } from '@/src/theme/radius';
import { shadows } from '@/src/theme/shadows';
import { spacing } from '@/src/theme/spacing';
import { typography } from '@/src/theme/typography';

interface RoleChoiceCardProps {
  description: string;
  onPress: () => void;
  title: string;
}

export function RoleChoiceCard({
  description,
  onPress,
  title,
}: RoleChoiceCardProps) {
  const { copy, isRtl } = useI18n();
  const localizedTitle = copy(title);

  return (
    <Pressable
      accessibilityHint={`${copy('Ouvre l’espace')} ${localizedTitle.toLowerCase()}`}
      accessibilityLabel={localizedTitle}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, isRtl && styles.cardRtl, pressed && styles.pressed]}>
      <View style={styles.copy}>
        <Text style={[styles.title, isRtl && styles.rtlText]}>{localizedTitle}</Text>
        <Text style={[styles.description, isRtl && styles.rtlText]}>{copy(description)}</Text>
      </View>
      <Feather color={colors.primaryDark} name="chevron-right" size={18} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.xl,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
    padding: spacing.md,
    ...shadows.card,
  },
  cardRtl: {
    flexDirection: 'row-reverse',
  },
  copy: {
    flex: 1,
    gap: spacing.xs,
  },
  title: {
    color: colors.text,
    ...typography.bodyStrong,
  },
  description: {
    color: colors.textSecondary,
    ...typography.caption,
  },
  pressed: {
    opacity: 0.86,
  },
  rtlText: {
    writingDirection: 'rtl',
  },
});
