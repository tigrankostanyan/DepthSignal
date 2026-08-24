import React from 'react';
import { X, RotateCcw, Bookmark } from 'lucide-react';
import { SavedFilterPreset, ScreenerFilters, Timeframe } from '../../types/index.js';

interface FilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  filters: ScreenerFilters;
  setFilters: React.Dispatch<React.SetStateAction<ScreenerFilters>>;
  presets: SavedFilterPreset[];
  onApplyPreset: (preset: SavedFilterPreset) => void;
  onSaveCurrentPreset: () => void;
}

export const FilterDrawer: React.FC<FilterDrawerProps> = ({
  isOpen,
  onClose,
  filters,
  setFilters,
  presets,
  onApplyPreset,
  onSaveCurrentPreset
}) => {
  if (!isOpen) return null;

  const handleReset = () => {
    setFilters(prev => ({
      ...prev,
      category: 'ALL',
      marketType: 'ALL',
      priceMin: undefined,
      priceMax: undefined,
      changeMin: undefined,
      changeMax: undefined,
      volumeMinUsd: undefined,
      volumeMaxUsd: undefined,
      rsiMin: undefined,
      rsiMax: undefined,
      onlyWithWalls: false,
      onlyWatchlist: false,
      timeframe: '1d'
    }));
  };

  const timeframes: Timeframe[] = ['30s', '1m', '5m', '15m', '1h', '4h', '1d'];

  return (
    <div className="fixed inset-y-0 right-0 w-80 sm:w-96 bg-[#181A20] border-l border-[#2B2F36] shadow-2xl z-50 flex flex-col text-xs select-none">
      {/* Header */}
      <div className="p-4 border-b border-[#2B2F36] flex items-center justify-between bg-[#1E2329]">
        <div className="flex items-center space-x-2">
          <span className="font-bold text-white text-sm">Advanced Screener Filters</span>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded hover:bg-[#2B2F36] text-[#848E9C] hover:text-white transition"
        >
          <X size={16} />
        </button>
      </div>

      {/* Preset Quick Select */}
      <div className="p-4 border-b border-[#2B2F36] bg-[#181A20]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold text-[#848E9C] uppercase tracking-wider">Saved Filter Presets</span>
          <button
            onClick={onSaveCurrentPreset}
            className="flex items-center space-x-1 text-[#F0B90B] hover:text-[#dfa700] font-semibold text-[11px] transition"
          >
            <Bookmark size={12} />
            <span>Save Current</span>
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {presets.map(p => (
            <button
              key={p.id}
              onClick={() => onApplyPreset(p)}
              className="px-2.5 py-1 rounded bg-[#1E2329] hover:bg-[#2B2F36] text-[#848E9C] hover:text-white border border-[#2B2F36] text-xs font-medium transition"
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable Filters Body */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-[#181A20]">
        {/* Timeframe for % Movement */}
        <div>
          <label className="block text-[11px] font-bold text-[#848E9C] uppercase tracking-wider mb-1.5">
            Evaluation Timeframe
          </label>
          <div className="grid grid-cols-4 gap-1">
            {timeframes.map(tf => (
              <button
                key={tf}
                onClick={() => setFilters(prev => ({ ...prev, timeframe: tf }))}
                className={`py-1.5 text-center font-mono font-bold rounded text-xs transition ${
                  filters.timeframe === tf
                    ? 'bg-[#F0B90B] text-black'
                    : 'bg-[#0B0E11] text-[#848E9C] hover:text-white border border-[#2B2F36]'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>

        {/* % Movement Range */}
        <div>
          <label className="block text-[11px] font-bold text-[#848E9C] uppercase tracking-wider mb-1.5">
            % Movement Range ({filters.timeframe})
          </label>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              placeholder="Min % (e.g. -5)"
              value={filters.changeMin ?? ''}
              onChange={(e) => setFilters(prev => ({ ...prev, changeMin: e.target.value ? parseFloat(e.target.value) : undefined }))}
              className="bg-[#0B0E11] border border-[#2B2F36] rounded px-2.5 py-1.5 text-[#EAECEF] text-xs font-mono focus:border-[#F0B90B] focus:outline-none"
            />
            <input
              type="number"
              placeholder="Max % (e.g. 10)"
              value={filters.changeMax ?? ''}
              onChange={(e) => setFilters(prev => ({ ...prev, changeMax: e.target.value ? parseFloat(e.target.value) : undefined }))}
              className="bg-[#0B0E11] border border-[#2B2F36] rounded px-2.5 py-1.5 text-[#EAECEF] text-xs font-mono focus:border-[#F0B90B] focus:outline-none"
            />
          </div>
        </div>

        {/* Price Range */}
        <div>
          <label className="block text-[11px] font-bold text-[#848E9C] uppercase tracking-wider mb-1.5">
            Price Range ($)
          </label>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              placeholder="Min Price"
              value={filters.priceMin ?? ''}
              onChange={(e) => setFilters(prev => ({ ...prev, priceMin: e.target.value ? parseFloat(e.target.value) : undefined }))}
              className="bg-[#0B0E11] border border-[#2B2F36] rounded px-2.5 py-1.5 text-[#EAECEF] text-xs font-mono focus:border-[#F0B90B] focus:outline-none"
            />
            <input
              type="number"
              placeholder="Max Price"
              value={filters.priceMax ?? ''}
              onChange={(e) => setFilters(prev => ({ ...prev, priceMax: e.target.value ? parseFloat(e.target.value) : undefined }))}
              className="bg-[#0B0E11] border border-[#2B2F36] rounded px-2.5 py-1.5 text-[#EAECEF] text-xs font-mono focus:border-[#F0B90B] focus:outline-none"
            />
          </div>
        </div>

        {/* 24h USD Volume */}
        <div>
          <label className="block text-[11px] font-bold text-[#848E9C] uppercase tracking-wider mb-1.5">
            24h USD Volume Min ($)
          </label>
          <input
            type="number"
            placeholder="Min Volume (e.g. 50000000)"
            value={filters.volumeMinUsd ?? ''}
            onChange={(e) => setFilters(prev => ({ ...prev, volumeMinUsd: e.target.value ? parseFloat(e.target.value) : undefined }))}
            className="w-full bg-[#0B0E11] border border-[#2B2F36] rounded px-2.5 py-1.5 text-[#EAECEF] text-xs font-mono focus:border-[#F0B90B] focus:outline-none"
          />
        </div>

        {/* RSI 14 Range */}
        <div>
          <label className="block text-[11px] font-bold text-[#848E9C] uppercase tracking-wider mb-1.5">
            RSI (14) Range
          </label>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              placeholder="Min RSI (e.g. 30)"
              value={filters.rsiMin ?? ''}
              onChange={(e) => setFilters(prev => ({ ...prev, rsiMin: e.target.value ? parseFloat(e.target.value) : undefined }))}
              className="bg-[#0B0E11] border border-[#2B2F36] rounded px-2.5 py-1.5 text-[#EAECEF] text-xs font-mono focus:border-[#F0B90B] focus:outline-none"
            />
            <input
              type="number"
              placeholder="Max RSI (e.g. 70)"
              value={filters.rsiMax ?? ''}
              onChange={(e) => setFilters(prev => ({ ...prev, rsiMax: e.target.value ? parseFloat(e.target.value) : undefined }))}
              className="bg-[#0B0E11] border border-[#2B2F36] rounded px-2.5 py-1.5 text-[#EAECEF] text-xs font-mono focus:border-[#F0B90B] focus:outline-none"
            />
          </div>
        </div>

        {/* Special Toggles */}
        <div className="pt-2 border-t border-[#2B2F36] space-y-2">
          <label className="flex items-center space-x-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.onlyWithWalls || false}
              onChange={(e) => setFilters(prev => ({ ...prev, onlyWithWalls: e.target.checked }))}
              className="rounded bg-[#0B0E11] border-[#2B2F36] text-[#F0B90B] focus:ring-0 w-4 h-4"
            />
            <span className="text-[#EAECEF] font-medium">Only show instruments with Active Walls</span>
          </label>

          <label className="flex items-center space-x-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.onlyWatchlist || false}
              onChange={(e) => setFilters(prev => ({ ...prev, onlyWatchlist: e.target.checked }))}
              className="rounded bg-[#0B0E11] border-[#2B2F36] text-[#F0B90B] focus:ring-0 w-4 h-4"
            />
            <span className="text-[#EAECEF] font-medium">Only Watchlist symbols</span>
          </label>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t border-[#2B2F36] bg-[#1E2329] flex items-center justify-between">
        <button
          onClick={handleReset}
          className="flex items-center space-x-1.5 text-[#848E9C] hover:text-white font-semibold transition"
        >
          <RotateCcw size={14} />
          <span>Reset All</span>
        </button>
        <button
          onClick={onClose}
          className="px-4 py-1.5 rounded bg-[#F0B90B] hover:bg-[#dfa700] text-black font-bold transition shadow"
        >
          Apply Filters
        </button>
      </div>
    </div>
  );
};
