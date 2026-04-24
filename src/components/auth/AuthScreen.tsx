import { PropsWithChildren, ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppLogo } from '@/src/components/AppLogo';
import { colors } from '@/src/theme/colors';
import { spacing } from '@/src/theme/spacing';
import { typography } from '@/src/theme/typography';

interface AuthScreenProps extends PropsWithChildren {
  footer?: ReactNode;
  subtitle: string;
  title: string;
}

export function AuthScreen({
  children,
  footer,
  subtitle,
  title,
}: AuthScreenProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View pointerEvents="none" style={styles.backgroundLayer}>
        <View style={[styles.glow, styles.glowTop]} />
        <View style={[styles.glow, styles.glowBottom]} />
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <AppLogo size={80} />
          <View style={styles.heroCopy}>
            <Text style={styles.brand}>ATouPay</Text>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>
        </View>

        {children}
        {footer}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  backgroundLayer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  glow: {
    borderRadius: 180,
    height: 300,
    opacity: 0.72,
    position: 'absolute',
    width: 300,
  },
  glowTop: {
    backgroundColor: colors.accentSoft,
    right: -132,
    top: -118,
  },
  glowBottom: {
    backgroundColor: colors.backgroundTint,
    bottom: -126,
    left: -112,
  },
  content: {
    flexGrow: 1,
    gap: spacing.md,
    justifyContent: 'center',
    padding: spacing.sm,
    paddingVertical: spacing.lg,
  },
  hero: {
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  heroCopy: {
    gap: spacing.xs,
  },
  brand: {
    color: colors.primaryDark,
    textTransform: 'uppercase',
    ...typography.label,
  },
  title: {
    color: colors.text,
    ...typography.display,
  },
  subtitle: {
    color: colors.textMuted,
    maxWidth: 360,
    ...typography.body,
  },
});
