import { Modal, View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurredHeaderBar } from '../../components/BlurredHeaderBar';
import type { PolicySection } from './policyFallbackContent';
import {
  useTheme,
  type Theme,
  navigationTitleTextStyle,
  spacing,
  typography,
  NAVIGATION_HEADER_TOOLBAR,
  NAVIGATION_HEADER_CHROME_PAD,
} from '../../theme';

export { PRIVACY_POLICY, TERMS_OF_SERVICE } from './policyFallbackContent';
export type { PolicySection } from './policyFallbackContent';

interface Props {
  visible: boolean;
  title: string;
  lastUpdated: string;
  sections: PolicySection[];
  onClose: () => void;
}

export function PolicyViewer({ visible, title, lastUpdated, sections, onClose }: Props) {
  const t = useTheme();
  const styles = makeStyles(t);
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <BlurredHeaderBar style={styles.header} contentStyle={styles.headerFront}>
          <View style={styles.headerSideSpacer} />
          <Text style={styles.headerTitle}>{title}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.closeBtn}>Done</Text>
          </TouchableOpacity>
        </BlurredHeaderBar>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        >
          <Text style={styles.lastUpdated}>Last updated: {lastUpdated}</Text>

          {sections.map((section, i) => (
            <View key={i} style={styles.section}>
              <Text style={styles.sectionHeading}>{section.heading}</Text>
              <Text style={styles.sectionBody}>{section.body}</Text>
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    header: {
      paddingHorizontal: spacing.xl,
      paddingTop: NAVIGATION_HEADER_CHROME_PAD,
      paddingBottom: NAVIGATION_HEADER_CHROME_PAD,
    },
    headerFront: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: NAVIGATION_HEADER_TOOLBAR,
    },
    headerSideSpacer: { minWidth: 56 },
    headerTitle: {
      ...navigationTitleTextStyle(t),
      flex: 1,
      textAlign: 'center',
    },
    closeBtn: {
      ...typography.callout,
      color: t.accent,
      fontWeight: '600',
      minWidth: 56,
      textAlign: 'right',
    },
    content: { padding: 24, gap: 0 },
    lastUpdated: { fontSize: 13, color: t.textTertiary, marginBottom: 24 },
    section: { marginBottom: 28 },
    sectionHeading: {
      fontSize: 15, fontWeight: '700', color: t.text,
      marginBottom: 8, letterSpacing: -0.1,
    },
    sectionBody: {
      fontSize: 14, color: t.textSecondary,
      lineHeight: 22,
    },
  });
}
