'use client';

import React from 'react';
import { CheckCircle2, XCircle, Clock, RotateCw } from 'lucide-react';
import type { DeliveryLogRow } from '@/lib/api';

interface AdminDeliveriesTabProps {
  deliveries: DeliveryLogRow[];
  filterStatus: string;
  setFilterStatus: (status: string) => void;
  onRetryDelivery: (deliveryId: string) => void;
}

const statusDisplay = (status: string): string => {
  if (status === 'sent') return 'delivered';
  return status;
};

export const AdminDeliveriesTab: React.FC<AdminDeliveriesTabProps> = ({
  deliveries,
  filterStatus,
  setFilterStatus,
  onRetryDelivery,
}) => {
  return (
    <div className="space-y-4">
      {/* Status Filter */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2 text-xs">
          <span className="text-muted">Filter Status:</span>
          {['', 'pending', 'sent', 'failed'].map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`px-2.5 py-1 rounded capitalize transition cursor-pointer ${
                filterStatus === st
                  ? 'bg-[#168FD6] text-white font-bold shadow'
                  : 'bg-card text-muted hover:text-white border border-divider'
              }`}
            >
              {st || 'All'}
            </button>
          ))}
        </div>
      </div>

      {/* Deliveries Table */}
      <div className="bg-card border border-divider rounded-xl overflow-hidden shadow-lg">
        <table className="w-full text-left text-xs">
          <thead className="bg-surface border-b border-divider text-muted font-semibold">
            <tr>
              <th className="p-3">ID / Time</th>
              <th className="p-3">Channel</th>
              <th className="p-3">Destination</th>
              <th className="p-3">Status</th>
              <th className="p-3">Attempts</th>
              <th className="p-3">Error Details</th>
              <th className="p-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-divider">
            {deliveries.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-muted">
                  No notification deliveries matching this filter.
                </td>
              </tr>
            ) : (
              deliveries.map((d) => (
                <tr key={d.id} className="hover:bg-surface/50 transition">
                  <td className="p-3">
                    <div className="font-mono text-white text-[11px]">{d.id}</div>
                    <div className="text-[10px] text-muted">
                      {new Date(d.createdAt).toLocaleTimeString()}
                    </div>
                  </td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded bg-panel font-mono text-[10px] text-accent border border-divider">
                      {d.channel}
                    </span>
                  </td>
                  <td className="p-3 font-mono text-white text-[11px] max-w-xs truncate">
                    {d.email || 'In-App SSE'}
                  </td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold flex items-center gap-1 w-fit ${
                        statusDisplay(d.status) === 'delivered'
                          ? 'bg-bid/15 text-bid border border-[#0ECB81]/30'
                          : d.status === 'failed'
                            ? 'bg-ask/15 text-ask border border-[#F6465D]/30'
                            : 'bg-[#168FD6]/15 text-[#24C4E8] border border-[#168FD6]/30'
                      }`}
                    >
                      {d.status === 'sent' && <CheckCircle2 size={11} />}
                      {d.status === 'failed' && <XCircle size={11} />}
                      {d.status === 'pending' && <Clock size={11} />}
                      <span className="uppercase">{statusDisplay(d.status)}</span>
                    </span>
                  </td>
                  <td className="p-3 font-mono text-white">{d.attempts}</td>
                  <td className="p-3 text-[11px] text-ask max-w-xs truncate">
                    {d.error || '-'}
                  </td>
                  <td className="p-3 text-right">
                    {d.status === 'failed' && (
                      <button
                        onClick={() => onRetryDelivery(d.id)}
                        className="px-2 py-1 rounded bg-[#168FD6] hover:bg-[#1C9AE5] text-white font-bold text-[11px] transition flex items-center space-x-1 ml-auto cursor-pointer shadow"
                      >
                        <RotateCw size={11} />
                        <span>Retry</span>
                      </button>
                    )}
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
