import React, { useState, useEffect } from 'react';
import { History, Filter } from 'lucide-react';
import type { DailyWallAggregate, HistoricalWallRecord } from '@/types/index';
import { fetchDailyAggregates, fetchWallHistory } from '@/lib/api';
import { formatUsd, formatUsdCompact, formatPercent } from '@/lib/format';
import { Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';

export const HistoricalWallsView: React.FC = () => {
  const [history, setHistory] = useState<HistoricalWallRecord[]>([]);
  const [aggregates, setAggregates] = useState<DailyWallAggregate[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSymbol, setFilterSymbol] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [hist, aggs] = await Promise.all([
          fetchWallHistory(filterSymbol || undefined),
          fetchDailyAggregates(30)
        ]);
        setHistory(hist);
        setAggregates(aggs);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [filterSymbol]);

  const totalHistoricalWalls = aggregates.reduce((sum, a) => sum + a.wallCount, 0);
  const totalHistoricalVolume = aggregates.reduce((sum, a) => sum + a.wallCount * a.avgVolumeUsd, 0);
  const totalFilled = aggregates.reduce((sum, a) => sum + a.filledCount, 0);
  const fillRate = totalHistoricalWalls > 0 ? (totalFilled / totalHistoricalWalls) * 100 : 0;

  // Derive a display outcome from the persisted wall state (final_state).
  const outcomeFor = (item: HistoricalWallRecord): 'FILLED' | 'SPOOFED' | 'CONFIRMED' => {
    if (item.state === 'FILLED') return 'FILLED';
    if (item.state === 'REMOVED') return 'SPOOFED';
    return 'CONFIRMED';
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-primary select-none text-xs">
      {/* Header */}
      <div className="flex-none">
        <PageHeader
          icon={<History size={20} />}
          title="90-Day Historical Wall Intelligence"
          subtitle="Persistent order book wall lifecycle records, fill rates, and spoofing telemetry"
          actions={
            <input
              type="text"
              placeholder="Filter Symbol (e.g. BTCUSDT)..."
              value={filterSymbol}
              onChange={(e) => setFilterSymbol(e.target.value)}
              className="bg-primary border border-divider rounded-lg px-3 py-1.5 text-white uppercase font-mono focus:border-[#168FD6] focus:outline-none w-56"
            />
          }
        />
      </div>

      {/* Stats Summary Bar */}
      <div className="p-4 bg-card border-b border-divider grid grid-cols-2 sm:grid-cols-4 gap-3 flex-none">
        <StatCard label="30D Wall Count" value={totalHistoricalWalls} />
        <StatCard label="Total Historical Liquidity" value={formatUsdCompact(totalHistoricalVolume, 1)} accent="text-accent" />
        <StatCard label="Historical Fill Rate" value={formatPercent(fillRate, 1)} accent="text-bid" />
        <StatCard label="Retention Policy" value="90 Days SQLite" accent="text-main" />
      </div>

      {/* Main Historical Table */}
      <div className="flex-1 overflow-auto min-h-0">
        <table className="w-full text-left border-collapse text-xs select-none">
          <thead className="sticky top-0 z-10 bg-card border-b border-divider text-[11px] font-bold text-muted uppercase tracking-wider">
            <tr>
              <th className="py-2.5 px-4">Instrument</th>
              <th className="py-2.5 px-4">Side</th>
              <th className="py-2.5 px-4 text-right">Price ($)</th>
              <th className="py-2.5 px-4 text-right">Initial Vol</th>
              <th className="py-2.5 px-4 text-right">Peak Vol</th>
              <th className="py-2.5 px-4 text-center">Duration</th>
              <th className="py-2.5 px-4 text-center">Outcome</th>
              <th className="py-2.5 px-4 text-right">Fill Ratio</th>
              <th className="py-2.5 px-4 text-right">Ended At</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-divider font-mono text-[11px]">
            {history.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-16 text-center text-muted font-sans text-xs">
                  No historical wall outcomes recorded yet. Wall outcomes persist automatically as barriers are removed or filled.
                </td>
              </tr>
            ) : (
              history.map(item => (
                <tr key={item.id} className="hover:bg-surface transition">
                  <td className="py-3 px-4 font-sans">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-white">{item.symbol}</span>
                      <Badge tone="neutral">{item.exchange}</Badge>
                    </div>
                  </td>

                  <td className="py-3 px-4">
                    <Badge tone={item.side === 'BID' ? 'green' : 'red'}>{item.side}</Badge>
                  </td>

                  <td className="py-3 px-4 text-right font-bold text-main">
                    {formatUsd(item.price)}
                  </td>

                  <td className="py-3 px-4 text-right text-muted">
                    {formatUsdCompact(item.initialVolumeUsd, 0)}
                  </td>

                  <td className="py-3 px-4 text-right text-accent font-bold">
                    {formatUsdCompact(item.peakVolumeUsd, 0)}
                  </td>

                  <td className="py-3 px-4 text-center text-muted">
                    {item.durationSeconds}s
                  </td>

                  <td className="py-3 px-4 text-center">
                    <Badge
                      tone={outcomeFor(item) === 'FILLED' ? 'green' : outcomeFor(item) === 'SPOOFED' ? 'red' : 'neutral'}
                      bordered={outcomeFor(item) !== 'CONFIRMED'}
                    >
                      {outcomeFor(item)}
                    </Badge>
                  </td>

                  <td className="py-3 px-4 text-right font-bold text-accent">
                    {item.fillPercentage ? formatPercent(item.fillPercentage, 1) : '--'}
                  </td>

                  <td className="py-3 px-4 text-right text-muted">
                    {new Date(item.createdAt).toLocaleTimeString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
