'use client';

import React from 'react';
import { Filter, Clock, Sparkles } from 'lucide-react';
import type { ScreenerFilters, SavedFilterPreset, Timeframe } from '@/types/index';
import { TIMEFRAMES, MARKET_TYPES, ASSET_CATEGORIES } from '@/lib/constants';

interface ScreenerHeaderProps {
  filters: ScreenerFilters;
  setFilters: React.Dispatch<React.SetStateAction<ScreenerFilters>>;
  presets: SavedFilterPreset[];
  onOpenFilterDrawer: () => void;
}

export const ScreenerHeader: React.FC<ScreenerHeaderProps> = ({
  filters,
  setFilters,
  presets,
  onOpenFilterDrawer,
}) => {
  const hasActiveFilters =
    filters.onlyWithWalls ||
    filters.onlyWatchlist ||
    filters.priceMin !== undefined ||
    filters.changeMin !== undefined ||
    filters.volumeMinUsd !== undefined ||
    filters.rsiMin !== undefined ||
    filters.maDistanceMin !== undefined ||
    filters.athDistanceMin !== undefined ||
    filters.volatilityMin !== undefined ||
    filters.volumeSpikeMinPercent !== undefined ||
    filters.marketCapMin !== undefined;

  return (
    <div className="p-3 border-b border-divider bg-card flex flex-wrap items-center justify-between gap-3 select-none flex-none">
      {/* Left: Quick Category & Market Type Selectors */}
      <div className="flex items-center space-x-2">
        {/* Market Type Segment */}
        <div className="flex items-center bg-card rounded border border-divider p-0.5">
          {(['ALL', 'SPOT', 'FUTURES'] as const).map((mType) => (
            <button
              key={mType}
              onClick={() => setFilters((prev) => ({ ...prev, marketType: mType }))}
              className={`px-3 py-1 text-xs rounded font-medium transition ${
                filters.marketType === mType ? 'bg-panel text-white shadow-sm' : 'text-muted hover:text-white'
              }`}
            >
              {mType === 'FUTURES' ? 'USDT-M Futures' : mType === 'SPOT' ? 'Spot Markets' : 'All Markets'}
            </button>
          ))}
        </div>

        {/* Asset Category Segment */}
        <div className="flex items-center bg-card rounded border border-divider p-0.5">
          {(['ALL', ...ASSET_CATEGORIES] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => setFilters((prev) => ({ ...prev, category: cat }))}
              className={`px-3 py-1 rounded text-xs font-medium transition ${
                filters.category === cat ? 'bg-panel text-accent shadow-sm' : 'text-muted hover:text-white'
              }`}
            >
              {cat === 'ALL' ? 'All Classes' : cat === 'CRYPTO' ? 'Crypto' : 'US Equities'}
            </button>
          ))}
        </div>

        {/* Timeframe Selector for % Change Column */}
        <div className="flex items-center space-x-1.5 bg-card rounded px-2.5 py-1 border border-divider text-xs">
          <Clock size={12} className="text-muted" />
          <span className="text-muted text-[11px]">TF:</span>
          <select
            value={filters.timeframe}
            onChange={(e) => setFilters((prev) => ({ ...prev, timeframe: e.target.value as Timeframe }))}
            className="bg-transparent text-accent font-mono font-bold focus:outline-none cursor-pointer"
          >
            {TIMEFRAMES.map((tf) => (
              <option key={tf} value={tf} className="bg-card text-main">
                {tf}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Right: Presets + Filter Drawer Trigger */}
      <div className="flex items-center space-x-2">
        {/* Quick Presets Pills */}
        <div className="hidden xl:flex items-center space-x-1.5">
          {presets.slice(0, 3).map((p) => (
            <button
              key={p.id}
              onClick={() => setFilters((prev) => ({ ...prev, ...p.filters }))}
              className="px-2.5 py-1 rounded text-[11px] font-medium bg-surface hover:bg-panel text-muted hover:text-white border border-divider transition flex items-center space-x-1"
            >
              <Sparkles size={11} className="text-accent" />
              <span>{p.name}</span>
            </button>
          ))}
        </div>

        {/* Filter Drawer Button */}
        <button
          onClick={onOpenFilterDrawer}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition border cursor-pointer ${
            hasActiveFilters
              ? 'bg-[#168FD6] text-white border-[#24C4E8] font-bold shadow-sm shadow-[#168FD6]/20'
              : 'bg-surface hover:bg-panel text-muted hover:text-white border-divider'
          }`}
        >
          <Filter size={13} className={hasActiveFilters ? 'text-white' : 'text-muted'} />
          <span>Filters</span>
          {hasActiveFilters && <span className="w-2 h-2 rounded-full bg-[#24C4E8] ml-1 shadow-[0_0_6px_#24C4E8]" />}
        </button>
      </div>
    </div>
  );
};
