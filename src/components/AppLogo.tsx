import { StyleSheet, View } from 'react-native';
import Svg, { G, Rect } from 'react-native-svg';

import { colors } from '@/src/theme/colors';
import { radius } from '@/src/theme/radius';
import { shadows } from '@/src/theme/shadows';

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
          borderRadius: Math.max(radius.md, size * 0.22),
        },
      ]}>
      <Svg height={size} viewBox="0 0 100 100" width={size}>
        <G fill={colors.surface}>
          <Rect height="5.5" width="6.6" x="46.7" y="12.9" />
          <Rect height="9.2" rx="2.7" width="10.9" x="44.5" y="16" />
          <Rect height="54.7" rx="3.5" width="19.9" x="40.2" y="22.1" />
          <Rect height="4.7" width="5.7" x="32" y="35.4" />
          <Rect height="37.9" rx="2.9" width="13.9" x="27.9" y="38.9" />
          <Rect height="4.7" width="5.7" x="62.7" y="28.5" />
          <Rect height="44.5" rx="2.9" width="13.9" x="58.6" y="32.2" />
          <Rect height="9.8" rx="4.3" width="52.3" x="24" y="72.5" />
        </G>
        <G fill={colors.primaryDark} opacity={0.82}>
          <Rect height="4.5" rx="0.9" width="3.9" x="44.5" y="31.6" />
          <Rect height="4.5" rx="0.9" width="3.9" x="52" y="31.6" />
          <Rect height="4.5" rx="0.9" width="3.9" x="44.5" y="40.4" />
          <Rect height="4.5" rx="0.9" width="3.9" x="52" y="40.4" />
          <Rect height="4.5" rx="0.9" width="3.9" x="44.5" y="49.2" />
          <Rect height="4.5" rx="0.9" width="3.9" x="52" y="49.2" />
          <Rect height="4.5" rx="0.9" width="3.9" x="44.5" y="58" />
          <Rect height="4.5" rx="0.9" width="3.9" x="52" y="58" />
          <Rect height="4.3" rx="0.9" width="4.1" x="32.6" y="46.1" />
          <Rect height="4.3" rx="0.9" width="4.1" x="32.6" y="54.7" />
          <Rect height="4.3" rx="0.9" width="4.1" x="32.6" y="63.3" />
          <Rect height="4.3" rx="0.9" width="4.1" x="63.5" y="40.6" />
          <Rect height="4.3" rx="0.9" width="4.1" x="63.5" y="49.2" />
          <Rect height="4.3" rx="0.9" width="4.1" x="63.5" y="57.8" />
          <Rect height="16.4" rx="3.9" width="7.8" x="46.3" y="65.8" />
        </G>
        <Rect fill={colors.accent} height="13.5" rx="2" width="3.9" x="48.2" y="68.8" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  mark: {
    alignItems: 'center',
    backgroundColor: colors.primaryDark,
    borderColor: 'rgba(255, 255, 255, 0.55)',
    borderWidth: 1,
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
    ...shadows.button,
  },
});
