import { Feather } from '@expo/vector-icons';
import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/src/theme/colors';
import { radius } from '@/src/theme/radius';
import { spacing } from '@/src/theme/spacing';
import { typography } from '@/src/theme/typography';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  showBackButton?: boolean;
  onBackPress?: () => void;
  rightAccessory?: ReactNode;
}

export function ScreenHeader({
  title,
  subtitle,
  showBackButton = false,
  onBackPress,
  rightAccessory,
}: ScreenHeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View style={styles.leading}>
          {showBackButton ? (
            <Pressable
              accessibilityHint="Revient à l'écran précédent"
              accessibilityLabel="Retour"
              accessibilityRole="button"
              hitSlop={8}
              onPress={onBackPress}
              style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
              <Feather color={colors.text} name="chevron-left" size={20} />
            </Pressable>
          ) : null}
          <View style={styles.copy}>
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
        </View>
        {rightAccessory ? <View style={styles.right}>{rightAccessory}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: spacing.sm,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  leading: {
    alignItems: 'center',
    flexDirection: 'row',
    flex: 1,
    gap: spacing.sm,
  },
  backButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  copy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  title: {
    color: colors.text,
    flexShrink: 1,
    ...typography.heading,
  },
  subtitle: {
    color: colors.textMuted,
    flexShrink: 1,
    ...typography.body,
  },
  right: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.85,
  },
});
