import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useThemeStore, type ColorSchemePreference } from '../../store/theme';
import { useTheme, type Theme } from '../../theme';
const SCHEME_OPTIONS: { key: ColorSchemePreference; label: string }[] = [
  { key: 'light', label: 'Light' },
  { key: 'dark', label: 'Dark' },
  { key: 'system', label: 'System' },
];

export function AppearanceScreen() {
  const t = useTheme();
  const styles = makeStyles(t);
  const { colorScheme, setColorScheme } = useThemeStore();

  return (
    <View style={styles.container}>
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.scrollContent}
      >
          <View style={styles.card}>
            <Text style={styles.appearanceLabel}>Color scheme</Text>
            <View style={styles.schemeSelector}>
              {SCHEME_OPTIONS.map(({ key, label }) => (
                <TouchableOpacity
                  key={key}
                  style={[styles.schemeOption, colorScheme === key && styles.schemeOptionActive]}
                  onPress={() => setColorScheme(key)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.schemeLabel, colorScheme === key && styles.schemeLabelActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
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
    appearanceLabel: { fontSize: 15, color: t.text, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10 },
    schemeSelector: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 16 },
    schemeOption: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center', backgroundColor: t.surfaceAlt },
    schemeOptionActive: { backgroundColor: t.accent },
    schemeLabel: { fontSize: 14, fontWeight: '600', color: t.textSecondary },
    schemeLabelActive: { color: t.surface },
  });
}
