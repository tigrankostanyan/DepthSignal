'use client';

import React, { useState } from 'react';
import { Check, X, Eye, ShieldCheck, ImageOff } from 'lucide-react';
import type { AdminPaymentProofRow } from '@/lib/api';
import { Badge } from '@/components/ui/Badge';

interface AdminReceiptsTabProps {
  receipts: AdminPaymentProofRow[];
  onActivate: (id: string) => void;
  onReject: (id: string) => void;
}

const STATUS_TONE: Record<string, 'yellow' | 'green' | 'red' | 'neutral'> = {
  pending: 'yellow',
  approved: 'green',
  rejected: 'red',
};

function fmtAmount(r: AdminPaymentProofRow): string {
  const v = Number(r.amountUsd) || 0;
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function fmtDate(ts?: number): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export const AdminReceiptsTab: React.FC<AdminReceiptsTabProps> = ({ receipts, onActivate, onReject }) => {
  const [preview, setPreview] = useState<AdminPaymentProofRow | null>(null);

  const pendingCount = receipts.filter((r) => r.status === 'pending').length;

  return (
    <div className="space-y-4">
      {/* Summary + note */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted">
          <ShieldCheck size={14} className="inline mr-1 text-bid" />
          Review user payment proofs and click <strong className="text-bid">Activate Plan</strong> to instantly
          upgrade the user's subscription in the database.
        </div>
        <Badge tone={pendingCount > 0 ? 'yellow' : 'neutral'} size="sm">
          {pendingCount} PENDING
        </Badge>
      </div>

      {receipts.length === 0 ? (
        <div className="bg-card border border-divider rounded-xl p-8 text-center text-xs text-muted">
          No payment receipts submitted yet.
        </div>
      ) : (
        <div className="bg-card border border-divider rounded-xl overflow-hidden shadow-lg">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface border-b border-divider text-muted font-semibold">
              <tr>
                <th className="p-3">User</th>
                <th className="p-3">Receipt</th>
                <th className="p-3">Plan</th>
                <th className="p-3">Amount</th>
                <th className="p-3">Note</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-divider">
              {receipts.map((r) => (
                <tr key={r.id} className="hover:bg-surface/50 transition align-top">
                  <td className="p-3">
                    <div className="font-bold text-main">{r.userName || '—'}</div>
                    <div className="text-[11px] text-muted font-mono">{r.userEmail || r.userId}</div>
                    <div className="text-[9px] text-muted font-mono mt-0.5">{r.id}</div>
                  </td>
                  <td className="p-3">
                    <button
                      onClick={() => setPreview(r)}
                      title="Preview receipt image"
                      className="group inline-flex items-center space-x-2 cursor-pointer"
                    >
                      {r.imageData ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={r.imageData}
                          alt="receipt"
                          width={56}
                          height={56}
                          className="rounded-lg object-cover border border-divider group-hover:border-[#168FD6] transition"
                        />
                      ) : (
                        <span className="w-14 h-14 rounded-lg bg-primary border border-divider flex items-center justify-center text-muted">
                          <ImageOff size={16} />
                        </span>
                      )}
                      <Eye size={13} className="text-brand opacity-0 group-hover:opacity-100 transition" />
                    </button>
                    <div className="text-[9px] text-muted font-mono mt-1">{fmtDate(r.createdAt)}</div>
                  </td>
                  <td className="p-3">
                    <div className="font-bold text-white">{r.plan}</div>
                    <div className="text-[10px] text-muted capitalize">{r.interval}</div>
                  </td>
                  <td className="p-3 font-mono text-white">{fmtAmount(r)} {r.currency || ''}</td>
                  <td className="p-3 text-muted max-w-[180px]">
                    <div className="line-clamp-2 whitespace-pre-line">{r.note || '—'}</div>
                  </td>
                  <td className="p-3">
                    <Badge tone={STATUS_TONE[r.status] || 'neutral'} size="sm">{r.status.toUpperCase()}</Badge>
                    {r.reviewedAt && (
                      <div className="text-[9px] text-muted font-mono mt-1">
                        {r.status === 'approved' ? 'Activated' : 'Reviewed'} {fmtDate(r.reviewedAt)}
                      </div>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    {r.status === 'pending' ? (
                      <div className="flex items-center justify-end space-x-1.5">
                        <button
                          onClick={() => onActivate(r.id)}
                          className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-bid text-white text-[11px] font-bold hover:brightness-110 transition cursor-pointer shadow"
                        >
                          <Check size={12} />
                          <span>Activate Plan</span>
                        </button>
                        <button
                          onClick={() => onReject(r.id)}
                          title="Reject this receipt"
                          className="inline-flex items-center px-2 py-1.5 rounded-lg bg-ask/15 border border-[#F6465D]/30 text-ask text-[11px] font-bold hover:bg-ask/25 transition cursor-pointer"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <span className="text-[10px] text-[#5A7A94]">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Full-size receipt preview overlay */}
      {preview && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/85 backdrop-blur-sm p-6"
          onClick={() => setPreview(null)}
        >
          <div
            className="relative max-w-2xl w-full bg-[#0B1E33] border border-divider rounded-xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-divider bg-primary flex items-center justify-between">
              <div className="text-xs text-white">
                <span className="font-bold">{preview.userName || 'User'}</span>
                <span className="text-muted font-mono ml-2">{preview.userEmail || preview.userId}</span>
              </div>
              <button
                onClick={() => setPreview(null)}
                className="text-muted hover:text-white text-lg font-bold cursor-pointer"
                aria-label="Close preview"
              >
                ×
              </button>
            </div>
            {preview.imageData ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview.imageData} alt={`Receipt from ${preview.userEmail || preview.userId}`} className="w-full max-h-[70vh] object-contain bg-primary" />
            ) : (
              <div className="p-16 text-center text-xs text-muted">No image attached.</div>
            )}
            <div className="px-4 py-3 border-t border-divider bg-primary flex items-center justify-between text-xs">
              <div className="text-muted">
                {preview.plan} · {preview.interval} · <span className="font-mono text-white">{fmtAmount(preview)}</span>
              </div>
              {preview.status === 'pending' && (
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => { setPreview(null); onActivate(preview.id); }}
                    className="px-3 py-1.5 rounded-lg bg-bid text-white font-bold hover:brightness-110 transition cursor-pointer shadow"
                  >
                    Activate Plan
                  </button>
                  <button
                    onClick={() => { setPreview(null); onReject(preview.id); }}
                    className="px-3 py-1.5 rounded-lg bg-ask text-white font-bold hover:brightness-90 transition cursor-pointer"
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
