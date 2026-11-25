import { useEffect } from 'react';
import { ErrorBoundary as DefaultErrorBoundary, Stack, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  useFonts,
  SourceSerif4_400Regular,
  SourceSerif4_400Regular_Italic,
  SourceSerif4_600SemiBold,
} from '@expo-google-fonts/source-serif-4';
import { colors } from '@dtour/shared';
import { AuthProvider, useAuth } from '@/lib/auth';
import { PresenceProvider } from '@/lib/presence';
import { NotificationsProvider } from '@/lib/notifications';
import { initMonitoring, reportError } from '@/lib/monitoring';

initMonitoring();
SplashScreen.preventAutoHideAsync();

/** Expo Router's error screen, plus a report to error monitoring (#15). */
export function ErrorBoundary(props: ErrorBoundaryProps) {
  useEffect(() => {
    reportError(props.error);
  }, [props.error]);
  return <DefaultErrorBoundary {...props} />;
}

function Root() {
  const { ready, session, profile } = useAuth();
  const [fontsLoaded] = useFonts({ SourceSerif4_400Regular, SourceSerif4_400Regular_Italic, SourceSerif4_600SemiBold });
  // `ready` means the saved session and its profile have been checked (see AuthProvider).
  const loaded = ready && fontsLoaded;

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);
  if (!loaded) return null;

  const signedIn = !!session && !!profile;
  return (
    <PresenceProvider enabled>
      <NotificationsProvider>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: 'slide_from_right' }}>
          {/* Reading is public; signing in is only needed to post, vote, reply or chat. */}
          <Stack.Protected guard={!(signedIn && !profile?.onboarded)}>
            <Stack.Screen name="(app)" options={{ animation: 'none' }} />
          </Stack.Protected>
          <Stack.Protected guard={!signedIn}>
            <Stack.Screen name="login" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          </Stack.Protected>
          <Stack.Protected guard={signedIn && !profile?.onboarded}>
            <Stack.Screen name="onboarding" />
          </Stack.Protected>
        </Stack>
      </NotificationsProvider>
    </PresenceProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="dark" />
          <Root />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
