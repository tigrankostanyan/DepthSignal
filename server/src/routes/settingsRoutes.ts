import { Router } from 'express';
import { ServerContext } from '../context.js';
import { requireAuth } from '../security/authMiddleware.js';
import { requireActiveAccess } from '../security/accessMiddleware.js';
import { validateBody } from '../utils/validate.js';
import { UserSettingsSchema } from '../validation/schemas.js';

// Create settings router
export function createSettingsRouter(ctx: ServerContext): Router {
  const router = Router();
  const { settingsController } = ctx;

  router.get('/', requireAuth, requireActiveAccess, settingsController.get);
  router.post('/', requireAuth, requireActiveAccess, validateBody(UserSettingsSchema), settingsController.update);

  return router;
}
