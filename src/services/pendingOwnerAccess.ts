import {
  readStoredJson,
  removeStoredItem,
  storageKeys,
  writeStoredJson,
} from '@/src/storage/persistence';

function normalizeOwnerAccessCode(value: string) {
  return value.trim().toUpperCase();
}

export async function getPendingOwnerAccessCode() {
  const storedValue = await readStoredJson<string | null>(
    storageKeys.pendingOwnerAccessCode,
    null,
  );

  return typeof storedValue === 'string' && storedValue.trim().length > 0
    ? normalizeOwnerAccessCode(storedValue)
    : null;
}

export async function storePendingOwnerAccessCode(value: string) {
  const normalized = normalizeOwnerAccessCode(value);

  if (normalized.length === 0) {
    await removeStoredItem(storageKeys.pendingOwnerAccessCode);
    return null;
  }

  await writeStoredJson(storageKeys.pendingOwnerAccessCode, normalized);
  return normalized;
}

export async function clearPendingOwnerAccessCode() {
  await removeStoredItem(storageKeys.pendingOwnerAccessCode);
}
