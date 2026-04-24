import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/src/theme/colors';
import { radius } from '@/src/theme/radius';
import { typography } from '@/src/theme/typography';

interface AvatarBadgeProps {
  initials: string;
  imageUrl?: string | null;
  label?: string;
  size?: number;
}

export function AvatarBadge({
  initials,
  imageUrl,
  label,
  size = 72,
}: AvatarBadgeProps) {
  const [hasImageError, setHasImageError] = useState(false);
  const shouldShowImage = !!imageUrl && !hasImageError;

  return (
    <View
      accessibilityLabel={label ? `Avatar ${label}` : `Avatar ${initials}`}
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: radius.pill,
        },
      ]}>
      {shouldShowImage ? (
        <Image
          onError={() => setHasImageError(true)}
          source={{ uri: imageUrl }}
          style={[
            styles.image,
            {
              borderRadius: radius.pill,
            },
          ]}
        />
      ) : (
        <Text style={[styles.text, { fontSize: size * 0.32 }]}>{initials}</Text>
      )}
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
  image: {
    height: '100%',
    width: '100%',
  },
});
