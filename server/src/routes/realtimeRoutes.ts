import { Router } from 'express';
import { ServerContext } from '../context.js';
import { requireAuth } from '../security/authMiddleware.js';
import { requireActiveAccess } from '../security/accessMiddleware.js';
import { getPlanDefinition } from '../services/billing/planConfig.js';

// Create realtime router
export function createRealtimeRouter(ctx: ServerContext): Router {
  const router = Router();
  const { sseManager } = ctx;

  router.get('/stream', requireAuth, requireActiveAccess, async (req, res, next) => {
    try {
      const user = req.user!;

      // Admins stream every exchange; everyone else only receives the exchanges
      // their subscription plan entitles them to.
      let allowedExchanges: string[] | undefined;
      if ((user.role || '').toUpperCase() !== 'ADMIN') {
        const subscription = await ctx.db.getUserSubscription(user.id);
        allowedExchanges = getPlanDefinition(subscription.plan).limits.allowedExchanges;
      }

      const clientId = `sse_${user.id}_${Math.random().toString(36).substring(2, 9)}`;
      sseManager.addClient(clientId, user, res, allowedExchanges);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
