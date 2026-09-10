import React from 'react';
import { Bell } from 'lucide-react';
import type { AlertTrigger } from '@/types/index';
import { formatTime, formatUsdPrice } from '@/lib/format';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';

interface AlertTriggerFeedProps {
  triggers: AlertTrigger[];
  onMarkRead: (id?: string) => void;
  onClearTriggers: () => void;
}

export const AlertTriggerFeed: React.FC<AlertTriggerFeedProps> = ({
  triggers,
  onMarkRead,
  onClearTriggers,
}) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between pb-2 border-b border-divider">
        <span className="text-xs text-muted font-medium">Historical Trigger Log ({triggers.length} events)</span>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => onMarkRead()}
            className="px-2.5 py-1 rounded bg-surface hover:bg-panel text-main text-xs font-medium border border-divider transition"
          >
            Mark All Read
          </button>
          <button
            onClick={onClearTriggers}
            className="px-2.5 py-1 rounded bg-ask/15 hover:bg-ask/25 text-ask text-xs font-medium border border-[#F6465D]/30 transition"
          >
            Clear Feed
          </button>
        </div>
      </div>

      {triggers.length === 0 ? (
        <EmptyState
          icon={<Bell size={28} className="text-accent opacity-40" />}
          title="No alerts triggered yet."
          message="Live market ticks will populate this feed as conditions are met."
          className="bg-card rounded-xl border border-divider"
        />
      ) : (
        triggers.map(trig => (
          <div
            key={trig.id}
            onClick={() => onMarkRead(trig.id)}
            className={`p-3.5 rounded-xl border transition cursor-pointer text-xs ${
              trig.read
                ? 'bg-card/60 border-divider opacity-80'
                : 'bg-surface border-[#24C4E8]/50 shadow-lg shadow-[#168FD6]/10'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center space-x-2">
                <span className="font-bold text-white text-sm font-sans">{trig.symbol}</span>
                <Badge tone="neutral">{trig.exchange} {trig.marketType}</Badge>
                <Badge tone="yellow">{trig.conditionType}</Badge>
              </div>
              <span className="text-[10px] font-mono text-muted">
                {formatTime(trig.timestamp)}
              </span>
            </div>

            <div className="text-main text-xs mb-2 font-medium">
              {trig.message}
            </div>

            <div className="flex items-center justify-between text-[11px] text-muted pt-1.5 border-t border-divider">
              <span>Triggered by: <strong className="text-white">{trig.ruleName}</strong></span>
              <span className="font-mono text-accent font-bold">
                Price at Event: {trig.triggerPrice ? formatUsdPrice(trig.triggerPrice) : '--'}
              </span>
            </div>
          </div>
        ))
      )}
    </div>
  );
};