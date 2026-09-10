import { Router } from 'express';
import { ServerContext } from '../context.js';
import { requireAuth, optionalAuth } from '../security/authMiddleware.js';

export function createAuthRouter(ctx: ServerContext): Router {
  const router = Router();
  const { authController } = ctx;

  router.post('/register', authController.register);
  router.post('/login', authController.login);
  router.post('/refresh', authController.refresh);
  router.get('/me', requireAuth, authController.me);
  router.post('/logout', optionalAuth, authController.logout);
  router.get('/config', authController.config);
  router.post('/google', authController.google);

  return router;
}