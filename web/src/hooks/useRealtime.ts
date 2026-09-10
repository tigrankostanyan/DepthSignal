// ==========================================
// useRealtime — SSE subscription hook
// ==========================================
'use client';

import { useEffect, useRef } from 'react';

import type { MarketTicker, DetectedWall, AlertTrigger } from '@/types/index';
import type { UserSubscription } from '@/types/index';
import { connectRealtime } from '@/lib/realtime/sse';

export interface RealtimeHandlers {
  onTickers: (tickers: MarketTicker[]) => void;
  onWallEvent: (wall: DetectedWall, eventType: string) => void;
  onAlertTrigger: (trigger: AlertTrigger) => void;
  onSubscriptionUpdated: (sub: UserSubscription) => void;
}

/**
 * Subscribes to the realtime SSE stream while `enabled` is true.
 * Handlers are read from a ref so consumers can pass fresh closures
 * without tearing down the EventSource connection.
 */
export function useRealtime(enabled: boolean, handlers: RealtimeHandlers): void {
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    if (!enabled) return;
    const sub = connectRealtime({
      onEvent: (event) => {
        switch (event.type) {
          case 'tickers_batch':
            handlersRef.current.onTickers(event.data as MarketTicker[]);
            break;
          case 'wall_event': {
            const { wall, eventType } = event.data as { wall: DetectedWall; eventType: string };
            handlersRef.current.onWallEvent(wall, eventType);
            break;
          }
          case 'alert_trigger':
            handlersRef.current.onAlertTrigger(event.data as AlertTrigger);
            break;
          case 'subscription_updated':
            handlersRef.current.onSubscriptionUpdated(event.data as UserSubscription);
            break;
          default:
            break;
        }
      },
    });
    return () => sub.close();
  }, [enabled]);
}
