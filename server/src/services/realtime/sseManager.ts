import { Response } from 'express';
import { UserProfile, MarketTicker } from '../../types/index.js';

//  s s e client
interface SSEClient {
  id: string;
  userId: string;
  res: Response;
  connectedAt: number;
  lastActiveAt: number;
  // Exchanges this client's plan entitles them to. undefined = all exchanges.
  allowedExchanges?: string[];
}

//  s s e manager
export class SSEManager {
  // Instance property
  private static instance: SSEManager;
  // Clients property
  private clients: Map<string, SSEClient> = new Map();
  // Heartbeat interval property
  private heartbeatInterval: NodeJS.Timeout | null = null;
  // Max connections per user property
  private maxConnectionsPerUser = 5;
  // Max total connections property
  private maxTotalConnections = 500;

  private constructor() {
    this.startHeartbeat();
  }

  // Get instance
  public static getInstance(): SSEManager {
    if (!SSEManager.instance) {
      SSEManager.instance = new SSEManager();
    }
    return SSEManager.instance;
  }

  // Add client
  public addClient(clientId: string, user: UserProfile, res: Response, allowedExchanges?: string[]): boolean {
    // Check total limit
    if (this.clients.size >= this.maxTotalConnections) {
      res.status(503).json({
        error: 'SERVICE_UNAVAILABLE',
        message: 'Max realtime streaming connections exceeded. Please try again later.'
      });
      return false;
    }

    // Check per-user connection limit
    let userConnectionCount = 0;
    for (const client of this.clients.values()) {
      if (client.userId === user.id) {
        userConnectionCount++;
      }
    }

    if (userConnectionCount >= this.maxConnectionsPerUser) {
      res.status(429).json({
        error: 'TOO_MANY_CONNECTIONS',
        message: `Max concurrent realtime streams reached (${this.maxConnectionsPerUser} max per account).`
      });
      return false;
    }

    // Set streaming headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    });

    res.write(`event: connected\ndata: ${JSON.stringify({ status: 'ok', userId: user.id, time: Date.now() })}\n\n`);

    const client: SSEClient = {
      id: clientId,
      userId: user.id,
      res,
      connectedAt: Date.now(),
      lastActiveAt: Date.now(),
      allowedExchanges
    };

    this.clients.set(clientId, client);

    const cleanup = () => {
      this.removeClient(clientId);
    };

    res.on('close', cleanup);
    res.on('finish', cleanup);
    res.on('error', cleanup);

    return true;
  }

  // Remove client
  public removeClient(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      try {
        client.res.end();
      } catch {
        // Ignore errors during closing
      }
      this.clients.delete(clientId);
    }
  }

  // Broadcast all
  public broadcastAll(event: string, data: any): void {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    const toRemove: string[] = [];

    for (const [id, client] of this.clients.entries()) {
      try {
        const canContinue = client.res.write(payload);
        client.lastActiveAt = Date.now();

        // Prevent memory leak from slow clients
        if (!canContinue || client.res.writableLength > 1024 * 1024) {
          toRemove.push(id);
        }
      } catch (err) {
        toRemove.push(id);
      }
    }

    for (const id of toRemove) {
      this.removeClient(id);
    }
  }

  // Broadcast tickers honouring each client's plan entitlements.
  // `grouped` is the same ticker set pre-bucketed by exchange so each client
  // only receives the exchanges their plan allows (and a much smaller payload).
  public broadcastTickers(allTickers: MarketTicker[], grouped: Map<string, MarketTicker[]>): void {
    const payloadCache = new Map<string, string>();
    const toRemove: string[] = [];

    for (const [id, client] of this.clients.entries()) {
      try {
        let payload: string;

        if (client.allowedExchanges) {
          const cacheKey = [...client.allowedExchanges].sort().join(',');
          const cached = payloadCache.get(cacheKey);
          if (cached) {
            payload = cached;
          } else {
            const data = client.allowedExchanges.flatMap((ex) => grouped.get(ex) ?? []);
            payload = `event: tickers_batch\ndata: ${JSON.stringify(data)}\n\n`;
            payloadCache.set(cacheKey, payload);
          }
        } else {
          const cached = payloadCache.get('__ALL__');
          if (cached) {
            payload = cached;
          } else {
            payload = `event: tickers_batch\ndata: ${JSON.stringify(allTickers)}\n\n`;
            payloadCache.set('__ALL__', payload);
          }
        }

        const canContinue = client.res.write(payload);
        client.lastActiveAt = Date.now();

        if (!canContinue || client.res.writableLength > 1024 * 1024) {
          toRemove.push(id);
        }
      } catch (err) {
        toRemove.push(id);
      }
    }

    for (const id of toRemove) {
      this.removeClient(id);
    }
  }

  // Broadcast user
  public broadcastUser(userId: string, event: string, data: any): void {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    const toRemove: string[] = [];

    for (const [id, client] of this.clients.entries()) {
      if (client.userId === userId) {
        try {
          const canContinue = client.res.write(payload);
          client.lastActiveAt = Date.now();
          
          if (!canContinue || client.res.writableLength > 1024 * 1024) {
            toRemove.push(id);
          }
        } catch (err) {
          toRemove.push(id);
        }
      }
    }

    for (const id of toRemove) {
      this.removeClient(id);
    }
  }

  // Get active client count
  public getActiveClientCount(): number {
    return this.clients.size;
  }

  // Start heartbeat
  private startHeartbeat(): void {
    if (this.heartbeatInterval) return;

    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      const toRemove: string[] = [];

      for (const [id, client] of this.clients.entries()) {
        try {
          // Send lightweight comment heartbeat
          client.res.write(': ping\n\n');
          client.lastActiveAt = now;
        } catch (e) {
          toRemove.push(id);
        }
      }

      for (const id of toRemove) {
        this.removeClient(id);
      }
    }, 15000);
  }
}
