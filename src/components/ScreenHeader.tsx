import { Feather } from '@expo/vector-icons';
import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/src/theme/colors';
import { radius } from '@/src/theme/radius';
import { spacing } from '@/src/theme/spacing';
import { typography } from '@/src/theme/typography';
import { BuildVariantBadge } from '@/src/components/BuildVariantBadge';
import { useI18n } from '@/src/i18n/I18nProvider';

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
  const { copy, isRtl } = useI18n();
  const localizedTitle = copy(title);
  const localizedSubtitle = subtitle ? copy(subtitle) : undefined;

  return (
    <View style={styles.container}>
      <View style={[styles.row, isRtl && styles.rowRtl]}>
        <View style={[styles.leading, isRtl && styles.leadingRtl]}>
          {showBackButton ? (
            <Pressable
              accessibilityHint={copy("Revient à l'écran précédent")}
              accessibilityLabel={copy('Retour')}
              accessibilityRole="button"
              hitSlop={8}
              onPress={onBackPress}
              style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
              <Feather color={colors.text} name="chevron-left" size={20} />
            </Pressable>
          ) : null}
          <View style={styles.copy}>
            <Text style={[styles.title, isRtl && styles.rtlText]}>{localizedTitle}</Text>
            {localizedSubtitle ? (
              <Text style={[styles.subtitle, isRtl && styles.rtlText]}>{localizedSubtitle}</Text>
            ) : null}
            <BuildVariantBadge />
          </View>
        </View>
        {rightAccessory ? <View style={styles.right}>{rightAccessory}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.primaryDark,
    borderRadius: radius.lg,
    padding: spacing.sm,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  rowRtl: {
    flexDirection: 'row-reverse',
  },
  leading: {
    alignItems: 'center',
    flexDirection: 'row',
    flex: 1,
    gap: spacing.sm,
  },
  leadingRtl: {
    flexDirection: 'row-reverse',
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
    color: colors.surface,
    flexShrink: 1,
    ...typography.heading,
  },
  subtitle: {
    color: colors.primarySoft,
    flexShrink: 1,
    ...typography.body,
  },
  right: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  rtlText: {
    writingDirection: 'rtl',
  },
  pressed: {
    opacity: 0.85,
  },
});
