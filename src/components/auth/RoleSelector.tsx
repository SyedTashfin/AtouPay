import { Pressable, StyleSheet, Text, View } from 'react-native';

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
  return (
    <View style={styles.row}>
      {roles.map((role) => {
        const selected = selectedRole === role;
        const label =
          role === 'tenant'
            ? 'Locataire'
            : role === 'owner'
              ? 'Propriétaire'
              : 'Agence';

        return (
          <Pressable
            accessibilityHint={`Sélectionne le rôle ${label.toLowerCase()} pour cette session`}
            accessibilityLabel={`Choisir ${label}`}
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
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  option: {
    alignItems: 'center',
    backgroundColor: colors.surfaceGlass,
    borderColor: colors.border,
    borderRadius: radius.xl,
    borderWidth: 1,
    flex: 1,
    minHeight: 64,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  optionSelected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
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
