import React, { useState } from 'react';
import { Ban, Plus, Trash2 } from 'lucide-react';
import type { BlacklistEntry } from '@/types/index';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { FormField } from '@/components/ui/FormField';
import { Badge } from '@/components/ui/Badge';
import { IconButton } from '@/components/ui/IconButton';

const condInputCls =
  'w-full bg-primary border border-divider rounded px-2.5 py-1.5 focus:border-[#168FD6] focus:outline-none';

interface BlacklistManagerProps {
  entries: BlacklistEntry[];
  onAddEntry: (entry: Omit<BlacklistEntry, 'id' | 'addedAt'>) => Promise<void>;
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
      exchange: (exchange.trim().toUpperCase() || undefined) as BlacklistEntry['exchange'],
      reason: reason.trim() || 'Manual user exclusion',
      category
    });

    setSymbol('');
    setExchange('');
    setReason('');
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-primary select-none text-xs">
      {/* Header */}
      <div className="flex-none">
        <PageHeader
          icon={<Ban size={20} />}
          iconClassName="p-2 rounded bg-ask/10 border border-[#F6465D]/30 text-ask"
          title="Global Ingestion Blacklist"
          subtitle="Pre-filtering rules that exclude illiquid pairs, delisted tokens, or restricted exchanges"
        />
      </div>

      <div className="flex-1 overflow-auto min-h-0 p-4 space-y-6">
        {/* Add Entry Card */}
        <Card className="p-4">
          <div className="text-xs font-bold text-white uppercase tracking-wider mb-3">
            Add Global Exclusion Rule
          </div>
          <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <FormField label="Symbol (or leave empty)">
              <input
                type="text"
                placeholder="e.g. LUNAUSDT"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                className={`${condInputCls} text-white font-mono uppercase`}
              />
            </FormField>

            <FormField label="Exchange (or leave empty)">
              <input
                type="text"
                placeholder="e.g. MEXC"
                value={exchange}
                onChange={(e) => setExchange(e.target.value)}
                className={`${condInputCls} text-white font-mono uppercase`}
              />
            </FormField>

            <FormField label="Category">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as 'CRYPTO' | 'STOCKS')}
                className={`${condInputCls} text-main font-mono`}
              >
                <option value="CRYPTO">Crypto</option>
                <option value="STOCKS">Stocks</option>
              </select>
            </FormField>

            <FormField label="Reason / Notes">
              <input
                type="text"
                placeholder="e.g. Low liquidity / delisted"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className={`${condInputCls} text-white`}
              />
            </FormField>

            <div className="flex items-end">
              <button
                type="submit"
                className="w-full py-1.5 rounded bg-ask hover:bg-ask/90 text-white font-bold transition flex items-center justify-center space-x-1.5 shadow"
              >
                <Plus size={14} />
                <span>Add Exclusion</span>
              </button>
            </div>
          </form>
        </Card>

        {/* Blacklist Table */}
        <Card className="overflow-hidden">
          <div className="p-3 border-b border-divider bg-surface flex items-center justify-between">
            <span className="font-bold text-main text-xs">Active Blacklist Filters ({entries.length})</span>
            <span className="text-[10px] text-muted">Pre-filtered before Alert & Screener pipelines</span>
          </div>

          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-card text-[10px] font-bold text-muted uppercase tracking-wider">
              <tr>
                <th className="py-2.5 px-4">Excluded Target</th>
                <th className="py-2.5 px-4">Exchange Scope</th>
                <th className="py-2.5 px-4">Category</th>
                <th className="py-2.5 px-4">Reason</th>
                <th className="py-2.5 px-4 text-right">Added At</th>
                <th className="py-2.5 px-4 text-center w-12">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-divider font-mono text-[11px]">
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted font-sans text-xs">
                    Blacklist is currently empty. All verified market instruments are ingested normally.
                  </td>
                </tr>
              ) : (
                entries.map(entry => (
                  <tr key={entry.id} className="hover:bg-surface transition">
                    <td className="py-3 px-4 font-bold text-ask">
                      {entry.symbol || 'ALL SYMBOLS'}
                    </td>
                    <td className="py-3 px-4">
                      <Badge tone="neutral">{entry.exchange || 'ALL EXCHANGES'}</Badge>
                    </td>
                    <td className="py-3 px-4">
                      <Badge tone="blue">{entry.category || 'ALL'}</Badge>
                    </td>
                    <td className="py-3 px-4 text-main font-sans">
                      {entry.reason || '--'}
                    </td>
                    <td className="py-3 px-4 text-right text-muted">
                      {new Date(entry.addedAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <IconButton
                        size="sm"
                        onClick={() => onRemoveEntry(entry.id)}
                        title="Remove from blacklist"
                        icon={<Trash2 size={14} />}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
};
