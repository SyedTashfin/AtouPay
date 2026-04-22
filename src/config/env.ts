import Constants from 'expo-constants';

type AppVariant = 'development' | 'preview' | 'production';

interface AppExtraConfig {
  apiBaseUrl: string;
  appVariant: AppVariant;
  enableDevTools: boolean;
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

const extra = (Constants.expoConfig?.extra?.appConfig ?? {}) as Partial<AppExtraConfig>;

const appVariant = normalizeVariant(extra.appVariant);

export const appConfig: AppExtraConfig = {
  apiBaseUrl:
    extra.apiBaseUrl ?? 'https://placeholder-api.atoupay.local',
  appVariant,
  enableDevTools: normalizeBoolean(extra.enableDevTools, appVariant !== 'production'),
};

export const isDebugToolsEnabled = appConfig.enableDevTools;

