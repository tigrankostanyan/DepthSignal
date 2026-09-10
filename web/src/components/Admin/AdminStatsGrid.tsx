'use client';

import React from 'react';
import type { AdminStats } from '@/lib/api';

interface AdminStatsGridProps {
  stats: AdminStats;
}

export const AdminStatsGrid: React.FC<AdminStatsGridProps> = ({ stats }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div className="bg-card border border-divider rounded-xl p-5">
        <div className="text-muted text-xs font-semibold mb-1">Total Registered Accounts</div>
        <div className="text-3xl font-black text-white font-mono">{stats.totalUsers}</div>
        <div className="mt-4 pt-3 border-t border-divider space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-muted">FREE Plan:</span>
            <span className="font-mono text-white font-bold">{stats.planDistribution?.FREE || 0}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">PRO Plan:</span>
            <span className="font-mono text-accent font-bold">{stats.planDistribution?.PRO || 0}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">ADVANCED Plan:</span>
            <span className="font-mono text-[#3B82F6] font-bold">
              {stats.planDistribution?.ADVANCED || 0}
            </span>
          </div>
        </div>
      </div>

      <div className="bg-card border border-divider rounded-xl p-5">
        <div className="text-muted text-xs font-semibold mb-1">Real-Time WebSocket Streams</div>
        <div className="text-3xl font-black text-bid font-mono">{stats.activeWsClients} Active</div>
        <div className="mt-4 pt-3 border-t border-divider text-xs text-muted">
          Active broadcast subscribers receiving synchronized order book depth and ticker ticks.
        </div>
      </div>

      <div className="bg-card border border-divider rounded-xl p-5">
        <div className="text-muted text-xs font-semibold mb-1">Notification Failures</div>
        <div className="text-3xl font-black text-ask font-mono">{stats.failedDeliveriesCount}</div>
        <div className="mt-4 pt-3 border-t border-divider text-xs text-muted">
          Permanently failed or blocked SSRF delivery records across all user dispatches.
        </div>
      </div>
    </div>
  );
};
