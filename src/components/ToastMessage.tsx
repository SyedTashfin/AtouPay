import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ToastState } from '@/src/types';
import { colors } from '@/src/theme/colors';
import { radius } from '@/src/theme/radius';
import { shadows } from '@/src/theme/shadows';
import { spacing } from '@/src/theme/spacing';
import { typography } from '@/src/theme/typography';

interface ToastMessageProps {
  onHide: () => void;
  toast: ToastState | null;
}

const toneStyles = {
  error: {
    backgroundColor: colors.danger,
    textColor: colors.surface,
  },
  info: {
    backgroundColor: colors.text,
    textColor: colors.surface,
  },
  success: {
    backgroundColor: colors.primaryDark,
    textColor: colors.surface,
  },
};

export function ToastMessage({ onHide, toast }: ToastMessageProps) {
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeoutId = setTimeout(onHide, 2600);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [onHide, toast]);

  if (!toast) {
    return null;
  }

  const toneStyle = toneStyles[toast.tone];

  return (
    <View
      accessibilityLiveRegion="polite"
      pointerEvents="none"
      style={[
        styles.wrapper,
        {
          bottom: Math.max(insets.bottom, spacing.sm),
        },
      ]}>
      <View style={[styles.toast, { backgroundColor: toneStyle.backgroundColor }]}>
        <Text style={[styles.title, { color: toneStyle.textColor }]}>{toast.title}</Text>
        <Text style={[styles.message, { color: toneStyle.textColor }]}>{toast.message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    left: spacing.sm,
    position: 'absolute',
    right: spacing.sm,
    zIndex: 40,
  },
  toast: {
    borderRadius: radius.md,
    gap: 2,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    ...shadows.card,
  },
  title: {
    ...typography.label,
  },
  message: {
    ...typography.caption,
  },
});
