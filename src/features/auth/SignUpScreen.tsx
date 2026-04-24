import { useMemo, useState, useLayoutEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as Linking from 'expo-linking';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { space, useTheme } from '../../theme';
import type { AuthStackParamList } from '../../navigation/types';
import { PRIVACY_POLICY_URL, TERMS_OF_SERVICE_URL } from '../../config/legal';
import { AuthHeroLayout } from './AuthHeroLayout';
import { AuthPasswordField } from './AuthPasswordField';
import { makeAuthStyles, authPlaceholderColor } from './authStyles';

export function SignUpScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const { t: tx } = useTranslation();
  const t = useTheme();
  const styles = useMemo(() => makeAuthStyles(t, { compact: true }), [t]);
  const placeholder = useMemo(() => authPlaceholderColor(t), [t]);
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<1 | 2>(1);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: step === 1 ? tx('auth.signUp.headerTitle') : tx('auth.signUp.inviteTitle'),
    });
  }, [navigation, step, tx]);

  function goStep2() {
    setError('');
    if (!legalAccepted) {
      setError(tx('auth.signUp.errors.legalRequired'));
      return;
    }
    if (!fullName.trim() || !email.trim() || !password.trim()) {
      setError(tx('auth.signUp.errors.allFields'));
      return;
    }
    if (password.length < 8) {
      setError(tx('auth.signUp.errors.passwordLength'));
      return;
    }
    setStep(2);
  }

  async function handleSignUp() {
    setError('');
    setLoading(true);
    const redirectTo = Linking.createURL('auth/callback');
    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: redirectTo,
      },
    });
    setLoading(false);
    if (authError) {
      setError(authError.message);
      return;
    }
    const user = data.user;
    if (
      user &&
      !data.session &&
      Array.isArray(user.identities) &&
      user.identities.length === 0
    ) {
      setError(tx('auth.signUp.errors.duplicateEmail'));
      return;
    }
    if (data.session) {
      return;
    }
    setSuccess(true);
  }

  if (success) {
    const before = tx('auth.signUp.successBeforeEmail');
    const after = tx('auth.signUp.successAfterEmail');

    return (
      <View
        style={[
          styles.successOuter,
          {
            paddingTop: insets.top + space[4],
            paddingBottom: insets.bottom + space[5],
            paddingHorizontal: space[5],
          },
        ]}
      >
        <View style={styles.successIconWrap}>
          <MaterialCommunityIcons name="email-check-outline" size={30} color="#7B8FF7" />
        </View>
        <Text style={styles.successTitle}>{tx('auth.signUp.successTitle')}</Text>
        <View style={styles.successDescBlock} accessibilityRole="text">
          {before !== '' ? <Text style={styles.successDescBody}>{before}</Text> : null}
          <Text style={styles.successEmailMark} selectable>
            {email}
          </Text>
          <Text style={styles.successDescBody}>{after}</Text>
        </View>
        <TouchableOpacity
          style={[styles.primaryButton, styles.successPrimaryButton, { marginBottom: 0 }]}
          onPress={() => navigation.replace('SignIn')}
          accessibilityRole="button"
          accessibilityLabel={tx('auth.signUp.goSignIn')}
          accessibilityHint={tx('auth.signUp.a11y.goSignInHint')}
        >
          <Text style={styles.primaryButtonText}>{tx('auth.signUp.goSignIn')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.outer}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
    >
      <AuthHeroLayout heroHeightFraction={0.31}>
        {step === 1 ? (
          <>
            <Text style={styles.stepHint}>{tx('auth.signUp.step1of2')}</Text>

            <TouchableOpacity
              style={styles.checkRow}
              onPress={() => setLegalAccepted((v) => !v)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: legalAccepted }}
              accessibilityLabel={tx('auth.signUp.a11y.legalCheckbox')}
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

            <Text style={styles.label}>{tx('auth.signUp.fullName')}</Text>
            <View style={styles.inputShell}>
              <TextInput
                style={styles.inputInShell}
                placeholder={tx('auth.signUp.namePlaceholder')}
                placeholderTextColor={placeholder}
                value={fullName}
                onChangeText={setFullName}
                returnKeyType="next"
                accessibilityLabel={tx('auth.signUp.fullName')}
              />
            </View>

            <Text style={styles.label}>{tx('auth.signUp.email')}</Text>
            <View style={styles.inputShell}>
              <TextInput
                style={styles.inputInShell}
                placeholder={tx('auth.signIn.emailPlaceholder')}
                placeholderTextColor={placeholder}
                autoCapitalize="none"
                keyboardType="email-address"
                returnKeyType="next"
                value={email}
                onChangeText={setEmail}
                accessibilityLabel={tx('auth.signUp.email')}
              />
            </View>

            <Text style={styles.label}>{tx('auth.signUp.password')}</Text>
            <AuthPasswordField
              value={password}
              onChangeText={setPassword}
              placeholder={tx('auth.signUp.passwordHint')}
              placeholderColor={placeholder}
              styles={styles}
              accessibilityLabel={tx('auth.signUp.password')}
              returnKeyType="done"
              onSubmitEditing={goStep2}
            />

            {error !== '' && (
              <View style={styles.errorBox} accessibilityRole="alert">
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={goStep2}
              accessibilityRole="button"
              accessibilityLabel={tx('auth.signUp.continue')}
              accessibilityHint={tx('auth.signUp.a11y.continueHint')}
            >
              <Text style={styles.primaryButtonText}>{tx('auth.signUp.continue')}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.stepHint}>{tx('auth.signUp.step2of2')}</Text>
            <Text style={styles.inviteBody}>{tx('auth.signUp.inviteBody')}</Text>

            {error !== '' && (
              <View style={styles.errorBox} accessibilityRole="alert">
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => void handleSignUp()}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel={tx('auth.signUp.createAccount')}
              accessibilityHint={tx('auth.signUp.a11y.createAccountHint')}
              accessibilityState={{ disabled: loading }}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>{tx('auth.signUp.createAccount')}</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryGhost}
              onPress={() => {
                setError('');
                setStep(1);
              }}
              disabled={loading}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={tx('auth.signUp.editDetails')}
              accessibilityHint={tx('auth.signUp.a11y.editDetailsHint')}
            >
              <Text style={styles.secondaryGhostText}>{tx('auth.signUp.editDetails')}</Text>
            </TouchableOpacity>
          </>
        )}

        <TouchableOpacity
          style={styles.toggleBtn}
          onPress={() => navigation.navigate('SignIn')}
          accessibilityRole="button"
          accessibilityLabel={`${tx('auth.signUp.hasAccount')}${tx('auth.signUp.signInLink')}`}
          accessibilityHint={tx('auth.signUp.a11y.signInLinkHint')}
          hitSlop={12}
        >
          <Text style={styles.toggleText}>{tx('auth.signUp.hasAccount')}</Text>
          <Text style={styles.toggleLink}>{tx('auth.signUp.signInLink')}</Text>
        </TouchableOpacity>
      </AuthHeroLayout>
    </KeyboardAvoidingView>
  );
}
