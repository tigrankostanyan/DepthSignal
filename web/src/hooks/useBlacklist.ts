'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiError, addBlacklistEntry, fetchBlacklist, removeBlacklistEntry } from '@/lib/api';
import type { ActionResult, BlacklistEntry } from '@/types/index';

export interface UseBlacklistResult {
  blacklist: BlacklistEntry[];
  handleAddBlacklist: (entry: Omit<BlacklistEntry, 'id' | 'addedAt'>) => Promise<ActionResult>;
  handleRemoveBlacklist: (id: string) => Promise<void>;
}

/** Blacklist state. Self-loads when enabled. */
export function useBlacklist(enabled: boolean): UseBlacklistResult {
  const [blacklist, setBlacklist] = useState<BlacklistEntry[]>([]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    fetchBlacklist()
      .then((d) => !cancelled && setBlacklist(d))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const handleAddBlacklist = useCallback(
    async (entry: Omit<BlacklistEntry, 'id' | 'addedAt'>): Promise<ActionResult> => {
      try {
        const created = await addBlacklistEntry(entry);
        setBlacklist((prev) => [...prev, created]);
        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          error:
            err instanceof ApiError && err.planLimit
              ? err.planLimit.resource
              : err instanceof Error
                ? err.message
                : 'Failed to add blacklist entry',
        };
      }
    },
    [],
  );

  const handleRemoveBlacklist = useCallback(async (id: string): Promise<void> => {
    try {
      await removeBlacklistEntry(id);
      setBlacklist((prev) => prev.filter((entry) => entry.id !== id));
    } catch (err) {
      console.error('Blacklist remove failed:', err);
    }
  }, []);

  return { blacklist, handleAddBlacklist, handleRemoveBlacklist };
}