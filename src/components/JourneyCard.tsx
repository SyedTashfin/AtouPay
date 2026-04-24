import { Feather } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/src/theme/colors';
import { radius } from '@/src/theme/radius';
import { shadows } from '@/src/theme/shadows';
import { spacing } from '@/src/theme/spacing';
import { typography } from '@/src/theme/typography';

type JourneyTone = 'primary' | 'warning' | 'danger' | 'neutral';

interface JourneyStep {
  description: string;
  iconName: keyof typeof Feather.glyphMap;
  title: string;
}

interface JourneyCardProps {
  description?: string;
  steps: JourneyStep[];
  title: string;
  tone?: JourneyTone;
}

const toneColors: Record<JourneyTone, { background: string; color: string }> = {
  danger: {
    background: colors.dangerSoft,
    color: colors.danger,
  },
  neutral: {
    background: colors.neutralSoft,
    color: colors.neutral,
  },
  primary: {
    background: colors.primarySoft,
    color: colors.primaryDark,
  },
  warning: {
    background: colors.warningSoft,
    color: colors.warning,
  },
};

export function JourneyCard({
  description,
  steps,
  title,
  tone = 'primary',
}: JourneyCardProps) {
  const toneColor = toneColors[tone];

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {description ? <Text style={styles.description}>{description}</Text> : null}
      </View>

      <View style={styles.steps}>
        {steps.map((step, index) => (
          <View key={`${step.title}-${index}`} style={styles.step}>
            <View style={[styles.iconWrap, { backgroundColor: toneColor.background }]}>
              <Feather color={toneColor.color} name={step.iconName} size={18} />
            </View>
            <View style={styles.stepCopy}>
              <Text style={styles.stepTitle}>{step.title}</Text>
              <Text style={styles.stepDescription}>{step.description}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceGlass,
    borderColor: colors.border,
    borderRadius: radius.xl,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.sm,
    ...shadows.soft,
  },
  header: {
    gap: 4,
  },
  title: {
    color: colors.text,
    ...typography.subheading,
  },
  description: {
    color: colors.textMuted,
    ...typography.body,
  },
  steps: {
    gap: spacing.sm,
  },
  step: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  iconWrap: {
    alignItems: 'center',
    borderRadius: radius.pill,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  stepCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  stepTitle: {
    color: colors.text,
    ...typography.bodyStrong,
  },
  stepDescription: {
    color: colors.textMuted,
    flexShrink: 1,
    ...typography.caption,
  },
});
