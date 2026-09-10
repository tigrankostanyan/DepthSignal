import { Router } from 'express';
import { ServerContext } from '../context.js';
import { requireAuth } from '../security/authMiddleware.js';
import { requireActiveAccess } from '../security/accessMiddleware.js';
import { validateBody } from '../utils/validate.js';
import { BlacklistEntrySchema } from '../validation/schemas.js';

// Create blacklist router
export function createBlacklistRouter(ctx: ServerContext): Router {
  const router = Router();
  const { blacklistController } = ctx;

  router.get('/', requireAuth, requireActiveAccess, blacklistController.list);
  router.post('/', requireAuth, requireActiveAccess, validateBody(BlacklistEntrySchema), blacklistController.add);
  router.delete('/:id', requireAuth, requireActiveAccess, blacklistController.remove);

  return router;
}
