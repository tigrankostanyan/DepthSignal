'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Search } from 'lucide-react';
import { useApp, useRealtimeData } from '@/providers/AppProviders';
import type { MarketTicker } from '@/types/index';
import { formatPrice, formatSignedPercent } from '@/lib/format';
import { Badge } from '@/components/ui/Badge';

export const SearchBar: React.FC = () => {
  const { openSymbolFocus } = useApp();
  const { tickers } = useRealtimeData();

  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [selectedSearchIndex, setSelectedSearchIndex] = useState(0);

  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const filteredSearchTickers = searchQuery.trim()
    ? tickers
        .filter(
          (t) =>
            t.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (t.baseAsset && t.baseAsset.toLowerCase().includes(searchQuery.toLowerCase())) ||
            (t.exchange && t.exchange.toLowerCase().includes(searchQuery.toLowerCase())),
        )
        .slice(0, 10)
    : tickers.slice(0, 8);

  // Ctrl+K shortcut + click outside handling for the search palette
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (searchContainerRef.current && !searchContainerRef.current.contains(target)) {
        setShowSearchDropdown(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchInputRef.current?.focus();
        setShowSearchDropdown(true);
        return;
      }
      if (event.key === 'Escape') {
        setShowSearchDropdown(false);
        searchInputRef.current?.blur();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    setSelectedSearchIndex(0);
  }, [searchQuery]);

  const handleSelectTicker = (t: MarketTicker) => {
    openSymbolFocus(t.symbol, t.exchange, t.marketType);
    setShowSearchDropdown(false);
    setSearchQuery('');
    searchInputRef.current?.blur();
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSearchDropdown || filteredSearchTickers.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedSearchIndex((prev) => (prev + 1) % filteredSearchTickers.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedSearchIndex(
        (prev) => (prev - 1 + filteredSearchTickers.length) % filteredSearchTickers.length,
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = filteredSearchTickers[selectedSearchIndex] ?? filteredSearchTickers[0];
      if (target) handleSelectTicker(target);
    }
  };

  return (
    <div ref={searchContainerRef} className="relative w-72 sm:w-88 md:w-96">
      <div className="flex items-center bg-primary border border-divider rounded-lg px-3 py-1.5 focus-within:border-[#168FD6] focus-within:ring-1 focus-within:ring-[#168FD6]/30 transition gap-2">
        <Search size={14} className="text-muted shrink-0" />
        <input
          ref={searchInputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setShowSearchDropdown(true);
          }}
          onFocus={() => setShowSearchDropdown(true)}
          onKeyDown={handleSearchKeyDown}
          placeholder="Search symbol (e.g. BTC, NVDA, ETH)..."
          className="w-full bg-transparent text-main placeholder-muted/60 focus:outline-none text-xs"
        />
        {searchQuery && (
          <button
            onClick={() => {
              setSearchQuery('');
              searchInputRef.current?.focus();
            }}
            className="text-muted hover:text-white shrink-0 cursor-pointer text-xs"
            title="Clear search"
          >
            ✕
          </button>
        )}
        <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[9px] font-mono font-bold text-muted bg-surface rounded border border-divider whitespace-nowrap shrink-0 leading-none select-none">
          Ctrl+K
        </kbd>
      </div>

      {/* Search Results Dropdown */}
      {showSearchDropdown && (
        <div
          data-dropdown="search"
          className="absolute left-0 mt-1 w-full bg-surface border border-divider rounded-lg shadow-2xl py-1 z-50 max-h-80 overflow-y-auto"
        >
          <div className="px-3 py-1.5 text-[10px] text-muted uppercase font-bold border-b border-divider flex justify-between items-center">
            <span>{searchQuery.trim() ? 'Matching Instruments' : 'Popular Instruments'}</span>
            <span className="font-mono text-[9px] lowercase text-muted/80">
              ↑↓ to navigate · enter to select
            </span>
          </div>
          {filteredSearchTickers.length === 0 ? (
            <div className="px-4 py-4 text-center text-xs text-muted">
              No symbol found matching "{searchQuery}"
            </div>
          ) : (
            filteredSearchTickers.map((t, idx) => {
              const isSelected = idx === selectedSearchIndex;
              return (
                <button
                  key={`${t.exchange}-${t.marketType}-${t.symbol}`}
                  onClick={() => handleSelectTicker(t)}
                  onMouseEnter={() => setSelectedSearchIndex(idx)}
                  className={`w-full px-3 py-2 text-left flex items-center justify-between transition group cursor-pointer border-b border-divider/30 last:border-0 ${
                    isSelected ? 'bg-panel text-white' : 'hover:bg-panel/60'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <span
                      className={`font-bold text-sm ${isSelected ? 'text-accent' : 'text-main group-hover:text-accent'}`}
                    >
                      {t.symbol}
                    </span>
                    <Badge tone="neutral">{t.exchange}</Badge>
                    <span className="text-[9px] text-muted font-mono uppercase font-semibold">
                      {t.marketType}
                    </span>
                  </div>
                  <div className="text-right font-mono">
                    <div className="text-main font-bold text-xs">
                      {`$${formatPrice(t.lastPrice)}`}
                    </div>
                    <div
                      className={`text-[10px] font-bold ${t.percentageChange >= 0 ? 'text-bid' : 'text-ask'}`}
                    >
                      {formatSignedPercent(t.percentageChange)}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};