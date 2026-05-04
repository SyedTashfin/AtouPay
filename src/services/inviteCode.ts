import * as Crypto from 'expo-crypto';

const inviteScheme = 'atoupay://auth/invitation';

export function normalizeInviteCode(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function formatInviteCode(value: string) {
  const normalized = normalizeInviteCode(value);
  const groups = normalized.match(/.{1,4}/g) ?? [normalized];

  return groups.join('-');
}

export async function generateInviteCode() {
  const rawToken = Crypto.randomUUID().replace(/-/g, '').toUpperCase().slice(0, 16);

  return formatInviteCode(rawToken);
}

export async function hashInviteCode(inviteCode: string) {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    normalizeInviteCode(inviteCode),
  );
}

export function buildInviteLink(inviteCode: string) {
  return `${inviteScheme}?invite=${encodeURIComponent(formatInviteCode(inviteCode))}`;
}
