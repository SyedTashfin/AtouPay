import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PaymentProvider } from '@/src/types';
import { colors } from '@/src/theme/colors';
import { radius } from '@/src/theme/radius';
import { spacing } from '@/src/theme/spacing';
import { typography } from '@/src/theme/typography';

interface PaymentMethodRowProps {
  disabled?: boolean;
  method: PaymentProvider;
  selected: boolean;
  onPress: () => void;
}

const iconMap: Record<PaymentProvider, keyof typeof MaterialCommunityIcons.glyphMap> = {
  Bankily: 'bank-outline',
  Sedad: 'wallet-outline',
  Masrvi: 'cellphone-nfc',
  'Carte bancaire': 'credit-card-outline',
};

export function PaymentMethodRow({
  disabled = false,
  method,
  selected,
  onPress,
}: PaymentMethodRowProps) {
  return (
    <Pressable
      accessibilityHint="Sélectionne ce moyen de paiement pour le loyer"
      accessibilityLabel={`Méthode ${method}`}
      accessibilityRole="button"
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        selected ? styles.cardSelected : styles.cardDefault,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}>
      <View style={styles.leading}>
        <View style={[styles.iconWrap, selected && styles.iconWrapSelected]}>
          <MaterialCommunityIcons
            color={selected ? colors.surface : colors.primaryDark}
            name={iconMap[method]}
            size={22}
          />
        </View>
        <View style={styles.copy}>
          <Text style={styles.title}>{method}</Text>
          <Text style={styles.subtitle}>Paiement simulé localement</Text>
        </View>
      </View>
      <View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>
        {selected ? <View style={styles.radioInner} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 68,
    padding: spacing.sm,
  },
  cardDefault: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  cardSelected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  pressed: {
    opacity: 0.88,
  },
  disabled: {
    opacity: 0.6,
  },
  leading: {
    alignItems: 'center',
    flexDirection: 'row',
    flex: 1,
    gap: spacing.sm,
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  iconWrap: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  iconWrapSelected: {
    backgroundColor: colors.primary,
  },
  title: {
    color: colors.text,
    flexShrink: 1,
    ...typography.bodyStrong,
  },
  subtitle: {
    color: colors.textMuted,
    flexShrink: 1,
    ...typography.caption,
  },
  radioOuter: {
    alignItems: 'center',
    borderColor: colors.borderStrong,
    borderRadius: radius.pill,
    borderWidth: 2,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  radioOuterSelected: {
    borderColor: colors.primary,
  },
  radioInner: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    height: 10,
    width: 10,
  },
});
