'use client';

import React, { useState, useEffect, useRef, useDeferredValue } from 'react';
import type {
  MarketTicker,
  ScreenerFilters,
  SavedFilterPreset,
  Watchlist,
  DetectedWall,
  BlacklistEntry,
  AlertTrigger,
  ExchangeId,
  MarketType,
} from '@/types/index';
import { FilterDrawer } from './FilterDrawer';
import { ScreenerHeader } from './ScreenerHeader';
import { ScreenerTable, WallSummary } from './ScreenerTable';
import { ScreenerBottomBar } from './ScreenerBottomBar';

interface MarketScreenerProps {
  tickers: MarketTicker[];
  filters: ScreenerFilters;
  setFilters: React.Dispatch<React.SetStateAction<ScreenerFilters>>;
  presets: SavedFilterPreset[];
  watchlists: Watchlist[];
  activeWalls: DetectedWall[];
  alertTriggers: AlertTrigger[];
  blacklist: BlacklistEntry[];
  onSelectSymbol: (symbol: string, exchange: ExchangeId, marketType: MarketType) => void;
  onToggleWatchlist: (symbol: string, exchange: ExchangeId, marketType: MarketType) => void;
  onSavePreset: (name: string) => void | Promise<void>;
}

const MarketScreenerComponent: React.FC<MarketScreenerProps> = ({
  tickers,
  filters,
  setFilters,
  presets,
  watchlists,
  activeWalls,
  alertTriggers,
  blacklist,
  onSelectSymbol,
  onToggleWatchlist,
  onSavePreset,
}) => {
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  // Unique live symbols ordered by aggregate 24h volume (used for coin picker options)
  const symbolOptions = React.useMemo(() => {
    const volBySymbol = new Map<string, number>();
    const order: string[] = [];
    for (const t of tickers) {
      const v = volBySymbol.get(t.symbol) ?? 0;
      if (v === 0) order.push(t.symbol);
      volBySymbol.set(t.symbol, v + t.volumeUsd);
    }
    return order.sort((a, b) => (volBySymbol.get(b) ?? 0) - (volBySymbol.get(a) ?? 0));
  }, [tickers]);

  // Track wall counts per symbol
  const deferredActiveWalls = useDeferredValue(activeWalls);
  const wallsBySymbol = React.useMemo(() => {
    const map = new Map<string, WallSummary>();
    for (const w of deferredActiveWalls) {
      const key = `${w.exchange}:${w.marketType}:${w.symbol}`;
      const entry = map.get(key) || { bidWalls: 0, askWalls: 0, walls: [] };
      if (w.side === 'BID') entry.bidWalls++;
      else entry.askWalls++;
      entry.walls.push(w);
      map.set(key, entry);
    }
    return map;
  }, [deferredActiveWalls]);

  // Watchlist membership set
  const watchlistedKeys = React.useMemo(() => {
    const set = new Set<string>();
    for (const wl of watchlists) {
      for (const item of wl.items) {
        set.add(`${item.exchange}:${item.marketType}:${item.symbol}`);
      }
    }
    return set;
  }, [watchlists]);

  // Latest alert trigger per symbol (for row coloring)
  const latestTriggerBySymbol = React.useMemo(() => {
    const map = new Map<string, AlertTrigger>();
    for (const t of alertTriggers) {
      const key = `${t.exchange}:${t.marketType}:${t.symbol}`;
      if (!map.has(key) || t.timestamp > map.get(key)!.timestamp) {
        map.set(key, t);
      }
    }
    return map;
  }, [alertTriggers]);


  const handleSort = (field: keyof MarketTicker) => {
    setFilters((prev) => ({
      ...prev,
      sortBy: field,
      sortOrder: prev.sortBy === field && prev.sortOrder === 'desc' ? 'asc' : 'desc',
    }));
  };

  // Computed and filtered tickers
  const deferredTickers = useDeferredValue(tickers);
  const baseFilteredSorted = React.useMemo(() => {
    let result = [...deferredTickers];

    // Filter by Market Type
    if (filters.marketType && filters.marketType !== 'ALL') {
      result = result.filter((t) => t.marketType === filters.marketType);
    }

    // Filter by Category
    if (filters.category && filters.category !== 'ALL') {
      const targetCat = filters.category === 'CRYPTO' ? 'CRYPTO' : 'STOCKS';
      result = result.filter((t) => t.category === targetCat);
    }

    // Filter by Search Query
    if (filters.searchQuery && filters.searchQuery.trim()) {
      const q = filters.searchQuery.toLowerCase().trim();
      result = result.filter(
        (t) =>
          t.symbol.toLowerCase().includes(q) ||
          (t.baseAsset && t.baseAsset.toLowerCase().includes(q)) ||
          (t.exchange && t.exchange.toLowerCase().includes(q)),
      );
    }

    // Filter by Exchanges
    if (filters.exchanges && filters.exchanges.length > 0) {
      result = result.filter((t) => filters.exchanges!.includes(t.exchange));
    }

    // Filter by Coins / Asset Pairs
    if (filters.symbols && filters.symbols.length > 0) {
      const symSet = new Set(filters.symbols);
      result = result.filter((t) => symSet.has(t.symbol));
    }

    // Filter by Only Watchlist
    if (filters.onlyWatchlist) {
      result = result.filter((t) => {
        const key = `${t.exchange}:${t.marketType}:${t.symbol}`;
        return watchlistedKeys.has(key);
      });
    }

    // Filter by Price min/max
    if (filters.priceMin !== undefined) {
      result = result.filter((t) => t.lastPrice >= filters.priceMin!);
    }
    if (filters.priceMax !== undefined) {
      result = result.filter((t) => t.lastPrice <= filters.priceMax!);
    }

    // Filter by Change min/max
    if (filters.changeMin !== undefined) {
      result = result.filter((t) => t.percentageChange >= filters.changeMin!);
    }
    if (filters.changeMax !== undefined) {
      result = result.filter((t) => t.percentageChange <= filters.changeMax!);
    }

    // Filter by 24h Volume (USD) range
    if (filters.volumeMinUsd !== undefined) {
      result = result.filter((t) => t.volumeUsd >= filters.volumeMinUsd!);
    }
    if (filters.volumeMaxUsd !== undefined) {
      result = result.filter((t) => t.volumeUsd <= filters.volumeMaxUsd!);
    }

    // Filter by RSI range
    if (filters.rsiMin !== undefined) {
      result = result.filter((t) => t.rsi !== undefined && t.rsi >= filters.rsiMin!);
    }
    if (filters.rsiMax !== undefined) {
      result = result.filter((t) => t.rsi !== undefined && t.rsi <= filters.rsiMax!);
    }

    // Filter by Moving Average distance
    if (filters.maDistanceType && (filters.maDistanceMin !== undefined || filters.maDistanceMax !== undefined)) {
      const maField =
        filters.maDistanceType === 'MA20' ? 'ma20Distance' : filters.maDistanceType === 'MA50' ? 'ma50Distance' : 'ma200Distance';
      if (filters.maDistanceMin !== undefined) {
        result = result.filter((t) => t[maField] !== undefined && t[maField]! >= filters.maDistanceMin!);
      }
      if (filters.maDistanceMax !== undefined) {
        result = result.filter((t) => t[maField] !== undefined && t[maField]! <= filters.maDistanceMax!);
      }
    }

    // Filter by ATH / ATL distance (percent from all-time high/low)
    if (filters.athDistanceMin !== undefined) {
      result = result.filter((t) => t.athDistance !== undefined && t.athDistance >= filters.athDistanceMin!);
    }
    if (filters.athDistanceMax !== undefined) {
      result = result.filter((t) => t.athDistance !== undefined && t.athDistance <= filters.athDistanceMax!);
    }
    if (filters.atlDistanceMin !== undefined) {
      result = result.filter((t) => t.atlDistance !== undefined && t.atlDistance >= filters.atlDistanceMin!);
    }
    if (filters.atlDistanceMax !== undefined) {
      result = result.filter((t) => t.atlDistance !== undefined && t.atlDistance <= filters.atlDistanceMax!);
    }

    // Filter by 24h volatility range
    if (filters.volatilityMin !== undefined) {
      result = result.filter((t) => t.volatility24h !== undefined && t.volatility24h >= filters.volatilityMin!);
    }
    if (filters.volatilityMax !== undefined) {
      result = result.filter((t) => t.volatility24h !== undefined && t.volatility24h <= filters.volatilityMax!);
    }

    // Filter by Volume Spike: 24h volume at least X% above the visible market average
    if (filters.volumeSpikeMinPercent !== undefined) {
      const avgVol = result.length ? result.reduce((sum, t) => sum + t.volumeUsd, 0) / result.length : 0;
      const mult = 1 + filters.volumeSpikeMinPercent / 100;
      result = result.filter((t) => avgVol > 0 && t.volumeUsd >= avgVol * mult);
    }

    // Filter by Stock Fundamentals
    if (filters.marketCapMin !== undefined) {
      result = result.filter((t) => t.marketCap !== undefined && t.marketCap >= filters.marketCapMin!);
    }
    if (filters.marketCapMax !== undefined) {
      result = result.filter((t) => t.marketCap !== undefined && t.marketCap <= filters.marketCapMax!);
    }
    if (filters.peRatioMin !== undefined) {
      result = result.filter((t) => t.peRatio !== undefined && t.peRatio >= filters.peRatioMin!);
    }
    if (filters.peRatioMax !== undefined) {
      result = result.filter((t) => t.peRatio !== undefined && t.peRatio <= filters.peRatioMax!);
    }

    // Filter out blacklisted instruments (global exclusion)
    if (filters.hideBlacklisted && blacklist.length > 0) {
      result = result.filter((t) => {
        return !blacklist.some(
          (b) =>
            (!b.symbol || b.symbol === t.symbol) &&
            (!b.exchange || b.exchange === t.exchange) &&
            (!b.category || b.category === t.category),
        );
      });
    }

    // Sorting — starred (watchlisted) instruments are always pinned to the top,
    // then the rest follow the active sort column.
    result.sort((a, b) => {
      const aWatchlisted = watchlistedKeys.has(`${a.exchange}:${a.marketType}:${a.symbol}`);
      const bWatchlisted = watchlistedKeys.has(`${b.exchange}:${b.marketType}:${b.symbol}`);
      if (aWatchlisted !== bWatchlisted) {
        return aWatchlisted ? -1 : 1;
      }

      const field = filters.sortBy || 'volumeUsd';
      let valA: unknown = a[field as keyof MarketTicker];
      let valB: unknown = b[field as keyof MarketTicker];

      if (field === 'percentageChange' && filters.timeframe) {
        valA =
          a.changesByTimeframe && a.changesByTimeframe[filters.timeframe] !== undefined
            ? a.changesByTimeframe[filters.timeframe]!
            : a.percentageChange;
        valB =
          b.changesByTimeframe && b.changesByTimeframe[filters.timeframe] !== undefined
            ? b.changesByTimeframe[filters.timeframe]!
            : b.percentageChange;
      }

      if (typeof valA === 'string') {
        return filters.sortOrder === 'asc' ? valA.localeCompare(String(valB)) : String(valB).localeCompare(valA);
      }

      const numA = Number(valA) || 0;
      const numB = Number(valB) || 0;

      return filters.sortOrder === 'asc' ? numA - numB : numB - numA;
    });

    return result;
    // NOTE: `wallsBySymbol` is intentionally NOT a dependency — walls are applied in
    // the separate cheap pass below, so wall events never re-run filter + sort.
  }, [deferredTickers, filters, watchlistedKeys, blacklist]);

  // Walls pass: applied only when the "only with walls" filter is active. This is an
  // O(n) Map lookup pass and does not re-sort the universe on every wall event.
  const filteredAndSortedTickers = React.useMemo(() => {
    if (!filters.onlyWithWalls) return baseFilteredSorted;
    return baseFilteredSorted.filter((t) => {
      const wallData = wallsBySymbol.get(`${t.exchange}:${t.marketType}:${t.symbol}`);
      return Boolean(wallData && wallData.bidWalls + wallData.askWalls > 0);
    });
  }, [baseFilteredSorted, filters.onlyWithWalls, wallsBySymbol]);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-primary">
      {/* Screener Controls Header */}
      <div className="flex-none">
        <ScreenerHeader
          filters={filters}
          setFilters={setFilters}
          presets={presets}
          onOpenFilterDrawer={() => setIsFilterDrawerOpen(true)}
        />
      </div>

      {/* Main High-Density Market Table Container */}
      <div className="flex-1 overflow-auto min-h-0 bg-card m-3 rounded-lg border border-divider flex flex-col">
        <ScreenerTable
          tickers={filteredAndSortedTickers}
          filters={filters}
          watchlistedKeys={watchlistedKeys}
          wallsBySymbol={wallsBySymbol}
          latestTriggerBySymbol={latestTriggerBySymbol}
          onSort={handleSort}
          onSelectSymbol={onSelectSymbol}
          onToggleWatchlist={onToggleWatchlist}
        />

        {/* Table Bottom Status / Pagination */}
        <ScreenerBottomBar
          shownCount={filteredAndSortedTickers.length}
          totalCount={tickers.length}
          filters={filters}
        />
      </div>

      {/* Filter Drawer */}
      <FilterDrawer
        isOpen={isFilterDrawerOpen}
        onClose={() => setIsFilterDrawerOpen(false)}
        filters={filters}
        setFilters={setFilters}
        presets={presets}
        onApplyPreset={(p) => {
          setFilters((prev) => ({ ...prev, ...p.filters }));
          setIsFilterDrawerOpen(false);
        }}
        onSaveCurrentPreset={onSavePreset}
        symbolOptions={symbolOptions}
      />
    </div>
  );
};

// Memoized so unrelated context/parent re-renders don't re-render the heavy screener.
export const MarketScreener = React.memo(MarketScreenerComponent);
