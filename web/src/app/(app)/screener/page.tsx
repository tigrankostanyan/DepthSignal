'use client';

import React from 'react';
import { MarketScreener } from '@/components/Screener/MarketScreener';
import { useApp, useRealtimeData } from '@/providers/AppProviders';

export default function ScreenerPage() {
  const {
    filters,
    setFilters,
    presets,
    watchlists,
    blacklist,
    openSymbolFocus,
    handleToggleWatchlist,
    handleSavePreset,
  } = useApp();
  const { tickers, activeWalls, alertTriggers } = useRealtimeData();

  return (
    <MarketScreener
      tickers={tickers}
      filters={filters}
      setFilters={setFilters}
      presets={presets}
      watchlists={watchlists}
      activeWalls={activeWalls}
      alertTriggers={alertTriggers}
      blacklist={blacklist}
      onSelectSymbol={openSymbolFocus}
      onToggleWatchlist={handleToggleWatchlist}
      onSavePreset={handleSavePreset}
    />
  );
}
