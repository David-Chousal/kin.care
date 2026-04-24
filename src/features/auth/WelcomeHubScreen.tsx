import { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import * as Linking from 'expo-linking';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { AuthSplitShell } from './AuthSplitShell';
import { PRIVACY_POLICY_URL, TERMS_OF_SERVICE_URL } from '../../config/legal';
import type { AuthStackParamList } from '../../navigation/types';
import { elevation, radius, space, typography, useTheme, type Theme } from '../../theme';
import { setWelcomeIntroSeen } from './authIntroStorage';

export function WelcomeHubScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const { t: tx } = useTranslation();
  const [legalAccepted, setLegalAccepted] = useState(false);
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);

  const openSignIn = async () => {
    await setWelcomeIntroSeen();
    navigation.navigate('SignIn');
  };

  const openSignUp = async () => {
    if (!legalAccepted) return;
    await setWelcomeIntroSeen();
    navigation.navigate('SignUp');
  };

  return (
    <View style={styles.outer}>
      <AuthSplitShell heroHeightFraction={0.36} showBrandInHero={false}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.hubTitle}>{tx('auth.welcome.hubTitle')}</Text>
          <Text style={styles.hubTagline}>{tx('auth.welcome.hubTagline')}</Text>

          <TouchableOpacity
            style={styles.checkRow}
            onPress={() => setLegalAccepted((v) => !v)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: legalAccepted }}
            accessibilityLabel={tx('auth.welcome.a11y.legalCheckbox')}
          >
            <View style={[styles.checkBox, legalAccepted && styles.checkBoxOn]}>
              {legalAccepted ? <Ionicons name="checkmark" size={16} color={t.surface} /> : null}
            </View>
            <Text style={styles.checkLabel}>
              {tx('auth.welcome.legalPrefix')}
              <Text
                style={styles.link}
                onPress={() => void Linking.openURL(TERMS_OF_SERVICE_URL)}
                accessibilityRole="link"
              >
                {tx('auth.welcome.termsLink')}
              </Text>
              {tx('auth.welcome.legalMid')}
              <Text
                style={styles.link}
                onPress={() => void Linking.openURL(PRIVACY_POLICY_URL)}
                accessibilityRole="link"
              >
                {tx('auth.welcome.privacyLink')}
              </Text>
              {tx('auth.welcome.legalSuffix')}
            </Text>
          </TouchableOpacity>

          <View style={styles.dualRow}>
            <TouchableOpacity
              style={[styles.pillSecondary, styles.pillHalf]}
              onPress={() => void openSignIn()}
              accessibilityRole="button"
              accessibilityLabel={tx('auth.welcome.logIn')}
              accessibilityHint={tx('auth.welcome.a11y.logInHint')}
            >
              <Text style={styles.pillSecondaryText}>{tx('auth.welcome.logIn')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.pillAccent, styles.pillHalf, !legalAccepted && styles.pillDisabled]}
              onPress={() => void openSignUp()}
              disabled={!legalAccepted}
              accessibilityRole="button"
              accessibilityLabel={tx('auth.welcome.signUp')}
              accessibilityHint={tx('auth.welcome.a11y.signUpHint')}
              accessibilityState={{ disabled: !legalAccepted }}
            >
              <Text style={styles.pillAccentText}>{tx('auth.welcome.signUp')}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.orRow}>
            <View style={styles.orLine} />
            <Text style={styles.orText}>{tx('auth.welcome.or')}</Text>
            <View style={styles.orLine} />
          </View>

          <TouchableOpacity
            style={styles.pillGhost}
            onPress={() => navigation.navigate('JoinFamilyInfo')}
            accessibilityRole="button"
            accessibilityLabel={tx('auth.welcome.joinFamily')}
            accessibilityHint={tx('auth.welcome.a11y.joinFamilyHint')}
          >
            <Text style={styles.pillGhostText}>{tx('auth.welcome.joinFamily')}</Text>
          </TouchableOpacity>

          <Text style={styles.emailHint}>{tx('auth.welcome.continueWithEmail')}</Text>
        </ScrollView>
      </AuthSplitShell>
    </View>
  );
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    outer: { flex: 1, backgroundColor: t.bg },
    scroll: { flex: 1 },
    scrollContent: {
      flexGrow: 1,
      paddingTop: space[2],
      paddingBottom: space[6],
      paddingHorizontal: space[5],
    },
    hubTitle: {
      ...typography.display,
      fontSize: 28,
      lineHeight: 34,
      fontWeight: '800',
      letterSpacing: -0.65,
      color: t.text,
      textAlign: 'center',
      marginBottom: space[2],
    },
    hubTagline: {
      ...typography.body,
      fontSize: 16,
      lineHeight: 24,
      color: t.textSecondary,
      textAlign: 'center',
      marginBottom: space[4],
      maxWidth: 360,
      alignSelf: 'center',
    },
    checkRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: space[3],
      marginBottom: space[4],
      width: '100%',
    },
    checkBox: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: t.border,
      marginTop: 2,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.surfaceAlt,
    },
    checkBoxOn: {
      backgroundColor: t.accent,
      borderColor: t.accent,
    },
    checkLabel: {
      ...typography.body,
      fontSize: 14,
      lineHeight: 20,
      color: t.textSecondary,
      flex: 1,
    },
    link: {
      color: t.accent,
      fontWeight: '600',
    },
    dualRow: {
      flexDirection: 'row',
      gap: space[2],
      marginBottom: space[3],
      width: '100%',
    },
    pillHalf: {
      flex: 1,
      minWidth: 0,
    },
    pillSecondary: {
      height: 56,
      borderRadius: radius.pill,
      backgroundColor: t.surfaceAlt,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pillSecondaryText: {
      ...typography.subhead,
      fontSize: 16,
      fontWeight: '700',
      color: t.text,
    },
    pillAccent: {
      height: 56,
      borderRadius: radius.pill,
      backgroundColor: t.accent,
      alignItems: 'center',
      justifyContent: 'center',
      ...elevation(2, t.accent),
    },
    pillAccentText: {
      ...typography.subhead,
      fontSize: 16,
      fontWeight: '700',
      color: t.surface,
    },
    pillDisabled: { opacity: 0.42 },
    orRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: space[3],
      gap: space[3],
      width: '100%',
    },
    orLine: {
      flex: 1,
      height: StyleSheet.hairlineWidth,
      backgroundColor: t.border,
    },
    orText: {
      ...typography.caption,
      color: t.textSecondary,
      fontWeight: '600',
    },
    pillGhost: {
      width: '100%',
      height: 56,
      borderRadius: radius.pill,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: space[2],
      backgroundColor: 'transparent',
    },
    pillGhostText: {
      ...typography.subhead,
      fontSize: 17,
      fontWeight: '600',
      color: t.text,
    },
    emailHint: {
      ...typography.caption,
      color: t.textSecondary,
      textAlign: 'center',
      marginTop: space[1],
    },
  });
}

