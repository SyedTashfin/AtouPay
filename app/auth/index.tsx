import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppLogo } from '@/src/components/AppLogo';
import { RoleChoiceCard } from '@/src/components/auth/RoleChoiceCard';
import { useI18n } from '@/src/i18n/I18nProvider';
import { colors } from '@/src/theme/colors';
import { spacing } from '@/src/theme/spacing';
import { typography } from '@/src/theme/typography';

export default function AuthWelcomeScreen() {
  const { invite, ownerInvite } = useLocalSearchParams<{
    invite?: string;
    ownerInvite?: string;
  }>();
  const { copy, isRtl } = useI18n();

  if (typeof invite === 'string' && invite.trim().length > 0) {
    return (
      <Redirect
        href={{
          pathname: '/auth/invitation',
          params: { invite },
        }}
      />
    );
  }

  if (typeof ownerInvite === 'string' && ownerInvite.trim().length > 0) {
    return (
      <Redirect
        href={{
          pathname: '/auth/owner',
          params: { ownerInvite },
        }}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={[styles.brandBlock, isRtl && styles.brandBlockRtl]}>
          <AppLogo size={56} />
          <View style={styles.brandCopy}>
            <Text style={styles.brandName}>ATouPay</Text>
            <Text style={[styles.brandMeta, isRtl && styles.rtlText]}>
              {copy('Gestion loyers & quittances')}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/language' as never)}
            style={({ pressed }) => [
              styles.languageButton,
              isRtl && styles.languageButtonRtl,
              pressed && styles.pressed,
            ]}>
            <Text style={styles.languageButtonText}>{copy('Langue')}</Text>
          </Pressable>
        </View>

        <View style={styles.copyBlock}>
          <Text style={[styles.title, isRtl && styles.rtlText]}>
            {copy('Bienvenue sur ATouPay')}
          </Text>
          <Text style={[styles.subtitle, isRtl && styles.rtlText]}>
            {copy('Gérez vos loyers et quittances simplement.')}
          </Text>
        </View>

        <View style={styles.choiceBlock}>
          <Text style={[styles.sectionTitle, isRtl && styles.rtlText]}>
            {copy('Choisissez votre espace')}
          </Text>
          <View style={styles.choiceList}>
            <RoleChoiceCard
              description="Accéder à mes loyers, paiements et quittances."
              onPress={() => router.push('/auth/tenant')}
              title="Je suis locataire"
            />
            <RoleChoiceCard
              description="Gérer mes biens, loyers et locataires."
              onPress={() => router.push('/auth/owner')}
              title="Je suis propriétaire"
            />
          </View>
        </View>

        <Pressable
          accessibilityHint={copy('Ouvre l’aide et le support ATouPay')}
          accessibilityRole="button"
          onPress={() => router.push('/support?mode=recovery')}
          style={({ pressed }) => pressed && styles.pressed}>
          <Text style={styles.helpLink}>{copy('Besoin d’aide ?')}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  brandBlock: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  brandBlockRtl: {
    flexDirection: 'row-reverse',
  },
  brandCopy: {
    flex: 1,
    gap: 2,
  },
  brandMeta: {
    color: colors.textSecondary,
    ...typography.caption,
  },
  brandName: {
    color: colors.primaryDark,
    ...typography.label,
  },
  choiceBlock: {
    gap: spacing.sm,
  },
  choiceList: {
    gap: spacing.sm,
  },
  container: {
    flex: 1,
    gap: spacing.lg,
    justifyContent: 'center',
    padding: spacing.md,
  },
  copyBlock: {
    gap: spacing.xs,
  },
  helpLink: {
    color: colors.primaryDark,
    textAlign: 'center',
    ...typography.bodyStrong,
  },
  languageButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  languageButtonRtl: {
    marginLeft: 0,
  },
  languageButtonText: {
    color: colors.primaryDark,
    ...typography.caption,
  },
  pressed: {
    opacity: 0.75,
  },
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  sectionTitle: {
    color: colors.text,
    ...typography.bodyStrong,
  },
  subtitle: {
    color: colors.textSecondary,
    maxWidth: 340,
    ...typography.body,
  },
  title: {
    color: colors.text,
    ...typography.heading,
  },
  rtlText: {
    writingDirection: 'rtl',
  },
});
