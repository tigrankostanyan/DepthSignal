import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  TrendingUp, 
  Layers, 
  Activity, 
  Clock, 
  ShieldCheck,
  Star,
  RefreshCw,
  ExternalLink,
  ChevronDown
} from 'lucide-react';
import { 
  Candle, 
  DetectedWall, 
  ExchangeId, 
  MarketTicker, 
  MarketType, 
  OrderBookSnapshot, 
  Trade 
} from '../../types/index.js';
import { fetchSymbolDetail } from '../../lib/api.js';

interface SymbolFocusViewProps {
  symbol: string;
  exchange: ExchangeId;
  marketType: MarketType;
  onBack: () => void;
  onSelectSymbol: (symbol: string, exchange: ExchangeId, marketType: string) => void;
  allTickers: MarketTicker[];
  onToggleWatchlist: (symbol: string, exchange: ExchangeId, marketType: string) => void;
  isWatchlisted: boolean;
}

export const SymbolFocusView: React.FC<SymbolFocusViewProps> = ({
  symbol,
  exchange,
  marketType,
  onBack,
  onSelectSymbol,
  allTickers,
  onToggleWatchlist,
  isWatchlisted
}) => {
  const [ticker, setTicker] = useState<MarketTicker | null>(null);
  const [orderBook, setOrderBook] = useState<OrderBookSnapshot | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [symbolWalls, setSymbolWalls] = useState<DetectedWall[]>([]);
  const [chartTimeframe, setChartTimeframe] = useState<'1m' | '5m' | '15m' | '1h' | '1d'>('15m');
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

  const bids = orderBook?.bids || [];
  const asks = orderBook?.asks || [];
  const maxBidVol = Math.max(...bids.map(b => b.usdVolume || 1), 1);
  const maxAskVol = Math.max(...asks.map(a => a.usdVolume || 1), 1);
  const maxVol = Math.max(maxBidVol, maxAskVol);

  // Set of wall prices for highlighting
  const wallPriceSet = new Set(symbolWalls.map(w => w.price));

  // Compute Candle rendering geometry
  const minCandleLow = Math.min(...candles.map(c => c.low), ticker?.lastPrice || 1);
  const maxCandleHigh = Math.max(...candles.map(c => c.high), ticker?.lastPrice || 1);
  const priceRange = maxCandleHigh - minCandleLow || 1;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0B0E11] overflow-hidden select-none text-xs">
      {/* Top Symbol Navigation Bar */}
      <div className="p-3 border-b border-[#2B2F36] bg-[#181A20] flex flex-wrap items-center justify-between gap-3 flex-none">
        <div className="flex items-center space-x-3">
          <button
            onClick={onBack}
            className="flex items-center space-x-1 p-1.5 rounded hover:bg-[#2B2F36] text-[#848E9C] hover:text-white transition font-bold"
          >
            <ArrowLeft size={16} />
            <span className="hidden sm:inline">Back</span>
          </button>

          <div className="h-4 w-px bg-[#2B2F36]" />

          <div className="flex items-center space-x-2">
            <h1 className="text-base font-bold text-white font-sans tracking-tight">{symbol}</h1>
            <span className="px-1.5 py-0.5 rounded bg-[#0B0E11] text-[#848E9C] border border-[#2B2F36] font-mono text-[10px]">
              {exchange}
            </span>
            <span className={`px-1.5 py-0.5 rounded font-mono font-bold text-[10px] ${
              marketType === 'FUTURES' ? 'bg-[#F0B90B]/15 text-[#F0B90B] border border-[#F0B90B]/30' : 'bg-[#0ECB81]/15 text-[#0ECB81] border border-[#0ECB81]/30'
            }`}>
              {marketType}
            </span>
            <button
              onClick={() => onToggleWatchlist(symbol, exchange, marketType)}
              className="text-[#848E9C] hover:text-[#F0B90B] p-1 transition"
            >
              <Star size={15} className={isWatchlisted ? 'fill-[#F0B90B] text-[#F0B90B]' : 'text-[#848E9C]'} />
            </button>
          </div>
        </div>

        {/* Real-time Ticker Metrics Bar */}
        {ticker && (
          <div className="flex items-center space-x-4 font-mono text-xs">
            <div>
              <div className="text-[10px] text-[#848E9C]">LAST PRICE</div>
              <div className="text-sm font-bold text-white">${ticker.lastPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
            </div>

            <div>
              <div className="text-[10px] text-[#848E9C]">24H CHANGE</div>
              <div className={`font-bold ${ticker.percentageChange >= 0 ? 'text-[#0ECB81]' : 'text-[#F6465D]'}`}>
                {ticker.percentageChange >= 0 ? '+' : ''}{ticker.percentageChange.toFixed(2)}%
              </div>
            </div>

            <div className="hidden md:block">
              <div className="text-[10px] text-[#848E9C]">24H HIGH / LOW</div>
              <div className="text-[#EAECEF]">${ticker.high24h.toLocaleString()} / ${ticker.low24h.toLocaleString()}</div>
            </div>

            <div className="hidden lg:block">
              <div className="text-[10px] text-[#848E9C]">24H VOLUME (USD)</div>
              <div className="text-[#F0B90B] font-bold">${(ticker.volumeUsd / 1e6).toFixed(1)}M</div>
            </div>

            {marketType === 'FUTURES' && ticker.markPrice && (
              <div className="hidden sm:block">
                <div className="text-[10px] text-[#848E9C]">MARK PRICE (WALL REF)</div>
                <div className="text-[#F0B90B] font-bold">${ticker.markPrice.toLocaleString()}</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main Terminal Workspace Layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-0 overflow-hidden">
        {/* Left Column: Interactive Candlestick Chart + Walls Overlay (8 Cols) */}
        <div className="lg:col-span-8 flex flex-col border-r border-[#2B2F36] bg-[#0B0E11] overflow-hidden">
          {/* Chart Header & Timeframe Buttons */}
          <div className="p-2.5 border-b border-[#2B2F36] bg-[#181A20] flex items-center justify-between">
            <div className="flex items-center space-x-1.5">
              {(['1m', '5m', '15m', '1h', '1d'] as const).map(tf => (
                <button
                  key={tf}
                  onClick={() => setChartTimeframe(tf)}
                  className={`px-2.5 py-1 rounded font-mono font-bold text-xs transition ${
                    chartTimeframe === tf ? 'bg-[#2B2F36] text-white shadow-sm' : 'text-[#848E9C] hover:text-white bg-[#0B0E11] border border-[#2B2F36]'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>

            <div className="flex items-center space-x-3 text-[11px] text-[#848E9C]">
              <div className="flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded bg-[#0ECB81] inline-block" />
                <span>Support Walls ({symbolWalls.filter(w => w.side === 'BID').length})</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded bg-[#F6465D] inline-block" />
                <span>Resistance Walls ({symbolWalls.filter(w => w.side === 'ASK').length})</span>
              </div>
            </div>
          </div>

          {/* Candlestick & Liquidity SVG Stage */}
          <div className="flex-1 relative p-4 flex flex-col justify-end bg-[#0B0E11] overflow-hidden">
            {/* Overlay Wall Lines across chart */}
            {symbolWalls.map(w => {
              const yPct = ((maxCandleHigh - w.price) / priceRange) * 100;
              if (yPct < 0 || yPct > 100) return null;
              const isBid = w.side === 'BID';
              return (
                <div
                  key={w.id}
                  className="absolute left-0 right-0 flex items-center z-10 pointer-events-none"
                  style={{ top: `${yPct}%` }}
                >
                  <div className={`w-full border-t border-dashed ${isBid ? 'border-[#0ECB81]/80' : 'border-[#F6465D]/80'}`} />
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold mr-4 shrink-0 ${
                    isBid ? 'bg-[#181A20] text-[#0ECB81] border border-[#0ECB81]/50' : 'bg-[#181A20] text-[#F6465D] border border-[#F6465D]/50'
                  }`}>
                    {w.side} WALL: ${w.price.toLocaleString()} (${(w.volumeUsd / 1e6).toFixed(2)}M)
                  </span>
                </div>
              );
            })}

            {/* Render Candlesticks */}
            <div className="w-full h-80 flex items-end justify-between space-x-1">
              {candles.slice(-40).map((c, i) => {
                const isGreen = c.close >= c.open;
                const candleTop = Math.max(c.open, c.close);
                const candleBottom = Math.min(c.open, c.close);

                const topY = ((maxCandleHigh - candleTop) / priceRange) * 100;
                const bodyHeight = Math.max(2, ((candleTop - candleBottom) / priceRange) * 100);
                const highY = ((maxCandleHigh - c.high) / priceRange) * 100;
                const lowY = ((maxCandleHigh - c.low) / priceRange) * 100;
                const wickHeight = Math.max(4, lowY - highY);

                return (
                  <div key={i} className="flex-1 h-full relative flex items-end justify-center group cursor-crosshair">
                    {/* Wick */}
                    <div
                      className={`absolute w-px ${isGreen ? 'bg-[#0ECB81]' : 'bg-[#F6465D]'}`}
                      style={{ top: `${highY}%`, height: `${wickHeight}%` }}
                    />
                    {/* Candle Body */}
                    <div
                      className={`w-full max-w-[10px] rounded-[1px] absolute ${
                        isGreen ? 'bg-[#0ECB81] shadow-sm' : 'bg-[#F6465D] shadow-sm'
                      }`}
                      style={{ top: `${topY}%`, height: `${bodyHeight}%` }}
                    />
                  </div>
                );
              })}
            </div>

            {/* Bottom Volume Sub-Chart */}
            <div className="w-full h-16 mt-3 pt-2 border-t border-[#2B2F36] flex items-end justify-between space-x-1">
              {candles.slice(-40).map((c, i) => {
                const maxVolInSeries = Math.max(...candles.map(cd => cd.volume), 1);
                const hPct = (c.volume / maxVolInSeries) * 100;
                return (
                  <div
                    key={i}
                    className={`flex-1 rounded-t-[1px] ${c.close >= c.open ? 'bg-[#0ECB81]/40' : 'bg-[#F6465D]/40'}`}
                    style={{ height: `${Math.max(4, hPct)}%` }}
                  />
                );
              })}
            </div>
          </div>

          {/* Active Walls on this Symbol Bar */}
          <div className="p-3 border-t border-[#2B2F36] bg-[#181A20]">
            <div className="text-[11px] font-bold text-[#848E9C] uppercase tracking-wider mb-2 flex items-center space-x-1.5">
              <Layers size={13} className="text-[#F0B90B]" />
              <span>Active Order Book Barriers for {symbol} ({symbolWalls.length})</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {symbolWalls.length === 0 ? (
                <div className="col-span-2 text-[#848E9C] text-xs py-2">
                  No liquidity walls currently detected within threshold distance.
                </div>
              ) : (
                symbolWalls.map(w => (
                  <div key={w.id} className="p-2 rounded bg-[#1E2329] border border-[#2B2F36] flex items-center justify-between text-xs font-mono">
                    <div className="flex items-center space-x-2">
                      <span className={`px-1.5 py-0.2 rounded font-bold text-[10px] ${
                        w.side === 'BID' ? 'bg-[#0ECB81]/15 text-[#0ECB81]' : 'bg-[#F6465D]/15 text-[#F6465D]'
                      }`}>
                        {w.side}
                      </span>
                      <span className="font-bold text-white">${w.price.toLocaleString()}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[#F0B90B] font-bold">${(w.volumeUsd / 1e6).toFixed(2)}M</span>
                      <span className="text-[#848E9C] text-[10px] ml-1">({w.distancePercent.toFixed(2)}% away)</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: L2 Depth Order Book & Trade Tape (4 Cols) */}
        <div className="lg:col-span-4 flex flex-col bg-[#181A20] overflow-hidden">
          {/* Header */}
          <div className="p-2.5 border-b border-[#2B2F36] bg-[#1E2329] flex items-center justify-between">
            <span className="font-bold text-[#EAECEF] text-xs uppercase tracking-wider">Level 2 Order Book</span>
            <span className="text-[10px] text-[#848E9C] font-mono">
              Spread: ${orderBook ? orderBook.spread.toFixed(2) : '0.00'} ({orderBook ? orderBook.spreadPercent.toFixed(3) : '0'}%)
            </span>
          </div>

          {/* L2 Book Table */}
          <div className="flex-1 flex flex-col p-2 overflow-y-auto space-y-1 font-mono text-[11px]">
            {/* Asks (Red) */}
            <div className="flex-1 flex flex-col-reverse justify-end space-y-0.5">
              {asks.slice(0, 10).map((ask, idx) => {
                const isWall = wallPriceSet.has(ask.price);
                const widthPct = ((ask.usdVolume || 1) / maxVol) * 100;
                return (
                  <div
                    key={`ask-${idx}`}
                    className={`relative flex items-center justify-between px-2 py-0.5 rounded transition ${
                      isWall ? 'bg-[#F6465D]/20 border border-[#F6465D]/50 font-bold' : 'hover:bg-[#2B2F36]'
                    }`}
                  >
                    <div
                      className="absolute right-0 top-0 bottom-0 bg-[#F6465D]/15 pointer-events-none rounded"
                      style={{ width: `${widthPct}%` }}
                    />
                    <span className="text-[#F6465D] font-bold z-10">${ask.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    <span className="text-[#EAECEF] z-10">{ask.amount.toFixed(3)}</span>
                    <span className="text-[#848E9C] z-10 text-[10px]">
                      ${((ask.usdVolume || (ask.price * ask.amount)) / 1000).toFixed(1)}k
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Mid Price Separator */}
            <div className="py-1.5 px-3 bg-[#0B0E11] rounded border border-[#2B2F36] flex items-center justify-between font-bold text-xs my-1">
              <span className="text-[#848E9C] font-sans text-[10px]">CURRENT PRICE</span>
              <span className="text-white">${ticker?.lastPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>

            {/* Bids (Green) */}
            <div className="flex-1 flex flex-col space-y-0.5">
              {bids.slice(0, 10).map((bid, idx) => {
                const isWall = wallPriceSet.has(bid.price);
                const widthPct = ((bid.usdVolume || 1) / maxVol) * 100;
                return (
                  <div
                    key={`bid-${idx}`}
                    className={`relative flex items-center justify-between px-2 py-0.5 rounded transition ${
                      isWall ? 'bg-[#0ECB81]/20 border border-[#0ECB81]/50 font-bold' : 'hover:bg-[#2B2F36]'
                    }`}
                  >
                    <div
                      className="absolute right-0 top-0 bottom-0 bg-[#0ECB81]/15 pointer-events-none rounded"
                      style={{ width: `${widthPct}%` }}
                    />
                    <span className="text-[#0ECB81] font-bold z-10">${bid.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    <span className="text-[#EAECEF] z-10">{bid.amount.toFixed(3)}</span>
                    <span className="text-[#848E9C] z-10 text-[10px]">
                      ${((bid.usdVolume || (bid.price * bid.amount)) / 1000).toFixed(1)}k
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bottom Trade Tape */}
          <div className="h-44 border-t border-[#2B2F36] flex flex-col bg-[#181A20]">
            <div className="p-2 border-b border-[#2B2F36] flex items-center justify-between text-[11px] font-bold text-[#848E9C] uppercase">
              <span>Realtime Trade Tape</span>
              <span className="text-[10px] text-[#848E9C]">Live Ticks</span>
            </div>
            <div className="flex-1 overflow-y-auto p-2 divide-y divide-[#2B2F36] font-mono text-[10px]">
              {trades.length === 0 ? (
                <div className="p-4 text-center text-[#848E9C] text-xs">Waiting for live executions...</div>
              ) : (
                trades.slice(0, 12).map((t) => (
                  <div key={t.id} className="py-1 flex items-center justify-between">
                    <span className={`font-bold ${t.side === 'BUY' ? 'text-[#0ECB81]' : 'text-[#F6465D]'}`}>
                      ${t.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-[#EAECEF]">{t.amount.toFixed(3)}</span>
                    <span className="text-[#848E9C]">{new Date(t.timestamp).toLocaleTimeString()}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
