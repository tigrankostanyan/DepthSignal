import { Request, Response, NextFunction } from 'express';
import { RedisService } from '../services/redis/RedisService.js';

//  rate limiter options
interface RateLimiterOptions {
  windowMs: number;       // Window size in ms (e.g. 60000)
  max: number;            // Max requests per window
  message?: string;       // Custom error message
  keyGenerator?: (req: Request) => string;
}

//  client record
interface ClientRecord {
  count: number;
  resetAt: number;
}

// Create rate limiter
// Uses Redis (shared across instances) when available, with an in-process
// fallback so a single-node deployment still works without Redis.
export function createRateLimiter(options: RateLimiterOptions) {
  const { windowMs, max, message = 'Too many requests. Please try again later.' } = options;
  const windowSeconds = Math.max(1, Math.ceil(windowMs / 1000));
  const store = new Map<string, ClientRecord>();

  // Periodically clean up expired entries
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of store.entries()) {
      if (record.resetAt <= now) {
        store.delete(key);
      }
    }
  }, Math.max(windowMs, 30000));

  const getKey = options.keyGenerator || ((req: Request) => {
    // Prefer authenticated user ID if available, otherwise client IP
    if (req.user && req.user.id) {
      return `user_${req.user.id}`;
    }
    const forwarded = req.headers['x-forwarded-for'];
    const ip = (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : req.socket.remoteAddress) || '127.0.0.1';
    return `ip_${ip}`;
  });

  const sendRateLimitHeaders = (res: Response, count: number, resetAt: number): void => {
    res.setHeader('RateLimit-Limit', max);
    res.setHeader('RateLimit-Remaining', Math.max(0, max - count));
    res.setHeader('RateLimit-Reset', Math.ceil(resetAt / 1000));
  };

  const reject = (req: Request, res: Response, resetAt: number): void => {
    const retryAfterSec = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
    res.setHeader('Retry-After', retryAfterSec);
    res.status(429).json({
      error: 'RATE_LIMIT_EXCEEDED',
      message: `${message} Retry after ${retryAfterSec}s.`,
      retryAfter: retryAfterSec,
      requestId: req.requestId
    });
  };

  // In-process fallback path
  const enforceInMemory = (req: Request, res: Response, next: NextFunction, key: string): void => {
    const now = Date.now();
    let record = store.get(key);

    if (!record || record.resetAt <= now) {
      record = { count: 1, resetAt: now + windowMs };
      store.set(key, record);
    } else {
      record.count += 1;
    }

    sendRateLimitHeaders(res, record.count, record.resetAt);

    if (record.count > max) {
      reject(req, res, record.resetAt);
      return;
    }

    next();
  };

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const key = getKey(req);

    try {
      const hit = await RedisService.getInstance().incrWithTtl(`ratelimit:${key}`, windowSeconds);
      if (hit) {
        sendRateLimitHeaders(res, hit.count, hit.resetAt);
        if (hit.count > max) {
          reject(req, res, hit.resetAt);
          return;
        }
        next();
        return;
      }
    } catch {
      // Redis unavailable — fall back to the in-process counter below.
    }

    enforceInMemory(req, res, next, key);
  };
}

// Pre-configured Rate Limiters
// Auth rate limiter
export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,                   // 5 attempts per 15 minutes (per IP/user)
  message: 'Too many authentication attempts. Please wait 15 minutes.'
});

// Alert mutation limiter
export const alertMutationLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 40,
  message: 'Alert mutation rate limit exceeded.'
});

// Watchlist mutation limiter
export const watchlistMutationLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 40,
  message: 'Watchlist mutation rate limit exceeded.'
});

// Preset mutation limiter
export const presetMutationLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 40,
  message: 'Preset mutation rate limit exceeded.'
});

// Test alert trigger limiter
export const testAlertTriggerLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 6,
  message: 'Simulation test alert rate limit exceeded. Max 6 per minute.'
});

// General api limiter
export const generalApiLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 180,
  message: 'General API request rate limit exceeded.'
});
