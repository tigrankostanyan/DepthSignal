import React, { useState, useEffect } from 'react';
import { History, BarChart3, Clock, Layers, Filter, CheckCircle2, XCircle } from 'lucide-react';
import { DailyWallAggregate, HistoricalWallRecord } from '../../types/index.js';
import { fetchDailyAggregates, fetchWallHistory } from '../../lib/api.js';

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

  const totalHistoricalWalls = aggregates.reduce((sum, a) => sum + a.totalWalls, 0);
  const totalHistoricalVolume = aggregates.reduce((sum, a) => sum + a.totalVolumeUsd, 0);
  const totalFilled = aggregates.reduce((sum, a) => sum + a.filledWalls, 0);
  const fillRate = totalHistoricalWalls > 0 ? (totalFilled / totalHistoricalWalls) * 100 : 0;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0B0E11] overflow-hidden select-none text-xs">
      {/* Header */}
      <div className="p-4 border-b border-[#2B2F36] bg-[#181A20] flex flex-wrap items-center justify-between gap-3 flex-none">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded bg-[#F0B90B]/10 border border-[#F0B90B]/30 text-[#F0B90B]">
            <History size={20} />
          </div>
          <div>
            <h1 className="text-base font-bold text-white uppercase tracking-tight">90-Day Historical Wall Intelligence</h1>
            <p className="text-xs text-[#848E9C]">Persistent order book wall lifecycle records, fill rates, and spoofing telemetry</p>
          </div>
        </div>

        {/* Filter */}
        <div className="flex items-center space-x-2">
          <input
            type="text"
            placeholder="Filter Symbol (e.g. BTCUSDT)..."
            value={filterSymbol}
            onChange={(e) => setFilterSymbol(e.target.value)}
            className="bg-[#0B0E11] border border-[#2B2F36] rounded px-3 py-1.5 text-white uppercase font-mono focus:border-[#F0B90B] focus:outline-none w-56"
          />
        </div>
      </div>

      {/* Stats Summary Bar */}
      <div className="p-4 bg-[#181A20] border-b border-[#2B2F36] grid grid-cols-2 sm:grid-cols-4 gap-3 flex-none">
        <div className="bg-[#1E2329] p-3 rounded-lg border border-[#2B2F36]">
          <div className="text-[11px] text-[#848E9C] font-semibold uppercase">30D Wall Count</div>
          <div className="text-lg font-bold font-mono text-white mt-1">{totalHistoricalWalls}</div>
        </div>

        <div className="bg-[#1E2329] p-3 rounded-lg border border-[#2B2F36]">
          <div className="text-[11px] text-[#848E9C] font-semibold uppercase">Total Historical Liquidity</div>
          <div className="text-lg font-bold font-mono text-[#F0B90B] mt-1">${(totalHistoricalVolume / 1e6).toFixed(1)}M</div>
        </div>

        <div className="bg-[#1E2329] p-3 rounded-lg border border-[#2B2F36]">
          <div className="text-[11px] text-[#848E9C] font-semibold uppercase">Historical Fill Rate</div>
          <div className="text-lg font-bold font-mono text-[#0ECB81] mt-1">{fillRate.toFixed(1)}%</div>
        </div>

        <div className="bg-[#1E2329] p-3 rounded-lg border border-[#2B2F36]">
          <div className="text-[11px] text-[#848E9C] font-semibold uppercase">Retention Policy</div>
          <div className="text-lg font-bold font-mono text-[#EAECEF] mt-1">90 Days SQLite</div>
        </div>
      </div>

      {/* Main Historical Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left border-collapse text-xs select-none">
          <thead className="sticky top-0 z-10 bg-[#181A20] border-b border-[#2B2F36] text-[11px] font-bold text-[#848E9C] uppercase tracking-wider">
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
          <tbody className="divide-y divide-[#2B2F36] font-mono text-[11px]">
            {history.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-16 text-center text-[#848E9C] font-sans text-xs">
                  No historical wall outcomes recorded yet. Wall outcomes persist automatically as barriers are removed or filled.
                </td>
              </tr>
            ) : (
              history.map(item => (
                <tr key={item.id} className="hover:bg-[#1E2329] transition">
                  <td className="py-3 px-4 font-sans">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-white">{item.symbol}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#0B0E11] text-[#848E9C] border border-[#2B2F36]">
                        {item.exchange}
                      </span>
                    </div>
                  </td>

                  <td className="py-3 px-4">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      item.side === 'BID' ? 'bg-[#0ECB81]/15 text-[#0ECB81]' : 'bg-[#F6465D]/15 text-[#F6465D]'
                    }`}>
                      {item.side}
                    </span>
                  </td>

                  <td className="py-3 px-4 text-right font-bold text-[#EAECEF]">
                    ${item.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>

                  <td className="py-3 px-4 text-right text-[#848E9C]">
                    ${(item.initialVolumeUsd / 1e3).toFixed(0)}k
                  </td>

                  <td className="py-3 px-4 text-right text-[#F0B90B] font-bold">
                    ${(item.peakVolumeUsd / 1e3).toFixed(0)}k
                  </td>

                  <td className="py-3 px-4 text-center text-[#848E9C]">
                    {item.durationSeconds}s
                  </td>

                  <td className="py-3 px-4 text-center">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      item.outcome === 'FILLED'
                        ? 'bg-[#0ECB81]/15 text-[#0ECB81] border border-[#0ECB81]/30'
                        : item.outcome === 'SPOOFED'
                        ? 'bg-[#F6465D]/15 text-[#F6465D] border border-[#F6465D]/30'
                        : 'bg-[#2B2F36] text-[#848E9C]'
                    }`}>
                      {item.outcome}
                    </span>
                  </td>

                  <td className="py-3 px-4 text-right font-bold text-[#F0B90B]">
                    {item.fillRatioPercent ? `${item.fillRatioPercent.toFixed(1)}%` : '--'}
                  </td>

                  <td className="py-3 px-4 text-right text-[#848E9C]">
                    {new Date(item.endedAt).toLocaleTimeString()}
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
