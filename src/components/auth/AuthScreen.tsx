import { PropsWithChildren, ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppLogo } from '@/src/components/AppLogo';
import { useI18n } from '@/src/i18n/I18nProvider';
import { colors } from '@/src/theme/colors';
import { radius } from '@/src/theme/radius';
import { spacing } from '@/src/theme/spacing';
import { typography } from '@/src/theme/typography';

interface AuthScreenProps extends PropsWithChildren {
  footer?: ReactNode;
  subtitle: string;
  title: string;
  topSlot?: ReactNode;
}

export function AuthScreen({
  children,
  footer,
  subtitle,
  title,
  topSlot,
}: AuthScreenProps) {
  const { copy, isRtl } = useI18n();

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={[styles.brandHeader, isRtl && styles.brandHeaderRtl]}>
          <AppLogo size={48} />
          <View style={styles.brandCopy}>
            <Text style={styles.brand}>ATouPay</Text>
            <Text style={[styles.brandMeta, isRtl && styles.rtlText]}>
              {copy('Gestion loyers & quittances')}
            </Text>
          </View>
        </View>

        {topSlot}

        <View style={styles.hero}>
          <Text style={[styles.title, isRtl && styles.rtlText]}>{copy(title)}</Text>
          <Text style={[styles.subtitle, isRtl && styles.rtlText]}>{copy(subtitle)}</Text>
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
  content: {
    flexGrow: 1,
    gap: spacing.sm,
    justifyContent: 'flex-start',
    padding: spacing.md,
    paddingBottom: spacing.xxl,
    paddingTop: spacing.md,
  },
  brandHeader: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.xl,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.sm,
  },
  brandHeaderRtl: {
    flexDirection: 'row-reverse',
  },
  brandCopy: {
    flex: 1,
    gap: 2,
  },
  hero: {
    alignItems: 'flex-start',
    backgroundColor: colors.primaryDark,
    borderRadius: radius.xl,
    gap: spacing.xs,
    padding: spacing.sm,
  },
  brand: {
    color: colors.primaryDark,
    textTransform: 'uppercase',
    ...typography.label,
  },
  brandMeta: {
    color: colors.textSecondary,
    ...typography.caption,
  },
  title: {
    color: colors.surface,
    ...typography.heading,
  },
  subtitle: {
    color: colors.primarySoft,
    maxWidth: 360,
    ...typography.body,
  },
  rtlText: {
    writingDirection: 'rtl',
  },
});
