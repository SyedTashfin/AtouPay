import { Platform } from 'react-native';
import {
  PhoneAuthProvider,
  RecaptchaVerifier,
  updatePhoneNumber,
  type ApplicationVerifier,
  type Auth,
} from 'firebase/auth';

import { requireFirebaseAuth } from '@/src/lib/firebase';

export type PhoneOtpChallenge = {
  verificationId: string;
};

type BrowserWindowWithRecaptcha = Window & {
  atoupayPhoneRecaptcha?: RecaptchaVerifier;
};

const RECAPTCHA_CONTAINER_ID = 'atoupay-phone-recaptcha';

function assertBrowserPhoneOtpSupported() {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error(
      'Real Firebase phone OTP needs a web reCAPTCHA verifier in Expo Go/web, or a native Firebase Auth verifier in a custom native build.',
    );
  }
}

function ensureRecaptchaContainer() {
  let container = document.getElementById(RECAPTCHA_CONTAINER_ID);

  if (!container) {
    container = document.createElement('div');
    container.id = RECAPTCHA_CONTAINER_ID;
    container.style.position = 'absolute';
    container.style.left = '-10000px';
    container.style.width = '1px';
    container.style.height = '1px';
    container.style.overflow = 'hidden';
    document.body.appendChild(container);
  }

  return container;
}

async function getRecaptchaVerifier(firebaseAuth: Auth): Promise<ApplicationVerifier> {
  assertBrowserPhoneOtpSupported();

  const browserWindow = window as BrowserWindowWithRecaptcha;
  if (!browserWindow.atoupayPhoneRecaptcha) {
    const container = ensureRecaptchaContainer();
    browserWindow.atoupayPhoneRecaptcha = new RecaptchaVerifier(firebaseAuth, container, {
      size: 'invisible',
      callback: () => undefined,
      'expired-callback': () => {
        void browserWindow.atoupayPhoneRecaptcha?.clear();
        browserWindow.atoupayPhoneRecaptcha = undefined;
      },
    });
  }

  await browserWindow.atoupayPhoneRecaptcha.render();
  return browserWindow.atoupayPhoneRecaptcha;
}

export async function sendPhoneOtp(phoneNumber: string): Promise<PhoneOtpChallenge> {
  const firebaseAuth = requireFirebaseAuth();
  const normalizedPhoneNumber = phoneNumber.trim();

  if (!/^\+[1-9]\d{7,14}$/.test(normalizedPhoneNumber)) {
    throw new Error('Enter the phone number in international E.164 format, for example +22236000000.');
  }

  if (!firebaseAuth.currentUser) {
    throw new Error('Sign in before verifying a recovery phone number.');
  }

  const provider = new PhoneAuthProvider(firebaseAuth);
  const verifier = await getRecaptchaVerifier(firebaseAuth);
  const verificationId = await provider.verifyPhoneNumber(normalizedPhoneNumber, verifier);

  return { verificationId };
}

export async function verifyPhoneOtp(challenge: PhoneOtpChallenge, code: string) {
  const firebaseAuth = requireFirebaseAuth();
  const currentUser = firebaseAuth.currentUser;

  if (!currentUser) {
    throw new Error('Sign in before confirming a phone verification code.');
  }

  const normalizedCode = code.trim();
  if (!/^\d{4,8}$/.test(normalizedCode)) {
    throw new Error('Enter the SMS verification code.');
  }

  const credential = PhoneAuthProvider.credential(challenge.verificationId, normalizedCode);
  await updatePhoneNumber(currentUser, credential);
  await currentUser.reload();

  return currentUser.phoneNumber ?? null;
}
