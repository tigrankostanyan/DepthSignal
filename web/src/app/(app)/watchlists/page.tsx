'use client';

import React from 'react';
import { WatchlistView } from '@/components/Watchlists/WatchlistView';
import { useApp, useRealtimeData } from '@/providers/AppProviders';
import { addWatchlistItem, removeWatchlistItem } from '@/lib/api';
import type { ExchangeId, MarketType } from '@/types/index';

export default function WatchlistsPage() {
  const { watchlists, openSymbolFocus, refreshWatchlists } = useApp();
  const { tickers } = useRealtimeData();

  const handleRemoveItem = async (watchlistId: string, symbol: string, exchange: string, marketType: string) => {
    try {
      await removeWatchlistItem(watchlistId, {
        symbol,
        exchange: exchange as ExchangeId,
        marketType: marketType as MarketType,
      });
      await refreshWatchlists();
    } catch (err) {
      console.error('Watchlist remove failed:', err);
    }
  };

  const handleAddItem = async (watchlistId: string, symbol: string, exchange: string, marketType: string) => {
    try {
      await addWatchlistItem(watchlistId, {
        symbol,
        exchange: exchange as ExchangeId,
        marketType: marketType as MarketType,
      });
      await refreshWatchlists();
    } catch (err) {
      console.error('Watchlist add failed:', err);
    }
  };

  return (
    <WatchlistView
      watchlists={watchlists}
      tickers={tickers}
      onSelectSymbol={openSymbolFocus}
      onRemoveItem={handleRemoveItem}
      onAddItem={handleAddItem}
    />
  );
}
