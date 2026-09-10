import { DatabaseService } from './db/database.js';
import { AuthService } from './services/auth/AuthService.js';
import { SSEManager } from './services/realtime/sseManager.js';
import { MarketStateService } from './services/market-data/MarketStateService.js';
import { WallEngine } from './services/wall-engine/WallEngine.js';
import { AlertEngine } from './services/alert-engine/AlertEngine.js';
import { ConnectorManager } from './services/connectors/ConnectorManager.js';
import { EntitlementService } from './services/billing/EntitlementService.js';
import { UsageService } from './services/billing/UsageService.js';
import { BillingProvider } from './services/billing/BillingProvider.js';
import { StripeBillingProvider } from './services/billing/StripeBillingProvider.js';
import { BinancePayProvider } from './services/billing/BinancePayProvider.js';
import { NotificationWorker } from './services/notifications/NotificationWorker.js';
import { TelegramLinkingService } from './services/notifications/TelegramLinkingService.js';

import { AuthController } from './controllers/authController.js';
import { MarketController } from './controllers/marketController.js';
import { WallController } from './controllers/wallController.js';
import { AlertController } from './controllers/alertController.js';
import { WatchlistController } from './controllers/watchlistController.js';
import { BlacklistController } from './controllers/blacklistController.js';
import { PresetController } from './controllers/presetController.js';
import { SettingsController } from './controllers/settingsController.js';
import { TelegramController } from './controllers/telegramController.js';
import { BillingController } from './controllers/billingController.js';
import { AdminController } from './controllers/adminController.js';
import { AuditController } from './controllers/auditController.js';
import { ConnectorController } from './controllers/connectorController.js';
import { SystemController } from './controllers/systemController.js';


//  server context
export interface ServerContext {
  // ── Infrastructure 
  db: DatabaseService;
  authService: AuthService;
  sseManager: SSEManager;
  marketState: MarketStateService;
  wallEngine: WallEngine;
  alertEngine: AlertEngine;
  connectorManager: ConnectorManager;
  entitlementService: EntitlementService;
  usageService: UsageService;
  billingProvider: BillingProvider;
  binancePayProvider: BinancePayProvider;
  notificationWorker: NotificationWorker;
  telegramLinkingService: TelegramLinkingService;

  // ── Feature controllers ───────────────────────────────────────────
  authController: AuthController;
  marketController: MarketController;
  wallController: WallController;
  alertController: AlertController;
  watchlistController: WatchlistController;
  blacklistController: BlacklistController;
  presetController: PresetController;
  settingsController: SettingsController;
  telegramController: TelegramController;
  billingController: BillingController;
  adminController: AdminController;
  auditController: AuditController;
  connectorController: ConnectorController;
  systemController: SystemController;
}

// Build server context
export function buildServerContext(): ServerContext {
  // Core singletons
  const db = DatabaseService.getInstance();
  const authService = AuthService.getInstance();
  const sseManager = SSEManager.getInstance();
  const marketState = MarketStateService.getInstance();
  const wallEngine = WallEngine.getInstance();
  const alertEngine = AlertEngine.getInstance();
  const connectorManager = ConnectorManager.getInstance();
  const entitlementService = EntitlementService.getInstance();
  const usageService = UsageService.getInstance();
  const billingProvider = new StripeBillingProvider();
  const binancePayProvider = new BinancePayProvider();
  const notificationWorker = NotificationWorker.getInstance();
  const telegramLinkingService = TelegramLinkingService.getInstance();

  // Controllers (constructor injection)
  const authController = new AuthController(authService);
  const marketController = new MarketController(marketState, wallEngine, db);
  const wallController = new WallController(db, wallEngine);
  const alertController = new AlertController(db, entitlementService, marketState, sseManager);
  const watchlistController = new WatchlistController(db, entitlementService);
  const blacklistController = new BlacklistController(db);
  const presetController = new PresetController(db);
  const settingsController = new SettingsController(db, wallEngine);
  const telegramController = new TelegramController(telegramLinkingService);
  const billingController = new BillingController(db, usageService, billingProvider, sseManager, binancePayProvider);
  const adminController = new AdminController(db, usageService, sseManager);
  const auditController = new AuditController(db);
  const connectorController = new ConnectorController(connectorManager);
  const systemController = new SystemController(sseManager, billingProvider);

  return {
    db,
    authService,
    sseManager,
    marketState,
    wallEngine,
    alertEngine,
    connectorManager,
    entitlementService,
    usageService,
    billingProvider,
    binancePayProvider,
    notificationWorker,
    telegramLinkingService,

    authController,
    marketController,
    wallController,
    alertController,
    watchlistController,
    blacklistController,
    presetController,
    settingsController,
    telegramController,
    billingController,
    adminController,
    auditController,
    connectorController,
    systemController
  };
}
