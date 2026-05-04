import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { router, useGlobalSearchParams, usePathname, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';

import { AppLoadingScreen } from '@/src/components/AppLoadingScreen';
import { isDebugToolsEnabled } from '@/src/config/env';
import { AppProvider, useAppContext } from '@/src/context/AppProvider';
import { SessionProvider, useSession } from '@/src/context/SessionProvider';
import { I18nProvider } from '@/src/i18n/I18nProvider';
import { colors } from '@/src/theme/colors';
import {
  getRouteGroupForRole,
  isProtectedRoleSegment,
} from '@/src/utils/session';

export { ErrorBoundary } from 'expo-router';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <I18nProvider>
        <SessionProvider>
          <AppProvider>
            <RootNavigator />
          </AppProvider>
        </SessionProvider>
      </I18nProvider>
    </SafeAreaProvider>
  );
}

function RootNavigator() {
  const { isHydrated: isAppHydrated } = useAppContext();
  const {
    authEntryRoute,
    homeRoute,
    isAuthenticated,
    isFirebaseEnabled,
    isHydrated: isSessionHydrated,
    session,
    sessionStatus,
  } = useSession();
  const pathname = usePathname();
  const globalParams = useGlobalSearchParams<{
    ownerInvite?: string;
  }>();
  const segments = useSegments();
  const topSegment = segments[0];
  const isPublicUtilityRoute =
    pathname.startsWith('/receipt-verification') ||
    pathname.startsWith('/terms') ||
    pathname.startsWith('/help') ||
    pathname.startsWith('/support') ||
    pathname.startsWith('/language');

  useEffect(() => {
    if (!isAppHydrated || !isSessionHydrated) {
      return;
    }

    if (!isAuthenticated) {
      if (sessionStatus !== 'public' && pathname !== authEntryRoute) {
        if (
          sessionStatus === 'owner-access-required' &&
          typeof globalParams.ownerInvite === 'string' &&
          globalParams.ownerInvite.trim().length > 0
        ) {
          router.replace(
            `/owner-access?ownerInvite=${encodeURIComponent(globalParams.ownerInvite)}` as never,
          );
          return;
        }

        router.replace(authEntryRoute as never);
        return;
      }

      if (topSegment && topSegment !== 'auth' && !isPublicUtilityRoute) {
        if (
          sessionStatus === 'owner-access-required' &&
          typeof globalParams.ownerInvite === 'string' &&
          globalParams.ownerInvite.trim().length > 0
        ) {
          router.replace(
            `/owner-access?ownerInvite=${encodeURIComponent(globalParams.ownerInvite)}` as never,
          );
          return;
        }

        router.replace(authEntryRoute as never);
      }
      return;
    }

    if (!session) {
      return;
    }

    if (topSegment === 'auth') {
      router.replace(homeRoute as never);
      return;
    }

    if (isProtectedRoleSegment(topSegment) && topSegment !== getRouteGroupForRole(session.role)) {
      router.replace(homeRoute as never);
    }
  }, [
    authEntryRoute,
    homeRoute,
    isAppHydrated,
    isAuthenticated,
    isSessionHydrated,
    pathname,
    globalParams.ownerInvite,
    session,
    sessionStatus,
    topSegment,
    isPublicUtilityRoute,
  ]);

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
        <Stack.Protected guard={sessionStatus === 'owner-access-required'}>
          <Stack.Screen name="owner-access" />
        </Stack.Protected>
        <Stack.Protected guard={sessionStatus === 'suspended'}>
          <Stack.Screen name="account-suspended" />
        </Stack.Protected>
        <Stack.Protected guard={isAuthenticated}>
          <Stack.Screen name="profile-contact" />
        </Stack.Protected>
        <Stack.Protected guard={isAuthenticated}>
          <Stack.Screen name="notifications" />
        </Stack.Protected>
        <Stack.Protected guard={isAuthenticated && session?.role === 'agency_admin'}>
          <Stack.Screen name="(agency)" />
        </Stack.Protected>
        <Stack.Protected guard={isAuthenticated && session?.role === 'tenant'}>
          <Stack.Screen name="(tenant)" />
        </Stack.Protected>
        <Stack.Protected guard={isAuthenticated && session?.role === 'owner'}>
          <Stack.Screen name="(owner)" />
        </Stack.Protected>
        <Stack.Protected guard={isAuthenticated}>
          <Stack.Screen name="receipt/[receiptId]" />
        </Stack.Protected>
        <Stack.Protected guard={isAuthenticated && isFirebaseEnabled}>
          <Stack.Screen name="link-password" />
        </Stack.Protected>
        <Stack.Protected guard={isAuthenticated && isDebugToolsEnabled}>
          <Stack.Screen name="dev-tools" />
        </Stack.Protected>
        <Stack.Screen name="terms" />
        <Stack.Screen name="help" />
        <Stack.Screen name="support" />
        <Stack.Screen name="language" />
        <Stack.Screen name="receipt-verification" />
        <Stack.Screen name="+not-found" />
      </Stack>
    </>
  );
}
