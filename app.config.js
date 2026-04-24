const appVariant = process.env.APP_VARIANT ?? 'development';
const appVersion = '1.0.0';
const apiBaseUrl =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://placeholder-api.atoupay.local';
const useBackend =
  process.env.EXPO_PUBLIC_USE_BACKEND != null
    ? process.env.EXPO_PUBLIC_USE_BACKEND === 'true'
    : false;
const enableDevTools =
  process.env.EXPO_PUBLIC_ENABLE_DEV_TOOLS != null
    ? process.env.EXPO_PUBLIC_ENABLE_DEV_TOOLS === 'true'
    : appVariant !== 'production';
const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
const googleIosUrlScheme = process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME;
const firebaseApiKey = process.env.EXPO_PUBLIC_FIREBASE_API_KEY;
const firebaseAuthDomain = process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN;
const firebaseProjectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;
const firebaseStorageBucket = process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET;
const firebaseMessagingSenderId = process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
const firebaseAppId = process.env.EXPO_PUBLIC_FIREBASE_APP_ID;
// Keep a repo-local fallback because `eas init` cannot auto-write projectId into dynamic config.
const defaultEasProjectId = '5045bc88-5619-4ff8-989e-58ab82d98207';
const easProjectId =
  process.env.EXPO_PUBLIC_EAS_PROJECT_ID ??
  process.env.EAS_PROJECT_ID ??
  defaultEasProjectId;
const updatesUrl = easProjectId ? `https://u.expo.dev/${easProjectId}` : undefined;
const plugins = [
  'expo-router',
  'expo-secure-store',
  'expo-dev-client',
  ...(googleIosUrlScheme
    ? [
        [
          '@react-native-google-signin/google-signin',
          {
            iosUrlScheme: googleIosUrlScheme,
          },
        ],
      ]
    : []),
];

const variantSuffix =
  appVariant === 'production' ? '' : appVariant === 'preview' ? '.preview' : '.dev';

const appName =
  appVariant === 'production'
    ? 'ATouPay'
    : appVariant === 'preview'
      ? 'ATouPay Preview'
      : 'ATouPay Dev';

module.exports = () => ({
  expo: {
    name: appName,
    slug: 'atoupay',
    version: appVersion,
    scheme: 'atoupay',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    newArchEnabled: true,
    runtimeVersion: appVersion,
    ...(updatesUrl
      ? {
          updates: {
            checkAutomatically: 'ON_LOAD',
            enabled: true,
            fallbackToCacheTimeout: 0,
            url: updatesUrl,
          },
        }
      : {}),
    ios: {
      buildNumber: '1',
      bundleIdentifier: `com.atoupay.mobile${variantSuffix}`,
      supportsTablet: true,
    },
    android: {
      edgeToEdgeEnabled: true,
      package: `com.atoupay.mobile${variantSuffix}`,
      predictiveBackGestureEnabled: false,
      versionCode: 1,
    },
    web: {
      bundler: 'metro',
    },
    plugins,
    experiments: {
      typedRoutes: true,
    },
    extra: {
      appConfig: {
        apiBaseUrl,
        appVariant,
        ...(easProjectId ? { easProjectId } : {}),
        enableDevTools,
        useBackend,
        ...(firebaseApiKey ? { firebaseApiKey } : {}),
        ...(firebaseAppId ? { firebaseAppId } : {}),
        ...(firebaseAuthDomain ? { firebaseAuthDomain } : {}),
        ...(firebaseMessagingSenderId ? { firebaseMessagingSenderId } : {}),
        ...(firebaseProjectId ? { firebaseProjectId } : {}),
        ...(firebaseStorageBucket ? { firebaseStorageBucket } : {}),
        ...(googleIosClientId ? { googleIosClientId } : {}),
        ...(googleIosUrlScheme ? { googleIosUrlScheme } : {}),
        ...(googleWebClientId ? { googleWebClientId } : {}),
        ...(updatesUrl ? { updatesUrl } : {}),
      },
      ...(easProjectId ? { eas: { projectId: easProjectId } } : {}),
    },
  },
});
