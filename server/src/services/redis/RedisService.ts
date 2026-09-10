import Redis from 'ioredis';
import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';

//  memory entry
interface MemoryEntry {
  value: string;
  expiresAt: number;
}

//  redis service
export class RedisService {
  // Instance property
  private static instance: RedisService;
  // Client property
  private client: Redis | null = null;
  // Memory property
  private memory = new Map<string, MemoryEntry>();
  // Redis available property
  private redisAvailable = false;
  // Flush memory timer property
  private flushMemoryTimer: NodeJS.Timeout | null = null;

  private constructor() {
    if (config.redis.enabled) {
      this.connect();
    } else {
      console.log('[Redis] Disabled (REDIS_ENABLED != true). Using in-memory fallback.');
    }
  }

  // Get instance
  public static getInstance(): RedisService {
    if (!RedisService.instance) {
      RedisService.instance = new RedisService();
    }
    return RedisService.instance;
  }

  public get isRedisAvailable(): boolean {
    return this.redisAvailable;
  }

  // Connect
  private connect(): void {
    try {
      this.client = new Redis(config.redis.url, {
        lazyConnect: false,
        maxRetriesPerRequest: 2,
        retryStrategy: (times) => Math.min(times * 250, 3000),
      });

      // Assume available immediately: commands issued before the TCP handshake
      // completes are held in ioredis' offline queue. With enableOfflineQueue:
      // false those commands used to throw ("Stream isn't writeable"), flipping
      // the service to its (empty) in-memory fallback and silently losing all
      // data already written to Redis.
      this.redisAvailable = true;

      this.client.on('connect', () => {
        this.redisAvailable = true;
        console.log(`[Redis] Connected to ${config.redis.url}`);
      });

      this.client.on('error', (err: Error) => {
        // Never crash the app because Redis is down.
        if (this.redisAvailable) {
          this.redisAvailable = false;
          console.error('[Redis] Connection lost. Falling back to in-memory store:', err.message);
        }
      });

      this.client.on('end', () => {
        if (this.redisAvailable) {
          this.redisAvailable = false;
          logger.warn('Redis connection closed — falling back to in-memory store');
        }
      });
    } catch (e: any) {
      this.redisAvailable = false;
      console.error('[Redis] Failed to initialize (falling back to in-memory store):', e.message);
    }
  }

  // K
  private k(key: string): string {
    return `${config.redis.keyPrefix}:${key}`;
  }

  // With client
  private async withClient<T>(fallback: T, op: (client: Redis) => Promise<T>): Promise<T> {
    const client = this.client;
    if (this.redisAvailable && client) {
      try {
        return await op(client);
      } catch (e: any) {
        this.redisAvailable = false;
        console.warn('Redis command failed — using in-memory fallback:', e.message);
      }
    }
    return fallback;
  }

  // Sweep memory
  private sweepMemory(): void {
    if (this.flushMemoryTimer) return;
    this.flushMemoryTimer = setTimeout(() => {
      const now = Date.now();
      for (const [key, entry] of this.memory.entries()) {
        if (entry.expiresAt <= now) this.memory.delete(key);
      }
      this.flushMemoryTimer = null;
    }, 60_000);
    if (this.flushMemoryTimer.unref) this.flushMemoryTimer.unref();
  }

  // Get
  public async get(key: string): Promise<string | null> {
    if (this.redisAvailable && this.client) {
      return this.withClient<string | null>(null, (c) => c.get(this.k(key)));
    }
    const entry = this.memory.get(this.k(key));
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      this.memory.delete(this.k(key));
      return null;
    }
    return entry.value;
  }

  // Set
  public async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    const prefixed = this.k(key);
    if (this.redisAvailable && this.client) {
      await this.withClient<void>(undefined, (c) =>
        (ttlSeconds ? c.set(prefixed, value, 'EX', ttlSeconds) : c.set(prefixed, value)).then(() => undefined)
      );
      return;
    }
    this.memory.set(prefixed, {
      value,
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : Number.MAX_SAFE_INTEGER,
    });
    this.sweepMemory();
  }

  // Del
  public async del(key: string): Promise<void> {
    const prefixed = this.k(key);
    if (this.redisAvailable && this.client) {
      await this.withClient<void>(undefined, (c) => c.del(prefixed).then(() => undefined));
      return;
    }
    this.memory.delete(prefixed);
  }

  // Atomic increment with TTL — used by the distributed rate limiter so limits are
  // shared across instances. Returns null when Redis is unavailable so the caller
  // can fall back to an in-process counter.
  public async incrWithTtl(key: string, ttlSeconds: number): Promise<{ count: number; resetAt: number } | null> {
    const client = this.client;
    if (!this.redisAvailable || !client) return null;

    const prefixed = this.k(key);
    try {
      const results: any = await client.multi().incr(prefixed).ttl(prefixed).exec();
      const count = Number(results?.[0]?.[1] ?? 0);
      let ttl = Number(results?.[1]?.[1] ?? -1);
      if (ttl < 0) {
        await client.expire(prefixed, ttlSeconds);
        ttl = ttlSeconds;
      }
      return { count, resetAt: Date.now() + ttl * 1000 };
    } catch (e: any) {
      this.redisAvailable = false;
      console.warn('Redis rate-limit command failed — using in-memory fallback:', e.message);
      return null;
    }
  }

  // Batch get
  public async mget(keys: string[]): Promise<(string | null)[]> {
    if (keys.length === 0) return [];
    const prefixed = keys.map(k => this.k(k));
    if (this.redisAvailable && this.client) {
      return this.withClient<(string | null)[]>([], (c) => c.mget(...prefixed));
    }
    const now = Date.now();
    return prefixed.map(pk => {
      const entry = this.memory.get(pk);
      if (!entry) return null;
      if (entry.expiresAt <= now) { this.memory.delete(pk); return null; }
      return entry.value;
    });
  }

  // Batch set with TTL (pipeline)
  public async mset(entries: [string, string][], ttlSeconds?: number): Promise<void> {
    if (entries.length === 0) return;
    if (this.redisAvailable && this.client) {
      await this.withClient<void>(undefined, async (c) => {
        const pipeline = c.pipeline();
        for (const [key, value] of entries) {
          const pk = this.k(key);
          if (ttlSeconds) {
            pipeline.set(pk, value, 'EX', ttlSeconds);
          } else {
            pipeline.set(pk, value);
          }
        }
        await pipeline.exec();
      });
      return;
    }
    const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : Number.MAX_SAFE_INTEGER;
    for (const [key, value] of entries) {
      this.memory.set(this.k(key), { value, expiresAt });
    }
    this.sweepMemory();
  }

  // Close
  public async close(): Promise<void> {
    if (this.flushMemoryTimer) clearTimeout(this.flushMemoryTimer);
    if (this.client) {
      this.redisAvailable = false;
      await this.client.quit().catch(() => undefined);
      this.client = null;
    }
  }
}
