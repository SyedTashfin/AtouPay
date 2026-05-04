import { App, AppOptions, cert, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { Firestore, getFirestore } from 'firebase-admin/firestore';

import type { AppConfig } from '../config/env.js';
import type { AuthContext, AuthProvider } from '../domain/types.js';

export interface AuthVerifier {
  verifyBearerToken(token: string): Promise<AuthContext>;
}

function mapProvider(providerId?: string | null): AuthProvider | null {
  if (providerId === 'google.com') {
    return 'google';
  }

  if (providerId === 'password') {
    return 'password';
  }

  if (providerId === 'phone') {
    return 'phone';
  }

  return null;
}

function uniqueProviders(input: Array<AuthProvider | null | undefined>) {
  return Array.from(new Set(input.filter((value): value is AuthProvider => value != null)));
}

export function initializeFirebaseAdmin(config: AppConfig): App {
  if (getApps().length > 0) {
    return getApp();
  }

  const options: AppOptions = {
    projectId: config.firebaseProjectId,
  };

  if (config.firebaseClientEmail && config.firebasePrivateKey) {
    options.credential = cert({
      clientEmail: config.firebaseClientEmail,
      privateKey: config.firebasePrivateKey,
      projectId: config.firebaseProjectId,
    });
  }

  return initializeApp(options);
}

export function createAuthVerifier(app: App): AuthVerifier {
  const auth = getAuth(app);

  return {
    async verifyBearerToken(token: string) {
      const decoded = await auth.verifyIdToken(token);
      const primaryProvider =
        mapProvider(decoded.firebase?.sign_in_provider);
      const providers = uniqueProviders([
        primaryProvider,
      ]);

      return {
        uid: decoded.uid,
        email: decoded.email ?? null,
        emailVerified: decoded.email_verified ?? false,
        displayName: decoded.name ?? null,
        photoUrl: decoded.picture ?? null,
        phoneNumber: decoded.phone_number ?? null,
        primaryProvider,
        providers,
      };
    },
  };
}

export function createFirestore(app: App): Firestore {
  return getFirestore(app);
}
