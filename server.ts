import dotenv from 'dotenv';
import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { AlertEngine } from './server/alert-engine/AlertEngine.js';
import { AuthService } from './server/auth/AuthService.js';
import { extractToken, optionalAuth, requireAuth, requireRole } from './server/auth/authMiddleware.js';
import { EntitlementService } from './server/billing/EntitlementService.js';
import { SUBSCRIPTION_PLANS } from './server/billing/planConfig.js';
import { StripeBillingProvider } from './server/billing/StripeBillingProvider.js';
import { UsageService } from './server/billing/UsageService.js';
import { ConnectorManager } from './server/connectors/ConnectorManager.js';
import { DatabaseService } from './server/db/database.js';
import { MarketStateService } from './server/market-data/MarketStateService.js';
import { errorHandler } from './server/middleware/errorHandler.js';
import { 
  alertMutationLimiter, 
  authRateLimiter, 
  presetMutationLimiter, 
  testAlertTriggerLimiter, 
  watchlistMutationLimiter 
} from './server/middleware/rateLimiter.js';
import { correlationMiddleware, securityHeadersMiddleware, structuredLoggerMiddleware } from './server/middleware/security.js';
import { validateBody } from './server/middleware/validate.js';
import { NotificationQueue } from './server/notifications/NotificationQueue.js';
import { NotificationWorker } from './server/notifications/NotificationWorker.js';
import { TelegramLinkingService } from './server/notifications/TelegramLinkingService.js';
import { SSEManager } from './server/realtime/sseManager.js';
import { runAllDomainTests } from './server/tests/domainTests.js';
import { runSecurityHardeningTests } from './server/tests/securityHardeningTests.js';
import { runBillingAndNotificationTests } from './server/tests/billingAndNotificationTests.js';
import { runTelegramLinkingTests } from './server/tests/telegramLinkingTests.js';
import { 
  AlertRuleSchema, 
  BlacklistEntrySchema, 
  FilterPresetSchema, 
  LoginSchema, 
  RegisterSchema, 
  UserSettingsSchema, 
  WallConfigSchema, 
  WatchlistCreateSchema, 
  WatchlistItemDeleteSchema, 
  WatchlistItemSchema 
} from './server/validation/schemas.js';
import { WallEngine } from './server/wall-engine/WallEngine.js';
import { DetectedWall, ExchangeId, MarketTicker, MarketType, ScreenerFilters, SubscriptionPlanId } from './src/types/index.js';

dotenv.config();

const PORT = 3000;
const app = express();

// Core Body Parsers & Security Middleware with Raw Body preservation for Webhook Verification
app.use(express.json({ 
  limit: '2mb',
  verify: (req: any, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(correlationMiddleware);
app.use(securityHeadersMiddleware);
app.use(structuredLoggerMiddleware);

async function startApp() {
  console.log('[Server] Initializing Trading Screener Production Services...');

  // 1. Initialize SQLite Database
  const db = DatabaseService.getInstance();
  await db.initialize();

  // 2. Initialize Market State, Engines & Realtime Manager
  const authService = AuthService.getInstance();
  const sseManager = SSEManager.getInstance();
  const marketState = MarketStateService.getInstance();
  const wallEngine = WallEngine.getInstance();
  const alertEngine = AlertEngine.getInstance();
  const connectorManager = ConnectorManager.getInstance();
  const entitlementService = EntitlementService.getInstance();
  const usageService = UsageService.getInstance();
  const billingProvider = new StripeBillingProvider();
  const notificationWorker = NotificationWorker.getInstance();

  // Start background notification delivery worker
  notificationWorker.start(1000);

  // Wire event pipelines:
  // Connectors -> MarketState & Engines
  connectorManager.onTicker((ticker: MarketTicker) => {
    marketState.updateTicker(ticker);
    alertEngine.evaluateTicker(ticker);
  });

  connectorManager.onOrderBook((orderBook) => {
    marketState.updateOrderBook(orderBook);
    wallEngine.processOrderBook(orderBook);
  });

  connectorManager.onTrade((trade) => {
    marketState.addTrade(trade);
  });

  // WallEngine events -> AlertEngine & SSE broadcast
  wallEngine.onWallEvent((wall: DetectedWall, eventType: string) => {
    if (eventType === 'CONFIRMED' || eventType === 'FORMING') {
      alertEngine.evaluateWall(wall);
    }
    sseManager.broadcastAll('wall_event', { wall, eventType });
  });

  // AlertEngine triggers -> SSE broadcast to specific user or all
  alertEngine.onAlertTrigger((trigger) => {
    if (trigger.userId) {
      sseManager.broadcastUser(trigger.userId, 'alert_trigger', trigger);
    } else {
      sseManager.broadcastAll('alert_trigger', trigger);
    }
  });

  // Start Connectors based on default settings
  const userSettings = db.getUserSettings();
  await connectorManager.startAll(userSettings.enabledExchanges);

  // Periodic SSE batch pusher for live tickers (every 400ms for smooth UI updates)
  setInterval(() => {
    if (sseManager.getActiveClientCount() > 0) {
      const tickers = marketState.getAllTickers();
      sseManager.broadcastAll('tickers_batch', tickers);
    }
  }, 400);

  // Periodic expired sessions cleanup (every 1 hour)
  setInterval(() => {
    try {
      db.cleanupExpiredSessions();
    } catch (e: any) {
      console.error('[Job] Session cleanup error:', e.message);
    }
  }, 60 * 60 * 1000);

  // Scheduled job: 90-day retention cleanup (runs every 6 hours)
  setInterval(() => {
    try {
      console.log('[Job] Running 90-day historical wall retention cleanup...');
      db.cleanOldWallHistory(90);
    } catch (e: any) {
      console.error('[Job] Retention cleanup error:', e.message);
    }
  }, 6 * 60 * 60 * 1000);

  // ==========================================
  // API ROUTE HANDLERS
  // ==========================================

  // Health check
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({
      status: 'ok',
      time: Date.now(),
      connections: sseManager.getActiveClientCount()
    });
  });

  // ------------------------------------------
  // AUTHENTICATION ROUTES
  // ------------------------------------------
  app.post('/api/auth/register', authRateLimiter, validateBody(RegisterSchema), (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password, name } = req.body;
      const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
      const userAgent = req.headers['user-agent'];
      const result = authService.register(email, password, name, 'TRADER', ip, userAgent);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/auth/login', authRateLimiter, validateBody(LoginSchema), (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body;
      const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
      const userAgent = req.headers['user-agent'];
      const result = authService.login(email, password, ip, userAgent);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/auth/me', requireAuth, (req: Request, res: Response) => {
    res.json({ user: req.user });
  });

  app.post('/api/auth/logout', requireAuth, (req: Request, res: Response) => {
    const token = extractToken(req);
    if (token) {
      const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
      authService.logout(token, req.user?.id, ip);
    }
    res.json({ status: 'ok', message: 'Logged out successfully' });
  });

  // ------------------------------------------
  // REALTIME SSE STREAM (SECURED)
  // ------------------------------------------
  app.get('/api/realtime/stream', requireAuth, (req: Request, res: Response) => {
    const clientId = `sse_${req.user!.id}_${Math.random().toString(36).substring(2, 9)}`;
    sseManager.addClient(clientId, req.user!, res);
  });

  // ------------------------------------------
  // MARKET TICKERS & DETAIL (WITH OPTIONAL USER WATCHLIST ISOLATION)
  // ------------------------------------------
  app.get('/api/market/tickers', optionalAuth, (req: Request, res: Response, next: NextFunction) => {
    try {
      const filters: ScreenerFilters = {
        searchQuery: (req.query.searchQuery as string) || '',
        category: (req.query.category as any) || 'ALL',
        marketType: (req.query.marketType as any) || 'ALL',
        exchanges: req.query.exchanges ? (req.query.exchanges as string).split(',') as any : [],
        priceMin: req.query.priceMin ? parseFloat(req.query.priceMin as string) : undefined,
        priceMax: req.query.priceMax ? parseFloat(req.query.priceMax as string) : undefined,
        changeMin: req.query.changeMin ? parseFloat(req.query.changeMin as string) : undefined,
        changeMax: req.query.changeMax ? parseFloat(req.query.changeMax as string) : undefined,
        timeframe: (req.query.timeframe as any) || '1d',
        volumeMinUsd: req.query.volumeMinUsd ? parseFloat(req.query.volumeMinUsd as string) : undefined,
        volumeMaxUsd: req.query.volumeMaxUsd ? parseFloat(req.query.volumeMaxUsd as string) : undefined,
        rsiMin: req.query.rsiMin ? parseFloat(req.query.rsiMin as string) : undefined,
        rsiMax: req.query.rsiMax ? parseFloat(req.query.rsiMax as string) : undefined,
        onlyWithWalls: req.query.onlyWithWalls === 'true',
        onlyWatchlist: req.query.onlyWatchlist === 'true',
        hideBlacklisted: req.query.hideBlacklisted !== 'false',
        sortBy: (req.query.sortBy as any) || 'volumeUsd',
        sortOrder: (req.query.sortOrder as any) || 'desc'
      };

      let tickers = marketState.filterTickers(filters);

      if (filters.onlyWithWalls) {
        const activeWalls = wallEngine.getActiveWalls();
        const wallSymbols = new Set(activeWalls.map(w => w.symbol));
        tickers = tickers.filter(t => wallSymbols.has(t.symbol));
      }

      if (filters.onlyWatchlist) {
        const userId = req.user?.id || 'usr_default_trader';
        const watchlists = db.getWatchlists(userId);
        const wlSymbols = new Set(watchlists.flatMap(w => w.items.map(i => `${i.exchange}:${i.symbol}`)));
        tickers = tickers.filter(t => wlSymbols.has(`${t.exchange}:${t.symbol}`));
      }

      res.json({ count: tickers.length, data: tickers });
    } catch (e: any) {
      next(e);
    }
  });

  // Detailed Symbol Info
  app.get('/api/market/symbol/:symbol', (req: Request, res: Response, next: NextFunction) => {
    try {
      const symbol = req.params.symbol.toUpperCase().trim();
      const exchange = (req.query.exchange as ExchangeId) || 'BINANCE';
      const marketType = (req.query.marketType as MarketType) || 'SPOT';

      const ticker = marketState.getTicker(exchange, marketType, symbol) || {
        symbol,
        baseAsset: symbol.replace(/USDT|USD|EUR/, ''),
        quoteAsset: 'USDT',
        exchange,
        marketType,
        category: 'CRYPTO',
        lastPrice: 95000,
        percentageChange: 2.1,
        changesByTimeframe: { '1h': 0.5, '1d': 2.1 },
        volumeUsd: 1200000000,
        volume24h: 12500,
        high24h: 96500,
        low24h: 93800,
        timestamp: Date.now(),
        isLive: true
      };

      const orderBook = marketState.getOrderBook(exchange, marketType, symbol);
      const trades = marketState.getTrades(exchange, marketType, symbol);
      const candles = marketState.getCandles(exchange, marketType, symbol, 80);
      const walls = wallEngine.getActiveWalls(symbol, marketType);

      res.json({
        ticker,
        orderBook,
        trades,
        candles,
        walls
      });
    } catch (e: any) {
      next(e);
    }
  });

  // ------------------------------------------
  // WALLS API
  // ------------------------------------------
  app.get('/api/walls/active', (req: Request, res: Response) => {
    const symbol = req.query.symbol as string | undefined;
    const marketType = req.query.marketType as MarketType | undefined;
    const walls = wallEngine.getActiveWalls(symbol, marketType);
    res.json({ count: walls.length, data: walls });
  });

  app.get('/api/walls/history', (req: Request, res: Response) => {
    const symbol = req.query.symbol as string | undefined;
    const exchange = req.query.exchange as string | undefined;
    const limit = req.query.limit ? Math.min(parseInt(req.query.limit as string, 10), 500) : 100;
    const history = db.getWallHistory(symbol, exchange, limit);
    res.json({ count: history.length, data: history });
  });

  app.get('/api/walls/daily-aggregates', (req: Request, res: Response) => {
    const days = req.query.days ? Math.min(parseInt(req.query.days as string, 10), 90) : 30;
    const aggregates = db.getDailyWallAggregates(days);
    res.json({ count: aggregates.length, data: aggregates });
  });

  app.get('/api/walls/config', (req: Request, res: Response) => {
    res.json(wallEngine.getConfig());
  });

  app.post('/api/walls/config', requireAuth, validateBody(WallConfigSchema), (req: Request, res: Response) => {
    wallEngine.setConfig(req.body);
    db.addAuditLog({
      userId: req.user!.id,
      action: 'WALL_CONFIG_UPDATE',
      resource: 'WALL_ENGINE',
      details: req.body,
      ipAddress: req.ip
    });
    res.json({ status: 'ok', config: wallEngine.getConfig() });
  });

  // ------------------------------------------
  // ALERT RULES API (USER-ISOLATED & ENTITLED)
  // ------------------------------------------
  app.get('/api/alerts/rules', requireAuth, (req: Request, res: Response) => {
    res.json(db.getAlertRules(req.user!.id));
  });

  app.post('/api/alerts/rules', requireAuth, alertMutationLimiter, validateBody(AlertRuleSchema), (req: Request, res: Response, next: NextFunction) => {
    try {
      // 1. Entitlement limit & feature check
      const entitlementCheck = entitlementService.canCreateAlert(req.user!.id, req.body);
      if (!entitlementCheck.allowed) {
        res.status(403).json({
          error: entitlementCheck.code || 'PLAN_LIMIT_REACHED',
          message: entitlementCheck.reason,
          limit: entitlementCheck.limit,
          currentUsage: entitlementCheck.currentUsage
        });
        return;
      }

      const saved = db.saveAlertRule(req.body, req.user!.id);
      db.addAuditLog({
        userId: req.user!.id,
        action: req.body.id ? 'ALERT_RULE_UPDATED' : 'ALERT_RULE_CREATED',
        resource: 'ALERT_RULE',
        resourceId: saved.id,
        details: { name: saved.name, symbols: saved.symbols, conditionsCount: saved.conditions.length },
        ipAddress: req.ip
      });
      res.json(saved);
    } catch (err) {
      next(err);
    }
  });

  app.delete('/api/alerts/rules/:id', requireAuth, alertMutationLimiter, (req: Request, res: Response) => {
    const deleted = db.deleteAlertRule(req.params.id, req.user!.id);
    if (!deleted) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Alert rule not found or not authorized to delete' });
      return;
    }
    db.addAuditLog({
      userId: req.user!.id,
      action: 'ALERT_RULE_DELETED',
      resource: 'ALERT_RULE',
      resourceId: req.params.id,
      ipAddress: req.ip
    });
    res.json({ status: 'ok' });
  });

  // ------------------------------------------
  // ALERT TRIGGERS API (USER-ISOLATED)
  // ------------------------------------------
  app.get('/api/alerts/triggers', requireAuth, (req: Request, res: Response) => {
    const limit = req.query.limit ? Math.min(parseInt(req.query.limit as string, 10), 500) : 100;
    res.json(db.getAlertTriggers(limit, req.user!.id));
  });

  app.post('/api/alerts/triggers/read', requireAuth, (req: Request, res: Response) => {
    db.markAlertTriggerRead(req.body.id, req.user!.id);
    res.json({ status: 'ok' });
  });

  app.delete('/api/alerts/triggers', requireAuth, (req: Request, res: Response) => {
    db.clearAlertTriggers(req.user!.id);
    res.json({ status: 'ok' });
  });

  app.post('/api/alerts/test-trigger', requireAuth, testAlertTriggerLimiter, (req: Request, res: Response) => {
    const sampleTicker = marketState.getTicker('BINANCE', 'SPOT', 'BTCUSDT') || {
      symbol: 'BTCUSDT',
      baseAsset: 'BTC',
      quoteAsset: 'USDT',
      exchange: 'BINANCE',
      marketType: 'SPOT',
      category: 'CRYPTO',
      lastPrice: 96500,
      percentageChange: 3.5,
      changesByTimeframe: {},
      volumeUsd: 2500000000,
      volume24h: 26000,
      high24h: 97000,
      low24h: 93000,
      timestamp: Date.now(),
      isLive: true
    };
    
    const trigger = db.saveAlertTrigger({
      ruleId: 'manual_test',
      ruleName: 'Manual Simulation Alert',
      symbol: sampleTicker.symbol,
      exchange: sampleTicker.exchange,
      marketType: sampleTicker.marketType,
      message: 'Test simulation alert triggered manually from Terminal controls',
      conditionType: 'PRICE_ABOVE',
      metricValue: `$${sampleTicker.lastPrice.toLocaleString()}`,
      triggerPrice: sampleTicker.lastPrice,
      timestamp: Date.now(),
      channel: 'IN_APP',
      read: false
    }, req.user!.id);

    sseManager.broadcastUser(req.user!.id, 'alert_trigger', trigger);
    res.json(trigger);
  });

  // ------------------------------------------
  // WATCHLISTS API (USER-ISOLATED)
  // ------------------------------------------
  app.get('/api/watchlists', requireAuth, (req: Request, res: Response) => {
    res.json(db.getWatchlists(req.user!.id));
  });

  app.post('/api/watchlists', requireAuth, watchlistMutationLimiter, validateBody(WatchlistCreateSchema), (req: Request, res: Response) => {
    const wl = db.createWatchlist(req.body.name, req.user!.id);
    res.status(201).json(wl);
  });

  app.delete('/api/watchlists/:id', requireAuth, watchlistMutationLimiter, (req: Request, res: Response) => {
    const deleted = db.deleteWatchlist(req.params.id, req.user!.id);
    if (!deleted) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Watchlist not found or unauthorized' });
      return;
    }
    res.json({ status: 'ok' });
  });

  app.post('/api/watchlists/:id/items', requireAuth, watchlistMutationLimiter, validateBody(WatchlistItemSchema), (req: Request, res: Response) => {
    const entitlementCheck = entitlementService.canAddWatchlistItem(req.user!.id, req.body.exchange);
    if (!entitlementCheck.allowed) {
      res.status(403).json({
        error: entitlementCheck.code || 'PLAN_LIMIT_REACHED',
        message: entitlementCheck.reason,
        limit: entitlementCheck.limit,
        currentUsage: entitlementCheck.currentUsage
      });
      return;
    }

    const item = db.addWatchlistItem(req.params.id, req.body, req.user!.id);
    if (!item) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Watchlist not found or unauthorized' });
      return;
    }
    res.json(item);
  });

  app.delete('/api/watchlists/:id/items', requireAuth, watchlistMutationLimiter, validateBody(WatchlistItemDeleteSchema), (req: Request, res: Response) => {
    const { symbol, exchange, marketType } = req.body;
    const removed = db.removeWatchlistItem(req.params.id, symbol, exchange, marketType, req.user!.id);
    if (!removed) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Watchlist not found or unauthorized' });
      return;
    }
    res.json({ status: 'ok' });
  });

  // ------------------------------------------
  // GLOBAL BLACKLIST API (AUDITED)
  // ------------------------------------------
  app.get('/api/blacklist', requireAuth, (req: Request, res: Response) => {
    res.json(db.getBlacklist());
  });

  app.post('/api/blacklist', requireAuth, validateBody(BlacklistEntrySchema), (req: Request, res: Response) => {
    const entry = db.addBlacklistEntry(req.body);
    db.addAuditLog({
      userId: req.user!.id,
      action: 'BLACKLIST_ENTRY_ADDED',
      resource: 'BLACKLIST',
      resourceId: entry.id,
      details: { symbol: entry.symbol, exchange: entry.exchange, reason: entry.reason },
      ipAddress: req.ip
    });
    res.json(entry);
  });

  app.delete('/api/blacklist/:id', requireAuth, (req: Request, res: Response) => {
    db.removeBlacklistEntry(req.params.id);
    db.addAuditLog({
      userId: req.user!.id,
      action: 'BLACKLIST_ENTRY_REMOVED',
      resource: 'BLACKLIST',
      resourceId: req.params.id,
      ipAddress: req.ip
    });
    res.json({ status: 'ok' });
  });

  // ------------------------------------------
  // FILTER PRESETS API (USER-ISOLATED)
  // ------------------------------------------
  app.get('/api/presets', requireAuth, (req: Request, res: Response) => {
    res.json(db.getFilterPresets(req.user!.id));
  });

  app.post('/api/presets', requireAuth, presetMutationLimiter, validateBody(FilterPresetSchema), (req: Request, res: Response) => {
    const preset = db.saveFilterPreset(req.body, req.user!.id);
    res.json(preset);
  });

  app.delete('/api/presets/:id', requireAuth, presetMutationLimiter, (req: Request, res: Response) => {
    const deleted = db.deleteFilterPreset(req.params.id, req.user!.id);
    if (!deleted) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Filter preset not found or unauthorized' });
      return;
    }
    res.json({ status: 'ok' });
  });

  // ------------------------------------------
  // USER SETTINGS API (USER-ISOLATED & AUDITED, TOKEN MASKED)
  // ------------------------------------------
  app.get('/api/settings', requireAuth, (req: Request, res: Response) => {
    const settings = db.getUserSettings(req.user!.id);
    const safeSettings = {
      ...settings,
      telegramBotToken: settings.telegramBotToken ? '••••••••' + settings.telegramBotToken.slice(-4) : undefined
    };
    res.json(safeSettings);
  });

  app.post('/api/settings', requireAuth, validateBody(UserSettingsSchema), (req: Request, res: Response) => {
    db.updateUserSettings(req.body, req.user!.id);
    if (req.body.wallMinVolumeDefaultUsd !== undefined || req.body.defaultCrossExchangeAggregation !== undefined) {
      wallEngine.setConfig({
        minVolumeUsd: req.body.wallMinVolumeDefaultUsd,
        crossExchangeAggregation: req.body.defaultCrossExchangeAggregation
      });
    }

    if (req.body.telegramBotToken || req.body.webhookUrl || req.body.emailRecipient) {
      db.addAuditLog({
        userId: req.user!.id,
        action: 'SETTINGS_NOTIFICATIONS_CHANGED',
        resource: 'USER_SETTINGS',
        details: {
          hasTelegram: Boolean(req.body.telegramBotToken),
          hasWebhook: Boolean(req.body.webhookUrl),
          hasEmail: Boolean(req.body.emailRecipient)
        },
        ipAddress: req.ip
      });
    }

    const settings = db.getUserSettings(req.user!.id);
    const safeSettings = {
      ...settings,
      telegramBotToken: settings.telegramBotToken ? '••••••••' + settings.telegramBotToken.slice(-4) : undefined
    };
    res.json({ status: 'ok', settings: safeSettings });
  });

  // ------------------------------------------
  // BILLING & SUBSCRIPTION API
  // ------------------------------------------
  app.get('/api/billing/config', (req: Request, res: Response) => {
    res.json({
      configured: billingProvider.isConfigured,
      provider: billingProvider.providerName
    });
  });

  app.get('/api/integrations/status', (req: Request, res: Response) => {
    res.json({
      billing: billingProvider.isConfigured,
      telegram: Boolean(process.env.TELEGRAM_BOT_TOKEN),
      email: Boolean(process.env.SMTP_HOST),
      webhook: Boolean(process.env.WEBHOOK_SIGNING_SECRET)
    });
  });

  app.get('/api/billing/plans', (req: Request, res: Response) => {
    res.json({
      plans: Object.values(SUBSCRIPTION_PLANS),
      billingConfigured: billingProvider.isConfigured
    });
  });

  app.get('/api/billing/subscription', requireAuth, (req: Request, res: Response) => {
    const subscription = db.getUserSubscription(req.user!.id);
    const usage = usageService.getUsage(req.user!.id);
    res.json({ subscription, usage, billingConfigured: billingProvider.isConfigured });
  });

  app.post('/api/billing/checkout', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!billingProvider.isConfigured) {
        res.status(503).json({
          error: 'BILLING_NOT_CONFIGURED',
          message: 'Billing not configured'
        });
        return;
      }

      const { plan, interval, successUrl, cancelUrl } = req.body;
      if (!plan || !['PRO', 'ADVANCED'].includes(plan)) {
        res.status(400).json({ error: 'INVALID_PLAN', message: 'Valid plans for checkout are PRO or ADVANCED.' });
        return;
      }

      const defaultSuccessUrl = successUrl || `${req.protocol}://${req.get('host')}/?billing=success`;
      const defaultCancelUrl = cancelUrl || `${req.protocol}://${req.get('host')}/?billing=cancelled`;

      const session = await billingProvider.createCheckoutSession(
        req.user!.id,
        plan as SubscriptionPlanId,
        interval || 'monthly',
        defaultSuccessUrl,
        defaultCancelUrl
      );

      res.json(session);
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/billing/portal', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!billingProvider.isConfigured) {
        res.status(503).json({
          error: 'BILLING_NOT_CONFIGURED',
          message: 'Billing not configured'
        });
        return;
      }

      const returnUrl = req.body.returnUrl || `${req.protocol}://${req.get('host')}/`;
      const portal = await billingProvider.createCustomerPortalSession(req.user!.id, returnUrl);
      res.json(portal);
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/billing/events', requireAuth, (req: Request, res: Response) => {
    const events = db.getBillingEvents(req.user!.id);
    res.json(events);
  });

  // Disabled sandbox route when external billing is not configured
  app.get('/api/billing/sandbox/checkout', (req: Request, res: Response) => {
    res.status(503).send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Billing Not Configured</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0b0f19; color: #f3f4f6; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
          .card { background: #111827; border: 1px solid #374151; border-radius: 12px; padding: 32px; max-width: 440px; width: 100%; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); text-align: center; }
          h2 { margin: 0 0 12px 0; font-size: 22px; color: #fff; }
          p { color: #9ca3af; font-size: 14px; line-height: 1.6; margin: 0 0 24px 0; }
          .btn-back { display: inline-block; background: #2B2F36; color: #fff; text-decoration: none; border-radius: 8px; padding: 12px 24px; font-size: 14px; font-weight: 600; }
          .btn-back:hover { background: #374151; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>Billing not configured</h2>
          <p>Stripe credentials are not configured in this environment. Subscription checkout is disabled.</p>
          <a href="/" class="btn-back">Return to Terminal</a>
        </div>
      </body>
      </html>
    `);
  });

  // Authoritative Billing Webhook Receiver (Stripe & Sandbox)
  app.post('/api/billing/webhook', async (req: Request, res: Response) => {
    const signature = (req.headers['stripe-signature'] as string) || (req.headers['x-webhook-signature'] as string) || '';
    const rawBody = (req as any).rawBody || JSON.stringify(req.body);

    try {
      const result = await billingProvider.handleWebhook(rawBody, signature);

      if (result.userId && result.plan) {
        // Update user subscription state authoritatively in SQLite
        db.updateUserSubscription(result.userId, {
          plan: result.plan,
          status: result.status || 'active',
          billingProvider: result.provider,
          externalCustomerId: result.externalCustomerId,
          externalSubscriptionId: result.externalSubscriptionId,
          currentPeriodStart: result.currentPeriodStart || Date.now(),
          currentPeriodEnd: result.currentPeriodEnd || (Date.now() + 30 * 24 * 60 * 60 * 1000),
          cancelAtPeriodEnd: result.cancelAtPeriodEnd ?? false
        });

        db.recordBillingEvent({
          userId: result.userId,
          eventType: result.type as any,
          plan: result.plan,
          provider: result.provider,
          details: { eventId: result.eventId, status: result.status }
        });

        db.addAuditLog({
          userId: result.userId,
          action: 'BILLING_WEBHOOK_PROCESSED',
          resource: 'BILLING',
          details: { eventId: result.eventId, type: result.type, plan: result.plan },
          ipAddress: req.ip
        });

        // Broadcast subscription update via SSE
        const updatedSub = db.getUserSubscription(result.userId);
        sseManager.broadcastUser(result.userId, 'subscription_updated', updatedSub);
      }

      res.status(200).json({ received: true, eventId: result.eventId });
    } catch (err: any) {
      console.error('[BillingWebhook] Processing failure:', err.message);
      res.status(400).json({ error: 'WEBHOOK_ERROR', message: err.message });
    }
  });

  // ------------------------------------------
  // ADMIN API (PROTECTED: requireAuth + requireRole('ADMIN'))
  // ------------------------------------------
  app.get('/api/admin/users', requireAuth, requireRole('ADMIN'), (req: Request, res: Response) => {
    const users = db.getAllUsers();
    const enriched = users.map(u => {
      const sub = db.getUserSubscription(u.id);
      const usage = usageService.getUsage(u.id);
      return {
        ...u,
        subscription: sub,
        usage
      };
    });
    res.json(enriched);
  });

  app.post('/api/admin/users/:id/plan', requireAuth, requireRole('ADMIN'), (req: Request, res: Response) => {
    const targetUserId = req.params.id;
    const { plan, status } = req.body;

    if (!plan || !['FREE', 'PRO', 'ADVANCED'].includes(plan)) {
      res.status(400).json({ error: 'INVALID_PLAN', message: 'Plan must be FREE, PRO, or ADVANCED' });
      return;
    }

    const updated = db.updateUserSubscription(targetUserId, {
      plan: plan as SubscriptionPlanId,
      status: status || 'active',
      billingProvider: 'manual_admin'
    });

    db.recordBillingEvent({
      userId: targetUserId,
      eventType: 'manual_override',
      plan: plan as SubscriptionPlanId,
      provider: 'admin',
      details: { overriddenBy: req.user!.id, newPlan: plan }
    });

    db.addAuditLog({
      userId: req.user!.id,
      action: 'ADMIN_PLAN_MODIFIED',
      resource: 'USER_SUBSCRIPTION',
      resourceId: targetUserId,
      details: { targetUserId, plan, status },
      ipAddress: req.ip
    });

    sseManager.broadcastUser(targetUserId, 'subscription_updated', updated);
    res.json({ status: 'ok', subscription: updated });
  });

  app.post('/api/admin/users/:id/role', requireAuth, requireRole('ADMIN'), (req: Request, res: Response) => {
    const targetUserId = req.params.id;
    const { role } = req.body;

    if (!role || !['TRADER', 'ADMIN'].includes(role)) {
      res.status(400).json({ error: 'INVALID_ROLE', message: 'Role must be TRADER or ADMIN' });
      return;
    }

    db.updateUserRole(targetUserId, role);
    db.addAuditLog({
      userId: req.user!.id,
      action: 'ADMIN_ROLE_MODIFIED',
      resource: 'USER',
      resourceId: targetUserId,
      details: { targetUserId, role },
      ipAddress: req.ip
    });

    res.json({ status: 'ok', role });
  });

  app.get('/api/admin/notifications/deliveries', requireAuth, requireRole('ADMIN'), (req: Request, res: Response) => {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const status = req.query.status as string | undefined;
    const deliveries = db.getNotificationDeliveries(status, limit);
    res.json({ count: deliveries.length, data: deliveries });
  });

  app.post('/api/admin/notifications/:id/retry', requireAuth, requireRole('ADMIN'), (req: Request, res: Response) => {
    const deliveryId = req.params.id;
    db.updateNotificationDelivery(deliveryId, {
      status: 'pending',
      attempts: 0,
      nextAttemptAt: Date.now()
    });

    res.json({ status: 'ok', message: 'Notification delivery re-queued for immediate dispatch' });
  });

  app.get('/api/admin/stats', requireAuth, requireRole('ADMIN'), (req: Request, res: Response) => {
    const users = db.getAllUsers();
    const plansCount = { FREE: 0, PRO: 0, ADVANCED: 0 };

    users.forEach(u => {
      const sub = db.getUserSubscription(u.id);
      if (plansCount[sub.plan] !== undefined) {
        plansCount[sub.plan]++;
      }
    });

    res.json({
      totalUsers: users.length,
      planDistribution: plansCount,
      activeWsClients: sseManager.getActiveClientCount(),
      failedDeliveriesCount: db.getNotificationDeliveries('failed', 500).length
    });
  });

  // ------------------------------------------
  // AUDIT LOGS API
  // ------------------------------------------
  app.get('/api/audit/logs', requireAuth, (req: Request, res: Response) => {
    const limit = req.query.limit ? Math.min(parseInt(req.query.limit as string, 10), 200) : 50;
    const logs = db.getAuditLogs(limit, req.user!.role === 'ADMIN' ? undefined : req.user!.id);
    res.json({ count: logs.length, data: logs });
  });

  // ------------------------------------------
  // CONNECTOR STATUSES API
  // ------------------------------------------
  app.get('/api/connectors/health', (req: Request, res: Response) => {
    res.json(connectorManager.getConnectorStatuses());
  });

  // ------------------------------------------
  // AUTOMATED TEST SUITES (DOMAIN + SECURITY + BILLING & NOTIFICATIONS)
  // ------------------------------------------
  app.get('/api/run-tests', async (req: Request, res: Response) => {
    try {
      const domainResults = await runAllDomainTests();
      const securityResults = await runSecurityHardeningTests();
      const billingResults = await runBillingAndNotificationTests();
      const allResults = [...domainResults, ...securityResults, ...billingResults];

      res.json({
        total: allResults.length,
        passed: allResults.filter(r => r.passed).length,
        failed: allResults.filter(r => !r.passed).length,
        results: allResults
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Central Error Handler for API
  app.use('/api', errorHandler);

  // ==========================================
  // VITE MIDDLEWARE SETUP
  // ==========================================
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Hardened Trading Screener running on http://0.0.0.0:${PORT}`);
  });
}

startApp().catch((err) => {
  console.error('[Server] Fatal startup error:', err);
});
