// ==========================================
// WATCHLISTS API
// ==========================================

import type { ExchangeId, MarketType, Watchlist, WatchlistItem } from '@/types/index';
import { authFetch, safeFetch } from './api-core';

export async function fetchWatchlists(): Promise<Watchlist[]> {
  return safeFetch<Watchlist[]>('/api/watchlists', undefined, []);
}

export async function addWatchlistItem(
  watchlistId: string,
  item: { symbol: string; exchange: ExchangeId; marketType: MarketType; notes?: string },
): Promise<WatchlistItem> {
  return authFetch<WatchlistItem>(`/api/watchlists/${watchlistId}/items`, {
    method: 'POST',
    body: JSON.stringify(item),
  });
}

export async function removeWatchlistItem(
  watchlistId: string,
  item: { symbol: string; exchange: ExchangeId; marketType: MarketType },
): Promise<void> {
  await authFetch(`/api/watchlists/${watchlistId}/items`, {
    method: 'DELETE',
    body: JSON.stringify(item),
  });
}

export async function toggleWatchlistSymbol(
  symbol: string,
  exchange: ExchangeId,
  marketType: MarketType,
  add: boolean,
): Promise<void> {
  const wls = await fetchWatchlists();
  const target = wls[0];
  if (!target) throw new Error('No watchlist available');
  if (add) {
    await addWatchlistItem(target.id, { symbol, exchange, marketType });
  } else {
    await removeWatchlistItem(target.id, { symbol, exchange, marketType });
  }
}
