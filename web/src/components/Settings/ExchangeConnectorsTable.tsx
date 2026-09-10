import React from 'react';
import { Radio, RefreshCw } from 'lucide-react';
import type { ConnectorStatus, ExchangeId } from '@/types/index';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Card } from '@/components/ui/Card';

interface ExchangeConnectorsTableProps {
  connectors: ConnectorStatus[];
  enabledExchanges: ExchangeId[];
  onToggleExchange: (ex: ExchangeId) => void;
  onRefreshHealth: () => Promise<void>;
}

export const ExchangeConnectorsTable: React.FC<ExchangeConnectorsTableProps> = ({
  connectors,
  enabledExchanges,
  onToggleExchange,
  onRefreshHealth,
}) => {
  return (
    <Card className="overflow-hidden">
      <SectionHeader
        variant="panel"
        icon={<Radio size={14} className="text-accent" />}
        title="Exchange Connectors & Gateway Health"
        actions={
          <button
            onClick={onRefreshHealth}
            className="p-1 rounded hover:bg-panel text-muted hover:text-white transition"
            title="Refresh Health"
          >
            <RefreshCw size={13} />
          </button>
        }
      />

      <table className="w-full text-left border-collapse text-xs">
        <thead className="bg-card text-[10px] font-bold text-muted uppercase tracking-wider">
          <tr>
            <th className="py-2.5 px-4">Exchange</th>
            <th className="py-2.5 px-4">Category</th>
            <th className="py-2.5 px-4">Gateway Status</th>
            <th className="py-2.5 px-4 text-right">Ping / Latency</th>
            <th className="py-2.5 px-4 text-right">Ingested Tickers</th>
            <th className="py-2.5 px-4 text-center">Enable/Disable</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-divider font-mono text-[11px]">
          {connectors.map((c) => {
            const isEnabled = enabledExchanges.includes(c.exchange);
            return (
              <tr key={c.exchange} className="hover:bg-surface/80 transition-colors">
                <td className="py-3 px-4 font-bold text-white font-sans">{c.name}</td>
                <td className="py-3 px-4 text-muted">
                  {c.exchange === 'STOCK_EXCHANGE' ? 'US STOCKS' : 'CRYPTO'}
                </td>
                <td className="py-3 px-4">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center w-max border ${
                      c.connected
                        ? 'bg-bid/15 text-bid border-bid/30'
                        : 'bg-panel text-muted border-divider'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                        c.connected ? 'bg-bid animate-pulse' : 'bg-muted/40'
                      }`}
                    />
                    {c.connected ? 'CONNECTED' : 'DISCONNECTED'}
                  </span>
                </td>
                <td className="py-3 px-4 text-right text-main">{c.pingMs ? `${c.pingMs}ms` : '--'}</td>
                <td className="py-3 px-4 text-right text-[#24C4E8] font-bold">
                  {c.subscribedSymbolsCount.toLocaleString()}
                </td>
                <td className="py-3 px-4 text-center">
                  <button
                    onClick={() => onToggleExchange(c.exchange)}
                    className={`px-3 py-1 rounded text-xs font-bold transition border cursor-pointer ${
                      isEnabled
                        ? 'bg-accent/20 text-[#24C4E8] border-[#24C4E8]/50 hover:bg-accent/30'
                        : 'bg-primary text-muted border-divider hover:text-white hover:border-[#168FD6]/40'
                    }`}
                  >
                    {isEnabled ? 'ENABLED' : 'MUTED'}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
};
