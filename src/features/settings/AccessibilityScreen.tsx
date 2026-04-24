import { View, Text, Switch, StyleSheet, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAccessibilityStore } from '../../store/accessibility';
import { useTheme, type Theme } from '../../theme';

export function AccessibilityScreen() {
  const t = useTheme();
  const styles = makeStyles(t);
  const { t: tx } = useTranslation();
  const hapticsEnabled = useAccessibilityStore((s) => s.hapticsEnabled);
  const setHapticsEnabled = useAccessibilityStore((s) => s.setHapticsEnabled);

  return (
    <View style={styles.container}>
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.rowLabel}>{tx('settings.accessibility.haptics.label')}</Text>
              <Text style={styles.rowSublabel}>
                {tx('settings.accessibility.haptics.sublabel')}
              </Text>
            </View>
            <Switch
              value={hapticsEnabled}
              onValueChange={setHapticsEnabled}
              trackColor={{ false: t.borderLight, true: t.accent }}
              thumbColor={t.surface}
            />
          </View>
        </View>

        <Text style={styles.footnote}>
          {tx('settings.accessibility.footnote')}
        </Text>
      </ScrollView>
    </View>
  );
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    scrollContent: { padding: 20, paddingBottom: 56 },
    card: {
      backgroundColor: t.surface,
      borderRadius: 16,
      overflow: 'hidden',
      shadowColor: t.shadow,
      shadowOpacity: 0.04,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 13,
      gap: 12,
    },
    rowLabel: { fontSize: 15, color: t.text },
    rowSublabel: { fontSize: 12, color: t.textTertiary, marginTop: 1 },
    footnote: {
      marginTop: 16,
      marginHorizontal: 4,
      fontSize: 13,
      lineHeight: 18,
      color: t.textSecondary,
    },
  });
}
