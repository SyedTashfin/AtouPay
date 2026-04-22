import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AppLogo } from '@/src/components/AppLogo';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { useSession } from '@/src/context/SessionProvider';
import { colors } from '@/src/theme/colors';
import { radius } from '@/src/theme/radius';
import { shadows } from '@/src/theme/shadows';
import { spacing } from '@/src/theme/spacing';
import { typography } from '@/src/theme/typography';
import { Role } from '@/src/types';

export default function LoginScreen() {
  const [phone, setPhone] = useState('+222 36 45 78 12');
  const [password, setPassword] = useState('atoupay-demo');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { selectedDemoRole, setSelectedDemoRole, signIn } = useSession();

  const handleLogin = async () => {
    setIsSubmitting(true);

    try {
      await signIn(selectedDemoRole);
      router.replace(selectedDemoRole === 'tenant' ? '/(tenant)/home' : '/(owner)/home');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickSwitch = async (role: Role) => {
    setIsSubmitting(true);

    try {
      await signIn(role);
      router.replace(role === 'tenant' ? '/(tenant)/home' : '/(owner)/home');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <AppLogo size={80} />
          <View style={styles.heroCopy}>
            <Text style={styles.brand}>ATouPay</Text>
            <Text style={styles.title}>Connexion</Text>
            <Text style={styles.description}>
              Paiement locatif simple, suivi clair et expérience mobile premium.
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Téléphone</Text>
            <TextInput
              accessibilityLabel="Téléphone"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="phone-pad"
              onChangeText={setPhone}
              placeholder="+222 30 00 00 00"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              textContentType="telephoneNumber"
              value={phone}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Mot de passe</Text>
            <View style={styles.passwordWrap}>
              <TextInput
                accessibilityLabel="Mot de passe"
                autoCapitalize="none"
                autoCorrect={false}
                onChangeText={setPassword}
                placeholder="Votre mot de passe"
                placeholderTextColor={colors.textMuted}
                secureTextEntry={!showPassword}
                style={styles.passwordInput}
                textContentType="password"
                value={password}
              />
              <Pressable
                accessibilityHint="Affiche ou masque le mot de passe"
                accessibilityLabel={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                accessibilityRole="button"
                onPress={() => setShowPassword((current) => !current)}
                style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
                <Feather
                  color={colors.textMuted}
                  name={showPassword ? 'eye-off' : 'eye'}
                  size={18}
                />
              </Pressable>
            </View>
          </View>

          <View style={styles.roleCard}>
            <Text style={styles.roleLabel}>Mode démo</Text>
            <View style={styles.roleSwitch}>
              {(['tenant', 'owner'] as Role[]).map((role) => {
                const selected = selectedDemoRole === role;
                const label = role === 'tenant' ? 'Locataire' : 'Propriétaire';

                return (
                  <Pressable
                    accessibilityLabel={`Choisir le rôle ${label}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    key={role}
                    onPress={() => setSelectedDemoRole(role)}
                    style={({ pressed }) => [
                      styles.roleOption,
                      selected && styles.roleOptionSelected,
                      pressed && styles.pressed,
                    ]}>
                    <Text style={[styles.roleOptionText, selected && styles.roleOptionTextSelected]}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <PrimaryButton
            accessibilityHint="Ouvre le tableau de bord du rôle sélectionné"
            label="Se connecter"
            loading={isSubmitting}
            onPress={handleLogin}
          />
        </View>

        <View style={styles.quickActions}>
          <PrimaryButton
            disabled={isSubmitting}
            label="Continuer comme locataire"
            onPress={() => handleQuickSwitch('tenant')}
            variant="secondary"
          />
          <PrimaryButton
            disabled={isSubmitting}
            label="Continuer comme propriétaire"
            onPress={() => handleQuickSwitch('owner')}
            variant="secondary"
          />
        </View>
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
    gap: spacing.md,
    justifyContent: 'center',
    padding: spacing.sm,
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
    ...typography.label,
  },
  title: {
    color: colors.text,
    ...typography.display,
  },
  description: {
    color: colors.textMuted,
    maxWidth: 320,
    ...typography.body,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
    padding: spacing.sm,
    ...shadows.card,
  },
  fieldGroup: {
    gap: spacing.xs,
  },
  label: {
    color: colors.text,
    ...typography.label,
  },
  input: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    color: colors.text,
    minHeight: 56,
    paddingHorizontal: spacing.sm,
    ...typography.body,
  },
  passwordWrap: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    flexDirection: 'row',
    minHeight: 56,
    paddingLeft: spacing.sm,
  },
  passwordInput: {
    color: colors.text,
    flex: 1,
    ...typography.body,
  },
  iconButton: {
    alignItems: 'center',
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  roleCard: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    gap: spacing.xs,
    padding: spacing.sm,
  },
  roleLabel: {
    color: colors.textMuted,
    ...typography.caption,
  },
  roleSwitch: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  roleOption: {
    alignItems: 'center',
    borderRadius: radius.pill,
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  roleOptionSelected: {
    backgroundColor: colors.surface,
  },
  roleOptionText: {
    color: colors.textMuted,
    ...typography.label,
  },
  roleOptionTextSelected: {
    color: colors.primaryDark,
  },
  quickActions: {
    gap: spacing.sm,
  },
  pressed: {
    opacity: 0.85,
  },
});
