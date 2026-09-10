export type NodeEnv = 'development' | 'production' | 'test';

//  app config
export interface AppConfig {
  env: NodeEnv;
  port: number;
  redis: {
    enabled: boolean;
    url: string;
    keyPrefix: string;
    wallStateTtlSeconds: number;
    tickerTtlSeconds: number;
    orderBookTtlSeconds: number;
    tradeTtlSeconds: number;
  };
}

// Read env
function readEnv(name: string): string | undefined {
  return process.env[name];
}

// Read int
function readInt(name: string, fallback: number): number {
  const raw = readEnv(name);
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

// Config
export const config: AppConfig = {
  env: (readEnv('NODE_ENV') as NodeEnv) || 'development',
  port: readInt('PORT', 3000),
  redis: {
    enabled: readEnv('REDIS_ENABLED') === 'true',
    url: readEnv('REDIS_URL') || 'redis://localhost:6379',
    keyPrefix: readEnv('REDIS_KEY_PREFIX') || 'ds',
    wallStateTtlSeconds: readInt('REDIS_WALL_TTL_SECONDS', 3600),
    tickerTtlSeconds: readInt('REDIS_TICKER_TTL_SECONDS', 120),
    orderBookTtlSeconds: readInt('REDIS_ORDERBOOK_TTL_SECONDS', 120),
    tradeTtlSeconds: readInt('REDIS_TRADE_TTL_SECONDS', 60),
  },
};
