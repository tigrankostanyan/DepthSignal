import React, { useState, useEffect } from 'react';
import type {
  Candle,
  DetectedWall,
  ExchangeId,
  MarketTicker,
  MarketType,
  OrderBookSnapshot,
  Trade,
  AlertTrigger
} from '@/types/index';
import { fetchSymbolDetail } from '@/lib/api';
import { SymbolNavbar } from './SymbolNavbar';
import { CandlestickChart } from './CandlestickChart';
import { DepthChart } from './DepthChart';
import { ActiveWallsPanel } from './ActiveWallsPanel';
import { SymbolAlertsPanel } from './SymbolAlertsPanel';
import { OrderBookL2 } from './OrderBookL2';
import { TradeTape } from './TradeTape';

interface SymbolFocusViewProps {
  symbol: string;
  exchange: ExchangeId;
  marketType: MarketType;
  onBack: () => void;
  onSelectSymbol: (symbol: string, exchange: ExchangeId, marketType: MarketType) => void;
  allTickers: MarketTicker[];
  alertTriggers: AlertTrigger[];
  onToggleWatchlist: (symbol: string, exchange: ExchangeId, marketType: MarketType) => void;
  isWatchlisted: boolean;
}

export const SymbolFocusView: React.FC<SymbolFocusViewProps> = ({
  symbol,
  exchange,
  marketType,
  onBack,
  onSelectSymbol,
  allTickers,
  alertTriggers,
  onToggleWatchlist,
  isWatchlisted
}) => {
  const [ticker, setTicker] = useState<MarketTicker | null>(null);
  const [orderBook, setOrderBook] = useState<OrderBookSnapshot | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [symbolWalls, setSymbolWalls] = useState<DetectedWall[]>([]);
  const [chartTimeframe, setChartTimeframe] = useState<'30s' | '1m' | '5m' | '15m' | '1h' | '4h' | '1d'>('15m');
  const [loading, setLoading] = useState(true);

  // Fetch initial symbol data
  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        setLoading(true);
        const data = await fetchSymbolDetail(symbol, exchange, marketType);
        if (isMounted) {
          setTicker(data.ticker);
          setOrderBook(data.orderBook);
          setTrades(data.trades || []);
          setCandles(data.candles || []);
          setSymbolWalls(data.walls || []);
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    load();
    const interval = setInterval(load, 2000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [symbol, exchange, marketType]);

  // Keep ticker updated in real-time from parent stream
  useEffect(() => {
    const live = allTickers.find(t => t.symbol === symbol && t.exchange === exchange && t.marketType === marketType);
    if (live) setTicker(live);
  }, [allTickers, symbol, exchange, marketType]);

  const wallPriceSet = new Set(symbolWalls.map(w => w.price));

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-primary select-none text-xs">
      {/* Top Symbol Navigation Bar */}
      <div className="flex-none">
      <SymbolNavbar
        symbol={symbol}
        exchange={exchange}
        marketType={marketType}
        ticker={ticker}
        isWatchlisted={isWatchlisted}
        onBack={onBack}
        onToggleWatchlist={() => onToggleWatchlist(symbol, exchange, marketType)}
        allTickers={allTickers}
        onSelectSymbol={onSelectSymbol}
      />
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-0 overflow-hidden">
        <div className="lg:col-span-8 flex flex-col border-r border-divider bg-primary overflow-hidden">
          <CandlestickChart
            candles={candles}
            symbolWalls={symbolWalls}
            chartTimeframe={chartTimeframe}
            ticker={ticker}
            onChangeTimeframe={setChartTimeframe}
          />

          <DepthChart orderBook={orderBook} ticker={ticker} symbol={symbol} />
          <ActiveWallsPanel symbol={symbol} walls={symbolWalls} />
          <SymbolAlertsPanel symbol={symbol} alertTriggers={alertTriggers} />
        </div>

        {/* Right Column: L2 Depth Order Book & Trade Tape (4 Cols) */}
        <div className="lg:col-span-4 flex flex-col bg-card overflow-hidden">
          <OrderBookL2 orderBook={orderBook} ticker={ticker} wallPriceSet={wallPriceSet} />

          {/* Bottom Trade Tape */}
          <TradeTape trades={trades} />
        </div>
      </div>
    </div>
  );
};