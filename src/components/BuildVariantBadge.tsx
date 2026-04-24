import { StyleSheet, Text, View } from 'react-native';

import { buildVariantBadgeLabel } from '@/src/config/env';
import { colors } from '@/src/theme/colors';
import { radius } from '@/src/theme/radius';
import { spacing } from '@/src/theme/spacing';
import { typography } from '@/src/theme/typography';

export function BuildVariantBadge() {
  if (!buildVariantBadgeLabel) {
    return null;
  }

  return (
    <View accessibilityLabel={`Variant ${buildVariantBadgeLabel}`} style={styles.badge}>
      <Text style={styles.label}>{buildVariantBadgeLabel}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primarySoft,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 4,
  },
  label: {
    color: colors.primaryDark,
    ...typography.caption,
  },
});
