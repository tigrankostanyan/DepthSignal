import { Router } from 'express';
import { ServerContext } from '../context.js';
import { UserController } from '../controllers/userController.js';
import { requireAuth } from '../security/authMiddleware.js';
import { requireActiveAccess } from '../security/accessMiddleware.js';

// Create user router
export function createUserRouter(ctx: ServerContext): Router {
  const router = Router();
  const controller = new UserController(ctx.db);

  // All routes require authentication and active access
  router.use(requireAuth);
  router.use(requireActiveAccess);

  router.get('/export', controller.exportData);
  router.delete('/me', controller.deleteAccount);

  return router;
}