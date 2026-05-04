import { PropsWithChildren } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/src/theme/colors';
import { radius } from '@/src/theme/radius';
import { shadows } from '@/src/theme/shadows';
import { spacing } from '@/src/theme/spacing';
import { typography } from '@/src/theme/typography';
import { useI18n } from '@/src/i18n/I18nProvider';

interface AuthCardProps extends PropsWithChildren {
  description?: string;
  title?: string;
}

export function AuthCard({ children, description, title }: AuthCardProps) {
  const { copy, isRtl } = useI18n();

  return (
    <View style={styles.card}>
      {title ? (
        <View style={styles.header}>
          <Text style={[styles.title, isRtl && styles.rtlText]}>{copy(title)}</Text>
          {description ? (
            <Text style={[styles.description, isRtl && styles.rtlText]}>{copy(description)}</Text>
          ) : null}
        </View>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.sm,
    overflow: 'hidden',
    padding: spacing.md,
    ...shadows.card,
  },
  header: {
    gap: spacing.xs,
  },
  title: {
    color: colors.text,
    ...typography.label,
  },
  description: {
    color: colors.textMuted,
    ...typography.caption,
  },
  rtlText: {
    writingDirection: 'rtl',
  },
});
