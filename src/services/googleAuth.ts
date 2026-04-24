import {
  GoogleSignin,
  isErrorWithCode,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { Platform } from 'react-native';

import { appConfig } from '@/src/config/env';
import { GoogleAuthPayload } from '@/src/types';

type GoogleSignInFailureStatus = 'cancelled' | 'error' | 'unavailable';

interface GoogleSignInSuccessResult {
  payload: GoogleAuthPayload;
  status: 'success';
}

interface GoogleSignInFailureResult {
  code?: string;
  message: string;
  status: GoogleSignInFailureStatus;
}

export type GoogleSignInResult = GoogleSignInSuccessResult | GoogleSignInFailureResult;

let isConfigured = false;

function getGoogleSignInSupportState() {
  if (Platform.OS === 'web') {
    return {
      available: false,
      message:
        "La connexion Google native est réservée aux builds iOS et Android. L'export web reste une revue d'interface.",
    };
  }

  if (!appConfig.googleWebClientId) {
    return {
      available: false,
      message:
        'Configuration Google incomplète: ajoutez EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID puis reconstruisez la build native.',
    };
  }

  if (Platform.OS === 'ios' && !appConfig.googleIosClientId) {
    return {
      available: false,
      message:
        'Configuration Google iOS incomplète: ajoutez EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID puis reconstruisez la build iOS.',
    };
  }

  if (Platform.OS === 'ios' && !appConfig.googleIosUrlScheme) {
    return {
      available: false,
      message:
        'Configuration Google iOS incomplète: ajoutez EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME puis reconstruisez la build iOS.',
    };
  }

  return {
    available: true,
    message: null,
  };
}

function ensureGoogleConfigured() {
  if (isConfigured || !isGoogleSignInAvailable()) {
    return;
  }

  GoogleSignin.configure({
    ...(appConfig.googleIosClientId ? { iosClientId: appConfig.googleIosClientId } : {}),
    offlineAccess: false,
    profileImageSize: 144,
    scopes: ['email', 'profile'],
    webClientId: appConfig.googleWebClientId,
  });

  isConfigured = true;
}

export function isGoogleSignInAvailable() {
  return getGoogleSignInSupportState().available;
}

export function getGoogleSignInUnavailableMessage() {
  return getGoogleSignInSupportState().message;
}

export async function signInWithGoogle(): Promise<GoogleSignInResult> {
  const supportState = getGoogleSignInSupportState();

  if (!supportState.available) {
    return {
      message: supportState.message ?? 'La connexion Google n’est pas disponible sur cette build.',
      status: 'unavailable',
    };
  }

  ensureGoogleConfigured();

  try {
    if (Platform.OS === 'android') {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    }

    const response = await GoogleSignin.signIn();

    if (response.type === 'cancelled') {
      return {
        message: 'La connexion Google a été annulée.',
        status: 'cancelled',
      };
    }

    const { idToken, serverAuthCode, user } = response.data;
    const tokens = await GoogleSignin.getTokens().catch(() => null);
    const accessToken = tokens?.accessToken ?? null;
    const resolvedIdToken = idToken ?? tokens?.idToken ?? null;

    return {
      payload: {
        accessToken,
        idToken: resolvedIdToken,
        profile: {
          displayName: user.name ?? user.givenName ?? user.email,
          email: user.email,
          id: user.id,
          photoUrl: user.photo,
        },
        token: resolvedIdToken ?? accessToken ?? serverAuthCode ?? `google-session-${user.id}`,
      },
      status: 'success',
    };
  } catch (error) {
    if (isErrorWithCode(error)) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        return {
          code: error.code,
          message: 'La connexion Google a été annulée.',
          status: 'cancelled',
        };
      }

      if (error.code === statusCodes.IN_PROGRESS) {
        return {
          code: error.code,
          message: 'Une tentative de connexion Google est déjà en cours.',
          status: 'error',
        };
      }

      if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        return {
          code: error.code,
          message:
            'Google Play Services est indisponible ou obsolète sur cet appareil Android.',
          status: 'unavailable',
        };
      }

      return {
        code: error.code,
        message:
          'La connexion Google a échoué. Vérifiez les identifiants OAuth et la configuration de la build.',
        status: 'error',
      };
    }

    return {
      message: 'Une erreur inattendue a interrompu la connexion Google.',
      status: 'error',
    };
  }
}

export async function signOutFromGoogle() {
  if (Platform.OS === 'web') {
    return;
  }

  if (isGoogleSignInAvailable()) {
    ensureGoogleConfigured();
  }

  try {
    if (GoogleSignin.hasPreviousSignIn()) {
      await GoogleSignin.signOut();
    }
  } catch {
    // Keep local logout resilient even if the Google SDK fails to clear its state.
  }
}
