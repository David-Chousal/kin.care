import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { WelcomeIntro } from '../features/auth/WelcomeIntro';
import { SignInScreen } from '../features/auth/SignInScreen';
import { SignUpScreen } from '../features/auth/SignUpScreen';
import { useTheme } from '../theme';
import { useReduceMotion } from './useReduceMotion';
import type { AuthStackParamList } from './types';

const INTRO_KEY = 'kin_welcome_intro_seen';
const Stack = createNativeStackNavigator<AuthStackParamList>();

function WelcomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const finishIntro = useCallback(async () => {
    await AsyncStorage.setItem(INTRO_KEY, '1');
    navigation.replace('SignIn');
  }, [navigation]);
  return <WelcomeIntro onComplete={finishIntro} />;
}

export function AuthStackNavigator() {
  const t = useTheme();
  const reduceMotion = useReduceMotion();
  const [introReady, setIntroReady] = useState(false);
  const [introSeen, setIntroSeen] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const v = await AsyncStorage.getItem(INTRO_KEY);
        if (!cancelled) setIntroSeen(v === '1');
      } finally {
        if (!cancelled) setIntroReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!introReady) {
    return (
      <View style={[styles.boot, { backgroundColor: t.bg }]}>
        <ActivityIndicator size="large" color={t.accent} />
      </View>
    );
  }

  return (
    <Stack.Navigator
      initialRouteName={introSeen ? 'SignIn' : 'Welcome'}
      screenOptions={{
        headerShown: false,
        animation: reduceMotion ? 'fade' : 'default',
        contentStyle: { backgroundColor: t.bg },
      }}
    >
      <Stack.Screen
        name="Welcome"
        component={WelcomeScreen}
        options={{ animation: 'fade' }}
      />
      <Stack.Screen name="SignIn" component={SignInScreen} />
      <Stack.Screen name="SignUp" component={SignUpScreen} />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  boot: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
