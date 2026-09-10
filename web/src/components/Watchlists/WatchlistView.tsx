import React, { useState } from 'react';
import { Eye, Plus, Trash2, ArrowRight, Star, TrendingUp } from 'lucide-react';
import type { ExchangeId, MarketTicker, MarketType, Watchlist } from '@/types/index';
import { formatUsd, formatSignedPercent, formatCompact, formatAmount } from '@/lib/format';
import { ALL_EXCHANGES, EXCHANGE_LABELS } from '@/lib/constants';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';

interface WatchlistViewProps {
  watchlists: Watchlist[];
  tickers: MarketTicker[];
  onSelectSymbol: (symbol: string, exchange: ExchangeId, marketType: MarketType) => void;
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
    <div className="flex-1 flex flex-col min-h-0 bg-primary select-none text-xs">
      {/* Header */}
      <div className="flex-none">
        <PageHeader
          icon={<Eye size={20} />}
          title="Focus Watchlists"
          subtitle="Curated portfolios with instant multi-timeframe monitoring"
          actions={
            <form onSubmit={handleAdd} className="flex items-center space-x-2">
              <input
                type="text"
                placeholder="Symbol (e.g. SOLUSDT)"
                value={newSymbol}
                onChange={(e) => setNewSymbol(e.target.value)}
                className="bg-primary border border-divider rounded-lg px-3 py-1.5 text-white uppercase font-mono focus:border-[#168FD6] focus:outline-none w-36"
              />
              <select
                value={newExchange}
                onChange={(e) => setNewExchange(e.target.value)}
                className="bg-primary border border-divider rounded-lg px-2.5 py-1.5 text-main font-mono focus:outline-none"
              >
                {ALL_EXCHANGES.map((ex) => (
                  <option key={ex} value={ex}>{EXCHANGE_LABELS[ex]}</option>
                ))}
              </select>
              <select
                value={newMarketType}
                onChange={(e) => setNewMarketType(e.target.value)}
                className="bg-primary border border-divider rounded-lg px-2.5 py-1.5 text-main font-mono focus:outline-none"
              >
                <option value="SPOT">Spot</option>
                <option value="FUTURES">Futures</option>
              </select>
              <button
                type="submit"
                className="px-3 py-1.5 rounded-lg bg-[#168FD6] hover:bg-[#1C9AE5] text-white font-bold flex items-center space-x-1 transition shadow cursor-pointer active:scale-95"
              >
                <Plus size={14} className="text-white" />
                <span>Add</span>
              </button>
            </form>
          }
        />
      </div>

      {/* Watchlist Grid */}
      <div className="flex-1 overflow-auto min-h-0 p-4">
        {(!activeWl || activeWl.items.length === 0) ? (
          <EmptyState
            icon={<Star size={32} className="text-accent opacity-40" />}
            title="Your watchlist is empty."
            message="Star symbols from the Screener or add symbols above."
            className="bg-card rounded-xl border border-divider"
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {activeWl.items.map((item) => {
              const liveTicker = tickers.find(t => t.symbol === item.symbol && t.exchange === item.exchange && t.marketType === item.marketType);
              const isPositive = (liveTicker?.percentageChange || 0) >= 0;

              return (
                <Card
                  key={`${item.exchange}-${item.marketType}-${item.symbol}`}
                  variant="interactive"
                  className="p-4 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-white text-sm">{item.symbol}</span>
                        <Badge tone="neutral">{item.exchange}</Badge>
                        <Badge tone={item.marketType === 'FUTURES' ? 'yellow' : 'green'} bordered>
                          {item.marketType}
                        </Badge>
                      </div>
                      <button
                        onClick={() => onRemoveItem(activeWl.id, item.symbol, item.exchange, item.marketType)}
                        className="text-muted hover:text-ask p-1 transition"
                        title="Remove from watchlist"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>

                    <div className="flex items-baseline justify-between font-mono my-2">
                      <div className="text-xl font-bold text-white">
                        {liveTicker ? formatUsd(liveTicker.lastPrice) : '--'}
                      </div>
                      <div className={`text-xs font-bold ${isPositive ? 'text-bid' : 'text-ask'}`}>
                        {liveTicker ? formatSignedPercent(liveTicker.percentageChange) : '0.00%'}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-divider text-[11px] text-muted">
                      <div>
                        <span>24h Volume:</span>
                        <span className="font-mono text-main ml-1">
                          {formatCompact(liveTicker?.volumeUsd ?? 0, 1)}
                        </span>
                      </div>
                      <div>
                        <span>RSI (14):</span>
                        <span className="font-mono text-main ml-1">
                          {formatAmount(liveTicker?.rsi ?? 50, 1)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => onSelectSymbol(item.symbol, item.exchange as ExchangeId, item.marketType)}
                    className="mt-4 w-full py-2 rounded-lg bg-surface hover:bg-[#168FD6] text-main hover:text-white font-bold transition flex items-center justify-center space-x-1.5 border border-divider hover:border-[#24C4E8] cursor-pointer shadow-sm"
                  >
                    <span>Open Focus Terminal</span>
                    <ArrowRight size={13} />
                  </button>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
