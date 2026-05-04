import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const keyPrefix = 'atoupay.appPin.';
const fallbackPrefix = 'atoupay.appPin.fallback.';

interface AppPinRecord {
  hash: string;
  salt: string;
  updatedAt: string;
  version: 1;
}

export interface AppPinStatus {
  enabled: boolean;
  updatedAt: string | null;
}

export function isValidAppPin(pin: string) {
  return /^\d{4}$/.test(pin);
}

async function digest(value: string) {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value);
}

async function getPinStorageKey(userKey: string) {
  const normalizedUserKey = userKey.trim().toLowerCase();
  const userHash = await digest(normalizedUserKey || 'anonymous');

  return `${keyPrefix}${userHash.slice(0, 32)}`;
}

async function getFallbackKey(storageKey: string) {
  return `${fallbackPrefix}${storageKey.replace(keyPrefix, '')}`;
}

async function readRecord(storageKey: string): Promise<AppPinRecord | null> {
  try {
    if (await SecureStore.isAvailableAsync()) {
      const rawSecureValue = await SecureStore.getItemAsync(storageKey);

      if (rawSecureValue) {
        return JSON.parse(rawSecureValue) as AppPinRecord;
      }
    }
  } catch {
    // Fall back to AsyncStorage below so older devices can still use the app.
  }

  try {
    const rawFallbackValue = await AsyncStorage.getItem(await getFallbackKey(storageKey));

    return rawFallbackValue ? (JSON.parse(rawFallbackValue) as AppPinRecord) : null;
  } catch {
    return null;
  }
}

async function writeRecord(storageKey: string, record: AppPinRecord) {
  const rawValue = JSON.stringify(record);
  let wroteSecureValue = false;

  try {
    if (await SecureStore.isAvailableAsync()) {
      await SecureStore.setItemAsync(storageKey, rawValue);
      wroteSecureValue = true;
    }
  } catch {
    // Keep a fallback for devices where SecureStore is unavailable.
  }

  const fallbackKey = await getFallbackKey(storageKey);

  if (wroteSecureValue) {
    await AsyncStorage.removeItem(fallbackKey);
    return;
  }

  await AsyncStorage.setItem(fallbackKey, rawValue);
}

async function deleteRecord(storageKey: string) {
  try {
    if (await SecureStore.isAvailableAsync()) {
      await SecureStore.deleteItemAsync(storageKey);
    }
  } catch {
    // Clear fallback even if SecureStore deletion fails.
  }

  await AsyncStorage.removeItem(await getFallbackKey(storageKey));
}

async function hashPin(pin: string, salt: string) {
  return digest(`${salt}:${pin}`);
}

export async function getAppPinStatus(userKey: string): Promise<AppPinStatus> {
  const storageKey = await getPinStorageKey(userKey);
  const record = await readRecord(storageKey);

  return {
    enabled: Boolean(record),
    updatedAt: record?.updatedAt ?? null,
  };
}

export async function setAppPin(userKey: string, pin: string): Promise<AppPinStatus> {
  if (!isValidAppPin(pin)) {
    throw new Error('Le code PIN doit contenir exactement 4 chiffres.');
  }

  const storageKey = await getPinStorageKey(userKey);
  const salt = Crypto.randomUUID();
  const record: AppPinRecord = {
    hash: await hashPin(pin, salt),
    salt,
    updatedAt: new Date().toISOString(),
    version: 1,
  };

  await writeRecord(storageKey, record);

  return {
    enabled: true,
    updatedAt: record.updatedAt,
  };
}

export async function verifyAppPin(userKey: string, pin: string): Promise<boolean> {
  if (!isValidAppPin(pin)) {
    return false;
  }

  const storageKey = await getPinStorageKey(userKey);
  const record = await readRecord(storageKey);

  if (!record) {
    return false;
  }

  return (await hashPin(pin, record.salt)) === record.hash;
}

export async function clearAppPin(userKey: string): Promise<AppPinStatus> {
  const storageKey = await getPinStorageKey(userKey);
  await deleteRecord(storageKey);

  return {
    enabled: false,
    updatedAt: null,
  };
}
