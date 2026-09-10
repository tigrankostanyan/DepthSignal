// ==========================================
// USER SETTINGS API
// ==========================================

import type { UserSettings } from '@/types/index';
import { authFetch } from './api-core';

export async function fetchUserSettings(): Promise<UserSettings> {
  return authFetch<UserSettings>('/api/settings');
}

export async function updateUserSettings(patch: Partial<UserSettings>): Promise<UserSettings> {
  const res = await authFetch<{ status: string; settings: UserSettings }>('/api/settings', {
    method: 'POST',
    body: JSON.stringify(patch),
  });
  return res.settings;
}
