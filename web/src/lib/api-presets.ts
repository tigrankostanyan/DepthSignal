// ==========================================
// SCREENER PRESETS API
// ==========================================

import type { SavedFilterPreset } from '@/types/index';
import { authFetch, safeFetch } from './api-core';

export async function fetchPresets(): Promise<SavedFilterPreset[]> {
  return safeFetch<SavedFilterPreset[]>('/api/presets', undefined, []);
}

export async function savePreset(preset: Partial<SavedFilterPreset>): Promise<SavedFilterPreset> {
  return authFetch<SavedFilterPreset>('/api/presets', {
    method: 'POST',
    body: JSON.stringify(preset),
  });
}
