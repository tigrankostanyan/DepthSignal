import React from 'react';
import { Activity } from 'lucide-react';
import type { MarketTicker, OrderBookSnapshot } from '@/types/index';
import { formatUsdPrice, formatUsd } from '@/lib/format';

interface DepthChartProps {
  orderBook: OrderBookSnapshot | null;
  ticker: MarketTicker | null;
  symbol: string;
}

export const DepthChart: React.FC<DepthChartProps> = ({ orderBook, ticker, symbol }) => {
  const depthChart = React.useMemo(() => {
    if (!orderBook || orderBook.bids.length === 0 || orderBook.asks.length === 0) {
      return { bidPts: [], askPts: [], maxCum: 0, minPrice: 0, maxPrice: 0 };
    }
    const bidPts: { price: number; cum: number }[] = [];
    let bidCum = 0;
    for (const b of [...orderBook.bids].reverse()) {
      bidCum += b.usdVolume || b.price * b.amount;
      bidPts.push({ price: b.price, cum: bidCum });
    }
    const askPts: { price: number; cum: number }[] = [];
    let askCum = 0;
    for (const a of orderBook.asks) {
      askCum += a.usdVolume || a.price * a.amount;
      askPts.push({ price: a.price, cum: askCum });
    }
    const all = [...bidPts, ...askPts];
    const maxCum = Math.max(...all.map(p => p.cum), 1);
    const minPrice = Math.min(...all.map(p => p.price));
    const maxPrice = Math.max(...all.map(p => p.price));
    return { bidPts, askPts, maxCum, minPrice, maxPrice };
  }, [orderBook]);

  const priceToXPct = (price: number) => {
    const { minPrice, maxPrice } = depthChart;
    const span = maxPrice - minPrice || 1;
    return ((price - minPrice) / span) * 100;
  };

  const cumToYPct = (cum: number) => {
    return 100 - (cum / depthChart.maxCum) * 100;
  };

  const bidPath = depthChart.bidPts && depthChart.bidPts.length
    ? depthChart.bidPts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${priceToXPct(p.price).toFixed(2)} ${cumToYPct(p.cum).toFixed(2)}`).join(' ')
    : '';
  const askPath = depthChart.askPts && depthChart.askPts.length
    ? depthChart.askPts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${priceToXPct(p.price).toFixed(2)} ${cumToYPct(p.cum).toFixed(2)}`).join(' ')
    : '';
  const midPricePct = ticker ? priceToXPct(ticker.lastPrice) : 50;

  return (
    <div className="p-3 border-t border-divider bg-card">
      <div className="text-[11px] font-bold text-muted uppercase tracking-wider mb-2 flex items-center space-x-1.5">
        <Activity size={13} className="text-accent" />
        <span>Order Book Depth</span>
      </div>
      <div className="relative h-40 bg-primary rounded border border-divider overflow-hidden">
        {depthChart.bidPts && depthChart.bidPts.length > 0 && depthChart.askPts && depthChart.askPts.length > 0 ? (
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
            <defs>
              <linearGradient id={`bidFill-${symbol}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0ECB81" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#0ECB81" stopOpacity="0.0" />
              </linearGradient>
              <linearGradient id={`askFill-${symbol}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#F6465D" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#F6465D" stopOpacity="0.0" />
              </linearGradient>
            </defs>
            {/* Bid depth area (left, green) */}
            <path
              d={`M 0 100 L ${bidPath} L 0 100 Z`}
              fill={`url(#bidFill-${symbol})`}
            />
            <path
              d={`M ${bidPath}`}
              fill="none"
              stroke="#0ECB81"
              strokeWidth="1.2"
              vectorEffect="non-scaling-stroke"
            />
            {/* Ask depth area (right, red) */}
            <path
              d={`M 100 100 L ${askPath} L 100 100 Z`}
              fill={`url(#askFill-${symbol})`}
            />
            <path
              d={`M ${askPath}`}
              fill="none"
              stroke="#F6465D"
              strokeWidth="1.2"
              vectorEffect="non-scaling-stroke"
            />
            {/* Mid price marker */}
            <line
              x1={midPricePct}
              y1="0"
              x2={midPricePct}
              y2="100"
              stroke="#24C4E8"
              strokeWidth="0.5"
              strokeDasharray="1.5 1.5"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted text-xs">
            No depth data available
          </div>
        )}
        {ticker && depthChart.bidPts && depthChart.bidPts.length > 0 && (
          <div className="absolute bottom-1 left-2 text-[10px] font-mono text-bid">
            Bid {formatUsdPrice(depthChart.maxCum)} &middot; Mid {formatUsdPrice(ticker.lastPrice)}
          </div>
        )}
      </div>
    </div>
  );
};