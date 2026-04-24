import { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import * as Linking from 'expo-linking';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { space, useTheme } from '../../theme';
import { makeAuthStyles, authPlaceholderColor } from './authStyles';

export function ForgotPasswordScreen() {
  const { t: tx } = useTranslation();
  const t = useTheme();
  const styles = useMemo(() => makeAuthStyles(t), [t]);
  const placeholder = useMemo(() => authPlaceholderColor(t), [t]);
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit() {
    setError('');
    const trimmed = email.trim();
    if (!trimmed) {
      setError(tx('auth.forgotPassword.errors.emailRequired'));
      return;
    }
    setLoading(true);
    const redirectTo = Linking.createURL('auth/callback');
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(trimmed, {
      redirectTo,
    });
    setLoading(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setSent(true);
  }

  if (sent) {
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
        <Text style={styles.successTitle}>{tx('auth.forgotPassword.sentTitle')}</Text>
        <Text style={styles.successBody}>{tx('auth.forgotPassword.sentBody')}</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.outer} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: space[4],
            paddingBottom: insets.bottom + space[5],
            paddingHorizontal: space[5],
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.lead}>{tx('auth.forgotPassword.lead')}</Text>

        <Text style={styles.label}>{tx('auth.signIn.email')}</Text>
        <View style={styles.inputShell}>
          <TextInput
            style={styles.inputInShell}
            placeholder={tx('auth.signIn.emailPlaceholder')}
            placeholderTextColor={placeholder}
            autoCapitalize="none"
            keyboardType="email-address"
            returnKeyType="done"
            value={email}
            onChangeText={setEmail}
            onSubmitEditing={() => void handleSubmit()}
            accessibilityLabel={tx('auth.signIn.email')}
          />
        </View>

        {error !== '' ? (
          <View style={styles.errorBox} accessibilityRole="alert">
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => void handleSubmit()}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel={tx('auth.forgotPassword.submit')}
          accessibilityState={{ disabled: loading }}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryButtonText}>{tx('auth.forgotPassword.submit')}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
