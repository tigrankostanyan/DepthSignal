import React, { useState, useEffect, useRef } from 'react';
import { 
  Filter, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  Star, 
  Layers, 
  ExternalLink,
  Flame,
  Clock,
  Sparkles,
  Plus
} from 'lucide-react';
import { 
  MarketTicker, 
  ScreenerFilters, 
  Timeframe, 
  SavedFilterPreset, 
  Watchlist, 
  DetectedWall, 
  ExchangeId 
} from '../../types/index.js';
import { FilterDrawer } from './FilterDrawer.js';

interface MarketScreenerProps {
  tickers: MarketTicker[];
  filters: ScreenerFilters;
  setFilters: React.Dispatch<React.SetStateAction<ScreenerFilters>>;
  presets: SavedFilterPreset[];
  watchlists: Watchlist[];
  activeWalls: DetectedWall[];
  onSelectSymbol: (symbol: string, exchange: ExchangeId, marketType: string) => void;
  onToggleWatchlist: (symbol: string, exchange: ExchangeId, marketType: string) => void;
  onSavePreset: () => void;
}

export const MarketScreener: React.FC<MarketScreenerProps> = ({
  tickers,
  filters,
  setFilters,
  presets,
  watchlists,
  activeWalls,
  onSelectSymbol,
  onToggleWatchlist,
  onSavePreset
}) => {
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const prevPrices = useRef<Map<string, number>>(new Map());
  const [flashingSymbols, setFlashingSymbols] = useState<Map<string, 'up' | 'down'>>(new Map());

  // Track wall counts per symbol
  const wallsBySymbol = React.useMemo(() => {
    const map = new Map<string, { bidWalls: number; askWalls: number; walls: DetectedWall[] }>();
    for (const w of activeWalls) {
      const key = `${w.exchange}:${w.marketType}:${w.symbol}`;
      const entry = map.get(key) || { bidWalls: 0, askWalls: 0, walls: [] };
      if (w.side === 'BID') entry.bidWalls++;
      else entry.askWalls++;
      entry.walls.push(w);
      map.set(key, entry);
    }
    return map;
  }, [activeWalls]);

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

  // Price flash animation hook
  useEffect(() => {
    const nextFlashes = new Map<string, 'up' | 'down'>();
    for (const t of tickers) {
      const key = `${t.exchange}:${t.marketType}:${t.symbol}`;
      const oldPrice = prevPrices.current.get(key);
      if (oldPrice !== undefined && oldPrice !== t.lastPrice) {
        nextFlashes.set(key, t.lastPrice > oldPrice ? 'up' : 'down');
      }
      prevPrices.current.set(key, t.lastPrice);
    }

    if (nextFlashes.size > 0) {
      setFlashingSymbols(nextFlashes);
      const timer = setTimeout(() => setFlashingSymbols(new Map()), 750);
      return () => clearTimeout(timer);
    }
  }, [tickers]);

  const handleSort = (field: keyof MarketTicker) => {
    setFilters(prev => ({
      ...prev,
      sortBy: field,
      sortOrder: prev.sortBy === field && prev.sortOrder === 'desc' ? 'asc' : 'desc'
    }));
  };

  const timeframes: Timeframe[] = ['30s', '1m', '5m', '15m', '1h', '4h', '1d'];

  const getSymbolAvatar = (symbol: string) => {
    if (symbol.startsWith('BTC')) return { icon: '₿', color: 'text-[#F0B90B]' };
    if (symbol.startsWith('ETH')) return { icon: 'Ξ', color: 'text-[#627EEA]' };
    if (symbol.startsWith('SOL')) return { icon: 'S', color: 'text-[#00FFA3]' };
    if (symbol.startsWith('AVAX')) return { icon: 'A', color: 'text-[#E84142]' };
    if (symbol.startsWith('BNB')) return { icon: 'B', color: 'text-[#F0B90B]' };
    if (symbol.startsWith('NVDA') || symbol.startsWith('AAPL') || symbol.startsWith('TSLA')) {
      return { icon: symbol.slice(0, 1), color: 'text-[#38BDF8]' };
    }
    return { icon: symbol.slice(0, 1), color: 'text-slate-200' };
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0B0E11] overflow-hidden">
      {/* Screener Controls Header */}
      <div className="p-3 border-b border-[#2B2F36] bg-[#181A20] flex flex-wrap items-center justify-between gap-3 select-none flex-none">
        {/* Left: Quick Category & Market Type Selectors */}
        <div className="flex items-center space-x-2">
          {/* Market Type Segment */}
          <div className="flex items-center bg-[#181A20] rounded border border-[#2B2F36] p-0.5">
            {(['ALL', 'SPOT', 'FUTURES'] as const).map((mType) => (
              <button
                key={mType}
                onClick={() => setFilters(prev => ({ ...prev, marketType: mType }))}
                className={`px-3 py-1 text-xs rounded font-medium transition ${
                  filters.marketType === mType
                    ? 'bg-[#2B2F36] text-white shadow-sm'
                    : 'text-[#848E9C] hover:text-white'
                }`}
              >
                {mType === 'FUTURES' ? 'USDT-M Futures' : mType === 'SPOT' ? 'Spot Markets' : 'All Markets'}
              </button>
            ))}
          </div>

          {/* Asset Category Segment */}
          <div className="flex items-center bg-[#181A20] rounded border border-[#2B2F36] p-0.5">
            {(['ALL', 'CRYPTO', 'STOCKS'] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setFilters(prev => ({ ...prev, category: cat }))}
                className={`px-3 py-1 rounded text-xs font-medium transition ${
                  filters.category === cat
                    ? 'bg-[#2B2F36] text-[#F0B90B] shadow-sm'
                    : 'text-[#848E9C] hover:text-white'
                }`}
              >
                {cat === 'ALL' ? 'All Classes' : cat === 'CRYPTO' ? 'Crypto' : 'US Equities'}
              </button>
            ))}
          </div>

          {/* Timeframe Selector for % Change Column */}
          <div className="flex items-center space-x-1.5 bg-[#181A20] rounded px-2.5 py-1 border border-[#2B2F36] text-xs">
            <Clock size={12} className="text-[#848E9C]" />
            <span className="text-[#848E9C] text-[11px]">TF:</span>
            <select
              value={filters.timeframe}
              onChange={(e) => setFilters(prev => ({ ...prev, timeframe: e.target.value as Timeframe }))}
              className="bg-transparent text-[#F0B90B] font-mono font-bold focus:outline-none cursor-pointer"
            >
              {timeframes.map(tf => (
                <option key={tf} value={tf} className="bg-[#181A20] text-[#EAECEF]">
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
                onClick={() => setFilters(prev => ({ ...prev, ...p.filters }))}
                className="px-2.5 py-1 rounded text-[11px] font-medium bg-[#1E2329] hover:bg-[#2B2F36] text-[#848E9C] hover:text-white border border-[#2B2F36] transition flex items-center space-x-1"
              >
                <Sparkles size={11} className="text-[#F0B90B]" />
                <span>{p.name}</span>
              </button>
            ))}
          </div>

          {/* Filter Drawer Button */}
          <button
            onClick={() => setIsFilterDrawerOpen(true)}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded text-xs font-medium transition border ${
              filters.onlyWithWalls || filters.priceMin !== undefined || filters.changeMin !== undefined
                ? 'bg-[#F0B90B] text-black border-[#F0B90B] font-bold'
                : 'bg-[#1E2329] hover:bg-[#2B2F36] text-[#848E9C] hover:text-white border-[#2B2F36]'
            }`}
          >
            <Filter size={13} />
            <span>Filters</span>
            {(filters.onlyWithWalls || filters.priceMin !== undefined || filters.changeMin !== undefined) && (
              <span className="w-2 h-2 rounded-full bg-black ml-1" />
            )}
          </button>
        </div>
      </div>

      {/* Main High-Density Market Table Container */}
      <div className="flex-1 overflow-auto bg-[#181A20] m-3 rounded-lg border border-[#2B2F36] flex flex-col">
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left border-collapse text-xs select-none">
            <thead className="sticky top-0 z-20 bg-[#1E2329] border-b border-[#2B2F36] text-[11px] font-bold text-[#848E9C] uppercase tracking-wider">
              <tr>
                <th className="py-3 px-3 w-10 text-center">★</th>
                <th 
                  className="py-3 px-4 cursor-pointer hover:text-white transition"
                  onClick={() => handleSort('symbol')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Symbol / Exchange</span>
                    <ArrowUpDown size={11} />
                  </div>
                </th>
                <th 
                  className="py-3 px-3 text-right cursor-pointer hover:text-white transition"
                  onClick={() => handleSort('lastPrice')}
                >
                  <div className="flex items-center justify-end space-x-1">
                    <span>Last Price</span>
                    <ArrowUpDown size={11} />
                  </div>
                </th>
                <th 
                  className="py-3 px-3 text-right cursor-pointer hover:text-white transition"
                  onClick={() => handleSort('percentageChange')}
                >
                  <div className="flex items-center justify-end space-x-1">
                    <span>24h Chg ({filters.timeframe})</span>
                    <ArrowUpDown size={11} />
                  </div>
                </th>
                <th className="py-3 px-3 text-center hidden md:table-cell">24h Range</th>
                <th 
                  className="py-3 px-4 text-right cursor-pointer hover:text-white transition hidden sm:table-cell"
                  onClick={() => handleSort('volumeUsd')}
                >
                  <div className="flex items-center justify-end space-x-1">
                    <span>24h Volume</span>
                    <ArrowUpDown size={11} />
                  </div>
                </th>
                <th className="py-3 px-3 text-right hidden lg:table-cell">RSI (14)</th>
                <th className="py-3 px-3 text-right hidden xl:table-cell">Volat.</th>
                <th className="py-3 px-4 text-center">Wall Status</th>
                <th className="py-3 px-3 text-center w-12">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2B2F36] font-mono text-[11px]">
              {tickers.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-16 text-center text-[#848E9C] font-sans text-xs">
                    No market instruments match the active filters or blacklist criteria.
                  </td>
                </tr>
              ) : (
                tickers.map((ticker) => {
                  const rowKey = `${ticker.exchange}:${ticker.marketType}:${ticker.symbol}`;
                  const flash = flashingSymbols.get(rowKey);
                  const isWatchlisted = watchlistedKeys.has(rowKey);
                  const wallData = wallsBySymbol.get(rowKey);
                  const totalWalls = wallData ? wallData.bidWalls + wallData.askWalls : 0;
                  const primaryWall = wallData?.walls[0];

                  const tfChange = (ticker.changesByTimeframe && ticker.changesByTimeframe[filters.timeframe] !== undefined)
                    ? ticker.changesByTimeframe[filters.timeframe]!
                    : ticker.percentageChange;

                  const isPositive = tfChange >= 0;
                  const avatar = getSymbolAvatar(ticker.symbol);

                  // 24h range percentage
                  const rangeDiff = ticker.high24h - ticker.low24h;
                  const rangePct = rangeDiff > 0 ? Math.min(100, Math.max(0, ((ticker.lastPrice - ticker.low24h) / rangeDiff) * 100)) : 50;

                  return (
                    <tr
                      key={rowKey}
                      onClick={() => onSelectSymbol(ticker.symbol, ticker.exchange, ticker.marketType)}
                      className={`hover:bg-[#2B2F36] transition cursor-pointer group ${
                        flash === 'up' ? 'flash-up' : flash === 'down' ? 'flash-down' : ''
                      }`}
                    >
                      {/* Watchlist Star */}
                      <td className="py-3 px-3 text-center" onClick={(e) => {
                        e.stopPropagation();
                        onToggleWatchlist(ticker.symbol, ticker.exchange, ticker.marketType);
                      }}>
                        <button className="text-[#848E9C] hover:text-[#F0B90B] transition">
                          <Star 
                            size={14} 
                            className={isWatchlisted ? 'fill-[#F0B90B] text-[#F0B90B]' : 'text-[#848E9C]'} 
                          />
                        </button>
                      </td>

                      {/* Instrument Symbol & Exchange */}
                      <td className="py-3 px-4 font-sans">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-full bg-[#34383F] flex items-center justify-center font-bold text-xs shrink-0 shadow-inner">
                            <span className={avatar.color}>{avatar.icon}</span>
                          </div>
                          <div>
                            <div className="text-sm font-bold text-white group-hover:text-[#F0B90B] transition flex items-center gap-1.5">
                              <span>{ticker.symbol}</span>
                              <span className="text-[10px] bg-[#2B2F36] px-1.5 py-0.2 rounded text-[#F0B90B] font-mono">
                                {ticker.marketType === 'FUTURES' ? 'PERP' : 'SPOT'}
                              </span>
                            </div>
                            <div className="text-[10px] text-[#848E9C] font-sans">
                              {ticker.exchange} {ticker.marketType === 'FUTURES' ? 'Futures' : 'Market'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Price */}
                      <td className="py-3 px-3 text-right">
                        <div className="font-bold text-sm text-[#EAECEF]">
                          ${ticker.lastPrice >= 1 ? ticker.lastPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ticker.lastPrice}
                        </div>
                        {ticker.marketType === 'FUTURES' && ticker.markPrice && (
                          <div className="text-[10px] text-[#848E9C]">
                            Mark: ${ticker.markPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        )}
                      </td>

                      {/* % Movement */}
                      <td className="py-3 px-3 text-right">
                        <div className={`text-sm font-medium inline-flex items-center ${isPositive ? 'text-[#0ECB81]' : 'text-[#F6465D]'}`}>
                          {isPositive ? '+' : ''}{tfChange.toFixed(2)}%
                        </div>
                      </td>

                      {/* 24h Range Bar */}
                      <td className="py-3 px-3 hidden md:table-cell">
                        <div className="w-24 mx-auto">
                          <div className="flex justify-between text-[9px] text-[#848E9C] mb-0.5">
                            <span>${ticker.low24h >= 1000 ? `${(ticker.low24h / 1000).toFixed(1)}k` : ticker.low24h}</span>
                            <span>${ticker.high24h >= 1000 ? `${(ticker.high24h / 1000).toFixed(1)}k` : ticker.high24h}</span>
                          </div>
                          <div className="w-full bg-[#0B0E11] h-1.5 rounded-full overflow-hidden">
                            <div 
                              className="bg-[#F0B90B] h-full rounded-full" 
                              style={{ width: `${rangePct}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Volume */}
                      <td className="py-3 px-4 text-right hidden sm:table-cell text-[#EAECEF] font-medium text-sm">
                        ${ticker.volumeUsd >= 1e9 ? `${(ticker.volumeUsd / 1e9).toFixed(2)}B` : ticker.volumeUsd >= 1e6 ? `${(ticker.volumeUsd / 1e6).toFixed(2)}M` : ticker.volumeUsd.toLocaleString()}
                      </td>

                      {/* RSI */}
                      <td className="py-3 px-3 text-right hidden lg:table-cell">
                        <span className={`text-sm font-medium ${
                          (ticker.rsi || 50) >= 70 ? 'text-[#F6465D]' : (ticker.rsi || 50) <= 30 ? 'text-[#0ECB81]' : 'text-[#EAECEF]'
                        }`}>
                          {ticker.rsi ? ticker.rsi.toFixed(1) : '50.0'}
                        </span>
                      </td>

                      {/* Volatility */}
                      <td className="py-3 px-3 text-right hidden xl:table-cell text-[#848E9C] text-sm">
                        {ticker.volatility24h ? `${ticker.volatility24h.toFixed(1)}%` : '0.8%'}
                      </td>

                      {/* Active Walls Status */}
                      <td className="py-3 px-4 text-center">
                        {totalWalls > 0 ? (
                          <div className="inline-flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${
                              primaryWall?.side === 'BID' ? 'bg-[#F0B90B] animate-pulse' : 'bg-[#F6465D]'
                            }`} />
                            <span className={`text-[10px] font-bold uppercase ${
                              primaryWall?.side === 'BID' ? 'text-[#F0B90B]' : 'text-[#F6465D]'
                            }`}>
                              {primaryWall?.side === 'BID' ? 'Support Wall' : 'Resist. Wall'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-[#848E9C] uppercase font-sans">Stable</span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-3 px-3 text-center">
                        <button className="p-1 rounded hover:bg-[#2B2F36] text-[#848E9C] hover:text-[#F0B90B] transition">
                          <ExternalLink size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Bottom Status / Pagination */}
        <div className="h-10 bg-[#1E2329] border-t border-[#2B2F36] px-4 flex items-center justify-between text-xs text-[#848E9C] flex-none">
          <div>Showing {tickers.length} active market instruments</div>
          <div className="flex gap-2">
            <button className="px-2.5 py-0.5 bg-[#2B2F36] rounded text-[#EAECEF] hover:bg-[#34383F] transition text-[11px]">
              Prev
            </button>
            <button className="px-2.5 py-0.5 bg-[#2B2F36] rounded text-[#EAECEF] hover:bg-[#34383F] transition text-[11px]">
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Filter Drawer */}
      <FilterDrawer
        isOpen={isFilterDrawerOpen}
        onClose={() => setIsFilterDrawerOpen(false)}
        filters={filters}
        setFilters={setFilters}
        presets={presets}
        onApplyPreset={(p) => {
          setFilters(prev => ({ ...prev, ...p.filters }));
          setIsFilterDrawerOpen(false);
        }}
        onSaveCurrentPreset={onSavePreset}
      />
    </div>
  );
};
