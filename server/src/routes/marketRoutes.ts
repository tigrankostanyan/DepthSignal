import { Router } from 'express';
import { ServerContext } from '../context.js';
import { optionalAuth } from '../security/authMiddleware.js';

// Create market router
export function createMarketRouter(ctx: ServerContext): Router {
  const router = Router();
  const { marketController } = ctx;

  router.get('/tickers', optionalAuth, marketController.tickers);
  router.get('/symbol/:symbol', marketController.symbolDetail);

  return router;
}
