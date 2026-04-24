import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/src/theme/colors';
import { radius } from '@/src/theme/radius';
import { shadows } from '@/src/theme/shadows';
import { spacing } from '@/src/theme/spacing';
import { typography } from '@/src/theme/typography';

type AccentTone = 'primary' | 'warning' | 'danger' | 'neutral';

interface SummaryCardProps {
  title: string;
  value: string;
  subtitle?: string;
  helper?: string;
  progress?: number;
  accent?: AccentTone;
  compact?: boolean;
}

const accentMap: Record<AccentTone, string> = {
  primary: colors.primary,
  warning: colors.warning,
  danger: colors.danger,
  neutral: colors.neutral,
};

export function SummaryCard({
  title,
  value,
  subtitle,
  helper,
  progress,
  accent = 'primary',
  compact = false,
}: SummaryCardProps) {
  return (
    <View style={[styles.card, compact && styles.compactCard]}>
      <View style={[styles.accent, { backgroundColor: accentMap[accent] }]} />
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        <Text style={[styles.value, compact && styles.compactValue]}>{value}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        {helper ? <Text style={styles.helper}>{helper}</Text> : null}
        {typeof progress === 'number' ? (
          <View style={styles.progressWrap}>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  {
                    backgroundColor: accentMap[accent],
                    width: `${Math.max(0, Math.min(progress, 100))}%`,
                  },
                ]}
              />
            </View>
            <Text style={styles.progressText}>{progress}% encaissé</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceGlass,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 132,
    overflow: 'hidden',
    padding: spacing.sm,
    ...shadows.glass,
  },
  compactCard: {
    minHeight: 112,
  },
  accent: {
    borderRadius: radius.pill,
    width: 6,
  },
  copy: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  title: {
    color: colors.textMuted,
    ...typography.caption,
  },
  value: {
    color: colors.text,
    flexShrink: 1,
    marginTop: 2,
    ...typography.heading,
  },
  compactValue: {
    fontSize: 22,
    lineHeight: 28,
  },
  subtitle: {
    color: colors.text,
    flexShrink: 1,
    ...typography.bodyStrong,
  },
  helper: {
    color: colors.textMuted,
    flexShrink: 1,
    marginTop: 2,
    ...typography.body,
  },
  progressWrap: {
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  progressTrack: {
    backgroundColor: 'rgba(16, 32, 24, 0.08)',
    borderRadius: radius.pill,
    height: 10,
    overflow: 'hidden',
  },
  progressFill: {
    borderRadius: radius.pill,
    height: '100%',
  },
  progressText: {
    color: colors.textMuted,
    ...typography.caption,
  },
});
