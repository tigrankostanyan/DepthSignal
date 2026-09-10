import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ArrowLeft, Star, Search, ChevronDown } from 'lucide-react';
import type { ExchangeId, MarketTicker, MarketType } from '@/types/index';
import { formatUsd, formatUsdPrice, formatCompact, formatSignedPercent } from '@/lib/format';
import { Badge } from '@/components/ui/Badge';

interface SymbolNavbarProps {
  symbol: string;
  exchange: ExchangeId;
  marketType: MarketType;
  ticker: MarketTicker | null;
  isWatchlisted: boolean;
  onBack: () => void;
  onToggleWatchlist: () => void;
  allTickers: MarketTicker[];
  onSelectSymbol: (symbol: string, exchange: ExchangeId, marketType: MarketType) => void;
}

export const SymbolNavbar: React.FC<SymbolNavbarProps> = ({
  symbol,
  exchange,
  marketType,
  ticker,
  isWatchlisted,
  onBack,
  onToggleWatchlist,
  allTickers,
  onSelectSymbol,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredTickers = useMemo(() => {
    if (!searchQuery) return allTickers.slice(0, 100);
    const q = searchQuery.toLowerCase();
    return allTickers
      .filter((t) => t.symbol.toLowerCase().includes(q))
      .slice(0, 100);
  }, [allTickers, searchQuery]);
  return (
    <div className="p-3 border-b border-divider bg-card flex flex-wrap items-center justify-between gap-3 flex-none">
      <div className="flex items-center space-x-3">
        <button
          onClick={onBack}
          className="flex items-center space-x-1 p-1.5 rounded hover:bg-panel text-muted hover:text-white transition font-bold"
        >
          <ArrowLeft size={16} />
          <span className="hidden sm:inline">Back</span>
        </button>

        <div className="h-4 w-px bg-panel" />

        <div className="flex items-center space-x-2">
          <div className="relative" ref={dropdownRef}>
            <button 
              onClick={() => {
                setDropdownOpen(!dropdownOpen);
                setSearchQuery('');
              }}
              className="flex items-center space-x-1 hover:bg-panel p-1 rounded transition"
            >
              <h1 className="text-base font-bold text-white font-sans tracking-tight">{symbol}</h1>
              <ChevronDown size={14} className="text-muted" />
            </button>
            
            {dropdownOpen && (
              <div className="absolute top-full left-0 mt-1 w-64 bg-surface border border-divider rounded-md shadow-2xl z-50 flex flex-col max-h-80">
                <div className="p-2 border-b border-divider">
                  <div className="relative">
                    <Search size={14} className="absolute left-2.5 top-2.5 text-muted" />
                    <input 
                      type="text"
                      className="w-full bg-primary text-white text-xs rounded border border-divider pl-8 pr-2 py-2 outline-none focus:border-[#168FD6] transition-colors"
                      placeholder="Search symbol..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      autoFocus
                    />
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {filteredTickers.map(t => (
                    <button
                      key={`${t.exchange}-${t.marketType}-${t.symbol}`}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-panel flex items-center justify-between transition-colors"
                      onClick={() => {
                        onSelectSymbol(t.symbol, t.exchange, t.marketType);
                        setDropdownOpen(false);
                      }}
                    >
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-white">{t.symbol}</span>
                        <span className="text-[9px] text-muted">{t.exchange} {t.marketType === 'FUTURES' ? 'PERP' : 'SPOT'}</span>
                      </div>
                      <span className={`text-[10px] ${t.percentageChange >= 0 ? 'text-bid' : 'text-ask'}`}>
                        {formatSignedPercent(t.percentageChange)}
                      </span>
                    </button>
                  ))}
                  {filteredTickers.length === 0 && (
                    <div className="p-3 text-center text-xs text-muted">No symbols found.</div>
                  )}
                </div>
              </div>
            )}
          </div>
          <Badge tone="neutral">{exchange}</Badge>
          <Badge tone={marketType === 'FUTURES' ? 'yellow' : 'green'} bordered>{marketType}</Badge>
          <button
            onClick={onToggleWatchlist}
            className="text-muted hover:text-accent p-1 transition"
          >
            <Star size={15} className={isWatchlisted ? 'fill-accent text-accent' : 'text-muted'} />
          </button>
        </div>
      </div>

      {ticker && (
        <div className="flex items-center space-x-4 font-mono text-xs">
          <div>
            <div className="text-[10px] text-muted">LAST PRICE</div>
            <div className="text-sm font-bold text-white">{formatUsd(ticker.lastPrice)}</div>
          </div>
          <div>
            <div className="text-[10px] text-muted">24H CHANGE</div>
            <div className={`font-bold ${ticker.percentageChange >= 0 ? 'text-bid' : 'text-ask'}`}>
              {formatSignedPercent(ticker.percentageChange)}
            </div>
          </div>
          <div className="hidden md:block">
            <div className="text-[10px] text-muted">24H HIGH / LOW</div>
            <div className="text-main">{formatUsdPrice(ticker.high24h)} / {formatUsdPrice(ticker.low24h)}</div>
          </div>
          <div className="hidden lg:block">
            <div className="text-[10px] text-muted">24H VOLUME (USD)</div>
            <div className="text-accent font-bold">{formatCompact(ticker.volumeUsd, 1)}</div>
          </div>
          {marketType === 'FUTURES' && ticker.markPrice && (
            <div className="hidden sm:block">
              <div className="text-[10px] text-muted">MARK PRICE (WALL REF)</div>
              <div className="text-accent font-bold">{formatUsd(ticker.markPrice)}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};