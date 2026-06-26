import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
import {
  Auth,
  browserLocalPersistence,
  getAuth,
  getReactNativePersistence,
  initializeAuth,
} from 'firebase/auth';
import { Firestore, getFirestore } from 'firebase/firestore';
import { FirebaseStorage, getStorage } from 'firebase/storage';

import { appConfig } from '@/src/config/env';

const firebaseConfig = {
  apiKey: appConfig.firebaseApiKey,
  appId: appConfig.firebaseAppId,
  authDomain: appConfig.firebaseAuthDomain,
  messagingSenderId: appConfig.firebaseMessagingSenderId,
  projectId: appConfig.firebaseProjectId,
  storageBucket: appConfig.firebaseStorageBucket,
} as const;

const firebaseConfigMessages = {
  apiKey: 'EXPO_PUBLIC_FIREBASE_API_KEY',
  appId: 'EXPO_PUBLIC_FIREBASE_APP_ID',
  authDomain: 'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
  messagingSenderId: 'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  projectId: 'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
  storageBucket: 'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET',
} as const;

type FirebaseConfigKey = keyof typeof firebaseConfigMessages;

export const missingFirebaseConfigKeys = (Object.entries(firebaseConfig) as Array<
  [FirebaseConfigKey, string | undefined]
>)
  .filter(([, value]) => typeof value !== 'string' || value.trim().length === 0)
  .map(([key]) => firebaseConfigMessages[key]);

export const isFirebaseConfigured = missingFirebaseConfigKeys.length === 0;

function createFirebaseApp() {
  if (!isFirebaseConfigured) {
    return null;
  }

  return getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
}

function createFirebaseAuth(app: FirebaseApp) {
  if (Platform.OS === 'web') {
    try {
      return initializeAuth(app, {
        persistence: browserLocalPersistence,
      });
    } catch {
      return getAuth(app);
    }
  }

  try {
    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    return getAuth(app);
  }
}

export const firebaseApp = createFirebaseApp();
export const auth: Auth | null = firebaseApp ? createFirebaseAuth(firebaseApp) : null;
export const db: Firestore | null = firebaseApp ? getFirestore(firebaseApp) : null;
export const storage: FirebaseStorage | null = firebaseApp ? getStorage(firebaseApp) : null;

export function getFirebaseUnavailableMessage() {
  if (isFirebaseConfigured) {
    return null;
  }

  if (appConfig.appVariant !== 'development') {
    return 'Connexion momentanément indisponible: cette version de l’application n’est pas correctement configurée. Installez la dernière mise à jour ATouPay ou contactez le support.';
  }

  return `Configuration Firebase incomplète: ajoutez ${missingFirebaseConfigKeys.join(', ')} dans .env.local puis reconstruisez la build native.`;
}

export function requireFirebaseAuth() {
  if (!auth) {
    throw new Error(
      getFirebaseUnavailableMessage() ??
        'Firebase Auth n’est pas initialisé dans cette build.',
    );
  }

  return auth;
}

export function requireFirestore() {
  if (!db) {
    throw new Error(
      getFirebaseUnavailableMessage() ??
        'Cloud Firestore n’est pas initialisé dans cette build.',
    );
  }

  return db;
}

export function requireFirebaseStorage() {
  if (!storage) {
    throw new Error(
      getFirebaseUnavailableMessage() ??
        'Firebase Storage n’est pas initialisé dans cette build.',
    );
  }

  return storage;
}
