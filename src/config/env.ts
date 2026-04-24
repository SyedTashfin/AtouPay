import Constants from 'expo-constants';
import { Platform } from 'react-native';

type AppVariant = 'development' | 'preview' | 'production';
const placeholderApiBaseUrl = 'https://placeholder-api.atoupay.local';

interface AppExtraConfig {
  apiBaseUrl: string;
  appVariant: AppVariant;
  easProjectId?: string;
  enableDevTools: boolean;
  firebaseApiKey?: string;
  firebaseAppId?: string;
  firebaseAuthDomain?: string;
  firebaseMessagingSenderId?: string;
  firebaseProjectId?: string;
  firebaseStorageBucket?: string;
  googleIosClientId?: string;
  googleIosUrlScheme?: string;
  googleWebClientId?: string;
  updatesUrl?: string;
  useBackend?: boolean;
}

function normalizeBoolean(value: unknown, fallback: boolean) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    return value === 'true';
  }

  return fallback;
}

function normalizeVariant(value: unknown): AppVariant {
  return value === 'preview' || value === 'production' ? value : 'development';
}

function resolveDefaultLocalApiBaseUrl() {
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3001';
  }

  return 'http://127.0.0.1:3001';
}

const extra = (Constants.expoConfig?.extra?.appConfig ?? {}) as Partial<AppExtraConfig>;

const appVariant = normalizeVariant(extra.appVariant);
const configuredApiBaseUrl =
  typeof extra.apiBaseUrl === 'string' &&
  extra.apiBaseUrl.trim().length > 0 &&
  extra.apiBaseUrl !== placeholderApiBaseUrl
    ? extra.apiBaseUrl.trim().replace(/\/$/, '')
    : undefined;

export const appConfig: AppExtraConfig = {
  apiBaseUrl: configuredApiBaseUrl ?? resolveDefaultLocalApiBaseUrl(),
  appVariant,
  easProjectId: typeof extra.easProjectId === 'string' ? extra.easProjectId : undefined,
  enableDevTools: normalizeBoolean(extra.enableDevTools, appVariant !== 'production'),
  firebaseApiKey:
    typeof extra.firebaseApiKey === 'string' ? extra.firebaseApiKey : undefined,
  firebaseAppId:
    typeof extra.firebaseAppId === 'string' ? extra.firebaseAppId : undefined,
  firebaseAuthDomain:
    typeof extra.firebaseAuthDomain === 'string' ? extra.firebaseAuthDomain : undefined,
  firebaseMessagingSenderId:
    typeof extra.firebaseMessagingSenderId === 'string'
      ? extra.firebaseMessagingSenderId
      : undefined,
  firebaseProjectId:
    typeof extra.firebaseProjectId === 'string' ? extra.firebaseProjectId : undefined,
  firebaseStorageBucket:
    typeof extra.firebaseStorageBucket === 'string' ? extra.firebaseStorageBucket : undefined,
  googleIosClientId:
    typeof extra.googleIosClientId === 'string' ? extra.googleIosClientId : undefined,
  googleIosUrlScheme:
    typeof extra.googleIosUrlScheme === 'string' ? extra.googleIosUrlScheme : undefined,
  googleWebClientId:
    typeof extra.googleWebClientId === 'string' ? extra.googleWebClientId : undefined,
  useBackend: normalizeBoolean(extra.useBackend, false),
  updatesUrl: typeof extra.updatesUrl === 'string' ? extra.updatesUrl : undefined,
};

export const isDebugToolsEnabled = appConfig.enableDevTools;
export const isBackendEnabled = appConfig.useBackend === true;
export const isProductionVariant = appConfig.appVariant === 'production';
export const buildVariantBadgeLabel =
  appConfig.appVariant === 'preview'
    ? 'Preview'
    : appConfig.appVariant === 'development'
      ? 'Build interne'
      : null;
