import { PrimaryButton } from '@/src/components/PrimaryButton';
import { useI18n } from '@/src/i18n/I18nProvider';
import { colors } from '@/src/theme/colors';
import { radius } from '@/src/theme/radius';
import { typography } from '@/src/theme/typography';
import { StyleSheet, Text, View } from 'react-native';

interface GoogleSignInButtonProps {
  disabled?: boolean;
  loading?: boolean;
  onPress: () => void;
}

function GoogleMark() {
  return (
    <View style={styles.mark}>
      <Text style={styles.markText}>G</Text>
    </View>
  );
}

export function GoogleSignInButton({
  disabled = false,
  loading = false,
  onPress,
}: GoogleSignInButtonProps) {
  const { copy } = useI18n();

  return (
    <PrimaryButton
      accessibilityHint={copy('Démarre la connexion Google')}
      disabled={disabled}
      icon={<GoogleMark />}
      label={copy('Continuer avec Google')}
      loading={loading}
      onPress={onPress}
      variant="secondary"
    />
  );
}

const styles = StyleSheet.create({
  mark: {
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  markText: {
    color: colors.text,
    ...typography.bodyStrong,
  },
});
