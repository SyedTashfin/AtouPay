import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/src/theme/colors';
import { radius } from '@/src/theme/radius';
import { typography } from '@/src/theme/typography';

interface AvatarBadgeProps {
  initials: string;
  size?: number;
}

export function AvatarBadge({ initials, size = 72 }: AvatarBadgeProps) {
  return (
    <View
      accessibilityLabel={`Avatar ${initials}`}
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: radius.pill,
        },
      ]}>
      <Text style={[styles.text, { fontSize: size * 0.32 }]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
  },
  text: {
    color: colors.primaryDark,
    ...typography.subheading,
  },
});

