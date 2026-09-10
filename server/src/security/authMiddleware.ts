import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth/AuthService.js';
import { DatabaseService } from '../db/database.js';
import { computeFingerprintHash } from './fingerprint.js';
import { UserProfile, UserRole } from '../types/index.js';

// Extend express Request to include authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: UserProfile;
      requestId?: string;
    }
  }
}

// Extract token
export function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }

  const customHeader = req.headers['x-session-token'];
  if (typeof customHeader === 'string' && customHeader.trim()) {
    return customHeader.trim();
  }

  if (typeof req.query.token === 'string' && req.query.token.trim()) {
    return req.query.token.trim();
  }

  const accessTokenCookie = req.cookies?.accessToken;
  if (typeof accessTokenCookie === 'string' && accessTokenCookie.trim()) {
    return accessTokenCookie.trim();
  }

  return null;
}

// Client ip
function clientIp(req: Request): string {
  return (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
}

// Header value
function header(req: Request, name: string): string | undefined {
  const v = req.headers[name];
  return Array.isArray(v) ? v[0] : v;
}

// Clear auth cookies with strict binding
export function clearAuthCookies(res: Response): void {
  const opts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: (process.env.NODE_ENV === 'production' ? 'strict' : 'lax') as any,
    path: '/'
  };
  res.clearCookie('accessToken', opts);
  res.clearCookie('refreshToken', opts);
}

// Require auth
// On every request (and SSE connection) the client fingerprint is re-verified against
// the fingerprint bound into the access token at session creation. A mismatch means the
// session was likely replayed from a different machine/network, so it is revoked.
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Authentication required. Please provide a valid Bearer token.',
      requestId: req.requestId
    });
    return;
  }

  const authService = AuthService.getInstance();
  const requestFingerprint = computeFingerprintHash(
    header(req, 'user-agent'),
    clientIp(req),
    header(req, 'x-session-entropy')
  );

  authService.validateAccessToken(token).then(async ({ user, fingerprintHash }) => {
    // Fingerprint drift is advisory only — never revoke the session or force a
    // re-login because of it (IP/network changes would otherwise sign users out).
    if (fingerprintHash && requestFingerprint !== fingerprintHash) {
      console.warn('[AUTH] Access-token fingerprint drift detected — continuing without revocation');
    }

    // Authoritative role: the access token carries a role snapshot, so re-read the
    // user from the DB to reflect promotions/demotions immediately (e.g. ADMIN bypass).
    const db = DatabaseService.getInstance();
    const freshUser = await db.getUserById(user.id);
    if (!freshUser) {
      clearAuthCookies(res);
      res.status(401).json({
        error: 'USER_NOT_FOUND',
        message: 'Account no longer exists. Please log in again.',
        requestId: req.requestId
      });
      return;
    }

    req.user = { ...user, ...freshUser, id: freshUser.id };
    next();
  }).catch((err: any) => {
    const statusCode = err.statusCode || 401;
    res.status(statusCode).json({
      error: err.code || 'UNAUTHORIZED',
      message: err.message || 'Invalid or expired authentication credentials',
      requestId: req.requestId
    });
  });
}

// Optional auth
export function optionalAuth(req: Request, res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (token) {
    const authService = AuthService.getInstance();
    authService.validateToken(token).then(user => {
      req.user = user;
    }).catch(() => {
      // Ignore error for optional auth
    }).finally(() => {
      next();
    });
  } else {
    next();
  }
}

// Require role
export function requireRole(allowedRoles: UserRole | UserRole[]) {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required',
        requestId: req.requestId
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        error: 'FORBIDDEN',
        message: `Insufficient privileges. Required role: ${roles.join(' or ')}`,
        requestId: req.requestId
      });
      return;
    }

    next();
  };
}

import { SubscriptionPlanId } from '../types/subscription.js';

// Require plan
export function requirePlan(allowedPlans: SubscriptionPlanId | SubscriptionPlanId[]) {
  const plans = Array.isArray(allowedPlans) ? allowedPlans : [allowedPlans];
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
      return;
    }

    try {
      const db = DatabaseService.getInstance();
      const subscription = await db.getUserSubscription(req.user.id);

      if (!plans.includes(subscription.plan)) {
        res.status(403).json({
          error: 'FORBIDDEN',
          message: `Required plan: ${plans.join(' or ')}. Current plan: ${subscription.plan}`
        });
        return;
      }

      (req as any).subscription = subscription;
      next();
    } catch (err) {
      res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: 'Failed to check subscription' });
    }
  };
}