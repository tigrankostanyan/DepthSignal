import { Router } from 'express';
import { ServerContext } from '../context.js';
import { requireAuth, requireRole } from '../security/authMiddleware.js';

// Create admin router
export function createAdminRouter(ctx: ServerContext): Router {
  const router = Router();
  const { adminController } = ctx;
  const adminOnly = [requireAuth, requireRole('ADMIN')];

  router.get('/users', ...adminOnly, adminController.users);
  router.post('/users/:id/plan', ...adminOnly, adminController.setPlan);
  router.post('/users/:id/role', ...adminOnly, adminController.setRole);

  router.get('/notifications/deliveries', ...adminOnly, adminController.notificationDeliveries);
  router.post('/notifications/:id/retry', ...adminOnly, adminController.retryNotification);

  router.get('/stats', ...adminOnly, adminController.stats);

  router.get('/receipts', ...adminOnly, adminController.receipts);
  router.post('/receipts/:id/activate', ...adminOnly, adminController.activateReceipt);
  router.post('/receipts/:id/reject', ...adminOnly, adminController.rejectReceipt);

  return router;
}
