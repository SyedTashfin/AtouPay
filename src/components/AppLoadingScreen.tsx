import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { AppLogo } from '@/src/components/AppLogo';
import { colors } from '@/src/theme/colors';
import { spacing } from '@/src/theme/spacing';
import { typography } from '@/src/theme/typography';

export function AppLoadingScreen() {
  return (
    <View style={styles.container}>
      <AppLogo size={72} />
      <Text style={styles.title}>ATouPay</Text>
      <ActivityIndicator color={colors.primary} size="small" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    gap: spacing.sm,
    justifyContent: 'center',
    padding: spacing.sm,
  },
  title: {
    color: colors.text,
    ...typography.subheading,
  },
});

