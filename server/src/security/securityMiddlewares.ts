import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';

// Correlation middleware
export function correlationMiddleware(req: Request, res: Response, next: NextFunction): void {
  const reqId = (req.headers['x-request-id'] as string) || `req_${crypto.randomBytes(8).toString('hex')}`;
  req.requestId = reqId;
  res.setHeader('X-Request-Id', reqId);
  next();
}

// Security headers middleware
export function securityHeadersMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Prevent MIME-sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Clickjacking protection
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Strict-Transport-Security (HSTS)
  if (req.secure || req.headers['x-forwarded-proto'] === 'https' || process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  
  // Referrer Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Restrict unnecessary browser features
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  // Cross-Origin Resource Policy
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  
  // Build CSP directives from environment variables
  const apiDomain = process.env.API_DOMAIN || 'api.quantscreen.com';
  const appDomain = process.env.APP_DOMAIN || 'quantscreen.com';
  const googleClientId = process.env.GOOGLE_CLIENT_ID || '';

  const cspDirectives = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline' https://accounts.google.com https://www.google.com ${googleClientId ? 'https://accounts.google.com' : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    `connect-src 'self' https://${apiDomain} wss://*.${appDomain}`,
    "font-src 'self'",
    "frame-src 'self' https://accounts.google.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests"
  ].join('; ');

  // CSP is enforced in production; report-only outside production to avoid dev breakage.
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Content-Security-Policy', cspDirectives);
  } else {
    res.setHeader('Content-Security-Policy-Report-Only', cspDirectives);
  }

  // Ensure caching is disabled for API responses
  if (req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }

  next();
}

// Structured logger middleware
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
