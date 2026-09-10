import type { MarketTicker, DetectedWall, AlertTrigger } from '@/types/index';
import type { UserSubscription } from '@/types/index';

export type RealtimeEvent =
  | { type: 'tickers_batch'; data: MarketTicker[] }
  | { type: 'wall_event'; data: { wall: DetectedWall; eventType: string } }
  | { type: 'alert_trigger'; data: AlertTrigger }
  | { type: 'subscription_updated'; data: UserSubscription }
  | { type: string; data: unknown };

export interface RealtimeOptions {
  onEvent?: (event: RealtimeEvent) => void;
  onStatusChange?: (status: 'connecting' | 'open' | 'closed') => void;
  autoReconnect?: boolean;
  reconnectIntervalMs?: number;
}

export interface RealtimeSubscription {
  close: () => void;
  getStatus: () => 'connecting' | 'open' | 'closed';
}

/**
 * Opens an SSE connection to the realtime stream.
 * The backend emits NAMED events (`tickers_batch`, `wall_event`, `alert_trigger`,
 * `subscription_updated`) and requires `?token=` for authentication.
 * Returns a handle with close() and getStatus().
 */
export function connectRealtime(options: RealtimeOptions = {}): RealtimeSubscription {
  let source: EventSource | null = null;
  let status: 'connecting' | 'open' | 'closed' = 'connecting';
  let closedByUser = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  const {
    onEvent,
    onStatusChange,
    autoReconnect = true,
    reconnectIntervalMs = 3000,
  } = options;

  const setStatus = (next: 'connecting' | 'open' | 'closed') => {
    status = next;
    onStatusChange?.(next);
  };

  const connect = () => {
    if (closedByUser) return;
    setStatus('connecting');

    const url = '/api/realtime/stream';

    try {
      source = new EventSource(url, { withCredentials: true });
    } catch {
      if (autoReconnect) scheduleReconnect();
      return;
    }

    source.onopen = () => {
      setStatus('open');
    };

    // Backend uses named SSE events — `onmessage` never fires.
    source.addEventListener('tickers_batch', (event) => {
      try {
        onEvent?.({ type: 'tickers_batch', data: JSON.parse((event as MessageEvent).data) as MarketTicker[] });
      } catch {
        // ignore malformed frames
      }
    });

    source.addEventListener('wall_event', (event) => {
      try {
        onEvent?.({ type: 'wall_event', data: JSON.parse((event as MessageEvent).data) as { wall: DetectedWall; eventType: string } });
      } catch {
        // ignore malformed frames
      }
    });

    source.addEventListener('alert_trigger', (event) => {
      try {
        onEvent?.({ type: 'alert_trigger', data: JSON.parse((event as MessageEvent).data) as AlertTrigger });
      } catch {
        // ignore malformed frames
      }
    });

    source.addEventListener('subscription_updated', (event) => {
      try {
        onEvent?.({ type: 'subscription_updated', data: JSON.parse((event as MessageEvent).data) as UserSubscription });
      } catch {
        // ignore malformed frames
      }
    });

    source.onerror = () => {
      source?.close();
      source = null;
      setStatus('closed');
      if (autoReconnect) scheduleReconnect();
    };
  };

  const scheduleReconnect = () => {
    if (closedByUser || reconnectTimer) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, reconnectIntervalMs);
  };

  connect();

  return {
    close: () => {
      closedByUser = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      source?.close();
      source = null;
      setStatus('closed');
    },
    getStatus: () => status,
  };
}
