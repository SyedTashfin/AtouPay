import { router } from 'expo-router';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/src/components/PrimaryButton';
import { colors } from '@/src/theme/colors';
import { spacing } from '@/src/theme/spacing';
import { typography } from '@/src/theme/typography';

export default function NotFoundScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Écran introuvable</Text>
        <Text style={styles.description}>
          Cette route n&apos;est pas disponible dans cette première version d&apos;ATouPay.
        </Text>
        <PrimaryButton label="Retour à la connexion" onPress={() => router.replace('/auth/login')} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  container: {
    flex: 1,
    gap: spacing.sm,
    justifyContent: 'center',
    padding: spacing.md,
  },
  title: {
    color: colors.text,
    textAlign: 'center',
    ...typography.heading,
  },
  description: {
    color: colors.textMuted,
    textAlign: 'center',
    ...typography.body,
  },
});

