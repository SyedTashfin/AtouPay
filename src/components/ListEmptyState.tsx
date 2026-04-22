import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/src/theme/colors';
import { radius } from '@/src/theme/radius';
import { spacing } from '@/src/theme/spacing';
import { typography } from '@/src/theme/typography';

interface ListEmptyStateProps {
  title: string;
  description: string;
}

export function ListEmptyState({ title, description }: ListEmptyStateProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  title: {
    color: colors.text,
    marginBottom: spacing.xs,
    ...typography.subheading,
  },
  description: {
    color: colors.textMuted,
    ...typography.body,
  },
});

