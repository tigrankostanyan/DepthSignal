'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiError, fetchWatchlists, toggleWatchlistSymbol } from '@/lib/api';
import type { ExchangeId, MarketType, Watchlist } from '@/types/index';

export interface UseWatchlistsResult {
  watchlists: Watchlist[];
  isSymbolWatchlisted: (symbol: string, exchange: ExchangeId, marketType: MarketType) => boolean;
  handleToggleWatchlist: (symbol: string, exchange: ExchangeId, marketType: MarketType) => Promise<boolean>;
  refreshWatchlists: () => Promise<void>;
}

/**
 * Watchlist state. Self-loads when enabled.
 *
 * `onPlanLimit` is called when the backend returns a plan-limit error so the
 * calling layer can open the pricing modal.
 */
export function useWatchlists(
  enabled: boolean,
  onPlanLimit: (resource: string) => void,
): UseWatchlistsResult {
  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);

  const refreshWatchlists = useCallback(async (): Promise<void> => {
    try {
      setWatchlists(await fetchWatchlists());
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    refreshWatchlists();
  }, [enabled, refreshWatchlists]);

  const isSymbolWatchlisted = useCallback(
    (symbol: string, exchange: ExchangeId, marketType: MarketType): boolean =>
      watchlists.some((wl) =>
        wl.items.some(
          (item) => item.symbol === symbol && item.exchange === exchange && item.marketType === marketType,
        ),
      ),
    [watchlists],
  );

  const handleToggleWatchlist = useCallback(
    async (symbol: string, exchange: ExchangeId, marketType: MarketType): Promise<boolean> => {
      const currentlyTracked = isSymbolWatchlisted(symbol, exchange, marketType);
      try {
        await toggleWatchlistSymbol(symbol, exchange, marketType, !currentlyTracked);
        await refreshWatchlists();
        return !currentlyTracked;
      } catch (err) {
        if (err instanceof ApiError && err.planLimit) {
          onPlanLimit(err.planLimit.resource);
        } else {
          console.error('Watchlist toggle failed:', err);
        }
        return currentlyTracked;
      }
    },
    [isSymbolWatchlisted, refreshWatchlists, onPlanLimit],
  );

  return { watchlists, isSymbolWatchlisted, handleToggleWatchlist, refreshWatchlists };
}