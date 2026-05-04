import { Feather } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/src/theme/colors';
import { radius } from '@/src/theme/radius';
import { shadows } from '@/src/theme/shadows';
import { spacing } from '@/src/theme/spacing';
import { typography } from '@/src/theme/typography';
import { useI18n } from '@/src/i18n/I18nProvider';

interface ListEmptyStateProps {
  title: string;
  description: string;
}

export function ListEmptyState({ title, description }: ListEmptyStateProps) {
  const { copy, isRtl } = useI18n();

  return (
    <View style={[styles.card, isRtl && styles.cardRtl]}>
      <View style={styles.iconWrap}>
        <Feather color={colors.primaryDark} name="inbox" size={18} />
      </View>
      <View style={styles.copy}>
        <Text style={[styles.title, isRtl && styles.rtlText]}>{copy(title)}</Text>
        <Text style={[styles.description, isRtl && styles.rtlText]}>{copy(description)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'flex-start',
    backgroundColor: colors.surfaceGlass,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
    padding: spacing.md,
    ...shadows.soft,
  },
  cardRtl: {
    alignItems: 'flex-end',
  },
  iconWrap: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  copy: {
    gap: spacing.xs,
  },
  title: {
    color: colors.text,
    ...typography.subheading,
  },
  description: {
    color: colors.textMuted,
    ...typography.body,
  },
  rtlText: {
    writingDirection: 'rtl',
  },
});
