import React, { useState } from 'react';
import { Ban, Plus, Trash2, Shield, AlertTriangle } from 'lucide-react';
import { BlacklistEntry } from '../../types/index.js';

interface BlacklistManagerProps {
  entries: BlacklistEntry[];
  onAddEntry: (entry: Partial<BlacklistEntry>) => Promise<void>;
  onRemoveEntry: (id: string) => Promise<void>;
}

export const BlacklistManager: React.FC<BlacklistManagerProps> = ({
  entries,
  onAddEntry,
  onRemoveEntry
}) => {
  const [symbol, setSymbol] = useState('');
  const [exchange, setExchange] = useState('');
  const [reason, setReason] = useState('');
  const [category, setCategory] = useState<'CRYPTO' | 'STOCKS'>('CRYPTO');

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!symbol.trim() && !exchange.trim()) return;

    await onAddEntry({
      symbol: symbol.trim().toUpperCase() || undefined,
      exchange: (exchange.trim().toUpperCase() as any) || undefined,
      reason: reason.trim() || 'Manual user exclusion',
      category
    });

    setSymbol('');
    setExchange('');
    setReason('');
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0B0E11] overflow-hidden select-none text-xs">
      {/* Header */}
      <div className="p-4 border-b border-[#2B2F36] bg-[#181A20] flex flex-wrap items-center justify-between gap-3 flex-none">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded bg-[#F6465D]/10 border border-[#F6465D]/30 text-[#F6465D]">
            <Ban size={20} />
          </div>
          <div>
            <h1 className="text-base font-bold text-white uppercase tracking-tight">Global Ingestion Blacklist</h1>
            <p className="text-xs text-[#848E9C]">Pre-filtering rules that exclude illiquid pairs, delisted tokens, or restricted exchanges</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-6">
        {/* Add Entry Card */}
        <div className="bg-[#181A20] border border-[#2B2F36] rounded-xl p-4 shadow-xl">
          <div className="text-xs font-bold text-white uppercase tracking-wider mb-3">
            Add Global Exclusion Rule
          </div>
          <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-[#848E9C] uppercase mb-1">Symbol (or leave empty)</label>
              <input
                type="text"
                placeholder="e.g. LUNAUSDT"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                className="w-full bg-[#0B0E11] border border-[#2B2F36] rounded px-2.5 py-1.5 text-white font-mono focus:border-[#F0B90B] focus:outline-none uppercase"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-[#848E9C] uppercase mb-1">Exchange (or leave empty)</label>
              <input
                type="text"
                placeholder="e.g. MEXC"
                value={exchange}
                onChange={(e) => setExchange(e.target.value)}
                className="w-full bg-[#0B0E11] border border-[#2B2F36] rounded px-2.5 py-1.5 text-white font-mono focus:border-[#F0B90B] focus:outline-none uppercase"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-[#848E9C] uppercase mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="w-full bg-[#0B0E11] border border-[#2B2F36] rounded px-2.5 py-1.5 text-[#EAECEF] font-mono focus:border-[#F0B90B] focus:outline-none"
              >
                <option value="CRYPTO">Crypto</option>
                <option value="STOCKS">Stocks</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-[#848E9C] uppercase mb-1">Reason / Notes</label>
              <input
                type="text"
                placeholder="e.g. Low liquidity / delisted"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full bg-[#0B0E11] border border-[#2B2F36] rounded px-2.5 py-1.5 text-white focus:border-[#F0B90B] focus:outline-none"
              />
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                className="w-full py-1.5 rounded bg-[#F6465D] hover:bg-[#F6465D]/90 text-white font-bold transition flex items-center justify-center space-x-1.5 shadow"
              >
                <Plus size={14} />
                <span>Add Exclusion</span>
              </button>
            </div>
          </form>
        </div>

        {/* Blacklist Table */}
        <div className="bg-[#181A20] border border-[#2B2F36] rounded-xl overflow-hidden shadow-lg">
          <div className="p-3 border-b border-[#2B2F36] bg-[#1E2329] flex items-center justify-between">
            <span className="font-bold text-[#EAECEF] text-xs">Active Blacklist Filters ({entries.length})</span>
            <span className="text-[10px] text-[#848E9C]">Pre-filtered before Alert & Screener pipelines</span>
          </div>

          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-[#181A20] text-[10px] font-bold text-[#848E9C] uppercase tracking-wider">
              <tr>
                <th className="py-2.5 px-4">Excluded Target</th>
                <th className="py-2.5 px-4">Exchange Scope</th>
                <th className="py-2.5 px-4">Category</th>
                <th className="py-2.5 px-4">Reason</th>
                <th className="py-2.5 px-4 text-right">Added At</th>
                <th className="py-2.5 px-4 text-center w-12">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2B2F36] font-mono text-[11px]">
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-[#848E9C] font-sans text-xs">
                    Blacklist is currently empty. All verified market instruments are ingested normally.
                  </td>
                </tr>
              ) : (
                entries.map(entry => (
                  <tr key={entry.id} className="hover:bg-[#1E2329] transition">
                    <td className="py-3 px-4 font-bold text-[#F6465D]">
                      {entry.symbol || 'ALL SYMBOLS'}
                    </td>
                    <td className="py-3 px-4 text-[#EAECEF]">
                      {entry.exchange || 'ALL EXCHANGES'}
                    </td>
                    <td className="py-3 px-4 text-[#848E9C]">
                      {entry.category || 'ALL'}
                    </td>
                    <td className="py-3 px-4 text-[#EAECEF] font-sans">
                      {entry.reason || '--'}
                    </td>
                    <td className="py-3 px-4 text-right text-[#848E9C]">
                      {new Date(entry.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => onRemoveEntry(entry.id)}
                        className="p-1 rounded hover:bg-[#F6465D]/20 text-[#848E9C] hover:text-[#F6465D] transition"
                        title="Remove from blacklist"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
