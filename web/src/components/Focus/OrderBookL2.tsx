import React from 'react';
import type { MarketTicker, OrderBookSnapshot } from '@/types/index';
import { formatUsd, formatUsdCompact, formatAmount, formatPercent } from '@/lib/format';

interface OrderBookL2Props {
  orderBook: OrderBookSnapshot | null;
  ticker: MarketTicker | null;
  wallPriceSet: Set<number>;
}

export const OrderBookL2: React.FC<OrderBookL2Props> = ({ orderBook, ticker, wallPriceSet }) => {
  const bids = orderBook?.bids || [];
  const asks = orderBook?.asks || [];
  const maxBidVol = Math.max(...bids.map(b => b.usdVolume || 1), 1);
  const maxAskVol = Math.max(...asks.map(a => a.usdVolume || 1), 1);
  const maxVol = Math.max(maxBidVol, maxAskVol);

  return (
    <>
      {/* Header */}
      <div className="p-2.5 border-b border-divider bg-surface flex items-center justify-between">
        <span className="font-bold text-main text-xs uppercase tracking-wider">Level 2 Order Book</span>
        <span className="text-[10px] text-muted font-mono">
          Spread: {formatAmount(orderBook?.spread ?? 0, 2)} ({formatPercent(orderBook?.spreadPercent ?? 0, 3)})
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
                  isWall ? 'bg-ask/10 border border-[#F6465D]/40 font-bold shadow-[inset_0_0_12px_rgba(246,70,93,0.15)]' : 'hover:bg-panel'
                }`}
              >
                <div
                  className="absolute right-0 top-0 bottom-0 bg-ask/15 pointer-events-none rounded"
                  style={{ width: `${widthPct}%` }}
                />
                <span className="text-ask font-bold z-10">{formatUsd(ask.price)}</span>
                <span className="text-main z-10">{formatAmount(ask.amount)}</span>
                <span className="text-muted z-10 text-[10px]">
                  {formatUsdCompact(ask.usdVolume || (ask.price * ask.amount))}
                </span>
              </div>
            );
          })}
        </div>

        {/* Mid Price Separator */}
        <div className="py-1.5 px-3 bg-primary rounded border border-divider flex items-center justify-between font-bold text-xs my-1">
          <span className="text-muted font-sans text-[10px]">CURRENT PRICE</span>
          <span className="text-white">{formatUsd(ticker?.lastPrice ?? 0)}</span>
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
                  isWall ? 'bg-bid/10 border border-[#0ECB81]/40 font-bold shadow-[inset_0_0_12px_rgba(14,203,129,0.15)]' : 'hover:bg-panel'
                }`}
              >
                <div
                  className="absolute right-0 top-0 bottom-0 bg-bid/15 pointer-events-none rounded"
                  style={{ width: `${widthPct}%` }}
                />
                <span className="text-bid font-bold z-10">{formatUsd(bid.price)}</span>
                <span className="text-main z-10">{formatAmount(bid.amount)}</span>
                <span className="text-muted z-10 text-[10px]">
                  {formatUsdCompact(bid.usdVolume || (bid.price * bid.amount))}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
};