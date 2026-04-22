import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

export const storageKeys = {
  dismissedHints: 'atoupay.dismissedHints',
  paymentFilters: 'atoupay.paymentFilters',
  payments: 'atoupay.payments',
  selectedDemoRole: 'atoupay.selectedDemoRole',
  sessionFallback: 'atoupay.session.fallback',
  sessionSecure: 'atoupay.session.secure',
} as const;

export async function readStoredJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const rawValue = await AsyncStorage.getItem(key);

    if (!rawValue) {
      return fallback;
    }

    return JSON.parse(rawValue) as T;
  } catch {
    return fallback;
  }
}

export async function writeStoredJson<T>(key: string, value: T) {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export async function removeStoredItem(key: string) {
  await AsyncStorage.removeItem(key);
}

export async function removeStoredItems(keys: string[]) {
  await AsyncStorage.multiRemove(keys);
}

async function isSecureStoreAvailable() {
  try {
    return await SecureStore.isAvailableAsync();
  } catch {
    return false;
  }
}

export async function readSecureJson<T>(key: string): Promise<T | null> {
  try {
    if (await isSecureStoreAvailable()) {
      const rawValue = await SecureStore.getItemAsync(key);

      if (rawValue) {
        return JSON.parse(rawValue) as T;
      }
    }
  } catch {
    // Ignore SecureStore read failures and fall back below.
  }

  return readStoredJson<T | null>(storageKeys.sessionFallback, null);
}

export async function writeSecureJson<T>(key: string, value: T) {
  const rawValue = JSON.stringify(value);

  try {
    if (await isSecureStoreAvailable()) {
      await SecureStore.setItemAsync(key, rawValue);
    }
  } catch {
    // Continue with the AsyncStorage fallback below.
  }

  await AsyncStorage.setItem(storageKeys.sessionFallback, rawValue);
}

export async function deleteSecureValue(key: string) {
  try {
    if (await isSecureStoreAvailable()) {
      await SecureStore.deleteItemAsync(key);
    }
  } catch {
    // Ignore deletion errors and clear the fallback below.
  }

  await AsyncStorage.removeItem(storageKeys.sessionFallback);
}
