import 'react-native-gesture-handler';
import { initSentry, Sentry } from './src/lib/sentry';
import { useEffect, useMemo } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet, Appearance } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
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
import { I18nextProvider } from 'react-i18next';
import { i18n } from './src/i18n/i18n';
import { useSyncI18nLanguage } from './src/i18n/useSyncI18nLanguage';

initSentry();

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => Sentry.captureException(error),
  }),
  mutationCache: new MutationCache({
    onError: (error) => Sentry.captureException(error),
  }),
});

function AppContent() {
  const { user, setSession } = useAuthStore();
  const colorScheme = useThemeStore((s) => s.colorScheme);
  const scheme = useResolvedScheme();
  const themeTokens = useTheme();
  const navigationTheme = useMemo(
    () => buildNavigationTheme(themeTokens, scheme === 'dark'),
    [themeTokens, scheme],
  );
  usePushToken();
  useRealtimeSync();
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

  return (
    <View style={styles.container}>
      <StatusBar style={colorScheme === 'dark' ? 'light' : colorScheme === 'light' ? 'dark' : 'auto'} />
      <View style={{ flex: 1 }}>
        <NavigationContainer theme={navigationTheme}>
          {user ? <MainStack /> : <AuthStackNavigator />}
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
    backgroundColor: '#F9F7F4',
  },
});
