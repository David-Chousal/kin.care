import { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import type { AuthStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme';
import { AuthHeroLayout } from './AuthHeroLayout';
import { AuthPasswordField } from './AuthPasswordField';
import { makeAuthStyles, authPlaceholderColor } from './authStyles';

export function SignInScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const { t: tx } = useTranslation();
  const t = useTheme();
  const styles = useMemo(() => makeAuthStyles(t), [t]);
  const placeholder = useMemo(() => authPlaceholderColor(t), [t]);
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
      keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
    >
      <AuthHeroLayout>
        <Text style={styles.label}>{tx('auth.signIn.email')}</Text>
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
            accessibilityLabel={tx('auth.signIn.email')}
          />
        </View>

        <Text style={styles.label}>{tx('auth.signIn.password')}</Text>
        <AuthPasswordField
          value={password}
          onChangeText={setPassword}
          placeholder={tx('auth.signIn.passwordPlaceholder')}
          placeholderColor={placeholder}
          styles={styles}
          accessibilityLabel={tx('auth.signIn.password')}
          returnKeyType="done"
          onSubmitEditing={() => void handleSignIn()}
        />

        <TouchableOpacity
          style={styles.forgotLinkWrap}
          onPress={() => navigation.navigate('ForgotPassword')}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={tx('auth.forgotPassword.link')}
          accessibilityHint={tx('auth.forgotPassword.a11y.linkHint')}
        >
          <Text style={styles.forgotLink}>{tx('auth.forgotPassword.link')}</Text>
        </TouchableOpacity>

        {error !== '' && (
          <View style={styles.errorBox} accessibilityRole="alert">
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => void handleSignIn()}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel={tx('auth.signIn.submit')}
          accessibilityHint={tx('auth.signIn.a11y.submitHint')}
          accessibilityState={{ disabled: loading }}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryButtonText}>{tx('auth.signIn.submit')}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.toggleBtn}
          onPress={() => navigation.navigate('SignUp')}
          accessibilityRole="button"
          accessibilityLabel={`${tx('auth.signIn.noAccount')}${tx('auth.signIn.create')}`}
          accessibilityHint={tx('auth.signIn.a11y.createLinkHint')}
          hitSlop={12}
        >
          <Text style={styles.toggleText}>{tx('auth.signIn.noAccount')}</Text>
          <Text style={styles.toggleLink}>{tx('auth.signIn.create')}</Text>
        </TouchableOpacity>
      </AuthHeroLayout>
    </KeyboardAvoidingView>
  );
}
