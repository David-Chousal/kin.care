import { Pressable } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { WelcomeHubScreen } from '../features/auth/WelcomeHubScreen';
import { SignInScreen } from '../features/auth/SignInScreen';
import { SignUpScreen } from '../features/auth/SignUpScreen';
import { ForgotPasswordScreen } from '../features/auth/ForgotPasswordScreen';
import { JoinFamilyInfoScreen } from '../features/auth/JoinFamilyInfoScreen';
import { useRerenderOnI18nLanguageChange } from '../i18n/useRerenderOnI18nLanguageChange';
import { useReduceMotion } from './useReduceMotion';
import type { AuthStackParamList } from './types';
import { useTheme } from '../theme';

const Stack = createNativeStackNavigator<AuthStackParamList>();

function AuthHeaderBackButton() {
  const navigation = useNavigation();
  const t = useTheme();
  return (
    <Pressable
      onPress={() => navigation.goBack()}
      hitSlop={12}
      style={{ paddingRight: 8, paddingVertical: 4 }}
      accessibilityRole="button"
      accessibilityLabel="Back"
    >
      <Ionicons name="chevron-back" size={24} color={t.text} />
    </Pressable>
  );
}

export function AuthStackNavigator() {
  useRerenderOnI18nLanguageChange();
  const reduceMotion = useReduceMotion();
  const t = useTheme();
  const { t: tx } = useTranslation();

  return (
    <Stack.Navigator
      initialRouteName="WelcomeHub"
      screenOptions={{
        animation: reduceMotion ? 'fade' : 'default',
        contentStyle: { backgroundColor: t.bg },
        headerShown: true,
        headerStyle: { backgroundColor: t.bg },
        headerTintColor: t.text,
        headerTitleStyle: { color: t.text, fontWeight: '700' },
        headerBackTitleVisible: false,
        headerShadowVisible: false,
        headerLeft: (props) => (props.canGoBack ? <AuthHeaderBackButton /> : null),
      }}
    >
      <Stack.Screen
        name="WelcomeHub"
        component={WelcomeHubScreen}
        options={{
          title: '',
          animation: 'fade',
        }}
      />
      <Stack.Screen
        name="SignIn"
        component={SignInScreen}
        options={() => ({
          title: tx('auth.signIn.headerTitle'),
        })}
      />
      <Stack.Screen
        name="SignUp"
        component={SignUpScreen}
        options={() => ({
          title: tx('auth.signUp.headerTitle'),
        })}
      />
      <Stack.Screen
        name="ForgotPassword"
        component={ForgotPasswordScreen}
        options={() => ({
          title: tx('auth.forgotPassword.headerTitle'),
        })}
      />
      <Stack.Screen
        name="JoinFamilyInfo"
        component={JoinFamilyInfoScreen}
        options={() => ({
          title: tx('auth.joinFamily.headerTitle'),
        })}
      />
    </Stack.Navigator>
  );
}

