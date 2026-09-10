'use client';

import React, { useState } from 'react';
import { X, RotateCcw, Check, Search } from 'lucide-react';
import type { SavedFilterPreset, ScreenerFilters, ExchangeId } from '@/types/index';
import { TIMEFRAMES, DEFAULT_SCREENER_FILTERS, ALL_EXCHANGES, EXCHANGE_LABELS } from '@/lib/constants';
import { FormField } from '@/components/ui/FormField';
import { FilterPresets } from './FilterPresets';
import { FilterRangeField } from './FilterRangeField';
import { FilterNumberField } from './FilterNumberField';
import { FilterToggleRow } from './FilterToggleRow';

interface FilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  filters: ScreenerFilters;
  setFilters: React.Dispatch<React.SetStateAction<ScreenerFilters>>;
  presets: SavedFilterPreset[];
  onApplyPreset: (preset: SavedFilterPreset) => void;
  onSaveCurrentPreset: (name: string) => void | Promise<void>;
  symbolOptions?: string[];
}

const inputCls =
  'bg-primary border border-divider rounded px-2.5 py-1.5 text-main text-xs font-mono focus:border-[#168FD6] focus:outline-none';

export const FilterDrawer: React.FC<FilterDrawerProps> = ({
  isOpen,
  onClose,
  filters,
  setFilters,
  presets,
  onApplyPreset,
  onSaveCurrentPreset,
  symbolOptions = [],
}) => {
  const [symQuery, setSymQuery] = useState('');

  if (!isOpen) return null;

  const handleReset = () => {
    setSymQuery('');
    setFilters({ ...DEFAULT_SCREENER_FILTERS });
  };

  const selectedExchanges = filters.exchanges ?? [];
  const selectedSymbols = filters.symbols ?? [];

  const toggleExchange = (ex: ExchangeId) => {
    setFilters((prev) => {
      const cur = prev.exchanges ?? [];
      return {
        ...prev,
        exchanges: cur.includes(ex) ? cur.filter((x) => x !== ex) : [...cur, ex],
      };
    });
  };

  const toggleSymbol = (sym: string) => {
    setFilters((prev) => {
      const cur = prev.symbols ?? [];
      return {
        ...prev,
        symbols: cur.includes(sym) ? cur.filter((s) => s !== sym) : [...cur, sym],
      };
    });
  };

  // Available symbols pre-sorted by volume (from live tickers), narrowed by search box.
  const q = symQuery.trim().toUpperCase();
  const filteredSymbols = q ? symbolOptions.filter((s) => s.includes(q)) : symbolOptions;
  const visibleSymbols = filteredSymbols.slice(0, 120);

  return (
    <div className="fixed inset-y-0 right-0 w-80 sm:w-96 bg-card border-l border-divider shadow-2xl z-50 flex flex-col text-xs select-none">
      {/* Header */}
      <div className="p-4 border-b border-divider flex items-center justify-between bg-surface">
        <span className="font-bold text-white text-sm">Advanced Screener Filters</span>
        <button
          onClick={onClose}
          className="p-1.5 rounded hover:bg-panel text-muted hover:text-white transition cursor-pointer"
        >
          <X size={16} />
        </button>
      </div>

      {/* Preset Quick Select */}
      <FilterPresets
        presets={presets}
        onApplyPreset={onApplyPreset}
        onSaveCurrentPreset={onSaveCurrentPreset}
      />

      {/* Scrollable Filters Body */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-card">
        {/* ── Exchange Filter ── */}
        <FormField
          label="Exchanges"
          hint={selectedExchanges.length === 0 ? 'All exchanges included' : `${selectedExchanges.length} of ${ALL_EXCHANGES.length} selected`}
        >
          <div className="flex flex-wrap gap-1">
            {ALL_EXCHANGES.map((ex) => {
              const active = selectedExchanges.includes(ex);
              return (
                <button
                  key={ex}
                  type="button"
                  onClick={() => toggleExchange(ex)}
                  className={`px-2 py-1 rounded text-[10px] font-bold transition cursor-pointer border ${
                    active
                      ? 'bg-[#168FD6] text-white border-[#24C4E8]'
                      : 'bg-primary text-muted hover:text-white border-divider'
                  }`}
                >
                  {EXCHANGE_LABELS[ex]}
                </button>
              );
            })}
          </div>
        </FormField>

        {/* ── Coin / Asset Pair Filter ── */}
        <FormField
          label={`Coins / Asset Pairs${selectedSymbols.length > 0 ? ` (${selectedSymbols.length})` : ''}`}
          hint={selectedSymbols.length === 0 ? 'All instruments included' : 'Only selected pairs are shown'}
        >
          {/* Selected chips */}
          {selectedSymbols.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-1.5">
              {selectedSymbols.map((sym) => (
                <span
                  key={sym}
                  className="flex items-center space-x-1 pl-2 pr-1 py-0.5 rounded bg-accent/15 border border-[#24C4E8]/40 text-[#24C4E8] font-mono font-bold text-[10px]"
                >
                  <span>{sym}</span>
                  <button
                    type="button"
                    onClick={() => toggleSymbol(sym)}
                    className="p-0.5 rounded hover:bg-accent/30 text-current cursor-pointer"
                    aria-label={`Remove ${sym}`}
                  >
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Search input */}
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder="Search symbol (e.g. BTC)"
              value={symQuery}
              onChange={(e) => setSymQuery(e.target.value)}
              className="w-full bg-primary border border-divider rounded px-2.5 py-1.5 pl-7 text-main text-xs font-mono focus:border-[#168FD6] focus:outline-none"
            />
          </div>

          {/* Symbol pick list */}
          <div className="mt-1.5 max-h-40 overflow-y-auto border border-divider rounded bg-primary">
            {visibleSymbols.length === 0 ? (
              <div className="p-3 text-center text-[#5A6E85] text-[11px]">
                {q ? `No symbols matching "${symQuery}"` : 'Loading live instruments…'}
              </div>
            ) : (
              visibleSymbols.map((sym) => {
                const active = selectedSymbols.includes(sym);
                return (
                  <button
                    key={sym}
                    type="button"
                    onClick={() => toggleSymbol(sym)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 text-left transition cursor-pointer hover:bg-surface ${
                      active ? 'bg-accent/10 text-accent' : 'text-main'
                    }`}
                  >
                    <span className="font-mono text-[11px] font-bold">{sym}</span>
                    <span
                      className={`w-3.5 h-3.5 rounded flex items-center justify-center border transition ${
                        active ? 'bg-[#168FD6] border-[#24C4E8] text-white' : 'border-divider text-transparent'
                      }`}
                    >
                      <Check size={10} strokeWidth={3} />
                    </span>
                  </button>
                );
              })
            )}
          </div>
          {filteredSymbols.length > 120 && (
            <p className="text-[10px] text-[#5A6E85] mt-1">
              Showing top 120 of {filteredSymbols.length} — type to narrow.
            </p>
          )}
        </FormField>

        <FormField label="Evaluation Timeframe">
          <div className="grid grid-cols-4 gap-1">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf}
                onClick={() => setFilters((prev) => ({ ...prev, timeframe: tf }))}
                className={`py-1.5 text-center font-mono font-bold rounded text-xs transition cursor-pointer ${
                  filters.timeframe === tf
                    ? 'bg-[#168FD6] text-white'
                    : 'bg-primary text-muted hover:text-white border border-divider'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </FormField>

        <FilterRangeField
          label={`% Movement Range (${filters.timeframe})`}
          minKey="changeMin"
          maxKey="changeMax"
          placeholderMin="Min % (e.g. -5)"
          placeholderMax="Max % (e.g. 10)"
          filters={filters}
          setFilters={setFilters}
        />

        <FilterRangeField
          label="Price Range ($)"
          minKey="priceMin"
          maxKey="priceMax"
          placeholderMin="Min Price"
          placeholderMax="Max Price"
          filters={filters}
          setFilters={setFilters}
        />

        <FilterNumberField
          label="24h USD Volume Min ($)"
          fieldKey="volumeMinUsd"
          placeholder="Min Volume (e.g. 50000000)"
          filters={filters}
          setFilters={setFilters}
        />

        <FilterRangeField
          label="RSI (14) Range"
          minKey="rsiMin"
          maxKey="rsiMax"
          placeholderMin="Min RSI (e.g. 30)"
          placeholderMax="Max RSI (e.g. 70)"
          filters={filters}
          setFilters={setFilters}
        />

        <FormField label="Distance from Moving Average (%)">
          <div className="flex items-center space-x-1.5 mb-1.5">
            {(['MA20', 'MA50', 'MA200'] as const).map((ma) => (
              <button
                key={ma}
                onClick={() => setFilters((prev) => ({ ...prev, maDistanceType: ma }))}
                className={`px-2 py-1 rounded font-mono font-bold text-[10px] transition cursor-pointer ${
                  filters.maDistanceType === ma
                    ? 'bg-[#168FD6] text-white'
                    : 'bg-primary text-muted hover:text-white border border-divider'
                }`}
              >
                {ma}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              placeholder="Min dist %"
              value={filters.maDistanceMin ?? ''}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  maDistanceMin: e.target.value ? parseFloat(e.target.value) : undefined,
                }))
              }
              className={inputCls}
            />
            <input
              type="number"
              placeholder="Max dist %"
              value={filters.maDistanceMax ?? ''}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  maDistanceMax: e.target.value ? parseFloat(e.target.value) : undefined,
                }))
              }
              className={inputCls}
            />
          </div>
        </FormField>

        <FilterRangeField
          label="Distance from ATH (%) (e.g. 5 = -95% below ATH)"
          minKey="athDistanceMin"
          maxKey="athDistanceMax"
          placeholderMin="Min ATH dist"
          placeholderMax="Max ATH dist"
          filters={filters}
          setFilters={setFilters}
        />

        <FilterRangeField
          label="Distance from ATL (%)"
          minKey="atlDistanceMin"
          maxKey="atlDistanceMax"
          placeholderMin="Min ATL dist"
          placeholderMax="Max ATL dist"
          filters={filters}
          setFilters={setFilters}
        />

        <FilterRangeField
          label="24h Volatility Range (%)"
          minKey="volatilityMin"
          maxKey="volatilityMax"
          placeholderMin="Min Volatility"
          placeholderMax="Max Volatility"
          filters={filters}
          setFilters={setFilters}
        />

        <FilterNumberField
          label="Volume Spike (% above market avg)"
          fieldKey="volumeSpikeMinPercent"
          placeholder="e.g. 300 = 3x average volume"
          filters={filters}
          setFilters={setFilters}
        />

        <FilterRangeField
          label="Market Cap Range ($) — Equities"
          minKey="marketCapMin"
          maxKey="marketCapMax"
          placeholderMin="Min Market Cap"
          placeholderMax="Max Market Cap"
          filters={filters}
          setFilters={setFilters}
        />

        <FilterRangeField
          label="P/E Ratio Range — Equities"
          minKey="peRatioMin"
          maxKey="peRatioMax"
          placeholderMin="Min P/E"
          placeholderMax="Max P/E"
          filters={filters}
          setFilters={setFilters}
        />

        {/* Special Toggles */}
        <div className="pt-2 border-t border-divider space-y-2">
          <FilterToggleRow
            label="Only show instruments with Active Walls"
            checked={filters.onlyWithWalls ?? false}
            onChange={(checked) => setFilters((prev) => ({ ...prev, onlyWithWalls: checked }))}
          />
          <FilterToggleRow
            label="Only Watchlist symbols"
            checked={filters.onlyWatchlist ?? false}
            onChange={(checked) => setFilters((prev) => ({ ...prev, onlyWatchlist: checked }))}
          />
          <FilterToggleRow
            label="Hide blacklisted instruments"
            checked={filters.hideBlacklisted ?? true}
            onChange={(checked) => setFilters((prev) => ({ ...prev, hideBlacklisted: checked }))}
          />
        </div>
      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t border-divider bg-surface flex items-center justify-between">
        <button
          onClick={handleReset}
          className="flex items-center space-x-1.5 text-muted hover:text-white font-semibold transition cursor-pointer"
        >
          <RotateCcw size={14} />
          <span>Reset All</span>
        </button>
        <button
          onClick={onClose}
          className="px-4 py-1.5 rounded-lg bg-[#168FD6] hover:bg-[#1C9AE5] text-white font-bold transition shadow-md shadow-[#168FD6]/20 cursor-pointer active:scale-95"
        >
          Apply Filters
        </button>
      </div>
    </div>
  );
};
