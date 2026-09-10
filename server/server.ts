// Load env BEFORE any other imports
import './src/env.js';

import { buildServerContext, ServerContext } from './src/context.js';
import { createApp } from './src/app.js';
import { DetectedWall, MarketTicker } from './src/types/index.js';
import { logger } from './src/utils/logger.js';

// Save original console.log before overriding
const originalLog = console.log;

// Filter logs: only show critical startup messages
console.log = (...args: any[]) => {
  const msg = args.join(' ');
  if (msg.includes('Server started successfully') || 
      msg.includes('API: http://localhost') ||
      msg.includes('🕒')) {
    originalLog(...args);
  }
};

const PORT = Number(process.env.PORT) || 3002;

async function startApp() {
  console.log('[Server] Initializing Trading Screener Production Services...');

  // 1. Initialize SQLite Database
  const ctx: ServerContext = buildServerContext();
  await ctx.db.initialize();

  // 2. Start background notification delivery worker
  ctx.notificationWorker.start(1000);

  // 3. Wire event pipelines:
  ctx.connectorManager.onTicker((ticker: MarketTicker) => {
    ctx.marketState.updateTicker(ticker).catch(err => console.error('[Ticker] Error:', err));
    ctx.alertEngine.evaluateTicker(ticker).catch(err => console.error('[Alert] Ticker eval error:', err));
  });

  ctx.connectorManager.onOrderBook((orderBook) => {
    ctx.marketState.updateOrderBook(orderBook).catch(err => console.error('[OrderBook] Error:', err));
    ctx.wallEngine.processOrderBook(orderBook).catch(err => console.error('[Wall] Process error:', err));
  });

  ctx.connectorManager.onTrade((trade) => {
    ctx.marketState.addTrade(trade).catch(err => console.error('[Trade] Error:', err));
  });

  // WallEngine events -> AlertEngine & SSE broadcast
  ctx.wallEngine.onWallEvent((wall: DetectedWall, eventType: string) => {
    if (eventType === 'CONFIRMED' || eventType === 'FORMING') {
      ctx.alertEngine.evaluateWall(wall).catch(err => console.error('[Alert] Wall eval error:', err));
    }
    ctx.sseManager.broadcastAll('wall_event', { wall, eventType });
  });

  // AlertEngine triggers -> SSE broadcast to specific user or all
  ctx.alertEngine.onAlertTrigger((trigger) => {
    if (trigger.userId) {
      ctx.sseManager.broadcastUser(trigger.userId, 'alert_trigger', trigger);
    } else {
      ctx.sseManager.broadcastAll('alert_trigger', trigger);
    }
  });

  // 4. Start Connectors using the platform default exchange set.
  // (No seeded default user exists — users configure exchanges via their own settings.)
  await ctx.connectorManager.startAll(['BINANCE', 'BYBIT', 'OKX', 'MEXC']);

  // 5. Periodic background jobs

  setInterval(async () => {
    if (ctx.sseManager.getActiveClientCount() > 0) {
      const tickers = await ctx.marketState.getAllTickers();

      // Pre-bucket once per tick so each client receives only the exchanges its
      // plan entitles them to (instead of broadcasting the whole universe to all).
      const grouped = new Map<string, typeof tickers>();
      for (const t of tickers) {
        const bucket = grouped.get(t.exchange);
        if (bucket) {
          bucket.push(t);
        } else {
          grouped.set(t.exchange, [t]);
        }
      }

      ctx.sseManager.broadcastTickers(tickers, grouped);
    }
  }, 400);

  // Expired sessions cleanup (every 1 hour)
  setInterval(async () => {
    try {
      await ctx.db.cleanupExpiredSessions();
    } catch (e: any) {
      console.error('[Job] Session cleanup error:', e.message);
    }
  }, 60 * 60 * 1000);

  // 90-day retention cleanup (every 6 hours)
  setInterval(async () => {
    try {
      console.log('[Job] Running 90-day historical wall retention cleanup...');
      await ctx.db.cleanOldWallHistory(90);
    } catch (e: any) {
      console.error('[Job] Retention cleanup error:', e.message);
    }
  }, 6 * 60 * 60 * 1000);

  // 6. Assemble HTTP app (middleware + feature routers + error handler)
  const app = createApp(ctx);

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n✅ Server started successfully on port ${PORT}`);
    console.log(`📡 API: http://localhost:${PORT}/api`);
    console.log(`🕒 ${new Date().toLocaleString()}\n`);
  });
}

startApp().catch((err) => {
  console.error('[Server] Fatal startup error:', err);
});
