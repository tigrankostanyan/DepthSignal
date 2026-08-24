import { Request, Response, NextFunction } from 'express';
import { AuthService } from './AuthService.js';
import { UserProfile, UserRole } from '../../src/types/index.js';

// Extend express Request to include authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: UserProfile;
      requestId?: string;
    }
  }
}

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

  return null;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  try {
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
    const user = authService.validateToken(token);
    req.user = user;
    next();
  } catch (err: any) {
    const statusCode = err.statusCode || 401;
    res.status(statusCode).json({
      error: err.code || 'UNAUTHORIZED',
      message: err.message || 'Invalid or expired authentication credentials',
      requestId: req.requestId
    });
  }
}

export function optionalAuth(req: Request, res: Response, next: NextFunction): void {
  try {
    const token = extractToken(req);
    if (token) {
      const authService = AuthService.getInstance();
      req.user = authService.validateToken(token);
    }
  } catch {
    // Ignore error for optional auth
  }
  next();
}

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
