import { Modal, View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurredHeaderBar } from '../../components/BlurredHeaderBar';
import {
  useTheme,
  type Theme,
  navigationTitleTextStyle,
  spacing,
  typography,
  NAVIGATION_HEADER_TOOLBAR,
  NAVIGATION_HEADER_CHROME_PAD,
} from '../../theme';

interface PolicySection {
  heading: string;
  body: string;
}

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


// ─── Policy content ───────────────────────────────────────────────────────────

export const PRIVACY_POLICY = {
  title: 'Privacy Policy',
  lastUpdated: 'April 2025',
  sections: [
    {
      heading: '1. Information We Collect',
      body: 'We collect information you provide directly: your name, email address, and the care-related data you enter (tasks, medications, health logs, calendar events, and check-ins). We also collect your device\'s push notification token to deliver reminders.',
    },
    {
      heading: '2. How We Use Your Information',
      body: 'Your data is used solely to provide the Kin service — syncing care information across your family group, sending notifications you have requested, and generating your doctor visit summaries. We do not use your data for advertising or sell it to third parties.',
    },
    {
      heading: '3. Data Storage & Security',
      body: 'All data is stored securely on Supabase infrastructure with encryption at rest and in transit. Access to your family\'s data is restricted to verified members of your family group. We use row-level security policies to enforce this at the database level.',
    },
    {
      heading: '4. Sharing With Third Parties',
      body: 'We use Supabase for database and authentication services, Expo for push notifications, and Anthropic\'s Claude API to generate visit summaries. These providers process only the minimum data necessary. We do not share your health information with insurers, advertisers, or data brokers.',
    },
    {
      heading: '5. Health Information',
      body: 'Health logs and medication records you enter are treated as sensitive data. They are accessible only within your family group. Kin is not a covered entity under HIPAA and does not provide medical advice. Do not use Kin as a substitute for professional medical records systems.',
    },
    {
      heading: '6. Data Retention',
      body: 'Your data is retained as long as your account is active. When you delete your account, your personal data is removed within 30 days. Family data shared with other members may be retained by those members\' accounts.',
    },
    {
      heading: '7. Your Rights',
      body: 'You may request a full export of your data at any time using the "Export Family Data" option in Settings. You may also request deletion of your account and associated data by using "Delete Account" or by contacting us at privacy@kin.care.',
    },
    {
      heading: '8. Children\'s Privacy',
      body: 'Kin is not directed to children under 13. We do not knowingly collect personal information from children under 13. If you believe a child has provided us with personal information, please contact us so we can delete it.',
    },
    {
      heading: '9. Changes to This Policy',
      body: 'We may update this policy as the service evolves. We will notify you of significant changes through the app. Continued use of Kin after changes constitutes acceptance of the updated policy.',
    },
    {
      heading: '10. Contact Us',
      body: 'For privacy-related questions or requests, contact us at privacy@kin.care.',
    },
  ],
};

export const TERMS_OF_SERVICE = {
  title: 'Terms of Service',
  lastUpdated: 'April 2025',
  sections: [
    {
      heading: '1. Acceptance of Terms',
      body: 'By creating an account or using Kin, you agree to these Terms of Service. If you do not agree, do not use the app. These terms form a binding agreement between you and Kin.',
    },
    {
      heading: '2. Description of Service',
      body: 'Kin is a family care coordination app that helps caregivers track tasks, medications, health logs, appointments, and check-ins for a care recipient. Kin also provides AI-generated summaries to assist with doctor visits.',
    },
    {
      heading: '3. Medical Disclaimer',
      body: 'Kin is a coordination tool, not a medical device or healthcare provider. Nothing in Kin constitutes medical advice, diagnosis, or treatment. Always consult a qualified healthcare professional for medical decisions. Do not delay seeking medical attention based on information in Kin.',
    },
    {
      heading: '4. User Responsibilities',
      body: 'You are responsible for the accuracy of information you enter. You agree not to use Kin to store information about individuals without their knowledge or consent. You are responsible for maintaining the confidentiality of your account credentials.',
    },
    {
      heading: '5. Family Groups & Data Access',
      body: 'When you create or join a family group, other members of that group can view and edit shared data. By adding members to your group, you consent to sharing that data with them. You are responsible for managing who you invite.',
    },
    {
      heading: '6. Acceptable Use',
      body: 'You agree not to use Kin to harass others, transmit malicious code, attempt to gain unauthorized access to our systems, or use the service in any way that violates applicable laws. We reserve the right to suspend accounts that violate these terms.',
    },
    {
      heading: '7. AI-Generated Content',
      body: 'Kin uses AI to generate visit preparation summaries. These summaries are based on the data you have entered and may contain errors or omissions. Always review AI-generated content before relying on it in a medical context.',
    },
    {
      heading: '8. Service Availability',
      body: 'We strive to keep Kin available at all times but do not guarantee uninterrupted access. We may modify, suspend, or discontinue features with reasonable notice. We are not liable for any loss resulting from service interruptions.',
    },
    {
      heading: '9. Limitation of Liability',
      body: 'To the fullest extent permitted by law, Kin shall not be liable for any indirect, incidental, or consequential damages arising from your use of the service. Our total liability for any claim shall not exceed the amount you paid for the service in the preceding 12 months.',
    },
    {
      heading: '10. Changes to Terms',
      body: 'We may update these terms as the service evolves. We will notify you of material changes through the app. Continued use after the effective date of changes constitutes acceptance.',
    },
    {
      heading: '11. Contact',
      body: 'Questions about these terms? Contact us at legal@kin.care.',
    },
  ],
};
