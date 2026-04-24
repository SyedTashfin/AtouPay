import { ReactNode } from 'react';
import {
  KeyboardTypeOptions,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';

import { colors } from '@/src/theme/colors';
import { radius } from '@/src/theme/radius';
import { spacing } from '@/src/theme/spacing';
import { typography } from '@/src/theme/typography';

interface AuthFieldProps {
  autoCapitalize?: TextInputProps['autoCapitalize'];
  autoComplete?: TextInputProps['autoComplete'];
  autoCorrect?: boolean;
  helper?: string;
  keyboardType?: KeyboardTypeOptions;
  label: string;
  multiline?: boolean;
  onChangeText: (value: string) => void;
  onSubmitEditing?: () => void;
  placeholder?: string;
  returnKeyType?: TextInputProps['returnKeyType'];
  rightAccessory?: ReactNode;
  secureTextEntry?: boolean;
  textContentType?: TextInputProps['textContentType'];
  value: string;
  editable?: boolean;
  error?: string | null;
}

export function AuthField({
  autoCapitalize = 'none',
  autoComplete,
  autoCorrect = false,
  editable = true,
  error,
  helper,
  keyboardType = 'default',
  label,
  multiline = false,
  onChangeText,
  onSubmitEditing,
  placeholder,
  returnKeyType = 'done',
  rightAccessory,
  secureTextEntry = false,
  textContentType,
  value,
}: AuthFieldProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View
        style={[
          styles.inputWrap,
          multiline && styles.inputWrapMultiline,
          !editable && styles.inputWrapDisabled,
        ]}>
        <TextInput
          accessibilityLabel={label}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          autoCorrect={autoCorrect}
          editable={editable}
          keyboardType={keyboardType}
          multiline={multiline}
          onChangeText={onChangeText}
          onSubmitEditing={onSubmitEditing}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          returnKeyType={returnKeyType}
          secureTextEntry={secureTextEntry}
          style={[styles.input, multiline && styles.inputMultiline]}
          textContentType={textContentType}
          value={value}
        />
        {rightAccessory ? <View style={styles.accessory}>{rightAccessory}</View> : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : helper ? <Text style={styles.helper}>{helper}</Text> : null}
    </View>
  );
}

interface AuthFieldAccessoryButtonProps {
  accessibilityHint?: string;
  accessibilityLabel: string;
  children: ReactNode;
  onPress: () => void;
}

export function AuthFieldAccessoryButton({
  accessibilityHint,
  accessibilityLabel,
  children,
  onPress,
}: AuthFieldAccessoryButtonProps) {
  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.accessoryButton, pressed && styles.pressed]}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  label: {
    color: colors.text,
    ...typography.label,
  },
  inputWrap: {
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: 56,
    paddingHorizontal: spacing.sm,
  },
  inputWrapDisabled: {
    backgroundColor: colors.surfaceMuted,
  },
  inputWrapMultiline: {
    alignItems: 'flex-start',
    paddingVertical: spacing.sm,
  },
  input: {
    color: colors.text,
    flex: 1,
    minHeight: 48,
    ...typography.body,
  },
  inputMultiline: {
    minHeight: 112,
    textAlignVertical: 'top',
  },
  accessory: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  accessoryButton: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    justifyContent: 'center',
    minHeight: 36,
    minWidth: 36,
  },
  helper: {
    color: colors.textMuted,
    ...typography.caption,
  },
  error: {
    color: colors.danger,
    ...typography.caption,
  },
  pressed: {
    opacity: 0.75,
  },
});
