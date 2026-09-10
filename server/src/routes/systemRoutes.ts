import { Router } from 'express';
import { ServerContext } from '../context.js';
import { requireAuth, requireRole } from '../security/authMiddleware.js';

// Create system router
export function createSystemRouter(ctx: ServerContext): Router {
  const router = Router();
  const { systemController, auditController, connectorController } = ctx;

  router.get('/health', systemController.health);
  router.get('/integrations/status', systemController.integrationsStatus);
  router.get('/audit/logs', requireAuth, auditController.list);
  router.get('/connectors/health', connectorController.health);
  // Admin-only: opening live exchange connections must never be publicly triggerable.
  router.get('/run-tests', requireAuth, requireRole('ADMIN'), systemController.runTests);

  return router;
}
