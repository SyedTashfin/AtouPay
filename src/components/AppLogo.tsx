import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/src/theme/colors';
import { radius } from '@/src/theme/radius';
import { typography } from '@/src/theme/typography';

interface AppLogoProps {
  size?: number;
}

export function AppLogo({ size = 72 }: AppLogoProps) {
  return (
    <View
      style={[
        styles.mark,
        {
          width: size,
          height: size,
          borderRadius: radius.lg,
        },
      ]}>
      <Text style={[styles.letter, { fontSize: size * 0.44 }]}>A</Text>
      <View style={styles.dot} />
    </View>
  );
}

const styles = StyleSheet.create({
  mark: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    justifyContent: 'center',
    position: 'relative',
  },
  letter: {
    color: colors.surface,
    ...typography.heading,
  },
  dot: {
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    height: 8,
    position: 'absolute',
    right: 14,
    top: 14,
    width: 8,
  },
});

