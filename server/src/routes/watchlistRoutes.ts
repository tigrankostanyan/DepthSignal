import { Router } from 'express';
import { ServerContext } from '../context.js';
import { requireAuth } from '../security/authMiddleware.js';
import { requireActiveAccess } from '../security/accessMiddleware.js';
import { watchlistMutationLimiter } from '../security/rateLimiter.js';
import { validateBody } from '../utils/validate.js';
import {
  WatchlistCreateSchema,
  WatchlistItemDeleteSchema,
  WatchlistItemSchema
} from '../validation/schemas.js';


// Create watchlist router
export function createWatchlistRouter(ctx: ServerContext): Router {
  const router = Router();
  const { watchlistController } = ctx;

  router.get('/', requireAuth, requireActiveAccess, watchlistController.list);
  router.post('/', requireAuth, requireActiveAccess, watchlistMutationLimiter, validateBody(WatchlistCreateSchema), watchlistController.create);
  router.delete('/:id', requireAuth, requireActiveAccess, watchlistMutationLimiter, watchlistController.remove);

  router.post('/:id/items', requireAuth, requireActiveAccess, watchlistMutationLimiter, validateBody(WatchlistItemSchema), watchlistController.addItem);
  router.delete('/:id/items', requireAuth, requireActiveAccess, watchlistMutationLimiter, validateBody(WatchlistItemDeleteSchema), watchlistController.removeItem);

  return router;
}
