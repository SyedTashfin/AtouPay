import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { AppLanguage } from '@/src/i18n/I18nProvider';
import { useI18n } from '@/src/i18n/I18nProvider';
import { languageLabels } from '@/src/i18n/translations';
import { colors } from '@/src/theme/colors';
import { radius } from '@/src/theme/radius';
import { shadows } from '@/src/theme/shadows';
import { spacing } from '@/src/theme/spacing';
import { typography } from '@/src/theme/typography';

const options: Array<{ label: string; value: AppLanguage }> = [
  { label: languageLabels.fr, value: 'fr' },
  { label: languageLabels.ar, value: 'ar' },
  { label: languageLabels.en, value: 'en' },
];

export function LanguageSelector() {
  const { isRtl, language, setLanguage, t } = useI18n();
  const [hasChanged, setHasChanged] = useState(false);
  const activeLanguageLabel = languageLabels[language];

  return (
    <View style={styles.card}>
      <View style={[styles.header, isRtl && styles.rtlRow]}>
        <View style={styles.iconWrap}>
          <Feather color={colors.primaryDark} name="globe" size={18} />
        </View>
        <View style={styles.headerCopy}>
          <Text style={[styles.label, isRtl && styles.rtlText]}>
            {t('common.languageChooserTitle')}
          </Text>
          <Text style={[styles.description, isRtl && styles.rtlText]}>
            {t('common.languageChooserSubtitle')}
          </Text>
        </View>
      </View>

      <Text style={[styles.activeLabel, isRtl && styles.rtlText]}>
        {t('common.languageActive')}: {activeLanguageLabel}
      </Text>

      <View style={styles.optionList}>
        {options.map((option) => {
          const selected = option.value === language;

          return (
            <Pressable
              accessibilityState={{ selected }}
              accessibilityRole="button"
              key={option.value}
              onPress={async () => {
                await setLanguage(option.value);
                setHasChanged(true);
              }}
              style={({ pressed }) => [
                styles.option,
                isRtl && styles.rtlRow,
                selected && styles.optionSelected,
                pressed && styles.pressed,
              ]}>
              <Text
                style={[
                  styles.optionText,
                  selected && styles.optionTextSelected,
                  isRtl && styles.rtlText,
                ]}>
                {option.label}
              </Text>
              {selected ? (
                <View style={styles.checkWrap}>
                  <Feather color={colors.surface} name="check" size={16} />
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {hasChanged ? (
        <Text style={[styles.successText, isRtl && styles.rtlText]}>
          {t('common.languageChanged')}
        </Text>
      ) : null}

      {language === 'ar' ? (
        <Text style={[styles.helperText, isRtl && styles.rtlText]}>
          {t('common.languageArabicRestart')}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceGlass,
    borderColor: colors.border,
    borderRadius: radius.xl,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md,
    ...shadows.soft,
  },
  activeLabel: {
    color: colors.textSecondary,
    ...typography.bodyStrong,
  },
  checkWrap: {
    alignItems: 'center',
    backgroundColor: colors.primaryDark,
    borderRadius: radius.pill,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  description: {
    color: colors.textSecondary,
    ...typography.caption,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  headerCopy: {
    flex: 1,
    gap: 2,
  },
  helperText: {
    color: colors.textSecondary,
    ...typography.caption,
  },
  iconWrap: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  label: {
    color: colors.text,
    ...typography.bodyStrong,
  },
  option: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  optionList: {
    gap: spacing.xs,
  },
  optionSelected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primaryDark,
  },
  optionText: {
    color: colors.textMuted,
    ...typography.bodyStrong,
  },
  optionTextSelected: {
    color: colors.primaryDark,
  },
  pressed: {
    opacity: 0.8,
  },
  rtlRow: {
    flexDirection: 'row-reverse',
  },
  rtlText: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  successText: {
    color: colors.success,
    ...typography.caption,
  },
});
