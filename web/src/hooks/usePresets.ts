'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchPresets, savePreset } from '@/lib/api';
import type { SavedFilterPreset, ScreenerFilters } from '@/types/index';

export interface UsePresetsResult {
  presets: SavedFilterPreset[];
  refreshPresets: () => Promise<void>;
  handleSavePreset: (name: string) => Promise<void>;
}

/** Saved filter presets. Self-loads when enabled. Depends on `filters` for saving. */
export function usePresets(enabled: boolean, filters: ScreenerFilters): UsePresetsResult {
  const [presets, setPresets] = useState<SavedFilterPreset[]>([]);

  const refreshPresets = useCallback(async (): Promise<void> => {
    try {
      setPresets(await fetchPresets());
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    refreshPresets();
  }, [enabled, refreshPresets]);

  const handleSavePreset = useCallback(async (name: string): Promise<void> => {
    const trimmed = name?.trim();
    if (!trimmed) return;
    try {
      await savePreset({ name: trimmed, filters });
      await refreshPresets();
    } catch (err) {
      console.error('Save preset failed:', err);
      throw err;
    }
  }, [filters, refreshPresets]);

  return { presets, refreshPresets, handleSavePreset };
}