import React, { useState } from 'react';
import { Eye, Plus, Trash2, ArrowRight, Star, TrendingUp } from 'lucide-react';
import { ExchangeId, MarketTicker, Watchlist } from '../../types/index.js';

interface WatchlistViewProps {
  watchlists: Watchlist[];
  tickers: MarketTicker[];
  onSelectSymbol: (symbol: string, exchange: ExchangeId, marketType: string) => void;
  onRemoveItem: (watchlistId: string, symbol: string, exchange: string, marketType: string) => void;
  onAddItem: (watchlistId: string, symbol: string, exchange: string, marketType: string) => void;
}

export const WatchlistView: React.FC<WatchlistViewProps> = ({
  watchlists,
  tickers,
  onSelectSymbol,
  onRemoveItem,
  onAddItem
}) => {
  const [activeWlId, setActiveWlId] = useState<string>(watchlists[0]?.id || 'wl_default');
  const [newSymbol, setNewSymbol] = useState('');
  const [newExchange, setNewExchange] = useState('BINANCE');
  const [newMarketType, setNewMarketType] = useState('SPOT');

  const activeWl = watchlists.find(w => w.id === activeWlId) || watchlists[0];

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSymbol.trim() || !activeWl) return;
    onAddItem(activeWl.id, newSymbol.trim().toUpperCase(), newExchange, newMarketType);
    setNewSymbol('');
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0B0E11] overflow-hidden select-none text-xs">
      {/* Header */}
      <div className="p-4 border-b border-[#2B2F36] bg-[#181A20] flex flex-wrap items-center justify-between gap-3 flex-none">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded bg-[#F0B90B]/10 border border-[#F0B90B]/30 text-[#F0B90B]">
            <Eye size={20} />
          </div>
          <div>
            <h1 className="text-base font-bold text-white uppercase tracking-tight">Focus Watchlists</h1>
            <p className="text-xs text-[#848E9C]">Curated portfolios with instant multi-timeframe monitoring</p>
          </div>
        </div>

        {/* Quick Add Form */}
        <form onSubmit={handleAdd} className="flex items-center space-x-2">
          <input
            type="text"
            placeholder="Symbol (e.g. SOLUSDT)"
            value={newSymbol}
            onChange={(e) => setNewSymbol(e.target.value)}
            className="bg-[#0B0E11] border border-[#2B2F36] rounded px-3 py-1.5 text-white uppercase font-mono focus:border-[#F0B90B] focus:outline-none w-36"
          />
          <select
            value={newExchange}
            onChange={(e) => setNewExchange(e.target.value)}
            className="bg-[#0B0E11] border border-[#2B2F36] rounded px-2.5 py-1.5 text-[#EAECEF] font-mono focus:outline-none"
          >
            <option value="BINANCE">Binance</option>
            <option value="BYBIT">Bybit</option>
            <option value="OKX">OKX</option>
            <option value="NASDAQ">Nasdaq</option>
          </select>
          <select
            value={newMarketType}
            onChange={(e) => setNewMarketType(e.target.value)}
            className="bg-[#0B0E11] border border-[#2B2F36] rounded px-2.5 py-1.5 text-[#EAECEF] font-mono focus:outline-none"
          >
            <option value="SPOT">Spot</option>
            <option value="FUTURES">Futures</option>
          </select>
          <button
            type="submit"
            className="px-3 py-1.5 rounded bg-[#F0B90B] hover:bg-[#F0B90B]/90 text-black font-bold flex items-center space-x-1 transition shadow"
          >
            <Plus size={14} />
            <span>Add</span>
          </button>
        </form>
      </div>

      {/* Watchlist Grid */}
      <div className="flex-1 overflow-auto p-4">
        {(!activeWl || activeWl.items.length === 0) ? (
          <div className="p-16 text-center text-[#848E9C] bg-[#181A20] rounded-xl border border-[#2B2F36]">
            <Star size={32} className="mx-auto mb-2 text-[#F0B90B] opacity-40" />
            <div>Your watchlist is empty.</div>
            <div className="text-[#848E9C] text-[11px] mt-1">Star symbols from the Screener or add symbols above.</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {activeWl.items.map((item) => {
              const liveTicker = tickers.find(t => t.symbol === item.symbol && t.exchange === item.exchange && t.marketType === item.marketType);
              const isPositive = (liveTicker?.percentageChange || 0) >= 0;

              return (
                <div
                  key={`${item.exchange}-${item.marketType}-${item.symbol}`}
                  className="p-4 rounded-xl bg-[#181A20] border border-[#2B2F36] hover:border-[#F0B90B]/40 transition shadow-lg flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-white text-sm">{item.symbol}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#0B0E11] text-[#848E9C] border border-[#2B2F36] font-mono">
                          {item.exchange}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${
                          item.marketType === 'FUTURES' ? 'bg-[#F0B90B]/15 text-[#F0B90B] border border-[#F0B90B]/30' : 'bg-[#0ECB81]/15 text-[#0ECB81] border border-[#0ECB81]/30'
                        }`}>
                          {item.marketType}
                        </span>
                      </div>
                      <button
                        onClick={() => onRemoveItem(activeWl.id, item.symbol, item.exchange, item.marketType)}
                        className="text-[#848E9C] hover:text-[#F6465D] p-1 transition"
                        title="Remove from watchlist"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>

                    <div className="flex items-baseline justify-between font-mono my-2">
                      <div className="text-xl font-bold text-white">
                        ${liveTicker ? liveTicker.lastPrice.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '--'}
                      </div>
                      <div className={`text-xs font-bold ${isPositive ? 'text-[#0ECB81]' : 'text-[#F6465D]'}`}>
                        {isPositive ? '+' : ''}{liveTicker ? liveTicker.percentageChange.toFixed(2) : '0.00'}%
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#2B2F36] text-[11px] text-[#848E9C]">
                      <div>
                        <span>24h Volume:</span>
                        <span className="font-mono text-[#EAECEF] ml-1">
                          ${liveTicker ? (liveTicker.volumeUsd / 1e6).toFixed(1) : '0'}M
                        </span>
                      </div>
                      <div>
                        <span>RSI (14):</span>
                        <span className="font-mono text-[#EAECEF] ml-1">
                          {liveTicker?.rsi ? liveTicker.rsi.toFixed(1) : '50.0'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => onSelectSymbol(item.symbol, item.exchange as ExchangeId, item.marketType)}
                    className="mt-4 w-full py-2 rounded bg-[#1E2329] hover:bg-[#F0B90B] hover:text-black text-[#EAECEF] font-bold transition flex items-center justify-center space-x-1.5 border border-[#2B2F36] hover:border-[#F0B90B]"
                  >
                    <span>Open Focus Terminal</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
