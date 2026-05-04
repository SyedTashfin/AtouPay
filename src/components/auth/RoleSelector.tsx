import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useI18n } from '@/src/i18n/I18nProvider';
import { colors } from '@/src/theme/colors';
import { radius } from '@/src/theme/radius';
import { spacing } from '@/src/theme/spacing';
import { typography } from '@/src/theme/typography';
import { Role } from '@/src/types';

const defaultRoles: Role[] = ['tenant', 'owner'];

interface RoleSelectorProps {
  disabled?: boolean;
  onChange: (role: Role) => void;
  roles?: Role[];
  selectedRole: Role | null;
}

export function RoleSelector({
  disabled = false,
  onChange,
  roles = defaultRoles,
  selectedRole,
}: RoleSelectorProps) {
  const { copy, isRtl } = useI18n();

  return (
    <View style={[styles.row, isRtl && styles.rowRtl]}>
      {roles.map((role) => {
        const selected = selectedRole === role;
        const label =
          role === 'tenant'
            ? 'Locataire'
            : role === 'owner'
              ? 'Propriétaire'
              : 'Agence';
        const localizedLabel = copy(label);

        return (
          <Pressable
            accessibilityHint={`${copy('Sélectionne le rôle')} ${localizedLabel.toLowerCase()} ${copy('pour cette session')}`}
            accessibilityLabel={`${copy('Choisir')} ${localizedLabel}`}
            accessibilityRole="button"
            accessibilityState={{ disabled, selected }}
            disabled={disabled}
            key={role}
            onPress={() => onChange(role)}
            style={({ pressed }) => [
              styles.option,
              disabled && styles.optionDisabled,
              selected && styles.optionSelected,
              pressed && !disabled && styles.pressed,
            ]}>
            <Text
              style={[
                styles.optionText,
                disabled && styles.optionTextDisabled,
              selected && styles.optionTextSelected,
              ]}>
              {localizedLabel}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 0,
    overflow: 'hidden',
  },
  rowRtl: {
    flexDirection: 'row-reverse',
  },
  option: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderColor: 'transparent',
    borderRadius: 0,
    borderWidth: 0,
    flex: 1,
    minHeight: 56,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  optionSelected: {
    backgroundColor: colors.accentMuted,
    borderColor: colors.accentMuted,
  },
  optionDisabled: {
    opacity: 0.65,
  },
  optionText: {
    color: colors.textMuted,
    ...typography.bodyStrong,
  },
  optionTextDisabled: {
    color: colors.textMuted,
  },
  optionTextSelected: {
    color: colors.primaryDark,
  },
  pressed: {
    opacity: 0.85,
  },
});
