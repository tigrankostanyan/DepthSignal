import express, { Express } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { ServerContext } from './context.js';
import { errorHandler } from './utils/errorHandler.js';
import {
  correlationMiddleware,
  securityHeadersMiddleware,
  structuredLoggerMiddleware
} from './security/securityMiddlewares.js';

import { createAuthRouter } from './routes/authRoutes.js';
import { createRealtimeRouter } from './routes/realtimeRoutes.js';
import { createMarketRouter } from './routes/marketRoutes.js';
import { createWallRouter } from './routes/wallRoutes.js';
import { createAlertRouter } from './routes/alertRoutes.js';
import { createWatchlistRouter } from './routes/watchlistRoutes.js';
import { createBlacklistRouter } from './routes/blacklistRoutes.js';
import { createPresetRouter } from './routes/presetRoutes.js';
import { createSettingsRouter } from './routes/settingsRoutes.js';
import { createTelegramRouter } from './routes/telegramRoutes.js';
import { createBillingRouter } from './routes/billingRoutes.js';
import { createAdminRouter } from './routes/adminRoutes.js';
import { createSystemRouter } from './routes/systemRoutes.js';
import { createUserRouter } from './routes/userRoutes.js';


// Create app
export function createApp(ctx: ServerContext): Express {
  const app = express();

  // CORS configuration — strict, only allow trusted origins
  const appDomain = process.env.APP_DOMAIN || '';
  const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map(o => o.trim())
    : [`https://${appDomain}`, `https://www.${appDomain}`];

  // CORS configuration — allow localhost for development
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, curl, etc.)
        if (!origin) return callback(null, true);
        // Allow all localhost and 127.0.0.1 variants for development
        const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/)?$/.test(origin);
        if (isLocalhost) {
          return callback(null, true);
        }
        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(new Error('Not allowed by CORS'), false);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-session-token', 'X-Requested-With'],
      maxAge: 86400 // 24 hours
    })
  );

  app.use(cookieParser());

  app.use(
    express.json({
      limit: '8mb',
      verify: (req: any, _res, buf) => {
        req.rawBody = buf;
      }
    })
  );

  // Global middleware stack
  app.use(correlationMiddleware);
  app.use(securityHeadersMiddleware);
  app.use(structuredLoggerMiddleware);

  // Feature routers mounted under /api
  app.use('/api/auth', createAuthRouter(ctx));
  app.use('/api/realtime', createRealtimeRouter(ctx));
  app.use('/api/market', createMarketRouter(ctx));
  app.use('/api/walls', createWallRouter(ctx));
  app.use('/api/alerts', createAlertRouter(ctx));
  app.use('/api/watchlists', createWatchlistRouter(ctx));
  app.use('/api/blacklist', createBlacklistRouter(ctx));
  app.use('/api/presets', createPresetRouter(ctx));
  app.use('/api/settings', createSettingsRouter(ctx));
  app.use('/api/telegram', createTelegramRouter(ctx));
  app.use('/api/billing', createBillingRouter(ctx));
  app.use('/api/admin', createAdminRouter(ctx));
  app.use('/api/user', createUserRouter(ctx));
  app.use('/api', createSystemRouter(ctx));
  app.use('/api', errorHandler);
  return app;
}
