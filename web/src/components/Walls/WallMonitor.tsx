import React from 'react';
import { Layers, Clock, ShieldCheck, ArrowRight } from 'lucide-react';
import type { DetectedWall, ExchangeId, MarketType } from '@/types/index';
import { WALL_VOLUME_THRESHOLDS, WALL_DISTANCE_THRESHOLDS } from '@/lib/constants';
import { formatUsdCompact, formatUsdPrice, formatPercent } from '@/lib/format';
import { Badge } from '@/components/ui/Badge';
import { StatCard } from '@/components/ui/StatCard';
import { Toggle } from '@/components/ui/Toggle';

interface WallMonitorProps {
  walls: DetectedWall[];
  onSelectSymbol: (symbol: string, exchange: ExchangeId, marketType: MarketType) => void;
  crossExchangeAggregation: boolean;
  onToggleAggregation: (val: boolean) => void;
  minVolumeUsd: number;
  onUpdateMinVolume: (val: number) => void;
  maxDistancePercent: number;
  onUpdateMaxDistance: (val: number) => void;
}

export const WallMonitor: React.FC<WallMonitorProps> = ({
  walls,
  onSelectSymbol,
  crossExchangeAggregation,
  onToggleAggregation,
  minVolumeUsd,
  onUpdateMinVolume,
  maxDistancePercent,
  onUpdateMaxDistance,
}) => {
  const bidWalls = walls.filter(w => w.side === 'BID');
  const askWalls = walls.filter(w => w.side === 'ASK');
  const totalVolume = walls.reduce((sum, w) => sum + w.volumeUsd, 0);

  const [renderLimit, setRenderLimit] = React.useState(50);

  // Reset chunking when important filters change
  React.useEffect(() => {
    setRenderLimit(50);
  }, [minVolumeUsd, maxDistancePercent, crossExchangeAggregation]);

  React.useEffect(() => {
    if (renderLimit < walls.length) {
      const timer = setTimeout(() => {
        setRenderLimit((prev) => prev + 100);
      }, 30);
      return () => clearTimeout(timer);
    }
  }, [renderLimit, walls.length]);

  const displayedWalls = walls.slice(0, renderLimit);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-primary select-none">
      {/* Wall Header & Key Metrics */}
      <div className="p-4 border-b border-divider bg-card flex-none">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center space-x-2">
              <Layers className="text-accent" size={20} />
              <h1 className="text-base font-bold text-white uppercase tracking-tight">Order Book Wall Detection Engine</h1>
            </div>
            <p className="text-xs text-muted mt-0.5">
              Live server-side liquidity barrier monitor across verified exchange order books
            </p>
          </div>

          {/* Aggregation Toggle Banner */}
          <div className="flex items-center space-x-3 bg-surface px-3.5 py-2 rounded-lg border border-divider">
            <div className="text-right">
              <div className="text-xs font-bold text-main">Cross-Exchange Aggregation</div>
              <div className="text-[10px] text-muted font-mono">Default: OFF (Independent Tracking)</div>
            </div>
            <Toggle checked={crossExchangeAggregation} onChange={onToggleAggregation} ariaLabel="Cross-exchange aggregation" />
          </div>
        </div>

        {/* Realtime Wall Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            label="Active Walls"
            value={walls.length}
            size="xl"
            sub={`${walls.filter(w => w.state === 'CONFIRMED').length} Confirmed • ${walls.filter(w => w.state === 'FORMING').length} Forming`}
          />
          <StatCard
            label="Total Wall Liquidity"
            value={formatUsdCompact(totalVolume, 2)}
            accent="text-accent"
            size="xl"
            sub="Across order book depths"
          />
          <StatCard
            label={
              <span className="flex items-center">
                <span className="w-1.5 h-1.5 rounded-full bg-bid mr-1.5" />
                Bid Walls (Support)
              </span>
            }
            value={bidWalls.length}
            accent="text-bid"
            size="xl"
            sub={`${formatUsdCompact(bidWalls.reduce((s, w) => s + w.volumeUsd, 0), 2)} USD`}
          />
          <StatCard
            label={
              <span className="flex items-center">
                <span className="w-1.5 h-1.5 rounded-full bg-ask mr-1.5" />
                Ask Walls (Resistance)
              </span>
            }
            value={askWalls.length}
            accent="text-ask"
            size="xl"
            sub={`${formatUsdCompact(askWalls.reduce((s, w) => s + w.volumeUsd, 0), 2)} USD`}
          />
        </div>

        {/* Engine Parameters Controls */}
        <div className="mt-4 pt-3 border-t border-divider flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <span className="text-muted font-semibold">Min Volume:</span>
              <select
                value={minVolumeUsd}
                onChange={(e) => onUpdateMinVolume(Number(e.target.value))}
                className="bg-primary border border-divider rounded px-2.5 py-1 text-accent font-mono font-bold focus:outline-none"
              >
                {WALL_VOLUME_THRESHOLDS.map((v) => (
                  <option key={v} value={v}>
                    ${v.toLocaleString()}{v === 500_000 ? ' (Standard)' : v === 1_000_000 ? ' (Institutional)' : v === 2_000_000 ? ' (Whale)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-muted font-semibold">Max Distance:</span>
              <select
                value={maxDistancePercent}
                onChange={(e) => onUpdateMaxDistance(Number(e.target.value))}
                className="bg-primary border border-divider rounded px-2.5 py-1 text-accent font-mono font-bold focus:outline-none"
              >
                {WALL_DISTANCE_THRESHOLDS.map((d) => (
                  <option key={d} value={d}>
                    {d.toFixed(1)}%{d === 2.5 ? ' (Standard)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="text-[11px] text-muted flex items-center space-x-1">
            <ShieldCheck size={14} className="text-bid" />
            <span>Futures wall distance calculates from <strong className="text-white">Mark Price</strong> (Strict Rule)</span>
          </div>
        </div>
      </div>

      {/* Main Wall Table */}
      <div className="flex-1 overflow-auto min-h-0 p-3">
        <div className="bg-card rounded-lg border border-divider overflow-hidden">
          <table className="w-full text-left border-collapse text-xs select-none">
            <thead className="sticky top-0 z-10 bg-surface border-b border-divider text-[11px] font-bold text-muted uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Instrument</th>
                <th className="py-3 px-4">Side / Barrier</th>
                <th className="py-3 px-4 text-right">Wall Price ($)</th>
                <th className="py-3 px-4 text-right">Reference Price</th>
                <th className="py-3 px-4 text-right">Distance (%)</th>
                <th className="py-3 px-4 text-right">Volume (USD)</th>
                <th className="py-3 px-4 text-center">State</th>
                <th className="py-3 px-4 text-center">Duration</th>
                <th className="py-3 px-4 text-center">Exchange Type</th>
                <th className="py-3 px-4 text-center w-16">Focus</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-divider font-mono text-[11px]">
              {displayedWalls.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-16 text-center text-muted font-sans text-xs">
                    <Layers size={24} className="mx-auto mb-2 opacity-40 text-accent" />
                    <div>No active order book walls currently qualify under the {formatUsdCompact(minVolumeUsd)} threshold.</div>
                    <div className="text-[11px] text-muted mt-1">Lower the volume filter above or wait for major liquidity barrier formation.</div>
                  </td>
                </tr>
              ) : (
                displayedWalls.map((wall) => {
                  const isBid = wall.side === 'BID';
                  return (
                    <tr
                      key={wall.id}
                      onClick={() => onSelectSymbol(wall.symbol, wall.exchange, wall.marketType)}
                      className="hover:bg-panel transition cursor-pointer group"
                    >
                      {/* Instrument */}
                      <td className="py-3 px-4 font-sans">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-main group-hover:text-accent transition text-xs">
                            {wall.symbol}
                          </span>
                          <Badge tone="neutral">{wall.exchange}</Badge>
                          <span className="text-[9px] px-1.5 py-0.5 rounded font-mono font-bold bg-surface text-accent border border-divider">
                            {wall.marketType}
                          </span>
                        </div>
                      </td>

                      {/* Side */}
                      <td className="py-3 px-4">
                        <Badge tone={isBid ? 'green' : 'red'} bordered>
                          {isBid ? 'BID (SUPPORT)' : 'ASK (RESISTANCE)'}
                        </Badge>
                      </td>

                      {/* Wall Price */}
                      <td className="py-3 px-4 text-right font-bold text-main">
                        {formatUsdPrice(wall.price)}
                      </td>

                      {/* Reference Price */}
                      <td className="py-3 px-4 text-right text-main">
                        <div>{formatUsdPrice(wall.referencePrice)}</div>
                        <div className="text-[9px] text-muted">{wall.marketType === 'FUTURES' ? 'Futures Mark' : 'Spot Last'}</div>
                      </td>

                      {/* Distance % */}
                      <td className="py-3 px-4 text-right">
                        <span className="font-bold text-accent">
                          {formatPercent(wall.distancePercent)}
                        </span>
                      </td>

                      {/* Volume USD */}
                      <td className="py-3 px-4 text-right font-bold text-main">
                        {formatUsdCompact(wall.volumeUsd, 2)}
                      </td>

                      {/* State */}
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          wall.state === 'CONFIRMED'
                            ? 'bg-bid/20 text-bid border border-[#0ECB81]/40'
                            : 'bg-accent/20 text-[#24C4E8] border border-[#24C4E8]/50 animate-pulse'
                        }`}>
                          {wall.state}
                        </span>
                      </td>

                      {/* Duration */}
                      <td className="py-3 px-4 text-center text-muted">
                        <div className="inline-flex items-center space-x-1">
                          <Clock size={11} className="text-muted" />
                          <span>{wall.durationSeconds}s</span>
                        </div>
                      </td>

                      {/* Exchange Type */}
                      <td className="py-3 px-4 text-center">
                        {wall.isAggregated ? (
                          <span className="px-1.5 py-0.5 rounded bg-panel text-accent text-[10px] font-bold border border-divider">
                            Cross-Exchange Aggregated
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted">Single Exchange</span>
                        )}
                      </td>

                      {/* Focus Action */}
                      <td className="py-3 px-4 text-center">
                        <button className="p-1 rounded hover:bg-panel text-muted hover:text-accent transition">
                          <ArrowRight size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
