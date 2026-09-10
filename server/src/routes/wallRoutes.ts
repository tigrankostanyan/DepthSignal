import { Router } from 'express';
import { ServerContext } from '../context.js';
import { requireAuth } from '../security/authMiddleware.js';
import { requireActiveAccess } from '../security/accessMiddleware.js';
import { validateBody } from '../utils/validate.js';
import { WallConfigSchema } from '../validation/schemas.js';


// Create wall router
export function createWallRouter(ctx: ServerContext): Router {
  const router = Router();
  const { wallController } = ctx;

  router.get('/active', wallController.active);
  router.get('/history', wallController.history);
  router.get('/daily-aggregates', wallController.dailyAggregates);
  router.get('/config', wallController.getConfig);
  router.post('/config', requireAuth, requireActiveAccess, validateBody(WallConfigSchema), wallController.setConfig);

  return router;
}
