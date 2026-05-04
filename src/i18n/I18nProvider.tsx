import { I18nManager } from 'react-native';
import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';

import type { AppLanguage, TranslationKey } from '@/src/i18n/translations';
import {
  getIntlLocale,
  normalizeLanguage,
  setActiveLanguage,
  translatePhrase,
  translations,
} from '@/src/i18n/translations';
import { readStoredJson, storageKeys, writeStoredJson } from '@/src/storage/persistence';

export type { AppLanguage, TranslationKey } from '@/src/i18n/translations';

interface I18nContextValue {
  copy: (value: string) => string;
  getLocale: () => string;
  isRtl: boolean;
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => Promise<void>;
  t: (key: TranslationKey) => string;
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

export function I18nProvider({ children }: PropsWithChildren) {
  const [language, setLanguageState] = useState<AppLanguage>('fr');

  useEffect(() => {
    let isMounted = true;

    void readStoredJson<AppLanguage>(storageKeys.language, 'fr').then((storedLanguage) => {
      if (isMounted) {
        setLanguageState(normalizeLanguage(storedLanguage));
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    I18nManager.allowRTL(language === 'ar');
    setActiveLanguage(language);
  }, [language]);

  const value = useMemo<I18nContextValue>(
    () => ({
      copy: (valueToTranslate) => translatePhrase(language, valueToTranslate),
      getLocale: () => getIntlLocale(language),
      isRtl: language === 'ar',
      language,
      setLanguage: async (nextLanguage) => {
        const normalizedLanguage = normalizeLanguage(nextLanguage);

        setLanguageState(normalizedLanguage);
        setActiveLanguage(normalizedLanguage);
        await writeStoredJson(storageKeys.language, normalizedLanguage);
      },
      t: (key) => translations[language][key],
    }),
    [language],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);

  if (!context) {
    throw new Error('useI18n must be used inside I18nProvider');
  }

  return context;
}
