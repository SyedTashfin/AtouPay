import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/src/components/PrimaryButton';
import { AuthField } from '@/src/components/auth/AuthField';
import { colors } from '@/src/theme/colors';
import { radius } from '@/src/theme/radius';
import { shadows } from '@/src/theme/shadows';
import { spacing } from '@/src/theme/spacing';
import { typography } from '@/src/theme/typography';

interface InviteClaimCardProps {
  code: string;
  errorMessage?: string | null;
  helperMessage?: string;
  loading?: boolean;
  onChangeCode: (value: string) => void;
  onClearDetectedCode?: () => void;
  onPasteCode?: () => void;
  onSubmit: () => void;
}

export function InviteClaimCard({
  code,
  errorMessage,
  helperMessage,
  loading = false,
  onChangeCode,
  onClearDetectedCode,
  onPasteCode,
  onSubmit,
}: InviteClaimCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.copy}>
        <Text style={styles.title}>Rejoindre mon unité</Text>
        <Text style={styles.description}>
          Saisissez le code transmis par le propriétaire pour rattacher ce compte à une seule unité.
        </Text>
      </View>

      <AuthField
        autoCapitalize="characters"
        autoCorrect={false}
        error={errorMessage}
        helper={helperMessage}
        label="Code d’invitation"
        onChangeText={onChangeCode}
        placeholder="ATPA-1234-5678-90AB"
        value={code}
      />

      <View style={styles.actionsRow}>
        {onPasteCode ? (
          <Pressable
            accessibilityHint="Colle un code d’invitation depuis le presse-papiers"
            accessibilityLabel="Coller le code"
            accessibilityRole="button"
            onPress={onPasteCode}
            style={({ pressed }) => [styles.clearButton, pressed && styles.pressed]}>
            <Text style={styles.clearText}>Coller le code</Text>
          </Pressable>
        ) : null}

        {onClearDetectedCode ? (
          <Pressable
            accessibilityHint="Efface le code détecté pour saisir une autre invitation"
            accessibilityLabel="Effacer le code détecté"
            accessibilityRole="button"
            onPress={onClearDetectedCode}
            style={({ pressed }) => [styles.clearButton, pressed && styles.pressed]}>
            <Text style={styles.clearText}>Effacer ce code</Text>
          </Pressable>
        ) : null}
      </View>

      <PrimaryButton
        accessibilityHint="Valide l’invitation et rattache ce compte à l’unité ciblée"
        disabled={code.trim().length < 8}
        label="Rattacher mon logement"
        loading={loading}
        onPress={onSubmit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceGlass,
    borderColor: colors.border,
    borderRadius: radius.xl,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
    ...shadows.glass,
  },
  copy: {
    gap: spacing.xs,
  },
  title: {
    color: colors.text,
    ...typography.subheading,
  },
  description: {
    color: colors.textMuted,
    ...typography.body,
  },
  clearButton: {
    alignSelf: 'flex-start',
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  clearText: {
    color: colors.primaryDark,
    ...typography.bodyStrong,
  },
  pressed: {
    opacity: 0.75,
  },
});
