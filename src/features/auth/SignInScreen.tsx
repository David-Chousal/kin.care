import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { useTheme, elevation, spacing, space, radius, typography, type Theme } from '../../theme';
import type { AuthStackParamList } from '../../navigation/types';

export function SignInScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const t = useTheme();
  const { t: tx } = useTranslation();
  const styles = makeStyles(t);
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSignIn() {
    setError('');
    setLoading(true);
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (authError) setError(authError.message);
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
          <Text style={styles.formTitle}>{tx('auth.signIn.title')}</Text>

          <Text style={styles.label}>{tx('auth.signIn.email')}</Text>
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

          <Text style={styles.label}>{tx('auth.signIn.password')}</Text>
          <TextInput
            style={styles.input}
            placeholder={tx('auth.signIn.passwordPlaceholder')}
            placeholderTextColor={t.textTertiary}
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={handleSignIn}
            value={password}
            onChangeText={setPassword}
          />

          {error !== '' && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <TouchableOpacity style={styles.button} onPress={handleSignIn} disabled={loading}>
            {loading ? <ActivityIndicator color={t.surface} /> : <Text style={styles.buttonText}>{tx('auth.signIn.submit')}</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.toggleBtn} onPress={() => navigation.navigate('SignUp')}>
            <Text style={styles.toggleText}>{tx('auth.signIn.noAccount')}</Text>
            <Text style={styles.toggleLink}>{tx('auth.signIn.create')}</Text>
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
    formTitle: { ...typography.heading, fontSize: 20, lineHeight: 24, letterSpacing: -0.2, color: t.text, marginBottom: spacing.xl },
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
