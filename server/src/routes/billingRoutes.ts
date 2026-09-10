import { Router } from 'express';
import { ServerContext } from '../context.js';
import { requireAuth } from '../security/authMiddleware.js';
import { requireActiveAccess } from '../security/accessMiddleware.js';

// Create billing router
export function createBillingRouter(ctx: ServerContext): Router {
  const router = Router();
  const { billingController } = ctx;
  router.get('/config', billingController.config);
  router.get('/plans', billingController.plans);
  router.get('/subscription', requireAuth, billingController.subscription);
  router.post('/checkout', requireAuth, billingController.checkout);
  router.post('/portal', requireAuth, requireActiveAccess, billingController.portal);
  router.get('/events', requireAuth, billingController.events);
  router.get('/history', requireAuth, billingController.events);
  router.post('/receipts', requireAuth, billingController.submitReceipt);
  router.get('/receipts', requireAuth, billingController.myReceipts);
  router.get('/sandbox/checkout', billingController.sandboxCheckout);
  router.post('/webhook', billingController.webhook);
  router.post('/binance/checkout', requireAuth, billingController.binanceCheckout);
  router.post('/binance/webhook', billingController.binanceWebhook);

  return router;
}
