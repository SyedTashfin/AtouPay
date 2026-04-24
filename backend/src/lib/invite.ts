import { createHash, randomUUID } from 'node:crypto';

export function normalizeInviteCode(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function formatInviteCode(value: string) {
  const groups = normalizeInviteCode(value).match(/.{1,4}/g) ?? [normalizeInviteCode(value)];

  return groups.join('-');
}

export function generateInviteCode() {
  const raw = randomUUID().replace(/-/g, '').toUpperCase().slice(0, 16);

  return formatInviteCode(raw);
}

export function hashInviteCode(inviteCode: string) {
  return createHash('sha256').update(normalizeInviteCode(inviteCode)).digest('hex');
}

export function hashStableValue(value: string) {
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}

export function buildScopedInviteLink(inviteBaseUrl: string, paramName: string, inviteCode: string) {
  const separator = inviteBaseUrl.includes('?') ? '&' : '?';

  return `${inviteBaseUrl}${separator}${paramName}=${encodeURIComponent(formatInviteCode(inviteCode))}`;
}

export function buildInviteLink(inviteBaseUrl: string, inviteCode: string) {
  return buildScopedInviteLink(inviteBaseUrl, 'invite', inviteCode);
}

export function currentMonthKey(now = new Date()) {
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');

  return `${year}-${month}`;
}

export function currentMonthDueDate(now = new Date()) {
  return `${currentMonthKey(now)}-05`;
}
