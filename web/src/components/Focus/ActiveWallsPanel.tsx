import React from 'react';
import { Layers } from 'lucide-react';
import type { DetectedWall } from '@/types/index';
import { formatPrice, formatCompact, formatPercent } from '@/lib/format';
import { Badge } from '@/components/ui/Badge';

interface ActiveWallsPanelProps {
  symbol: string;
  walls: DetectedWall[];
}

export const ActiveWallsPanel: React.FC<ActiveWallsPanelProps> = ({ symbol, walls }) => {
  return (
    <div className="p-3 border-t border-divider bg-card">
      <div className="text-[11px] font-bold text-muted uppercase tracking-wider mb-2 flex items-center space-x-1.5">
        <Layers size={13} className="text-accent" />
        <span>Active Order Book Barriers for {symbol} ({walls.length})</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {walls.length === 0 ? (
          <div className="col-span-2 text-muted text-xs py-2">
            No liquidity walls currently detected within threshold distance.
          </div>
        ) : (
          walls.map(w => (
            <div key={w.id} className="p-2 rounded bg-surface border border-divider flex items-center justify-between text-xs font-mono">
              <div className="flex items-center space-x-2">
                <Badge tone={w.side === 'BID' ? 'green' : 'red'}>{w.side}</Badge>
                <span className="font-bold text-white">{formatPrice(w.price)}</span>
              </div>
              <div className="text-right">
                <span className="text-accent font-bold">{formatCompact(w.volumeUsd, 2)}</span>
                <span className="text-muted text-[10px] ml-1">({formatPercent(w.distancePercent)} away)</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};