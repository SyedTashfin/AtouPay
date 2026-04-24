import { AuthProvider } from '@/src/types';

export function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function isValidPassword(value: string) {
  return value.trim().length >= 8;
}

export function getAuthProviderLabel(
  provider?: AuthProvider,
  linkedProviders: AuthProvider[] = [],
) {
  if (provider === 'password') {
    return linkedProviders.includes('google') ? 'E-mail + Google' : 'E-mail';
  }

  if (provider === 'google') {
    return linkedProviders.includes('password') ? 'Google + e-mail' : 'Google';
  }

  return 'Démo locale';
}

export function getFirstName(value: string, fallback: string) {
  const firstName = value.trim().split(/\s+/)[0];

  return firstName || fallback;
}
