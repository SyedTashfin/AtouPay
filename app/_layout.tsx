import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';

import { AppLoadingScreen } from '@/src/components/AppLoadingScreen';
import { isDebugToolsEnabled } from '@/src/config/env';
import { AppProvider, useAppContext } from '@/src/context/AppProvider';
import { SessionProvider, useSession } from '@/src/context/SessionProvider';
import { colors } from '@/src/theme/colors';

export { ErrorBoundary } from 'expo-router';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <AppProvider>
          <RootNavigator />
        </AppProvider>
      </SessionProvider>
    </SafeAreaProvider>
  );
}

function RootNavigator() {
  const { isHydrated: isAppHydrated } = useAppContext();
  const { isAuthenticated, isHydrated: isSessionHydrated, session } = useSession();

  if (!isAppHydrated || !isSessionHydrated) {
    return <AppLoadingScreen />;
  }

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          contentStyle: {
            backgroundColor: colors.background,
          },
          headerShown: false,
        }}>
        <Stack.Screen name="index" />
        <Stack.Protected guard={!isAuthenticated}>
          <Stack.Screen name="auth" />
        </Stack.Protected>
        <Stack.Protected guard={isAuthenticated && session?.role === 'tenant'}>
          <Stack.Screen name="(tenant)" />
        </Stack.Protected>
        <Stack.Protected guard={isAuthenticated && session?.role === 'owner'}>
          <Stack.Screen name="(owner)" />
        </Stack.Protected>
        <Stack.Protected guard={isAuthenticated && isDebugToolsEnabled}>
          <Stack.Screen name="dev-tools" />
        </Stack.Protected>
        <Stack.Screen name="+not-found" />
      </Stack>
    </>
  );
}
