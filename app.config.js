const appVariant = process.env.APP_VARIANT ?? 'development';
const apiBaseUrl =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://placeholder-api.atoupay.local';
const enableDevTools =
  process.env.EXPO_PUBLIC_ENABLE_DEV_TOOLS != null
    ? process.env.EXPO_PUBLIC_ENABLE_DEV_TOOLS === 'true'
    : appVariant !== 'production';
const easProjectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;

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
    version: '1.0.0',
    scheme: 'atoupay',
    orientation: 'portrait',
    userInterfaceStyle: 'light',
    newArchEnabled: true,
    runtimeVersion: {
      policy: 'appVersion',
    },
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
    plugins: ['expo-router', 'expo-secure-store', 'expo-dev-client'],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      appConfig: {
        apiBaseUrl,
        appVariant,
        enableDevTools,
      },
      ...(easProjectId ? { eas: { projectId: easProjectId } } : {}),
    },
  },
});

