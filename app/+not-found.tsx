import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/src/components/PrimaryButton';
import { useI18n } from '@/src/i18n/I18nProvider';
import { colors } from '@/src/theme/colors';
import { spacing } from '@/src/theme/spacing';
import { typography } from '@/src/theme/typography';

export default function NotFoundScreen() {
  const { copy } = useI18n();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>{copy('Écran introuvable')}</Text>
        <Text style={styles.description}>
          {copy("Cette route n'est pas disponible dans cette première version d'ATouPay.")}
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
