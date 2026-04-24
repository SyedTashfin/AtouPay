import { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/src/theme/colors';
import { radius } from '@/src/theme/radius';
import { shadows } from '@/src/theme/shadows';
import { spacing } from '@/src/theme/spacing';
import { typography } from '@/src/theme/typography';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  variant?: ButtonVariant;
  icon?: ReactNode;
  loading?: boolean;
}

export function PrimaryButton({
  label,
  onPress,
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
  variant = 'primary',
  icon,
  loading = false,
}: PrimaryButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      accessibilityState={{
        busy: loading,
        disabled: isDisabled,
      }}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        isDisabled ? disabledVariantStyles[variant] : variantStyles[variant],
        pressed && !isDisabled && styles.pressed,
      ]}>
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator color={indicatorColors[variant]} size="small" />
        ) : (
          icon
        )}
        <Text style={[styles.label, isDisabled ? disabledLabelStyles[variant] : labelStyles[variant]]}>
          {loading ? 'Traitement...' : label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 54,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  content: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'center',
  },
  label: {
    ...typography.bodyStrong,
  },
  pressed: {
    opacity: 0.86,
    transform: [{ scale: 0.99 }],
  },
});

const variantStyles = StyleSheet.create({
  primary: {
    backgroundColor: colors.primaryDark,
    borderColor: colors.primaryDark,
    ...shadows.button,
  },
  secondary: {
    backgroundColor: colors.surfaceGlass,
    borderColor: colors.border,
  },
  ghost: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
  },
});

const labelStyles = StyleSheet.create({
  primary: {
    color: colors.surface,
  },
  secondary: {
    color: colors.text,
  },
  ghost: {
    color: colors.primaryDark,
  },
});

const disabledVariantStyles = StyleSheet.create({
  primary: {
    backgroundColor: colors.borderStrong,
    borderColor: colors.borderStrong,
  },
  secondary: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
  },
  ghost: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.surfaceMuted,
  },
});

const disabledLabelStyles = StyleSheet.create({
  primary: {
    color: colors.textMuted,
  },
  secondary: {
    color: colors.textMuted,
  },
  ghost: {
    color: colors.textMuted,
  },
});

const indicatorColors = {
  ghost: colors.primaryDark,
  primary: colors.surface,
  secondary: colors.text,
} as const;
