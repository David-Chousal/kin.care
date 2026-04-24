import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme, spacing, radius, typography, type Theme } from '../theme';
import type { FeatureId } from './featureTierConfig';
import { FEATURE_TIER, TIER_DISPLAY_NAME, requiredTierForFeature } from './featureTierConfig';
import type { EffectiveTier } from './types';
import { tierMeetsMinimum } from './types';

type Props = {
  featureId: FeatureId;
  currentTier: EffectiveTier;
  onUpgrade: () => void;
  /** When false, still show copy but primary CTA can be hidden (e.g. web). */
  showNativePurchaseCta?: boolean;
};

export function FeatureLockedCallout({
  featureId,
  currentTier,
  onUpgrade,
  showNativePurchaseCta = true,
}: Props) {
  const t = useTheme();
  const styles = makeStyles(t);
  const rule = FEATURE_TIER[featureId];
  const need = requiredTierForFeature(featureId);
  const needLabel = need === 'care_team' ? TIER_DISPLAY_NAME.care_team : TIER_DISPLAY_NAME.family;
  const isCareTeamUpsell = need === 'care_team' && tierMeetsMinimum(currentTier, 'family');

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{rule.title}</Text>
      <Text style={styles.body}>{rule.benefit}</Text>
      <Text style={styles.tierLine}>
        {isCareTeamUpsell
          ? `Your Family plan does not include this. Upgrade to ${needLabel} to unlock it.`
          : `Requires ${needLabel} (${need === 'care_team' ? '$8.99/mo' : '$4.99/mo'}).`}
      </Text>
      {showNativePurchaseCta ? (
        <TouchableOpacity style={styles.btn} onPress={onUpgrade} activeOpacity={0.85}>
          <Text style={styles.btnText}>View plans & upgrade</Text>
        </TouchableOpacity>
      ) : (
        <Text style={styles.webHint}>Subscribe in the Kin iOS or Android app to upgrade.</Text>
      )}
    </View>
  );
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    wrap: {
      marginHorizontal: spacing.lg,
      marginVertical: spacing.md,
      padding: spacing.lg,
      borderRadius: radius.lg,
      backgroundColor: t.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.border,
      gap: spacing.sm,
    },
    title: { ...typography.title, fontSize: 17, color: t.text },
    body: { ...typography.body, fontSize: 15, color: t.textSecondary, lineHeight: 22 },
    tierLine: { ...typography.body, fontSize: 14, color: t.accent, fontWeight: '600', marginTop: 4 },
    btn: {
      marginTop: spacing.md,
      alignSelf: 'flex-start',
      backgroundColor: t.accent,
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: radius.md,
    },
    btnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
    webHint: { ...typography.body, fontSize: 14, color: t.textSecondary, marginTop: spacing.sm },
  });
}
