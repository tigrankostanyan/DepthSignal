'use client';

import type { Dispatch, SetStateAction } from 'react';
import { useRealtime } from './useRealtime';
import type { AlertTrigger, DetectedWall, MarketTicker } from '@/types/index';
import type { UserSubscription } from '@/types/index';

interface UseRealtimeAlertsOptions {
  enabled: boolean;
  onTickers: (tickers: MarketTicker[]) => void;
  setActiveWalls: Dispatch<SetStateAction<DetectedWall[]>>;
  onAlertTrigger: (trigger: AlertTrigger) => void;
  onSubscriptionUpdated: (sub: UserSubscription) => void;
}

/**
 * Subscribes to the realtime SSE stream and applies the order-book wall
 * merge rules (insert/update on FORMING/CONFIRMED, remove on REMOVED/FILLED).
 */
export function useRealtimeAlerts({
  enabled,
  onTickers,
  setActiveWalls,
  onAlertTrigger,
  onSubscriptionUpdated,
}: UseRealtimeAlertsOptions): void {
  useRealtime(enabled, {
    onTickers,
    onWallEvent: (wall, eventType) => {
      setActiveWalls((prev) => {
        if (eventType === 'CONFIRMED' || eventType === 'FORMING') {
          const existingIdx = prev.findIndex((w) => w.id === wall.id);
          if (existingIdx >= 0) {
            const updated = [...prev];
            updated[existingIdx] = wall;
            return updated;
          }
          return [wall, ...prev];
        }
        if (eventType === 'REMOVED' || eventType === 'FILLED') {
          return prev.filter((w) => w.id !== wall.id);
        }
        return prev;
      });
    },
    onAlertTrigger,
    onSubscriptionUpdated,
  });
}
