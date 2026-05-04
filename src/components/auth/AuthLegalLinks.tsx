import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useI18n } from '@/src/i18n/I18nProvider';
import { colors } from '@/src/theme/colors';
import { spacing } from '@/src/theme/spacing';
import { typography } from '@/src/theme/typography';

export function AuthLegalLinks() {
  const { copy, isRtl } = useI18n();

  return (
    <View style={[styles.row, isRtl && styles.rowRtl]}>
      <Pressable
        accessibilityHint={copy('Ouvre les conditions d’utilisation')}
        accessibilityRole="button"
        onPress={() => router.push('/terms')}
        style={({ pressed }) => pressed && styles.pressed}>
        <Text style={styles.link}>{copy('Conditions')}</Text>
      </Pressable>
      <Pressable
        accessibilityHint={copy('Ouvre l’aide et les informations de support')}
        accessibilityRole="button"
        onPress={() => router.push('/help')}
        style={({ pressed }) => pressed && styles.pressed}>
        <Text style={styles.link}>{copy('Aide')}</Text>
      </Pressable>
      <Pressable
        accessibilityHint={copy('Ouvre le support ATouPay')}
        accessibilityRole="button"
        onPress={() => router.push('/support?mode=recovery')}
        style={({ pressed }) => pressed && styles.pressed}>
        <Text style={styles.link}>{copy('Support')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  rowRtl: {
    flexDirection: 'row-reverse',
  },
  link: {
    color: colors.textMuted,
    ...typography.caption,
  },
  pressed: {
    opacity: 0.75,
  },
});
