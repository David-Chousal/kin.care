import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Linking from 'expo-linking';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTheme, elevation, spacing, space, radius, typography, type Theme } from '../../theme';
import type { AuthStackParamList } from '../../navigation/types';

export function SignUpScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const t = useTheme();
  const { t: tx } = useTranslation();
  const styles = makeStyles(t);
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<1 | 2>(1);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  function goStep2() {
    setError('');
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
    const redirectTo = Linking.createURL('/');
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
    return (
      <View style={[styles.outer, styles.successContainer, { paddingTop: insets.top + space[6] + space[2] }]}>
        <View style={styles.successCard}>
          <MaterialCommunityIcons name="email-check-outline" size={48} color={t.accent} />
          <Text style={styles.successTitle}>{tx('auth.signUp.successTitle')}</Text>
          <Text style={styles.successDesc}>
            {tx('auth.signUp.successDesc', { email })}
          </Text>
          <TouchableOpacity style={styles.button} onPress={() => navigation.replace('SignIn')}>
            <Text style={styles.buttonText}>{tx('auth.signUp.goSignIn')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.outer}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: insets.top + space[6] + space[2], paddingBottom: insets.bottom + space[5] }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brand}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>K</Text>
          </View>
          <Text style={styles.appName}>{tx('auth.brand.name')}</Text>
          <Text style={styles.tagline}>{tx('auth.brand.tagline')}</Text>
        </View>

        <View style={styles.form}>
          {step === 1 ? (
            <>
              <Text style={styles.formTitle}>{tx('auth.signUp.createTitle')}</Text>
              <Text style={styles.stepHint}>{tx('auth.signUp.step1of2')}</Text>

              <Text style={styles.label}>{tx('auth.signUp.fullName')}</Text>
              <TextInput
                style={styles.input}
                placeholder={tx('auth.signUp.namePlaceholder')}
                placeholderTextColor={t.textTertiary}
                value={fullName}
                onChangeText={setFullName}
                returnKeyType="next"
              />

              <Text style={styles.label}>{tx('auth.signUp.email')}</Text>
              <TextInput
                style={styles.input}
                placeholder={tx('auth.signIn.emailPlaceholder')}
                placeholderTextColor={t.textTertiary}
                autoCapitalize="none"
                keyboardType="email-address"
                returnKeyType="next"
                value={email}
                onChangeText={setEmail}
              />

              <Text style={styles.label}>{tx('auth.signUp.password')}</Text>
              <TextInput
                style={styles.input}
                placeholder={tx('auth.signUp.passwordHint')}
                placeholderTextColor={t.textTertiary}
                secureTextEntry
                returnKeyType="done"
                onSubmitEditing={goStep2}
                value={password}
                onChangeText={setPassword}
              />

              {error !== '' && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <TouchableOpacity style={styles.button} onPress={goStep2}>
                <Text style={styles.buttonText}>{tx('auth.signUp.continue')}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.formTitle}>{tx('auth.signUp.inviteTitle')}</Text>
              <Text style={styles.stepHint}>{tx('auth.signUp.step2of2')}</Text>
              <Text style={styles.inviteBody}>
                {tx('auth.signUp.inviteBody')}
              </Text>

              {error !== '' && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <TouchableOpacity style={styles.button} onPress={handleSignUp} disabled={loading}>
                {loading ? <ActivityIndicator color={t.surface} /> : <Text style={styles.buttonText}>{tx('auth.signUp.createAccount')}</Text>}
              </TouchableOpacity>

              <TouchableOpacity style={styles.secondaryGhost} onPress={() => { setError(''); setStep(1); }} disabled={loading}>
                <Text style={styles.secondaryGhostText}>{tx('auth.signUp.editDetails')}</Text>
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity style={styles.toggleBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.toggleText}>{tx('auth.signUp.hasAccount')}</Text>
            <Text style={styles.toggleLink}>{tx('auth.signUp.signInLink')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    outer: { flex: 1, backgroundColor: t.bg },
    container: { flexGrow: 1, paddingHorizontal: space[5] },
    successContainer: { paddingHorizontal: space[5], alignItems: 'stretch' },
    successCard: {
      backgroundColor: t.surface, borderRadius: radius.xxl, padding: space[6] - space[1],
      alignItems: 'center', gap: space[3],
      ...elevation(2, t.shadow),
    },
    successTitle: { ...typography.title, color: t.text },
    successDesc: { ...typography.callout, color: t.textSecondary, textAlign: 'center' },
    brand: { alignItems: 'center', marginBottom: space[6] + space[2], gap: space[2] },
    logoCircle: {
      width: 72, height: 72, borderRadius: 22,
      backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center',
      ...elevation(3, t.accent),
    },
    logoText: { fontSize: 36, fontWeight: '800', color: t.surface },
    appName: { ...typography.display, color: t.text },
    tagline: { ...typography.body, color: t.textSecondary },
    form: {
      backgroundColor: t.surface, borderRadius: radius.xxl, padding: space[5],
      ...elevation(2, t.shadow),
    },
    formTitle: { ...typography.heading, fontSize: 20, lineHeight: 24, letterSpacing: -0.2, color: t.text, marginBottom: space[1] },
    stepHint: { ...typography.caption, color: t.textTertiary, marginBottom: spacing.xl },
    inviteBody: { ...typography.body, color: t.textSecondary, marginBottom: space[4] },
    secondaryGhost: {
      alignSelf: 'center',
      paddingVertical: spacing.md,
      marginTop: spacing.xs,
    },
    secondaryGhostText: { ...typography.callout, color: t.accent, fontWeight: '600' },
    label: { ...typography.caption, fontWeight: '600', color: t.textSecondary, marginBottom: space[2] },
    input: {
      borderWidth: 1, borderColor: t.border, borderRadius: radius.lg,
      paddingHorizontal: space[4], paddingVertical: space[3], ...typography.body,
      color: t.text, backgroundColor: t.bg, marginBottom: space[3] + space[1],
    },
    errorBox: { backgroundColor: t.errorSurface, borderRadius: radius.md, padding: space[3], marginBottom: space[3] + space[1] },
    errorText: { ...typography.caption, color: t.error },
    button: {
      backgroundColor: t.accent, borderRadius: radius.xl, paddingVertical: space[4],
      alignItems: 'center', marginTop: space[1], marginBottom: space[4],
      ...elevation(4, t.accent),
    },
    buttonText: { ...typography.subhead, color: t.surface, fontWeight: '700' },
    toggleBtn: { flexDirection: 'row', justifyContent: 'center' },
    toggleText: { ...typography.callout, color: t.textSecondary },
    toggleLink: { ...typography.callout, color: t.accent, fontWeight: '600' },
  });
}
