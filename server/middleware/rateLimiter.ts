import { Request, Response, NextFunction } from 'express';

interface RateLimiterOptions {
  windowMs: number;       // Window size in ms (e.g. 60000)
  max: number;            // Max requests per window
  message?: string;       // Custom error message
  keyGenerator?: (req: Request) => string;
}

interface ClientRecord {
  count: number;
  resetAt: number;
}

export function createRateLimiter(options: RateLimiterOptions) {
  const { windowMs, max, message = 'Too many requests. Please try again later.' } = options;
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

  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    const key = getKey(req);
    let record = store.get(key);

    if (!record || record.resetAt <= now) {
      record = {
        count: 1,
        resetAt: now + windowMs
      };
      store.set(key, record);
    } else {
      record.count += 1;
    }

    const remaining = Math.max(0, max - record.count);
    const retryAfterSec = Math.ceil((record.resetAt - now) / 1000);

    res.setHeader('RateLimit-Limit', max);
    res.setHeader('RateLimit-Remaining', remaining);
    res.setHeader('RateLimit-Reset', Math.ceil(record.resetAt / 1000));

    if (record.count > max) {
      res.setHeader('Retry-After', retryAfterSec);
      res.status(429).json({
        error: 'RATE_LIMIT_EXCEEDED',
        message: `${message} Retry after ${retryAfterSec}s.`,
        retryAfter: retryAfterSec,
        requestId: req.requestId
      });
      return;
    }

    next();
  };
}

// Pre-configured Rate Limiters
export const authRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 15,
  message: 'Too many authentication attempts.'
});

export const alertMutationLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 40,
  message: 'Alert mutation rate limit exceeded.'
});

export const watchlistMutationLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 40,
  message: 'Watchlist mutation rate limit exceeded.'
});

export const presetMutationLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 40,
  message: 'Preset mutation rate limit exceeded.'
});

export const testAlertTriggerLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 6,
  message: 'Simulation test alert rate limit exceeded. Max 6 per minute.'
});

export const generalApiLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 180,
  message: 'General API request rate limit exceeded.'
});
