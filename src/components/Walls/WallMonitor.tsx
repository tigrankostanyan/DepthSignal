import React from 'react';
import { 
  Layers, 
  Clock, 
  ShieldCheck, 
  TrendingUp, 
  Sliders, 
  ArrowRight,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import { DetectedWall, ExchangeId, MarketType } from '../../types/index.js';

interface WallMonitorProps {
  walls: DetectedWall[];
  onSelectSymbol: (symbol: string, exchange: ExchangeId, marketType: string) => void;
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
  onUpdateMaxDistance
}) => {
  const bidWalls = walls.filter(w => w.side === 'BID');
  const askWalls = walls.filter(w => w.side === 'ASK');
  const totalVolume = walls.reduce((sum, w) => sum + w.volumeUsd, 0);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0B0E11] overflow-hidden select-none">
      {/* Wall Header & Key Metrics */}
      <div className="p-4 border-b border-[#2B2F36] bg-[#181A20] flex-none">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center space-x-2">
              <Layers className="text-[#F0B90B]" size={20} />
              <h1 className="text-base font-bold text-white uppercase tracking-tight">Order Book Wall Detection Engine</h1>
            </div>
            <p className="text-xs text-[#848E9C] mt-0.5">
              Live server-side liquidity barrier monitor across verified exchange order books
            </p>
          </div>

          {/* Aggregation Toggle Banner */}
          <div className="flex items-center space-x-3 bg-[#1E2329] px-3.5 py-2 rounded-lg border border-[#2B2F36]">
            <div className="text-right">
              <div className="text-xs font-bold text-[#EAECEF]">Cross-Exchange Aggregation</div>
              <div className="text-[10px] text-[#848E9C] font-mono">Default: OFF (Independent Tracking)</div>
            </div>
            <button
              onClick={() => onToggleAggregation(!crossExchangeAggregation)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                crossExchangeAggregation ? 'bg-[#F0B90B]' : 'bg-[#2B2F36]'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  crossExchangeAggregation ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Realtime Wall Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-[#1E2329] p-3 rounded-lg border border-[#2B2F36]">
            <div className="text-[11px] text-[#848E9C] font-semibold uppercase">Active Walls</div>
            <div className="text-xl font-bold font-mono text-white mt-1">{walls.length}</div>
            <div className="text-[10px] text-[#848E9C] mt-0.5">
              {walls.filter(w => w.state === 'CONFIRMED').length} Confirmed • {walls.filter(w => w.state === 'FORMING').length} Forming
            </div>
          </div>

          <div className="bg-[#1E2329] p-3 rounded-lg border border-[#2B2F36]">
            <div className="text-[11px] text-[#848E9C] font-semibold uppercase">Total Wall Liquidity</div>
            <div className="text-xl font-bold font-mono text-[#F0B90B] mt-1">
              ${(totalVolume / 1e6).toFixed(2)}M
            </div>
            <div className="text-[10px] text-[#848E9C] mt-0.5">Across order book depths</div>
          </div>

          <div className="bg-[#1E2329] p-3 rounded-lg border border-[#2B2F36]">
            <div className="text-[11px] text-[#0ECB81] font-semibold uppercase flex items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-[#0ECB81] mr-1.5" />
              Bid Walls (Support)
            </div>
            <div className="text-xl font-bold font-mono text-[#0ECB81] mt-1">{bidWalls.length}</div>
            <div className="text-[10px] text-[#848E9C] mt-0.5">
              ${(bidWalls.reduce((s, w) => s + w.volumeUsd, 0) / 1e6).toFixed(2)}M USD
            </div>
          </div>

          <div className="bg-[#1E2329] p-3 rounded-lg border border-[#2B2F36]">
            <div className="text-[11px] text-[#F6465D] font-semibold uppercase flex items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-[#F6465D] mr-1.5" />
              Ask Walls (Resistance)
            </div>
            <div className="text-xl font-bold font-mono text-[#F6465D] mt-1">{askWalls.length}</div>
            <div className="text-[10px] text-[#848E9C] mt-0.5">
              ${(askWalls.reduce((s, w) => s + w.volumeUsd, 0) / 1e6).toFixed(2)}M USD
            </div>
          </div>
        </div>

        {/* Engine Parameters Controls */}
        <div className="mt-4 pt-3 border-t border-[#2B2F36] flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <span className="text-[#848E9C] font-semibold">Min Volume:</span>
              <select
                value={minVolumeUsd}
                onChange={(e) => onUpdateMinVolume(Number(e.target.value))}
                className="bg-[#0B0E11] border border-[#2B2F36] rounded px-2.5 py-1 text-[#F0B90B] font-mono font-bold focus:outline-none"
              >
                <option value={100000}>$100,000</option>
                <option value={250000}>$250,000</option>
                <option value={500000}>$500,000 (Standard)</option>
                <option value={1000000}>$1,000,000 (Institutional)</option>
                <option value={2000000}>$2,000,000 (Whale)</option>
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-[#848E9C] font-semibold">Max Distance:</span>
              <select
                value={maxDistancePercent}
                onChange={(e) => onUpdateMaxDistance(Number(e.target.value))}
                className="bg-[#0B0E11] border border-[#2B2F36] rounded px-2.5 py-1 text-[#F0B90B] font-mono font-bold focus:outline-none"
              >
                <option value={1.0}>1.0%</option>
                <option value={2.5}>2.5% (Standard)</option>
                <option value={5.0}>5.0%</option>
                <option value={10.0}>10.0%</option>
              </select>
            </div>
          </div>

          <div className="text-[11px] text-[#848E9C] flex items-center space-x-1">
            <ShieldCheck size={14} className="text-[#0ECB81]" />
            <span>Futures wall distance calculates from <strong className="text-white">Mark Price</strong> (Strict Rule)</span>
          </div>
        </div>
      </div>

      {/* Main Wall Table */}
      <div className="flex-1 overflow-auto p-3">
        <div className="bg-[#181A20] rounded-lg border border-[#2B2F36] overflow-hidden">
          <table className="w-full text-left border-collapse text-xs select-none">
            <thead className="sticky top-0 z-10 bg-[#1E2329] border-b border-[#2B2F36] text-[11px] font-bold text-[#848E9C] uppercase tracking-wider">
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
            <tbody className="divide-y divide-[#2B2F36] font-mono text-[11px]">
              {walls.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-16 text-center text-[#848E9C] font-sans text-xs">
                    <Layers size={24} className="mx-auto mb-2 opacity-40 text-[#F0B90B]" />
                    <div>No active order book walls currently qualify under the ${minVolumeUsd.toLocaleString()} threshold.</div>
                    <div className="text-[11px] text-[#848E9C] mt-1">Lower the volume filter above or wait for major liquidity barrier formation.</div>
                  </td>
                </tr>
              ) : (
                walls.map((wall) => {
                  const isBid = wall.side === 'BID';
                  return (
                    <tr
                      key={wall.id}
                      onClick={() => onSelectSymbol(wall.symbol, wall.exchange, wall.marketType)}
                      className="hover:bg-[#2B2F36] transition cursor-pointer group"
                    >
                      {/* Instrument */}
                      <td className="py-3 px-4 font-sans">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-white group-hover:text-[#F0B90B] transition text-xs">
                            {wall.symbol}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#0B0E11] text-[#848E9C] border border-[#2B2F36]">
                            {wall.exchange}
                          </span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded font-mono font-bold bg-[#1E2329] text-[#F0B90B] border border-[#2B2F36]">
                            {wall.marketType}
                          </span>
                        </div>
                      </td>

                      {/* Side */}
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          isBid 
                            ? 'bg-[#0ECB81]/15 text-[#0ECB81] border border-[#0ECB81]/30' 
                            : 'bg-[#F6465D]/15 text-[#F6465D] border border-[#F6465D]/30'
                        }`}>
                          {isBid ? 'BID (SUPPORT)' : 'ASK (RESISTANCE)'}
                        </span>
                      </td>

                      {/* Wall Price */}
                      <td className="py-3 px-4 text-right font-bold text-[#EAECEF]">
                        ${wall.price >= 1 ? wall.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : wall.price}
                      </td>

                      {/* Reference Price */}
                      <td className="py-3 px-4 text-right text-[#EAECEF]">
                        <div>${wall.referencePrice >= 1 ? wall.referencePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : wall.referencePrice}</div>
                        <div className="text-[9px] text-[#848E9C]">{wall.marketType === 'FUTURES' ? 'Futures Mark' : 'Spot Last'}</div>
                      </td>

                      {/* Distance % */}
                      <td className="py-3 px-4 text-right">
                        <span className="font-bold text-[#F0B90B]">
                          {wall.distancePercent.toFixed(2)}%
                        </span>
                      </td>

                      {/* Volume USD */}
                      <td className="py-3 px-4 text-right font-bold text-white">
                        ${(wall.volumeUsd / 1e6).toFixed(2)}M
                      </td>

                      {/* State */}
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          wall.state === 'CONFIRMED'
                            ? 'bg-[#0ECB81]/20 text-[#0ECB81] border border-[#0ECB81]/40'
                            : 'bg-[#F0B90B]/20 text-[#F0B90B] border border-[#F0B90B]/40 animate-pulse'
                        }`}>
                          {wall.state}
                        </span>
                      </td>

                      {/* Duration */}
                      <td className="py-3 px-4 text-center text-[#848E9C]">
                        <div className="inline-flex items-center space-x-1">
                          <Clock size={11} className="text-[#848E9C]" />
                          <span>{wall.durationSeconds}s</span>
                        </div>
                      </td>

                      {/* Exchange Type */}
                      <td className="py-3 px-4 text-center">
                        {wall.isAggregated ? (
                          <span className="px-1.5 py-0.5 rounded bg-[#2B2F36] text-[#F0B90B] text-[10px] font-bold border border-[#2B2F36]">
                            Cross-Exchange Aggregated
                          </span>
                        ) : (
                          <span className="text-[10px] text-[#848E9C]">Single Exchange</span>
                        )}
                      </td>

                      {/* Focus Action */}
                      <td className="py-3 px-4 text-center">
                        <button className="p-1 rounded hover:bg-[#2B2F36] text-[#848E9C] hover:text-[#F0B90B] transition">
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
