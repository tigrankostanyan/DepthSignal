import { Request, Response, NextFunction } from 'express';
import { DatabaseService } from '../db/database.js';

// Require active access
export async function requireActiveAccess(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
    return;
  }

  // Development bypass is opt-in only (ALLOW_DEV_ACCESS_BYPASS=true) and is
  // impossible in production, so a misconfigured NODE_ENV can never unlock paid features.
  if (process.env.NODE_ENV !== 'production' && process.env.ALLOW_DEV_ACCESS_BYPASS === 'true') {
    return next();
  }

  const userId = req.user.id;

  // Admin always has access (case-insensitive — role may be stored as 'admin'/'Admin')
  if ((req.user.role || '').toUpperCase() === 'ADMIN') {
    return next();
  }

  try {
    const db = DatabaseService.getInstance();

    // Get user with trial fields
    const userWithTrial = await db.getUserById(userId);
    if (!userWithTrial) {
      res.status(404).json({ error: 'USER_NOT_FOUND', message: 'User not found' });
      return;
    }

    // Check if trial is active
    const now = Date.now();
    const trialEnd = userWithTrial.trialEndDate;
    if (trialEnd && trialEnd > now) {
      // Trial is active, allow access
      return next();
    }

    // Check if user has an active paid subscription
    const subscription = await db.getUserSubscription(userId);
    if (subscription.plan !== 'FREE' && subscription.status === 'active') {
      // Has active paid plan
      return next();
    }

    // Access denied
    res.status(403).json({
      error: 'ACCESS_RESTRICTED',
      message: 'Your trial has expired. Please subscribe to continue using the service.',
      trialEnded: true,
      // Optionally include subscription info
    });
  } catch {
    res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: 'Failed to verify access' });
  }
}