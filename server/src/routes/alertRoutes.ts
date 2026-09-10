import { Router } from 'express';
import { ServerContext } from '../context.js';
import { requireAuth } from '../security/authMiddleware.js';
import { requireActiveAccess } from '../security/accessMiddleware.js';
import { alertMutationLimiter, testAlertTriggerLimiter } from '../security/rateLimiter.js';
import { validateBody } from '../utils/validate.js';
import { AlertRuleSchema } from '../validation/schemas.js';

// Create alert router
export function createAlertRouter(ctx: ServerContext): Router {
  const router = Router();
  const { alertController } = ctx;

  router.get('/rules', requireAuth, requireActiveAccess, alertController.listRules);
  router.post('/rules', requireAuth, requireActiveAccess, alertMutationLimiter, validateBody(AlertRuleSchema), alertController.createRule);
  router.delete('/rules/:id', requireAuth, requireActiveAccess, alertMutationLimiter, alertController.deleteRule);

  router.get('/triggers', requireAuth, requireActiveAccess, alertController.listTriggers);
  router.post('/triggers/read', requireAuth, requireActiveAccess, alertController.markTriggerRead);
  router.delete('/triggers', requireAuth, requireActiveAccess, alertController.clearTriggers);
  router.post('/test-trigger', requireAuth, requireActiveAccess, testAlertTriggerLimiter, alertController.testTrigger);

  return router;
}
