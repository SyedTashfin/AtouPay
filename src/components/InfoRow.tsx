import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/src/theme/colors';
import { radius } from '@/src/theme/radius';
import { spacing } from '@/src/theme/spacing';
import { typography } from '@/src/theme/typography';

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
  const content = (
    <View style={styles.row}>
      <View style={styles.copy}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{value}</Text>
      </View>
      <Feather color={colors.textMuted} name={iconName} size={18} />
    </View>
  );

  if (!onPress) {
    return <View style={styles.card}>{content}</View>;
  }

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  copy: {
    flex: 1,
    gap: 4,
  },
  label: {
    color: colors.textMuted,
    ...typography.caption,
  },
  value: {
    color: colors.text,
    ...typography.bodyStrong,
  },
  pressed: {
    opacity: 0.85,
  },
});

