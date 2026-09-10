// ==========================================
// BLACKLIST API
// ==========================================

import type { BlacklistEntry } from '@/types/index';
import { authFetch, safeFetch } from './api-core';

export async function fetchBlacklist(): Promise<BlacklistEntry[]> {
  return safeFetch<BlacklistEntry[]>('/api/blacklist', undefined, []);
}

export async function addBlacklistEntry(
  entry: Omit<BlacklistEntry, 'id' | 'addedAt'>,
): Promise<BlacklistEntry> {
  return authFetch<BlacklistEntry>('/api/blacklist', {
    method: 'POST',
    body: JSON.stringify(entry),
  });
}

export async function removeBlacklistEntry(id: string): Promise<void> {
  await authFetch(`/api/blacklist/${id}`, { method: 'DELETE' });
}
