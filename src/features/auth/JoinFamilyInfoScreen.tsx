import { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { space, useTheme } from '../../theme';
import type { AuthStackParamList } from '../../navigation/types';
import { setWelcomeIntroSeen } from './authIntroStorage';
import { setPendingPostAuthIntent } from './pendingAuthIntent';
import { makeAuthStyles } from './authStyles';

export function JoinFamilyInfoScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const { t: tx } = useTranslation();
  const insets = useSafeAreaInsets();
  const t = useTheme();
  const styles = useMemo(() => makeAuthStyles(t), [t]);

  async function goAuth(route: 'SignIn' | 'SignUp') {
    await setPendingPostAuthIntent('join_family');
    await setWelcomeIntroSeen();
    navigation.navigate(route);
  }

  return (
    <ScrollView
      style={[styles.outer, { paddingTop: insets.top + space[4] }]}
      contentContainerStyle={[
        joinStyles.scrollContent,
        { paddingBottom: insets.bottom + space[6], paddingHorizontal: space[5] },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.successBody}>{tx('auth.joinFamily.body')}</Text>

      <TouchableOpacity
        style={[styles.primaryButton, { marginTop: space[5] }]}
        onPress={() => void goAuth('SignIn')}
        accessibilityRole="button"
        accessibilityLabel={tx('auth.joinFamily.logIn')}
        accessibilityHint={tx('auth.joinFamily.a11y.logInHint')}
      >
        <Text style={styles.primaryButtonText}>{tx('auth.joinFamily.logIn')}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={() => void goAuth('SignUp')}
        accessibilityRole="button"
        accessibilityLabel={tx('auth.joinFamily.signUp')}
        accessibilityHint={tx('auth.joinFamily.a11y.signUpHint')}
      >
        <Text style={styles.primaryButtonText}>{tx('auth.joinFamily.signUp')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const joinStyles = StyleSheet.create({
  scrollContent: { flexGrow: 1 },
});
