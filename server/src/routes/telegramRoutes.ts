import { Router } from 'express';
import { ServerContext } from '../context.js';
import { requireAuth } from '../security/authMiddleware.js';
import { requireActiveAccess } from '../security/accessMiddleware.js';
import { testAlertTriggerLimiter } from '../security/rateLimiter.js';

// Create telegram router
export function createTelegramRouter(ctx: ServerContext): Router {
  const router = Router();
  const { telegramController } = ctx;

  router.get('/status', requireAuth, requireActiveAccess, telegramController.status);
  router.post('/link-token', requireAuth, requireActiveAccess, telegramController.linkToken);
  router.post('/test-alert', requireAuth, requireActiveAccess, testAlertTriggerLimiter, telegramController.testAlert);
  router.post('/disconnect', requireAuth, requireActiveAccess, telegramController.disconnect);
  router.post('/webhook', telegramController.webhook);

  return router;
}
