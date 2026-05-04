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
import { useI18n } from '@/src/i18n/I18nProvider';

interface AuthFieldProps {
  autoCapitalize?: TextInputProps['autoCapitalize'];
  autoComplete?: TextInputProps['autoComplete'];
  autoCorrect?: boolean;
  helper?: string;
  keyboardType?: KeyboardTypeOptions;
  label: string;
  maxLength?: TextInputProps['maxLength'];
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
  maxLength,
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
  const { copy, isRtl } = useI18n();
  const localizedLabel = copy(label);
  const localizedPlaceholder = placeholder ? copy(placeholder) : undefined;
  const localizedHelper = helper ? copy(helper) : undefined;
  const localizedError = error ? copy(error) : undefined;

  return (
    <View style={styles.container}>
      <Text style={[styles.label, isRtl && styles.rtlText]}>{localizedLabel}</Text>
      <View
        style={[
          styles.inputWrap,
          multiline && styles.inputWrapMultiline,
          !editable && styles.inputWrapDisabled,
        ]}>
        <TextInput
          accessibilityLabel={localizedLabel}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          autoCorrect={autoCorrect}
          editable={editable}
          keyboardType={keyboardType}
          maxLength={maxLength}
          multiline={multiline}
          onChangeText={onChangeText}
          onSubmitEditing={onSubmitEditing}
          placeholder={localizedPlaceholder}
          placeholderTextColor={colors.textMuted}
          returnKeyType={returnKeyType}
          secureTextEntry={secureTextEntry}
          style={[styles.input, multiline && styles.inputMultiline, isRtl && styles.rtlInput]}
          textContentType={textContentType}
          value={value}
        />
        {rightAccessory ? <View style={styles.accessory}>{rightAccessory}</View> : null}
      </View>
      {localizedError ? (
        <Text style={[styles.error, isRtl && styles.rtlText]}>{localizedError}</Text>
      ) : localizedHelper ? (
        <Text style={[styles.helper, isRtl && styles.rtlText]}>{localizedHelper}</Text>
      ) : null}
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
  const { copy } = useI18n();

  return (
    <Pressable
      accessibilityHint={accessibilityHint ? copy(accessibilityHint) : undefined}
      accessibilityLabel={copy(accessibilityLabel)}
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
    backgroundColor: colors.primarySoft,
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
  rtlInput: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  rtlText: {
    writingDirection: 'rtl',
  },
});
