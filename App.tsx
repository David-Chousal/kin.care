import 'react-native-gesture-handler';
import { initSentry, Sentry } from './src/lib/sentry';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet, Appearance, Animated, Easing, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import { useThemeStore } from './src/store/theme';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from '@tanstack/react-query';
import { supabase } from './src/lib/supabase';
import { useAuthStore } from './src/store/auth';
import { AuthStackNavigator } from './src/navigation/AuthStackNavigator';
import { MainStack } from './src/navigation/MainStack';
import { buildNavigationTheme } from './src/navigation/navigationTheme';
import { useTheme } from './src/theme';
import { useResolvedScheme } from './src/lib/useResolvedScheme';
import { usePushToken } from './src/features/notifications/usePushToken';
import { useRealtimeSync } from './src/hooks/useRealtimeSync';
import { useSyncMedicationDoseReminders } from './src/hooks/useSyncMedicationDoseReminders';
import { useReduceMotion } from './src/navigation/useReduceMotion';
import { I18nextProvider } from 'react-i18next';
import { i18n } from './src/i18n/i18n';
import { useSyncI18nLanguage } from './src/i18n/useSyncI18nLanguage';
import { initRevenueCatIfNeeded, syncRevenueCatUser } from './src/lib/revenueCat';
import { PostAuthOnboardingScreen } from './src/features/auth/PostAuthOnboardingScreen';
import { getPostAuthOnboardingSeen } from './src/features/auth/postAuthOnboardingStorage';
import { initReactQueryNetworkSync } from './src/lib/reactQueryNetwork';
import { ConnectivityBanner } from './src/components/ConnectivityBanner';

initSentry();
initReactQueryNetworkSync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      networkMode: 'offlineFirst',
    },
    mutations: {
      networkMode: 'offlineFirst',
    },
  },
  queryCache: new QueryCache({
    onError: (error) => Sentry.captureException(error),
  }),
  mutationCache: new MutationCache({
    onError: (error) => Sentry.captureException(error),
  }),
});

function parseSupabaseAuthHash(url: string): { access_token: string; refresh_token: string } | null {
  const hashIdx = url.indexOf('#');
  if (hashIdx < 0) return null;

  const hash = url.slice(hashIdx + 1);
  if (!hash) return null;

  const params = new URLSearchParams(hash);
  const access_token = params.get('access_token') ?? '';
  const refresh_token = params.get('refresh_token') ?? '';
  if (!access_token || !refresh_token) return null;

  return { access_token, refresh_token };
}

function AppContent() {
  const { user, setSession } = useAuthStore();
  const colorScheme = useThemeStore((s) => s.colorScheme);
  const scheme = useResolvedScheme();
  const themeTokens = useTheme();
  const reduceMotion = useReduceMotion();
  const navigationTheme = useMemo(
    () => buildNavigationTheme(themeTokens, scheme === 'dark'),
    [themeTokens, scheme],
  );
  const navFade = useRef(new Animated.Value(0)).current;
  const [postAuthReady, setPostAuthReady] = useState(false);
  const [postAuthSeen, setPostAuthSeen] = useState(true);
  usePushToken();
  useRealtimeSync();
  useSyncMedicationDoseReminders();
  useSyncI18nLanguage();

  useEffect(() => {
    Appearance.setColorScheme(colorScheme === 'system' ? null : colorScheme);
  }, [colorScheme]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    async function handleUrl(url: string) {
      const tokens = parseSupabaseAuthHash(url);
      if (!tokens) return;

      const { error } = await supabase.auth.setSession(tokens);
      if (error) Sentry.captureException(error);
    }

    Linking.getInitialURL()
      .then((url) => {
        if (url) void handleUrl(url);
      })
      .catch((e) => Sentry.captureException(e));

    const sub = Linking.addEventListener('url', ({ url }) => {
      void handleUrl(url);
    });

    return () => sub.remove();
  }, []);

  useEffect(() => {
    void initRevenueCatIfNeeded();
  }, []);

  useEffect(() => {
    void syncRevenueCatUser(user?.id);
  }, [user?.id]);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setPostAuthReady(true);
      setPostAuthSeen(true);
      return;
    }
    setPostAuthReady(false);
    void (async () => {
      try {
        const seen = await getPostAuthOnboardingSeen();
        if (!cancelled) setPostAuthSeen(seen);
      } finally {
        if (!cancelled) setPostAuthReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    navFade.setValue(reduceMotion ? 1 : 0);
    if (reduceMotion) return;
    Animated.timing(navFade, {
      toValue: 1,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [user ? 'authed' : 'unauthed', reduceMotion, navFade]);

  return (
    <View style={[styles.container, { backgroundColor: themeTokens.bg }]}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <ConnectivityBanner />
      <View style={{ flex: 1 }}>
        <NavigationContainer theme={navigationTheme}>
          <Animated.View style={{ flex: 1, opacity: navFade }}>
            {user ? (
              !postAuthReady ? (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                  <ActivityIndicator size="large" color={themeTokens.accent} />
                </View>
              ) : !postAuthSeen ? (
                <PostAuthOnboardingScreen onDone={() => setPostAuthSeen(true)} />
              ) : (
                <MainStack />
              )
            ) : (
              <AuthStackNavigator />
            )}
          </Animated.View>
        </NavigationContainer>
      </View>
    </View>
  );
}

function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <I18nextProvider i18n={i18n}>
            <AppContent />
          </I18nextProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default Sentry.wrap(App);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
