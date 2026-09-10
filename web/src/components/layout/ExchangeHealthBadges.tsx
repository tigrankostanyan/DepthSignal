'use client';

import React from 'react';
import { Layers, Activity } from 'lucide-react';
import { useApp, useRealtimeData } from '@/providers/AppProviders';

export const ExchangeHealthBadges: React.FC = () => {
  const { connectors } = useApp();
  const { activeWalls } = useRealtimeData();

  const binanceStatus = connectors.find((c) => c.exchange === 'BINANCE');
  const connectedCount = connectors.filter((c) => c.connected).length;
  const activeWallCount = activeWalls.length;

  return (
    <div className="hidden lg:flex items-center space-x-3 text-muted">
      <div className="flex items-center space-x-2 px-3 py-1 bg-surface rounded border border-divider">
        <div className="w-2 h-2 rounded-full bg-bid animate-pulse"></div>
        <span className="text-xs text-muted">
          Binance:{' '}
          <span className="text-bid font-mono font-medium">
            {binanceStatus?.pingMs ? `${binanceStatus.pingMs}ms` : 'Connected'}
          </span>
        </span>
      </div>

      <div className="flex items-center space-x-1.5 px-3 py-1 rounded bg-surface border border-divider">
        <Layers size={13} className="text-accent" />
        <span className="text-xs text-muted">Order Book Walls:</span>
        <span className="font-mono text-accent font-bold">{activeWallCount}</span>
      </div>

      <div className="flex items-center space-x-1.5 px-3 py-1 rounded bg-surface border border-divider">
        <Activity size={13} className="text-main" />
        <span className="text-xs text-muted">Gateways:</span>
        <span className="font-mono text-main">{connectedCount} Active</span>
      </div>
    </div>
  );
};