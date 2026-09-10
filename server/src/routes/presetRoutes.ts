import { Router } from 'express';
import { ServerContext } from '../context.js';
import { requireAuth } from '../security/authMiddleware.js';
import { requireActiveAccess } from '../security/accessMiddleware.js';
import { presetMutationLimiter } from '../security/rateLimiter.js';
import { validateBody } from '../utils/validate.js';
import { FilterPresetSchema } from '../validation/schemas.js';

// Create preset router
export function createPresetRouter(ctx: ServerContext): Router {
  const router = Router();
  const { presetController } = ctx;

  router.get('/', requireAuth, requireActiveAccess, presetController.list);
  router.post('/', requireAuth, requireActiveAccess, presetMutationLimiter, validateBody(FilterPresetSchema), presetController.save);
  router.delete('/:id', requireAuth, requireActiveAccess, presetMutationLimiter, presetController.remove);

  return router;
}
