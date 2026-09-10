import React from 'react';
import type { Trade } from '@/types/index';
import { formatUsd, formatAmount } from '@/lib/format';

interface TradeTapeProps {
  trades: Trade[];
}

export const TradeTape: React.FC<TradeTapeProps> = ({ trades }) => {
  return (
    <div className="h-44 border-t border-divider flex flex-col bg-card">
      <div className="p-2 border-b border-divider flex items-center justify-between text-[11px] font-bold text-muted uppercase">
        <span>Realtime Trade Tape</span>
        <span className="text-[10px] text-muted">Live Ticks</span>
      </div>
      <div className="flex-1 overflow-y-auto p-2 divide-y divide-divider font-mono text-[10px]">
        {trades.length === 0 ? (
          <div className="p-4 text-center text-muted text-xs">Waiting for live executions...</div>
        ) : (
          trades.slice(0, 12).map((t) => (
            <div key={t.id} className="py-1 flex items-center justify-between">
              <span className={`font-bold ${t.side === 'BUY' ? 'text-bid' : 'text-ask'}`}>
                {formatUsd(t.price)}
              </span>
              <span className="text-main">{formatAmount(t.amount)}</span>
              <span className="text-muted">{new Date(t.timestamp).toLocaleTimeString()}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};