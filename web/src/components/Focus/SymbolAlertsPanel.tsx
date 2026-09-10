import React from 'react';
import { BellRing } from 'lucide-react';
import type { AlertTrigger } from '@/types/index';
import { formatPrice } from '@/lib/format';
import { Badge } from '@/components/ui/Badge';

interface SymbolAlertsPanelProps {
  symbol: string;
  alertTriggers: AlertTrigger[];
}

export const SymbolAlertsPanel: React.FC<SymbolAlertsPanelProps> = ({ symbol, alertTriggers }) => {
  const symbolAlerts = alertTriggers
    .filter(t => t.symbol === symbol)
    .slice(0, 6);

  return (
    <div className="p-3 border-t border-divider bg-card">
      <div className="text-[11px] font-bold text-muted uppercase tracking-wider mb-2 flex items-center space-x-1.5">
        <BellRing size={13} className="text-accent" />
        <span>Active Alerts for {symbol} ({symbolAlerts.length})</span>
      </div>
      {symbolAlerts.length === 0 ? (
        <div className="text-muted text-xs py-2">
          No active alerts for this symbol. Configure rules in the Alerts page.
        </div>
      ) : (
        <div className="space-y-1.5">
          {symbolAlerts.map(a => (
            <div key={a.id} className="p-2 rounded bg-surface border border-divider flex items-center justify-between text-xs">
              <div className="flex items-center space-x-2 min-w-0">
                <Badge tone="yellow" bordered className="shrink-0">{a.conditionType}</Badge>
                <span className="text-main truncate">{a.message}</span>
              </div>
              <div className="text-right shrink-0 ml-2 font-mono text-[10px] text-muted">
                <div>@ {formatPrice(a.triggerPrice)}</div>
                <div>{new Date(a.timestamp).toLocaleTimeString()}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};