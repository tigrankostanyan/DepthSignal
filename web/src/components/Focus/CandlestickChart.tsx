import React from 'react';
import type { Candle, DetectedWall, MarketTicker } from '@/types/index';
import { TIMEFRAMES } from '@/lib/constants';
import { formatUsdPrice, formatCompact } from '@/lib/format';

interface CandlestickChartProps {
  candles: Candle[];
  symbolWalls: DetectedWall[];
  chartTimeframe: string;
  ticker: MarketTicker | null;
  onChangeTimeframe: (tf: '30s' | '1m' | '5m' | '15m' | '1h' | '4h' | '1d') => void;
}

export const CandlestickChart: React.FC<CandlestickChartProps> = ({
  candles,
  symbolWalls,
  chartTimeframe,
  ticker,
  onChangeTimeframe,
}) => {
  const minCandleLow = Math.min(...candles.map(c => c.low), ticker?.lastPrice || 1);
  const maxCandleHigh = Math.max(...candles.map(c => c.high), ticker?.lastPrice || 1);
  const priceRange = maxCandleHigh - minCandleLow || 1;

  return (
    <>
      {/* Chart Header & Timeframe Buttons */}
      <div className="p-2.5 border-b border-divider bg-card flex items-center justify-between">
        <div className="flex items-center space-x-1.5">
          {(TIMEFRAMES as string[]).map(tf => (
            <button
              key={tf}
              onClick={() => onChangeTimeframe(tf as any)}
              className={`px-2.5 py-1 rounded font-mono font-bold text-xs transition ${
                chartTimeframe === tf ? 'bg-panel text-white shadow-sm' : 'text-muted hover:text-white bg-primary border border-divider'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>

        <div className="flex items-center space-x-3 text-[11px] text-muted">
          <div className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded bg-bid inline-block" />
            <span>Support Walls ({symbolWalls.filter(w => w.side === 'BID').length})</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded bg-ask inline-block" />
            <span>Resistance Walls ({symbolWalls.filter(w => w.side === 'ASK').length})</span>
          </div>
        </div>
      </div>

      {/* Candlestick & Liquidity SVG Stage */}
      <div className="flex-1 relative p-4 flex flex-col justify-end bg-primary overflow-hidden">
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
                isBid ? 'bg-card text-bid border border-[#0ECB81]/50' : 'bg-card text-ask border border-[#F6465D]/50'
              }`}>
                {w.side} WALL: {formatUsdPrice(w.price)} ({formatCompact(w.volumeUsd, 2)})
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
                  className={`absolute w-px ${isGreen ? 'bg-bid' : 'bg-ask'}`}
                  style={{ top: `${highY}%`, height: `${wickHeight}%` }}
                />
                {/* Candle Body */}
                <div
                  className={`w-full max-w-[10px] rounded-[1px] absolute ${
                    isGreen ? 'bg-bid shadow-sm' : 'bg-ask shadow-sm'
                  }`}
                  style={{ top: `${topY}%`, height: `${bodyHeight}%` }}
                />
              </div>
            );
          })}
        </div>

        {/* Bottom Volume Sub-Chart */}
        <div className="w-full h-16 mt-3 pt-2 border-t border-divider flex items-end justify-between space-x-1">
          {candles.slice(-40).map((c, i) => {
            const maxVolInSeries = Math.max(...candles.map(cd => cd.volume), 1);
            const hPct = (c.volume / maxVolInSeries) * 100;
            return (
              <div
                key={i}
                className={`flex-1 rounded-t-[1px] ${c.close >= c.open ? 'bg-bid/40' : 'bg-ask/40'}`}
                style={{ height: `${Math.max(4, hPct)}%` }}
              />
            );
          })}
        </div>
      </div>
    </>
  );
};