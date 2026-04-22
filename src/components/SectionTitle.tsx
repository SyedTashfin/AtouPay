import { Pressable, StyleSheet, Text, View } from 'react-native';

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
  return (
    <View style={styles.row}>
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {actionLabel && onActionPress ? (
        <Pressable
          accessibilityLabel={actionLabel}
          accessibilityRole="button"
          onPress={onActionPress}
          style={({ pressed }) => pressed && styles.pressed}>
          <Text style={styles.action}>{actionLabel}</Text>
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
});

