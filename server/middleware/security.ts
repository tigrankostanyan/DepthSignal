import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';

export function correlationMiddleware(req: Request, res: Response, next: NextFunction): void {
  const reqId = (req.headers['x-request-id'] as string) || `req_${crypto.randomBytes(8).toString('hex')}`;
  req.requestId = reqId;
  res.setHeader('X-Request-Id', reqId);
  next();
}

export function securityHeadersMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Prevent MIME-sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Clickjacking protection
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  
  // Referrer Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Restrict unnecessary browser features
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  // Cross-Origin Resource Policy
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');

  // Ensure caching is disabled for API responses
  if (req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }

  next();
}

export function structuredLoggerMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const isError = res.statusCode >= 400;
    // Avoid noisy logging of frequent polling / SSE endpoints unless error
    if (req.path === '/api/realtime/stream' || (req.path === '/api/market/tickers' && !isError)) {
      return;
    }
    const logLine = `[${new Date().toISOString()}] [${req.requestId}] ${req.method} ${req.originalUrl || req.url} ${res.statusCode} (${duration}ms)${req.user ? ` - user:${req.user.id}` : ''}`;
    if (isError) {
      console.warn(`\x1b[33m${logLine}\x1b[0m`);
    } else {
      console.log(logLine);
    }
  });

  next();
}
