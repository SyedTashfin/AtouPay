import {
  readStoredJson,
  removeStoredItem,
  storageKeys,
  writeStoredJson,
} from '@/src/storage/persistence';

function normalizeInviteCode(value: string) {
  return value.trim().toUpperCase();
}

export async function getPendingInviteCode() {
  const storedValue = await readStoredJson<string | null>(storageKeys.pendingInviteCode, null);

  return typeof storedValue === 'string' && storedValue.trim().length > 0
    ? normalizeInviteCode(storedValue)
    : null;
}

export async function storePendingInviteCode(value: string) {
  const normalized = normalizeInviteCode(value);

  if (normalized.length === 0) {
    await removeStoredItem(storageKeys.pendingInviteCode);
    return null;
  }

  await writeStoredJson(storageKeys.pendingInviteCode, normalized);
  return normalized;
}

export async function clearPendingInviteCode() {
  await removeStoredItem(storageKeys.pendingInviteCode);
}
