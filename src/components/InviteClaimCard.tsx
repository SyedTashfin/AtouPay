import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/src/components/PrimaryButton';
import { AuthField } from '@/src/components/auth/AuthField';
import { useI18n } from '@/src/i18n/I18nProvider';
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
  const { copy, isRtl } = useI18n();

  return (
    <View style={styles.card}>
      <View style={styles.copy}>
        <Text style={[styles.title, isRtl && styles.rtlText]}>{copy('Ajouter mon logement')}</Text>
        <Text style={[styles.description, isRtl && styles.rtlText]}>
          {copy('Collez le code donné par votre propriétaire. Il rattache ce compte à votre appartement.')}
        </Text>
      </View>

      <AuthField
        autoCapitalize="characters"
        autoCorrect={false}
        error={errorMessage}
        helper={helperMessage}
        label="Code logement"
        onChangeText={onChangeCode}
        placeholder="ATPA-1234-5678-90AB"
        value={code}
      />

      <View style={styles.actionsRow}>
        {onPasteCode ? (
          <Pressable
            accessibilityHint={copy('Colle un code d’invitation depuis le presse-papiers')}
            accessibilityLabel={copy('Coller le code')}
            accessibilityRole="button"
            onPress={onPasteCode}
            style={({ pressed }) => [styles.clearButton, pressed && styles.pressed]}>
            <Text style={styles.clearText}>{copy('Coller le code')}</Text>
          </Pressable>
        ) : null}

        {onClearDetectedCode ? (
          <Pressable
            accessibilityHint={copy('Efface le code détecté pour saisir une autre invitation')}
            accessibilityLabel={copy('Effacer le code détecté')}
            accessibilityRole="button"
            onPress={onClearDetectedCode}
            style={({ pressed }) => [styles.clearButton, pressed && styles.pressed]}>
            <Text style={styles.clearText}>{copy('Effacer ce code')}</Text>
          </Pressable>
        ) : null}
      </View>

      <PrimaryButton
        accessibilityHint="Valide le code et rattache ce compte au logement ciblé"
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
  rtlText: {
    writingDirection: 'rtl',
  },
});
