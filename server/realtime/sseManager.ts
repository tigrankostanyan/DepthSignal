import { Response } from 'express';
import { UserProfile } from '../../src/types/index.js';

interface SSEClient {
  id: string;
  userId: string;
  res: Response;
  connectedAt: number;
  lastActiveAt: number;
}

export class SSEManager {
  private static instance: SSEManager;
  private clients: Map<string, SSEClient> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private maxConnectionsPerUser = 5;
  private maxTotalConnections = 500;

  private constructor() {
    this.startHeartbeat();
  }

  public static getInstance(): SSEManager {
    if (!SSEManager.instance) {
      SSEManager.instance = new SSEManager();
    }
    return SSEManager.instance;
  }

  public addClient(clientId: string, user: UserProfile, res: Response): boolean {
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
      lastActiveAt: Date.now()
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

  public broadcastAll(event: string, data: any): void {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    const toRemove: string[] = [];

    for (const [id, client] of this.clients.entries()) {
      try {
        client.res.write(payload);
        client.lastActiveAt = Date.now();
      } catch (err) {
        toRemove.push(id);
      }
    }

    for (const id of toRemove) {
      this.removeClient(id);
    }
  }

  public broadcastUser(userId: string, event: string, data: any): void {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    const toRemove: string[] = [];

    for (const [id, client] of this.clients.entries()) {
      if (client.userId === userId) {
        try {
          client.res.write(payload);
          client.lastActiveAt = Date.now();
        } catch (err) {
          toRemove.push(id);
        }
      }
    }

    for (const id of toRemove) {
      this.removeClient(id);
    }
  }

  public getActiveClientCount(): number {
    return this.clients.size;
  }

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
