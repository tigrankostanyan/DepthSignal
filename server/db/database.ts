import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import initSqlJs, { Database } from 'sql.js';
import { 
  AlertRule, 
  AlertTrigger, 
  AuditLogEntry,
  BillingEvent,
  BlacklistEntry, 
  DailyWallAggregate, 
  DetectedWall, 
  HistoricalWallRecord, 
  NotificationDelivery,
  SavedFilterPreset, 
  SubscriptionPlanId,
  SubscriptionStatus,
  UserProfile,
  UserRole,
  UserSettings, 
  UserSubscription,
  UserTelegramLink,
  Watchlist, 
  WatchlistItem 
} from '../../src/types/index.js';

const DB_FILE_PATH = path.join(process.cwd(), 'trading_screener.db');

export class DatabaseService {
  private static instance: DatabaseService;
  private db: Database | null = null;
  private isInitialized = false;
  private saveTimeout: NodeJS.Timeout | null = null;

  private constructor() {}

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized && this.db) return;

    try {
      const SQL = await initSqlJs();
      
      let loadedFromDisk = false;
      if (fs.existsSync(DB_FILE_PATH)) {
        try {
          const fileBuffer = fs.readFileSync(DB_FILE_PATH);
          if (fileBuffer.length > 0) {
            this.db = new SQL.Database(fileBuffer);
            this.runIntegrityCheck();
            this.createTables();
            loadedFromDisk = true;
            console.log('[DB] Successfully loaded and validated SQLite database from disk');
          }
        } catch (diskErr: any) {
          console.warn('[DB] Existing SQLite file on disk was corrupted or unreadable. Resetting cleanly:', diskErr.message);
          try {
            if (fs.existsSync(DB_FILE_PATH)) {
              fs.unlinkSync(DB_FILE_PATH);
            }
          } catch (_) {}
          this.db = null;
        }
      }

      if (!loadedFromDisk || !this.db) {
        this.db = new SQL.Database();
        console.log('[DB] Created fresh SQLite database in memory');
        this.createTables();
      }

      this.seedInitialData();
      this.persistToDisk();
      this.isInitialized = true;
    } catch (err) {
      console.error('[DB] Failed to initialize SQLite database:', err);
      throw err;
    }
  }

  public runIntegrityCheck(): void {
    if (!this.db) return;
    try {
      const res = this.db.exec("PRAGMA integrity_check;");
      if (res.length > 0 && res[0].values.length > 0) {
        const status = res[0].values[0][0];
        console.log(`[DB] SQLite Integrity Check: ${status}`);
      }
    } catch (e: any) {
      console.error('[DB] SQLite Integrity Check Error:', e.message);
    }
  }

  private createTables(): void {
    if (!this.db) return;

    this.db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE,
        password_hash TEXT,
        password_salt TEXT,
        name TEXT,
        role TEXT DEFAULT 'TRADER',
        created_at INTEGER,
        updated_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        token TEXT UNIQUE,
        user_id TEXT,
        expires_at INTEGER,
        ip_address TEXT,
        user_agent TEXT,
        created_at INTEGER,
        revoked_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        action TEXT,
        resource TEXT,
        resource_id TEXT,
        details_json TEXT,
        ip_address TEXT,
        created_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS user_settings (
        id TEXT PRIMARY KEY,
        user_id TEXT UNIQUE,
        theme TEXT DEFAULT 'dark',
        decimal_precision INTEGER DEFAULT 2,
        currency TEXT DEFAULT 'USD',
        refresh_rate_ms INTEGER DEFAULT 1000,
        default_preset_id TEXT,
        default_cross_exchange_aggregation INTEGER DEFAULT 0,
        wall_min_volume_default_usd REAL DEFAULT 500000,
        wall_min_duration_default_sec INTEGER DEFAULT 15,
        wall_distance_default_percent REAL DEFAULT 2.5,
        enabled_exchanges TEXT DEFAULT 'BINANCE,BYBIT,OKX,MEXC',
        sound_enabled INTEGER DEFAULT 1,
        telegram_bot_token TEXT,
        telegram_chat_id TEXT,
        email_recipient TEXT,
        webhook_url TEXT,
        updated_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS watchlists (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        name TEXT,
        created_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS watchlist_items (
        id TEXT PRIMARY KEY,
        watchlist_id TEXT,
        symbol TEXT,
        exchange TEXT,
        market_type TEXT,
        notes TEXT,
        added_at INTEGER,
        UNIQUE(watchlist_id, symbol, exchange, market_type)
      );

      CREATE TABLE IF NOT EXISTS saved_filter_presets (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        name TEXT,
        is_default INTEGER DEFAULT 0,
        filters_json TEXT,
        created_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS alert_rules (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        name TEXT,
        enabled INTEGER DEFAULT 1,
        symbols TEXT,
        exchanges TEXT,
        market_types TEXT,
        logic TEXT DEFAULT 'AND',
        conditions_json TEXT,
        cooldown_seconds INTEGER DEFAULT 300,
        last_triggered_at INTEGER,
        notify_channels TEXT DEFAULT 'IN_APP',
        created_at INTEGER,
        updated_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS alert_triggers (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        rule_id TEXT,
        rule_name TEXT,
        symbol TEXT,
        exchange TEXT,
        market_type TEXT,
        message TEXT,
        condition_type TEXT,
        metric_value TEXT,
        trigger_price REAL,
        channel TEXT DEFAULT 'IN_APP',
        read INTEGER DEFAULT 0,
        timestamp INTEGER
      );

      CREATE TABLE IF NOT EXISTS detected_walls (
        id TEXT PRIMARY KEY,
        symbol TEXT,
        exchange TEXT,
        market_type TEXT,
        side TEXT,
        price REAL,
        volume_amount REAL,
        volume_usd REAL,
        reference_price REAL,
        distance_percent REAL,
        first_seen_at INTEGER,
        last_seen_at INTEGER,
        duration_seconds INTEGER,
        state TEXT,
        initial_volume_usd REAL,
        peak_volume_usd REAL,
        remaining_volume_usd REAL,
        is_aggregated INTEGER DEFAULT 0,
        contributing_exchanges TEXT,
        created_at INTEGER,
        updated_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS wall_history (
        id TEXT PRIMARY KEY,
        symbol TEXT,
        exchange TEXT,
        market_type TEXT,
        side TEXT,
        price REAL,
        volume_usd REAL,
        reference_price REAL,
        distance_percent REAL,
        first_seen_at INTEGER,
        last_seen_at INTEGER,
        duration_seconds INTEGER,
        final_state TEXT,
        fill_percentage REAL,
        peak_volume_usd REAL,
        is_aggregated INTEGER DEFAULT 0,
        created_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS daily_wall_aggregates (
        id TEXT PRIMARY KEY,
        date TEXT,
        symbol TEXT,
        exchange TEXT,
        market_type TEXT,
        wall_count INTEGER DEFAULT 0,
        bid_wall_count INTEGER DEFAULT 0,
        ask_wall_count INTEGER DEFAULT 0,
        avg_volume_usd REAL DEFAULT 0,
        peak_volume_usd REAL DEFAULT 0,
        avg_duration_seconds REAL DEFAULT 0,
        filled_count INTEGER DEFAULT 0,
        removed_count INTEGER DEFAULT 0,
        created_at INTEGER,
        UNIQUE(date, symbol, exchange, market_type)
      );

      CREATE TABLE IF NOT EXISTS blacklist_entries (
        id TEXT PRIMARY KEY,
        symbol TEXT,
        exchange TEXT,
        category TEXT,
        reason TEXT,
        added_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS subscriptions (
        user_id TEXT PRIMARY KEY,
        plan TEXT NOT NULL DEFAULT 'FREE',
        status TEXT NOT NULL DEFAULT 'active',
        billing_provider TEXT NOT NULL DEFAULT 'manual',
        external_customer_id TEXT,
        external_subscription_id TEXT,
        current_period_start INTEGER,
        current_period_end INTEGER,
        cancel_at_period_end INTEGER DEFAULT 0,
        trial_ends_at INTEGER,
        created_at INTEGER,
        updated_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS billing_events (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        plan TEXT,
        provider TEXT NOT NULL,
        details TEXT,
        ip_address TEXT,
        created_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS billing_webhook_events (
        event_id TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        event_type TEXT NOT NULL,
        payload_hash TEXT,
        processed_at INTEGER,
        status TEXT
      );

      CREATE TABLE IF NOT EXISTS notification_deliveries (
        id TEXT PRIMARY KEY,
        alert_trigger_id TEXT,
        user_id TEXT NOT NULL,
        channel TEXT NOT NULL,
        destination TEXT,
        status TEXT NOT NULL,
        attempts INTEGER DEFAULT 0,
        max_attempts INTEGER DEFAULT 4,
        next_attempt_at INTEGER,
        last_attempt_at INTEGER,
        delivered_at INTEGER,
        last_error TEXT,
        payload TEXT,
        created_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS telegram_link_tokens (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        expires_at INTEGER NOT NULL,
        used_at INTEGER,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS user_telegram_links (
        user_id TEXT PRIMARY KEY,
        telegram_chat_id TEXT NOT NULL,
        telegram_user_id TEXT NOT NULL UNIQUE,
        telegram_username TEXT,
        linked_at INTEGER NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        updated_at INTEGER NOT NULL
      );
    `);

    this.migrateSchema();

    this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
      CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_watchlists_user_id ON watchlists(user_id);
      CREATE INDEX IF NOT EXISTS idx_watchlist_items_wl ON watchlist_items(watchlist_id);
      CREATE INDEX IF NOT EXISTS idx_alert_rules_user_id ON alert_rules(user_id);
      CREATE INDEX IF NOT EXISTS idx_alert_triggers_user_id ON alert_triggers(user_id, timestamp);
      CREATE INDEX IF NOT EXISTS idx_alert_triggers_symbol ON alert_triggers(symbol, timestamp);
      CREATE INDEX IF NOT EXISTS idx_saved_presets_user_id ON saved_filter_presets(user_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_wall_history_symbol ON wall_history(symbol, exchange, created_at);
      CREATE INDEX IF NOT EXISTS idx_daily_aggregates_date ON daily_wall_aggregates(date, symbol);
      CREATE INDEX IF NOT EXISTS idx_blacklist_symbol ON blacklist_entries(symbol);
      CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
      CREATE INDEX IF NOT EXISTS idx_billing_events_user ON billing_events(user_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_notif_deliveries_status ON notification_deliveries(status, next_attempt_at);
      CREATE INDEX IF NOT EXISTS idx_notif_deliveries_user ON notification_deliveries(user_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_tg_tokens_hash ON telegram_link_tokens(token_hash);
      CREATE INDEX IF NOT EXISTS idx_tg_tokens_user ON telegram_link_tokens(user_id);
      CREATE INDEX IF NOT EXISTS idx_tg_links_chat ON user_telegram_links(telegram_chat_id);
      CREATE INDEX IF NOT EXISTS idx_tg_links_tg_user ON user_telegram_links(telegram_user_id);
    `);
  }

  private migrateSchema(): void {
    if (!this.db) return;
    
    // 1. Users table columns migration
    try {
      const usersInfo = this.db.exec("PRAGMA table_info(users);");
      if (usersInfo.length > 0 && usersInfo[0].values) {
        const cols = usersInfo[0].values.map(v => v[1] as string);
        if (!cols.includes('password_hash')) {
          this.db.run("ALTER TABLE users ADD COLUMN password_hash TEXT;");
        }
        if (!cols.includes('password_salt')) {
          this.db.run("ALTER TABLE users ADD COLUMN password_salt TEXT;");
        }
        if (!cols.includes('role')) {
          this.db.run("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'TRADER';");
        }
        if (!cols.includes('created_at')) {
          this.db.run("ALTER TABLE users ADD COLUMN created_at INTEGER;");
        }
        if (!cols.includes('updated_at')) {
          this.db.run("ALTER TABLE users ADD COLUMN updated_at INTEGER;");
        }
      }
    } catch (err: any) {
      console.warn('[DB Migration] Notice on users table:', err.message);
    }

    // 2. User ID columns across entities
    const tablesWithUserId = ['user_settings', 'watchlists', 'saved_filter_presets', 'alert_rules', 'alert_triggers'];
    for (const table of tablesWithUserId) {
      try {
        const tableInfo = this.db.exec(`PRAGMA table_info(${table});`);
        if (tableInfo.length > 0 && tableInfo[0].values) {
          const columns = tableInfo[0].values.map(v => v[1] as string);
          if (!columns.includes('user_id')) {
            this.db.run(`ALTER TABLE ${table} ADD COLUMN user_id TEXT;`);
          }
        }
      } catch (err: any) {
        console.warn(`[DB Migration] Notice on table ${table}:`, err.message);
      }
    }
  }

  private seedInitialData(): void {
    if (!this.db) return;

    // Check if default user exists
    const users = this.db.exec("SELECT count(*) as count FROM users WHERE id = 'usr_default_trader'");
    const count = users.length > 0 && users[0].values.length > 0 ? (users[0].values[0][0] as number) : 0;

    if (count === 0) {
      const now = Date.now();
      const userId = 'usr_default_trader';

      // Standard scrypt hash for default initial password "TraderPassword123!"
      const defaultSalt = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';
      const defaultHash = crypto.scryptSync('TraderPassword123!', defaultSalt, 64).toString('hex');

      // Insert default user
      this.db.run(`
        INSERT INTO users (id, email, password_hash, password_salt, name, role, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        userId,
        'trader@institution.local',
        defaultHash,
        defaultSalt,
        'Head Trader',
        'ADMIN',
        now,
        now
      ]);

      // Insert default sessions
      const defaultToken = 'tok_default_trader_session_v1';
      this.createSession(userId, defaultToken, now + 30 * 24 * 60 * 60 * 1000, '127.0.0.1', 'Trading Screener Engine');
      this.createSession(userId, 'sess_default_institution_trader_token_001', now + 30 * 24 * 60 * 60 * 1000, '127.0.0.1', 'Trading Screener Engine');

      // Insert settings
      this.db.run(`
        INSERT OR REPLACE INTO user_settings (
          id, user_id, theme, decimal_precision, currency, refresh_rate_ms,
          default_cross_exchange_aggregation, wall_min_volume_default_usd,
          wall_min_duration_default_sec, wall_distance_default_percent,
          enabled_exchanges, sound_enabled, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        'set_default',
        userId,
        'dark',
        2,
        'USD',
        1000,
        0, // default false
        500000,
        15,
        2.5,
        'BINANCE,BYBIT,OKX,MEXC,GATE,BITGET,KUCOIN,HYPERLIQUID,ASTERDEX',
        1,
        now
      ]);

      // Default Watchlist
      const watchlistId = 'wl_main_crypto';
      this.db.run(`INSERT OR REPLACE INTO watchlists (id, user_id, name, created_at) VALUES (?, ?, ?, ?)`, [
        watchlistId,
        userId,
        'Core Crypto Focus',
        now
      ]);

      const initialSymbols = [
        { symbol: 'BTCUSDT', exchange: 'BINANCE', type: 'SPOT', notes: 'Core market leader' },
        { symbol: 'BTCUSDT', exchange: 'BINANCE', type: 'FUTURES', notes: 'Perpetual Wall monitoring' },
        { symbol: 'ETHUSDT', exchange: 'BINANCE', type: 'SPOT', notes: 'Layer 1 benchmark' },
        { symbol: 'SOLUSDT', exchange: 'BINANCE', type: 'SPOT', notes: 'High volatility focus' },
        { symbol: 'BNBUSDT', exchange: 'BINANCE', type: 'SPOT', notes: 'Exchange utility' },
        { symbol: 'DOGEUSDT', exchange: 'BINANCE', type: 'SPOT', notes: 'Momentum breakout' },
        { symbol: 'NVDA', exchange: 'STOCK_EXCHANGE', type: 'SPOT', notes: 'Semiconductor tech leader' },
        { symbol: 'AAPL', exchange: 'STOCK_EXCHANGE', type: 'SPOT', notes: 'Megacap tech' }
      ];

      for (const item of initialSymbols) {
        this.db.run(`
          INSERT OR REPLACE INTO watchlist_items (id, watchlist_id, symbol, exchange, market_type, notes, added_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [`wli_${Math.random().toString(36).substring(2, 9)}`, watchlistId, item.symbol, item.exchange, item.type, item.notes, now]);
      }

      // Default Presets
      const preset1 = {
        name: 'High Volume Breakouts',
        isDefault: true,
        filters: {
          category: 'ALL',
          marketType: 'ALL',
          volumeMinUsd: 10000000,
          changeMin: 2.0,
          timeframe: '1h',
          sortBy: 'volumeUsd',
          sortOrder: 'desc'
        }
      };

      const preset2 = {
        name: 'Active Order Book Walls',
        isDefault: false,
        filters: {
          category: 'ALL',
          marketType: 'ALL',
          onlyWithWalls: true,
          sortBy: 'volumeUsd',
          sortOrder: 'desc'
        }
      };

      const preset3 = {
        name: 'RSI Oversold Bounce',
        isDefault: false,
        filters: {
          rsiMax: 32,
          category: 'ALL',
          marketType: 'ALL',
          sortBy: 'rsi',
          sortOrder: 'asc'
        }
      };

      for (const p of [preset1, preset2, preset3]) {
        this.db.run(`
          INSERT INTO saved_filter_presets (id, user_id, name, is_default, filters_json, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [`pst_${Math.random().toString(36).substring(2, 9)}`, userId, p.name, p.isDefault ? 1 : 0, JSON.stringify(p.filters), now]);
      }

      // Default Alert Rules
      const defaultRule1: Partial<AlertRule> = {
        name: 'BTC $1M+ Order Book Wall Alert',
        enabled: true,
        symbols: ['BTCUSDT'],
        exchanges: ['BINANCE', 'BYBIT'],
        marketTypes: ['SPOT', 'FUTURES'],
        logic: 'AND',
        conditions: [
          {
            id: 'c1',
            type: 'WALL_DETECTED',
            params: {
              minWallVolumeUsd: 1000000,
              maxWallDistancePercent: 2.0,
              wallSide: 'ANY'
            }
          }
        ],
        cooldownSeconds: 120,
        notifyChannels: ['IN_APP']
      };

      const defaultRule2: Partial<AlertRule> = {
        name: 'ETH Extreme Volume Spike (>5x)',
        enabled: true,
        symbols: ['ETHUSDT', 'SOLUSDT'],
        exchanges: ['BINANCE'],
        marketTypes: ['SPOT'],
        logic: 'AND',
        conditions: [
          {
            id: 'c2',
            type: 'VOLUME_SPIKE',
            params: {
              volumeMultiplier: 3.5,
              timeframe: '5m'
            }
          }
        ],
        cooldownSeconds: 300,
        notifyChannels: ['IN_APP']
      };

      for (const r of [defaultRule1, defaultRule2]) {
        this.db.run(`
          INSERT INTO alert_rules (
            id, user_id, name, enabled, symbols, exchanges, market_types,
            logic, conditions_json, cooldown_seconds, notify_channels, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          `rl_${Math.random().toString(36).substring(2, 9)}`,
          userId,
          r.name,
          r.enabled ? 1 : 0,
          JSON.stringify(r.symbols),
          JSON.stringify(r.exchanges),
          JSON.stringify(r.marketTypes),
          r.logic,
          JSON.stringify(r.conditions),
          r.cooldownSeconds,
          r.notifyChannels?.join(',') || 'IN_APP',
          now,
          now
        ]);
      }

      // Default Blacklist
      this.db.run(`
        INSERT OR REPLACE INTO blacklist_entries (id, symbol, exchange, category, reason, added_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        'blk_1',
        'FTXUSDT',
        'BINANCE',
        'CRYPTO',
        'Defunct token / high insolvency risk',
        now
      ]);

      this.db.run(`
        INSERT OR REPLACE INTO blacklist_entries (id, symbol, exchange, category, reason, added_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        'blk_2',
        'LUNCUSDT',
        null,
        'CRYPTO',
        'Legacy hyperinflated token',
        now
      ]);

      // Seed default user subscription (PRO plan for institutional trader)
      this.db.run(`
        INSERT OR REPLACE INTO subscriptions (
          user_id, plan, status, billing_provider, external_customer_id,
          external_subscription_id, current_period_start, current_period_end,
          cancel_at_period_end, trial_ends_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        userId,
        'PRO',
        'active',
        'manual',
        'cus_default_trader_001',
        'sub_default_trader_001',
        now,
        now + 365 * 24 * 60 * 60 * 1000,
        0,
        null,
        now,
        now
      ]);
    }
  }

  public schedulePersist(): void {
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => {
      this.persistToDisk();
    }, 1000);
  }

  public persistToDisk(): void {
    if (!this.db) return;
    try {
      const data = this.db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(DB_FILE_PATH, buffer);
    } catch (err) {
      console.error('[DB] Error writing SQLite database to disk:', err);
    }
  }

  // ==========================================
  // AUTHENTICATION & USER MANAGEMENT
  // ==========================================

  public createUser(user: { email: string; passwordHash: string; passwordSalt: string; name: string; role?: UserRole }): UserProfile {
    if (!this.db) throw new Error('Database not initialized');
    const id = `usr_${Math.random().toString(36).substring(2, 9)}`;
    const now = Date.now();
    const role: UserRole = user.role || 'TRADER';

    this.db.run(`
      INSERT INTO users (id, email, password_hash, password_salt, name, role, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, user.email, user.passwordHash, user.passwordSalt, user.name, role, now, now]);

    // Initialize default settings for user
    this.db.run(`
      INSERT INTO user_settings (
        id, user_id, theme, decimal_precision, currency, refresh_rate_ms,
        default_cross_exchange_aggregation, wall_min_volume_default_usd,
        wall_min_duration_default_sec, wall_distance_default_percent,
        enabled_exchanges, sound_enabled, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      `set_${id}`,
      id,
      'dark',
      2,
      'USD',
      1000,
      0,
      500000,
      15,
      2.5,
      'BINANCE,BYBIT,OKX,MEXC',
      1,
      now
    ]);

    // Initialize a default watchlist
    const watchlistId = `wl_${Math.random().toString(36).substring(2, 9)}`;
    this.db.run(`INSERT INTO watchlists (id, user_id, name, created_at) VALUES (?, ?, ?, ?)`, [
      watchlistId,
      id,
      'My Favorites',
      now
    ]);

    this.schedulePersist();
    return { id, email: user.email, name: user.name, role, createdAt: now };
  }

  public getUserByEmail(email: string): (UserProfile & { passwordHash: string; passwordSalt: string }) | null {
    if (!this.db) throw new Error('Database not initialized');
    const res = this.db.exec("SELECT * FROM users WHERE email = ?", [email.toLowerCase().trim()]);
    if (res.length === 0 || res[0].values.length === 0) return null;

    const row = res[0].values[0];
    const cols = res[0].columns;
    const getVal = (col: string) => row[cols.indexOf(col)];

    return {
      id: getVal('id') as string,
      email: getVal('email') as string,
      passwordHash: getVal('password_hash') as string,
      passwordSalt: getVal('password_salt') as string,
      name: getVal('name') as string,
      role: (getVal('role') as UserRole) || 'TRADER',
      createdAt: Number(getVal('created_at'))
    };
  }

  public getUserById(id: string): UserProfile | null {
    if (!this.db) throw new Error('Database not initialized');
    const res = this.db.exec("SELECT id, email, name, role, created_at FROM users WHERE id = ?", [id]);
    if (res.length === 0 || res[0].values.length === 0) return null;

    const row = res[0].values[0];
    const cols = res[0].columns;
    const getVal = (col: string) => row[cols.indexOf(col)];

    return {
      id: getVal('id') as string,
      email: getVal('email') as string,
      name: getVal('name') as string,
      role: (getVal('role') as UserRole) || 'TRADER',
      createdAt: Number(getVal('created_at'))
    };
  }

  public createSession(userId: string, token: string, expiresAt: number, ipAddress?: string, userAgent?: string): void {
    if (!this.db) throw new Error('Database not initialized');
    const id = `sess_${Math.random().toString(36).substring(2, 9)}`;
    const now = Date.now();

    this.db.run(`
      INSERT INTO sessions (id, token, user_id, expires_at, ip_address, user_agent, created_at, revoked_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, NULL)
    `, [id, token, userId, expiresAt, ipAddress || null, userAgent || null, now]);

    this.schedulePersist();
  }

  public getSessionByToken(token: string): { session: any; user: UserProfile } | null {
    if (!this.db) throw new Error('Database not initialized');
    const res = this.db.exec(`
      SELECT s.id as sess_id, s.token, s.user_id, s.expires_at, s.revoked_at,
             u.id as user_id, u.email, u.name, u.role, u.created_at as user_created_at
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.token = ?
    `, [token]);

    if (res.length === 0 || res[0].values.length === 0) return null;

    const row = res[0].values[0];
    const cols = res[0].columns;
    const getVal = (col: string) => row[cols.indexOf(col)];

    const session = {
      id: getVal('sess_id') as string,
      token: getVal('token') as string,
      userId: getVal('user_id') as string,
      expiresAt: Number(getVal('expires_at')),
      revokedAt: getVal('revoked_at') ? Number(getVal('revoked_at')) : null
    };

    const user: UserProfile = {
      id: getVal('user_id') as string,
      email: getVal('email') as string,
      name: getVal('name') as string,
      role: (getVal('role') as UserRole) || 'TRADER',
      createdAt: Number(getVal('user_created_at'))
    };

    return { session, user };
  }

  public revokeSession(token: string): void {
    if (!this.db) return;
    this.db.run("UPDATE sessions SET revoked_at = ? WHERE token = ?", [Date.now(), token]);
    this.schedulePersist();
  }

  public cleanupExpiredSessions(): void {
    if (!this.db) return;
    const now = Date.now();
    this.db.run("DELETE FROM sessions WHERE expires_at < ? OR revoked_at IS NOT NULL", [now]);
    this.schedulePersist();
  }

  // ==========================================
  // AUDIT LOGGING
  // ==========================================

  public addAuditLog(entry: {
    userId: string;
    action: string;
    resource: string;
    resourceId?: string;
    details?: Record<string, any>;
    ipAddress?: string;
  }): void {
    if (!this.db) return;
    const id = `aud_${Math.random().toString(36).substring(2, 9)}`;
    const now = Date.now();

    this.db.run(`
      INSERT INTO audit_logs (id, user_id, action, resource, resource_id, details_json, ip_address, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      entry.userId,
      entry.action,
      entry.resource,
      entry.resourceId || null,
      entry.details ? JSON.stringify(entry.details) : null,
      entry.ipAddress || null,
      now
    ]);
    this.schedulePersist();
  }

  public getAuditLogs(limit = 100, userId?: string): AuditLogEntry[] {
    if (!this.db) return [];
    let sql = "SELECT * FROM audit_logs";
    const params: any[] = [];

    if (userId) {
      sql += " WHERE user_id = ?";
      params.push(userId);
    }
    sql += " ORDER BY created_at DESC LIMIT ?";
    params.push(limit);

    const res = this.db.exec(sql, params);
    if (res.length === 0) return [];

    const cols = res[0].columns;
    return res[0].values.map(row => {
      const getVal = (col: string) => row[cols.indexOf(col)];
      return {
        id: getVal('id') as string,
        userId: getVal('user_id') as string,
        action: getVal('action') as string,
        resource: getVal('resource') as string,
        resourceId: (getVal('resource_id') as string) || undefined,
        details: getVal('details_json') ? JSON.parse(getVal('details_json') as string) : undefined,
        ipAddress: (getVal('ip_address') as string) || undefined,
        createdAt: Number(getVal('created_at'))
      };
    });
  }

  // ==========================================
  // USER SETTINGS (USER-SCOPED)
  // ==========================================

  public getUserSettings(userId = 'usr_default_trader'): UserSettings {
    if (!this.db) throw new Error('Database not initialized');
    const res = this.db.exec("SELECT * FROM user_settings WHERE user_id = ?", [userId]);
    if (res.length === 0 || res[0].values.length === 0) {
      return {
        theme: 'dark',
        decimalPrecision: 2,
        currency: 'USD',
        refreshRateMs: 1000,
        defaultCrossExchangeAggregation: false,
        wallMinVolumeDefaultUsd: 500000,
        wallMinDurationDefaultSec: 15,
        wallDistanceDefaultPercent: 2.5,
        enabledExchanges: ['BINANCE', 'BYBIT', 'OKX', 'MEXC'],
        soundEnabled: true
      };
    }
    const row = res[0].values[0];
    const columns = res[0].columns;
    const getVal = (col: string) => row[columns.indexOf(col)];

    return {
      theme: (getVal('theme') as 'dark' | 'light') || 'dark',
      decimalPrecision: Number(getVal('decimal_precision')) || 2,
      currency: (getVal('currency') as 'USD' | 'USDT') || 'USD',
      refreshRateMs: Number(getVal('refresh_rate_ms')) || 1000,
      defaultPresetId: (getVal('default_preset_id') as string) || undefined,
      defaultCrossExchangeAggregation: Boolean(getVal('default_cross_exchange_aggregation')),
      wallMinVolumeDefaultUsd: Number(getVal('wall_min_volume_default_usd')) || 500000,
      wallMinDurationDefaultSec: Number(getVal('wall_min_duration_default_sec')) || 15,
      wallDistanceDefaultPercent: Number(getVal('wall_distance_default_percent')) || 2.5,
      enabledExchanges: ((getVal('enabled_exchanges') as string) || 'BINANCE,BYBIT,OKX').split(',') as any,
      soundEnabled: Boolean(getVal('sound_enabled')),
      telegramBotToken: (getVal('telegram_bot_token') as string) || undefined,
      telegramChatId: (getVal('telegram_chat_id') as string) || undefined,
      emailRecipient: (getVal('email_recipient') as string) || undefined,
      webhookUrl: (getVal('webhook_url') as string) || undefined,
    };
  }

  public updateUserSettings(settings: Partial<UserSettings>, userId = 'usr_default_trader'): void {
    if (!this.db) throw new Error('Database not initialized');
    const current = this.getUserSettings(userId);
    const updated = { ...current, ...settings };
    
    this.db.run(`
      INSERT OR REPLACE INTO user_settings (
        id, user_id, theme, decimal_precision, currency, refresh_rate_ms,
        default_preset_id, default_cross_exchange_aggregation,
        wall_min_volume_default_usd, wall_min_duration_default_sec,
        wall_distance_default_percent, enabled_exchanges, sound_enabled,
        telegram_bot_token, telegram_chat_id, email_recipient, webhook_url, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      `set_${userId}`,
      userId,
      updated.theme,
      updated.decimalPrecision,
      updated.currency,
      updated.refreshRateMs,
      updated.defaultPresetId || null,
      updated.defaultCrossExchangeAggregation ? 1 : 0,
      updated.wallMinVolumeDefaultUsd,
      updated.wallMinDurationDefaultSec,
      updated.wallDistanceDefaultPercent,
      updated.enabledExchanges.join(','),
      updated.soundEnabled ? 1 : 0,
      updated.telegramBotToken || null,
      updated.telegramChatId || null,
      updated.emailRecipient || null,
      updated.webhookUrl || null,
      Date.now()
    ]);
    this.schedulePersist();
  }

  // ==========================================
  // TELEGRAM LINKING & TOKEN MANAGEMENT
  // ==========================================

  public createTelegramLinkToken(userId: string, tokenHash: string, ttlMs = 10 * 60 * 1000): { id: string; expiresAt: number } {
    if (!this.db) throw new Error('Database not initialized');
    const id = `tgl_${Math.random().toString(36).substring(2, 9)}`;
    const now = Date.now();
    const expiresAt = now + ttlMs;

    this.db.run(`
      INSERT INTO telegram_link_tokens (id, user_id, token_hash, expires_at, used_at, created_at)
      VALUES (?, ?, ?, ?, NULL, ?)
    `, [id, userId, tokenHash, expiresAt, now]);

    this.schedulePersist();
    return { id, expiresAt };
  }

  public getTelegramLinkTokenByHash(tokenHash: string): {
    id: string;
    userId: string;
    tokenHash: string;
    expiresAt: number;
    usedAt: number | null;
    createdAt: number;
  } | null {
    if (!this.db) throw new Error('Database not initialized');
    const res = this.db.exec("SELECT * FROM telegram_link_tokens WHERE token_hash = ?", [tokenHash]);
    if (res.length === 0 || res[0].values.length === 0) return null;

    const row = res[0].values[0];
    const cols = res[0].columns;
    const getVal = (col: string) => row[cols.indexOf(col)];

    return {
      id: getVal('id') as string,
      userId: getVal('user_id') as string,
      tokenHash: getVal('token_hash') as string,
      expiresAt: Number(getVal('expires_at')),
      usedAt: getVal('used_at') ? Number(getVal('used_at')) : null,
      createdAt: Number(getVal('created_at'))
    };
  }

  public markTelegramLinkTokenUsed(tokenId: string): void {
    if (!this.db) throw new Error('Database not initialized');
    this.db.run("UPDATE telegram_link_tokens SET used_at = ? WHERE id = ?", [Date.now(), tokenId]);
    this.schedulePersist();
  }

  public getUserTelegramLink(userId: string): UserTelegramLink | null {
    if (!this.db) throw new Error('Database not initialized');
    const res = this.db.exec("SELECT * FROM user_telegram_links WHERE user_id = ?", [userId]);
    if (res.length === 0 || res[0].values.length === 0) return null;

    const row = res[0].values[0];
    const cols = res[0].columns;
    const getVal = (col: string) => row[cols.indexOf(col)];

    return {
      userId: getVal('user_id') as string,
      telegramChatId: getVal('telegram_chat_id') as string,
      telegramUserId: getVal('telegram_user_id') as string,
      telegramUsername: (getVal('telegram_username') as string) || undefined,
      linkedAt: Number(getVal('linked_at')),
      enabled: Boolean(getVal('enabled'))
    };
  }

  public getTelegramLinkByTelegramUserId(telegramUserId: string): UserTelegramLink | null {
    if (!this.db) throw new Error('Database not initialized');
    const res = this.db.exec("SELECT * FROM user_telegram_links WHERE telegram_user_id = ?", [String(telegramUserId)]);
    if (res.length === 0 || res[0].values.length === 0) return null;

    const row = res[0].values[0];
    const cols = res[0].columns;
    const getVal = (col: string) => row[cols.indexOf(col)];

    return {
      userId: getVal('user_id') as string,
      telegramChatId: getVal('telegram_chat_id') as string,
      telegramUserId: getVal('telegram_user_id') as string,
      telegramUsername: (getVal('telegram_username') as string) || undefined,
      linkedAt: Number(getVal('linked_at')),
      enabled: Boolean(getVal('enabled'))
    };
  }

  public getTelegramLinkByChatId(chatId: string): UserTelegramLink | null {
    if (!this.db) throw new Error('Database not initialized');
    const res = this.db.exec("SELECT * FROM user_telegram_links WHERE telegram_chat_id = ?", [String(chatId)]);
    if (res.length === 0 || res[0].values.length === 0) return null;

    const row = res[0].values[0];
    const cols = res[0].columns;
    const getVal = (col: string) => row[cols.indexOf(col)];

    return {
      userId: getVal('user_id') as string,
      telegramChatId: getVal('telegram_chat_id') as string,
      telegramUserId: getVal('telegram_user_id') as string,
      telegramUsername: (getVal('telegram_username') as string) || undefined,
      linkedAt: Number(getVal('linked_at')),
      enabled: Boolean(getVal('enabled'))
    };
  }

  public saveUserTelegramLink(link: {
    userId: string;
    telegramChatId: string;
    telegramUserId: string;
    telegramUsername?: string;
    enabled?: boolean;
  }): UserTelegramLink {
    if (!this.db) throw new Error('Database not initialized');
    const now = Date.now();
    const isEnabled = link.enabled !== undefined ? (link.enabled ? 1 : 0) : 1;

    this.db.run(`
      INSERT OR REPLACE INTO user_telegram_links (
        user_id, telegram_chat_id, telegram_user_id, telegram_username, linked_at, enabled, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      link.userId,
      String(link.telegramChatId),
      String(link.telegramUserId),
      link.telegramUsername || null,
      now,
      isEnabled,
      now
    ]);

    // Also sync to user_settings table
    this.db.run(`
      UPDATE user_settings SET telegram_chat_id = ?, updated_at = ? WHERE user_id = ?
    `, [String(link.telegramChatId), now, link.userId]);

    this.schedulePersist();

    return {
      userId: link.userId,
      telegramChatId: String(link.telegramChatId),
      telegramUserId: String(link.telegramUserId),
      telegramUsername: link.telegramUsername,
      linkedAt: now,
      enabled: Boolean(isEnabled)
    };
  }

  public disconnectUserTelegram(userId: string): void {
    if (!this.db) throw new Error('Database not initialized');
    const now = Date.now();

    this.db.run("DELETE FROM user_telegram_links WHERE user_id = ?", [userId]);
    this.db.run("UPDATE user_settings SET telegram_chat_id = NULL, updated_at = ? WHERE user_id = ?", [now, userId]);

    this.schedulePersist();
  }

  // ==========================================
  // WATCHLISTS (USER-SCOPED)
  // ==========================================

  public getWatchlists(userId = 'usr_default_trader'): Watchlist[] {
    if (!this.db) throw new Error('Database not initialized');
    const res = this.db.exec("SELECT * FROM watchlists WHERE user_id = ? ORDER BY created_at ASC", [userId]);
    if (res.length === 0) return [];

    const watchlists: Watchlist[] = [];
    const wlCols = res[0].columns;

    for (const row of res[0].values) {
      const id = row[wlCols.indexOf('id')] as string;
      const name = row[wlCols.indexOf('name')] as string;
      const createdAt = Number(row[wlCols.indexOf('created_at')]);

      // fetch items
      const itemsRes = this.db.exec("SELECT * FROM watchlist_items WHERE watchlist_id = ? ORDER BY added_at ASC", [id]);
      const items: WatchlistItem[] = [];
      if (itemsRes.length > 0) {
        const itemCols = itemsRes[0].columns;
        for (const itemRow of itemsRes[0].values) {
          items.push({
            id: itemRow[itemCols.indexOf('id')] as string,
            symbol: itemRow[itemCols.indexOf('symbol')] as string,
            exchange: itemRow[itemCols.indexOf('exchange')] as any,
            marketType: itemRow[itemCols.indexOf('market_type')] as any,
            notes: (itemRow[itemCols.indexOf('notes')] as string) || undefined,
            addedAt: Number(itemRow[itemCols.indexOf('added_at')])
          });
        }
      }

      watchlists.push({ id, name, items, createdAt });
    }

    return watchlists;
  }

  public getWatchlistById(watchlistId: string, userId = 'usr_default_trader'): Watchlist | null {
    if (!this.db) throw new Error('Database not initialized');
    const res = this.db.exec("SELECT * FROM watchlists WHERE id = ? AND user_id = ?", [watchlistId, userId]);
    if (res.length === 0 || res[0].values.length === 0) return null;

    const row = res[0].values[0];
    const cols = res[0].columns;
    const id = row[cols.indexOf('id')] as string;
    const name = row[cols.indexOf('name')] as string;
    const createdAt = Number(row[cols.indexOf('created_at')]);

    const itemsRes = this.db.exec("SELECT * FROM watchlist_items WHERE watchlist_id = ? ORDER BY added_at ASC", [id]);
    const items: WatchlistItem[] = [];
    if (itemsRes.length > 0) {
      const itemCols = itemsRes[0].columns;
      for (const itemRow of itemsRes[0].values) {
        items.push({
          id: itemRow[itemCols.indexOf('id')] as string,
          symbol: itemRow[itemCols.indexOf('symbol')] as string,
          exchange: itemRow[itemCols.indexOf('exchange')] as any,
          marketType: itemRow[itemCols.indexOf('market_type')] as any,
          notes: (itemRow[itemCols.indexOf('notes')] as string) || undefined,
          addedAt: Number(itemRow[itemCols.indexOf('added_at')])
        });
      }
    }

    return { id, name, items, createdAt };
  }

  public createWatchlist(name: string, userId = 'usr_default_trader'): Watchlist {
    if (!this.db) throw new Error('Database not initialized');
    const id = `wl_${Math.random().toString(36).substring(2, 9)}`;
    const createdAt = Date.now();

    this.db.run(`
      INSERT INTO watchlists (id, user_id, name, created_at)
      VALUES (?, ?, ?, ?)
    `, [id, userId, name, createdAt]);

    this.schedulePersist();
    return { id, name, items: [], createdAt };
  }

  public deleteWatchlist(watchlistId: string, userId = 'usr_default_trader'): boolean {
    if (!this.db) throw new Error('Database not initialized');
    // Verify ownership
    const check = this.db.exec("SELECT id FROM watchlists WHERE id = ? AND user_id = ?", [watchlistId, userId]);
    if (check.length === 0 || check[0].values.length === 0) {
      return false;
    }

    this.db.run("DELETE FROM watchlist_items WHERE watchlist_id = ?", [watchlistId]);
    this.db.run("DELETE FROM watchlists WHERE id = ? AND user_id = ?", [watchlistId, userId]);
    this.schedulePersist();
    return true;
  }

  public addWatchlistItem(
    watchlistId: string, 
    item: Omit<WatchlistItem, 'id' | 'addedAt'>, 
    userId = 'usr_default_trader'
  ): WatchlistItem | null {
    if (!this.db) throw new Error('Database not initialized');
    // Verify watchlist ownership
    const check = this.db.exec("SELECT id FROM watchlists WHERE id = ? AND user_id = ?", [watchlistId, userId]);
    if (check.length === 0 || check[0].values.length === 0) {
      return null;
    }

    const id = `wli_${Math.random().toString(36).substring(2, 9)}`;
    const addedAt = Date.now();

    this.db.run(`
      INSERT OR REPLACE INTO watchlist_items (id, watchlist_id, symbol, exchange, market_type, notes, added_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [id, watchlistId, item.symbol, item.exchange, item.marketType, item.notes || null, addedAt]);
    
    this.schedulePersist();
    return { id, symbol: item.symbol, exchange: item.exchange, marketType: item.marketType, notes: item.notes, addedAt };
  }

  public removeWatchlistItem(
    watchlistId: string, 
    symbol: string, 
    exchange: string, 
    marketType: string, 
    userId = 'usr_default_trader'
  ): boolean {
    if (!this.db) throw new Error('Database not initialized');
    // Verify watchlist ownership
    const check = this.db.exec("SELECT id FROM watchlists WHERE id = ? AND user_id = ?", [watchlistId, userId]);
    if (check.length === 0 || check[0].values.length === 0) {
      return false;
    }

    this.db.run(`
      DELETE FROM watchlist_items 
      WHERE watchlist_id = ? AND symbol = ? AND exchange = ? AND market_type = ?
    `, [watchlistId, symbol, exchange, marketType]);
    this.schedulePersist();
    return true;
  }

  // ==========================================
  // GLOBAL BLACKLIST
  // ==========================================

  public getBlacklist(): BlacklistEntry[] {
    if (!this.db) throw new Error('Database not initialized');
    const res = this.db.exec("SELECT * FROM blacklist_entries ORDER BY added_at DESC");
    if (res.length === 0) return [];
    
    const cols = res[0].columns;
    return res[0].values.map(row => ({
      id: row[cols.indexOf('id')] as string,
      symbol: (row[cols.indexOf('symbol')] as string) || undefined,
      exchange: (row[cols.indexOf('exchange')] as any) || undefined,
      category: (row[cols.indexOf('category')] as any) || undefined,
      reason: row[cols.indexOf('reason')] as string,
      addedAt: Number(row[cols.indexOf('added_at')])
    }));
  }

  public addBlacklistEntry(entry: Omit<BlacklistEntry, 'id' | 'addedAt'>): BlacklistEntry {
    if (!this.db) throw new Error('Database not initialized');
    const id = `blk_${Math.random().toString(36).substring(2, 9)}`;
    const addedAt = Date.now();

    this.db.run(`
      INSERT INTO blacklist_entries (id, symbol, exchange, category, reason, added_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [id, entry.symbol || null, entry.exchange || null, entry.category || null, entry.reason, addedAt]);
    
    this.schedulePersist();
    return { id, ...entry, addedAt };
  }

  public removeBlacklistEntry(id: string): void {
    if (!this.db) throw new Error('Database not initialized');
    this.db.run("DELETE FROM blacklist_entries WHERE id = ?", [id]);
    this.schedulePersist();
  }

  // ==========================================
  // ALERT RULES (USER-SCOPED)
  // ==========================================

  public getAlertRules(userId = 'usr_default_trader'): AlertRule[] {
    if (!this.db) throw new Error('Database not initialized');
    const res = this.db.exec("SELECT * FROM alert_rules WHERE user_id = ? ORDER BY created_at DESC", [userId]);
    if (res.length === 0) return [];

    const cols = res[0].columns;
    return res[0].values.map(row => {
      const getVal = (col: string) => row[cols.indexOf(col)];
      return {
        id: getVal('id') as string,
        name: getVal('name') as string,
        enabled: Boolean(getVal('enabled')),
        symbols: JSON.parse((getVal('symbols') as string) || '[]'),
        exchanges: JSON.parse((getVal('exchanges') as string) || '[]'),
        marketTypes: JSON.parse((getVal('market_types') as string) || '[]'),
        logic: (getVal('logic') as 'AND' | 'OR') || 'AND',
        conditions: JSON.parse((getVal('conditions_json') as string) || '[]'),
        cooldownSeconds: Number(getVal('cooldown_seconds')) || 300,
        lastTriggeredAt: getVal('last_triggered_at') ? Number(getVal('last_triggered_at')) : undefined,
        notifyChannels: ((getVal('notify_channels') as string) || 'IN_APP').split(',') as any,
        createdAt: Number(getVal('created_at')),
        updatedAt: Number(getVal('updated_at'))
      };
    });
  }

  public getAlertRuleById(ruleId: string, userId = 'usr_default_trader'): AlertRule | null {
    if (!this.db) throw new Error('Database not initialized');
    const res = this.db.exec("SELECT * FROM alert_rules WHERE id = ? AND user_id = ?", [ruleId, userId]);
    if (res.length === 0 || res[0].values.length === 0) return null;

    const row = res[0].values[0];
    const cols = res[0].columns;
    const getVal = (col: string) => row[cols.indexOf(col)];
    return {
      id: getVal('id') as string,
      name: getVal('name') as string,
      enabled: Boolean(getVal('enabled')),
      symbols: JSON.parse((getVal('symbols') as string) || '[]'),
      exchanges: JSON.parse((getVal('exchanges') as string) || '[]'),
      marketTypes: JSON.parse((getVal('market_types') as string) || '[]'),
      logic: (getVal('logic') as 'AND' | 'OR') || 'AND',
      conditions: JSON.parse((getVal('conditions_json') as string) || '[]'),
      cooldownSeconds: Number(getVal('cooldown_seconds')) || 300,
      lastTriggeredAt: getVal('last_triggered_at') ? Number(getVal('last_triggered_at')) : undefined,
      notifyChannels: ((getVal('notify_channels') as string) || 'IN_APP').split(',') as any,
      createdAt: Number(getVal('created_at')),
      updatedAt: Number(getVal('updated_at'))
    };
  }

  public saveAlertRule(rule: Omit<AlertRule, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }, userId = 'usr_default_trader'): AlertRule {
    if (!this.db) throw new Error('Database not initialized');
    const now = Date.now();
    
    // If id is provided, verify ownership first
    if (rule.id) {
      const existing = this.getAlertRuleById(rule.id, userId);
      if (!existing) {
        // If it exists under another user, reject
        const anyRes = this.db.exec("SELECT user_id FROM alert_rules WHERE id = ?", [rule.id]);
        if (anyRes.length > 0 && anyRes[0].values.length > 0) {
          const error: any = new Error('Unauthorized to modify alert rule');
          error.statusCode = 403;
          throw error;
        }
      }
    }

    const id = rule.id || `rl_${Math.random().toString(36).substring(2, 9)}`;

    this.db.run(`
      INSERT OR REPLACE INTO alert_rules (
        id, user_id, name, enabled, symbols, exchanges, market_types,
        logic, conditions_json, cooldown_seconds, notify_channels, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      userId,
      rule.name,
      rule.enabled ? 1 : 0,
      JSON.stringify(rule.symbols),
      JSON.stringify(rule.exchanges),
      JSON.stringify(rule.marketTypes),
      rule.logic,
      JSON.stringify(rule.conditions),
      rule.cooldownSeconds,
      (rule.notifyChannels || ['IN_APP']).join(','),
      now,
      now
    ]);

    this.schedulePersist();
    return {
      ...rule,
      id,
      notifyChannels: rule.notifyChannels || ['IN_APP'],
      createdAt: now,
      updatedAt: now
    };
  }

  public createAlertRule(rule: Omit<AlertRule, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }, userId = 'usr_default_trader'): AlertRule {
    return this.saveAlertRule(rule, userId);
  }

  public updateAlertRuleLastTriggered(ruleId: string, timestamp: number): void {
    if (!this.db) return;
    this.db.run("UPDATE alert_rules SET last_triggered_at = ? WHERE id = ?", [timestamp, ruleId]);
  }

  public deleteAlertRule(ruleId: string, userId = 'usr_default_trader'): boolean {
    if (!this.db) throw new Error('Database not initialized');
    // Verify ownership
    const check = this.db.exec("SELECT id FROM alert_rules WHERE id = ? AND user_id = ?", [ruleId, userId]);
    if (check.length === 0 || check[0].values.length === 0) {
      return false;
    }

    this.db.run("DELETE FROM alert_rules WHERE id = ? AND user_id = ?", [ruleId, userId]);
    this.schedulePersist();
    return true;
  }

  // ==========================================
  // ALERT TRIGGERS (USER-SCOPED)
  // ==========================================

  public saveAlertTrigger(trigger: Omit<AlertTrigger, 'id'>, userId = 'usr_default_trader'): AlertTrigger {
    if (!this.db) throw new Error('Database not initialized');
    const id = `trg_${Math.random().toString(36).substring(2, 9)}`;

    this.db.run(`
      INSERT INTO alert_triggers (
        id, user_id, rule_id, rule_name, symbol, exchange, market_type,
        message, condition_type, metric_value, trigger_price, channel, read, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      userId,
      trigger.ruleId,
      trigger.ruleName,
      trigger.symbol,
      trigger.exchange,
      trigger.marketType,
      trigger.message,
      trigger.conditionType,
      String(trigger.metricValue),
      trigger.triggerPrice,
      trigger.channel,
      trigger.read ? 1 : 0,
      trigger.timestamp
    ]);

    this.schedulePersist();
    return { ...trigger, id };
  }

  public getAlertTriggers(limit = 100, userId = 'usr_default_trader'): AlertTrigger[] {
    if (!this.db) throw new Error('Database not initialized');
    const res = this.db.exec(
      "SELECT * FROM alert_triggers WHERE user_id = ? OR user_id IS NULL ORDER BY timestamp DESC LIMIT ?", 
      [userId, limit]
    );
    if (res.length === 0) return [];

    const cols = res[0].columns;
    return res[0].values.map(row => {
      const getVal = (col: string) => row[cols.indexOf(col)];
      return {
        id: getVal('id') as string,
        ruleId: getVal('rule_id') as string,
        ruleName: getVal('rule_name') as string,
        symbol: getVal('symbol') as string,
        exchange: getVal('exchange') as any,
        marketType: getVal('market_type') as any,
        message: getVal('message') as string,
        conditionType: getVal('condition_type') as any,
        metricValue: getVal('metric_value') as string,
        triggerPrice: Number(getVal('trigger_price')),
        channel: (getVal('channel') as any) || 'IN_APP',
        read: Boolean(getVal('read')),
        timestamp: Number(getVal('timestamp'))
      };
    });
  }

  public markAlertTriggerRead(triggerId?: string, userId = 'usr_default_trader'): void {
    if (!this.db) return;
    if (triggerId) {
      this.db.run("UPDATE alert_triggers SET read = 1 WHERE id = ? AND (user_id = ? OR user_id IS NULL)", [triggerId, userId]);
    } else {
      this.db.run("UPDATE alert_triggers SET read = 1 WHERE user_id = ? OR user_id IS NULL", [userId]);
    }
    this.schedulePersist();
  }

  public clearAlertTriggers(userId = 'usr_default_trader'): void {
    if (!this.db) return;
    this.db.run("DELETE FROM alert_triggers WHERE user_id = ? OR user_id IS NULL", [userId]);
    this.schedulePersist();
  }

  // ==========================================
  // FILTER PRESETS (USER-SCOPED)
  // ==========================================

  public getFilterPresets(userId = 'usr_default_trader'): SavedFilterPreset[] {
    if (!this.db) throw new Error('Database not initialized');
    const res = this.db.exec("SELECT * FROM saved_filter_presets WHERE user_id = ? ORDER BY created_at ASC", [userId]);
    if (res.length === 0) return [];

    const cols = res[0].columns;
    return res[0].values.map(row => ({
      id: row[cols.indexOf('id')] as string,
      name: row[cols.indexOf('name')] as string,
      isDefault: Boolean(row[cols.indexOf('is_default')]),
      filters: JSON.parse(row[cols.indexOf('filters_json')] as string),
      createdAt: Number(row[cols.indexOf('created_at')])
    }));
  }

  public saveFilterPreset(
    preset: Omit<SavedFilterPreset, 'id' | 'createdAt'> & { id?: string }, 
    userId = 'usr_default_trader'
  ): SavedFilterPreset {
    if (!this.db) throw new Error('Database not initialized');
    const id = preset.id || `pst_${Math.random().toString(36).substring(2, 9)}`;
    const createdAt = Date.now();

    if (preset.isDefault) {
      this.db.run("UPDATE saved_filter_presets SET is_default = 0 WHERE user_id = ?", [userId]);
    }

    this.db.run(`
      INSERT OR REPLACE INTO saved_filter_presets (id, user_id, name, is_default, filters_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [id, userId, preset.name, preset.isDefault ? 1 : 0, JSON.stringify(preset.filters), createdAt]);

    this.schedulePersist();
    return { id, ...preset, createdAt };
  }

  public deleteFilterPreset(presetId: string, userId = 'usr_default_trader'): boolean {
    if (!this.db) throw new Error('Database not initialized');
    // Verify ownership
    const check = this.db.exec("SELECT id FROM saved_filter_presets WHERE id = ? AND user_id = ?", [presetId, userId]);
    if (check.length === 0 || check[0].values.length === 0) {
      return false;
    }

    this.db.run("DELETE FROM saved_filter_presets WHERE id = ? AND user_id = ?", [presetId, userId]);
    this.schedulePersist();
    return true;
  }

  // ==========================================
  // WALL PERSISTENCE & HISTORY (MARKET-WIDE)
  // ==========================================

  public saveWallRecord(wall: DetectedWall): void {
    if (!this.db) return;
    this.db.run(`
      INSERT OR REPLACE INTO detected_walls (
        id, symbol, exchange, market_type, side, price, volume_amount, volume_usd,
        reference_price, distance_percent, first_seen_at, last_seen_at, duration_seconds,
        state, initial_volume_usd, peak_volume_usd, remaining_volume_usd, is_aggregated,
        contributing_exchanges, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      wall.id,
      wall.symbol,
      wall.exchange,
      wall.marketType,
      wall.side,
      wall.price,
      wall.volumeAmount,
      wall.volumeUsd,
      wall.referencePrice,
      wall.distancePercent,
      wall.firstSeenAt,
      wall.lastSeenAt,
      wall.durationSeconds,
      wall.state,
      wall.initialVolumeUsd,
      wall.peakVolumeUsd,
      wall.remainingVolumeUsd,
      wall.isAggregated ? 1 : 0,
      wall.contributingExchanges ? JSON.stringify(wall.contributingExchanges) : null,
      wall.createdAt,
      wall.updatedAt
    ]);
    this.schedulePersist();
  }

  public recordWallHistoricalOutcome(wall: DetectedWall, finalState: 'REMOVED' | 'FILLED', fillPercentage = 0): void {
    if (!this.db) return;
    const historyId = `wh_${wall.id}`;
    const now = Date.now();

    this.db.run(`
      INSERT OR REPLACE INTO wall_history (
        id, symbol, exchange, market_type, side, price, volume_usd, reference_price,
        distance_percent, first_seen_at, last_seen_at, duration_seconds, final_state,
        fill_percentage, peak_volume_usd, is_aggregated, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      historyId,
      wall.symbol,
      wall.exchange,
      wall.marketType,
      wall.side,
      wall.price,
      wall.volumeUsd,
      wall.referencePrice,
      wall.distancePercent,
      wall.firstSeenAt,
      wall.lastSeenAt,
      wall.durationSeconds,
      finalState,
      fillPercentage,
      wall.peakVolumeUsd,
      wall.isAggregated ? 1 : 0,
      now
    ]);

    // Update daily aggregates
    this.updateDailyAggregate(wall, finalState);
    this.schedulePersist();
  }

  private updateDailyAggregate(wall: DetectedWall, finalState: 'REMOVED' | 'FILLED'): void {
    if (!this.db) return;
    const dateStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const exchange = wall.isAggregated ? 'AGGREGATED' : wall.exchange;
    const aggId = `agg_${dateStr}_${wall.symbol}_${exchange}_${wall.marketType}`;

    const res = this.db.exec(`
      SELECT * FROM daily_wall_aggregates 
      WHERE date = ? AND symbol = ? AND exchange = ? AND market_type = ?
    `, [dateStr, wall.symbol, exchange, wall.marketType]);

    if (res.length === 0 || res[0].values.length === 0) {
      this.db.run(`
        INSERT INTO daily_wall_aggregates (
          id, date, symbol, exchange, market_type, wall_count, bid_wall_count,
          ask_wall_count, avg_volume_usd, peak_volume_usd, avg_duration_seconds,
          filled_count, removed_count, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        aggId,
        dateStr,
        wall.symbol,
        exchange,
        wall.marketType,
        1,
        wall.side === 'BID' ? 1 : 0,
        wall.side === 'ASK' ? 1 : 0,
        wall.volumeUsd,
        wall.peakVolumeUsd,
        wall.durationSeconds,
        finalState === 'FILLED' ? 1 : 0,
        finalState === 'REMOVED' ? 1 : 0,
        Date.now()
      ]);
    } else {
      const row = res[0].values[0];
      const cols = res[0].columns;
      const getVal = (col: string) => row[cols.indexOf(col)];

      const currentCount = Number(getVal('wall_count'));
      const newCount = currentCount + 1;
      const currentAvgVol = Number(getVal('avg_volume_usd'));
      const newAvgVol = (currentAvgVol * currentCount + wall.volumeUsd) / newCount;
      const currentPeakVol = Math.max(Number(getVal('peak_volume_usd')), wall.peakVolumeUsd);
      const currentAvgDur = Number(getVal('avg_duration_seconds'));
      const newAvgDur = (currentAvgDur * currentCount + wall.durationSeconds) / newCount;

      this.db.run(`
        UPDATE daily_wall_aggregates SET
          wall_count = ?,
          bid_wall_count = bid_wall_count + ?,
          ask_wall_count = ask_wall_count + ?,
          avg_volume_usd = ?,
          peak_volume_usd = ?,
          avg_duration_seconds = ?,
          filled_count = filled_count + ?,
          removed_count = removed_count + ?
        WHERE id = ?
      `, [
        newCount,
        wall.side === 'BID' ? 1 : 0,
        wall.side === 'ASK' ? 1 : 0,
        newAvgVol,
        currentPeakVol,
        newAvgDur,
        finalState === 'FILLED' ? 1 : 0,
        finalState === 'REMOVED' ? 1 : 0,
        aggId
      ]);
    }
  }

  public getWallHistory(symbol?: string, exchange?: string, limit = 100): HistoricalWallRecord[] {
    if (!this.db) throw new Error('Database not initialized');
    let sql = "SELECT * FROM wall_history";
    const params: any[] = [];
    const conditions: string[] = [];

    if (symbol) {
      conditions.push("symbol = ?");
      params.push(symbol.toUpperCase());
    }
    if (exchange) {
      conditions.push("exchange = ?");
      params.push(exchange);
    }

    if (conditions.length > 0) {
      sql += " WHERE " + conditions.join(" AND ");
    }
    sql += " ORDER BY created_at DESC LIMIT ?";
    params.push(limit);

    const res = this.db.exec(sql, params);
    if (res.length === 0) return [];

    const cols = res[0].columns;
    return res[0].values.map(row => {
      const getVal = (col: string) => row[cols.indexOf(col)];
      return {
        id: getVal('id') as string,
        symbol: getVal('symbol') as string,
        exchange: getVal('exchange') as any,
        marketType: getVal('market_type') as any,
        side: getVal('side') as any,
        price: Number(getVal('price')),
        volumeAmount: 0,
        volumeUsd: Number(getVal('volume_usd')),
        referencePrice: Number(getVal('reference_price')),
        distancePercent: Number(getVal('distance_percent')),
        firstSeenAt: Number(getVal('first_seen_at')),
        lastSeenAt: Number(getVal('last_seen_at')),
        durationSeconds: Number(getVal('duration_seconds')),
        state: (getVal('final_state') as any) || 'CONFIRMED',
        initialVolumeUsd: Number(getVal('volume_usd')),
        peakVolumeUsd: Number(getVal('peak_volume_usd')) || Number(getVal('volume_usd')),
        remainingVolumeUsd: 0,
        isAggregated: Boolean(getVal('is_aggregated')),
        createdAt: Number(getVal('created_at')),
        updatedAt: Number(getVal('created_at')),
        fillPercentage: getVal('fill_percentage') ? Number(getVal('fill_percentage')) : undefined
      };
    });
  }

  public getDailyWallAggregates(days = 30): DailyWallAggregate[] {
    if (!this.db) throw new Error('Database not initialized');
    const res = this.db.exec(`
      SELECT * FROM daily_wall_aggregates 
      ORDER BY date DESC 
      LIMIT ?
    `, [days * 20]);

    if (res.length === 0) return [];
    const cols = res[0].columns;
    return res[0].values.map(row => {
      const getVal = (col: string) => row[cols.indexOf(col)];
      return {
        id: getVal('id') as string,
        date: getVal('date') as string,
        symbol: getVal('symbol') as string,
        exchange: getVal('exchange') as any,
        marketType: getVal('market_type') as any,
        wallCount: Number(getVal('wall_count')),
        bidWallCount: Number(getVal('bid_wall_count')),
        askWallCount: Number(getVal('ask_wall_count')),
        avgVolumeUsd: Number(getVal('avg_volume_usd')),
        peakVolumeUsd: Number(getVal('peak_volume_usd')),
        avgDurationSeconds: Number(getVal('avg_duration_seconds')),
        filledCount: Number(getVal('filled_count')),
        removedCount: Number(getVal('removed_count'))
      };
    });
  }

  public cleanOldWallHistory(retentionDays = 90): void {
    if (!this.db) return;
    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    this.db.run("DELETE FROM wall_history WHERE created_at < ?", [cutoff]);
    this.db.run("DELETE FROM detected_walls WHERE updated_at < ?", [cutoff]);
    this.schedulePersist();
  }

  // ==========================================
  // SUBSCRIPTION & BILLING OPERATIONS
  // ==========================================

  public getUserSubscription(userId: string): UserSubscription {
    if (!this.db) throw new Error('Database not initialized');
    const res = this.db.exec("SELECT * FROM subscriptions WHERE user_id = ?", [userId]);
    const now = Date.now();

    if (res.length === 0 || res[0].values.length === 0) {
      // Default to active FREE plan
      const defaultSub: UserSubscription = {
        userId,
        plan: 'FREE',
        status: 'active',
        billingProvider: 'manual',
        currentPeriodStart: now,
        currentPeriodEnd: now + 365 * 24 * 60 * 60 * 1000,
        cancelAtPeriodEnd: false,
        createdAt: now,
        updatedAt: now
      };
      this.saveUserSubscription(defaultSub);
      return defaultSub;
    }

    const cols = res[0].columns;
    const row = res[0].values[0];
    const getVal = (col: string) => row[cols.indexOf(col)];

    return {
      userId: getVal('user_id') as string,
      plan: (getVal('plan') as SubscriptionPlanId) || 'FREE',
      status: (getVal('status') as SubscriptionStatus) || 'active',
      billingProvider: (getVal('billing_provider') as string) || 'manual',
      externalCustomerId: getVal('external_customer_id') ? (getVal('external_customer_id') as string) : undefined,
      externalSubscriptionId: getVal('external_subscription_id') ? (getVal('external_subscription_id') as string) : undefined,
      currentPeriodStart: Number(getVal('current_period_start')) || now,
      currentPeriodEnd: Number(getVal('current_period_end')) || (now + 30 * 24 * 60 * 60 * 1000),
      cancelAtPeriodEnd: Boolean(getVal('cancel_at_period_end')),
      trialEndsAt: getVal('trial_ends_at') ? Number(getVal('trial_ends_at')) : undefined,
      createdAt: Number(getVal('created_at')) || now,
      updatedAt: Number(getVal('updated_at')) || now
    };
  }

  public saveUserSubscription(sub: UserSubscription): void {
    if (!this.db) throw new Error('Database not initialized');
    const now = Date.now();
    this.db.run(`
      INSERT OR REPLACE INTO subscriptions (
        user_id, plan, status, billing_provider, external_customer_id,
        external_subscription_id, current_period_start, current_period_end,
        cancel_at_period_end, trial_ends_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      sub.userId,
      sub.plan,
      sub.status,
      sub.billingProvider || 'manual',
      sub.externalCustomerId || null,
      sub.externalSubscriptionId || null,
      sub.currentPeriodStart || now,
      sub.currentPeriodEnd || (now + 30 * 24 * 60 * 60 * 1000),
      sub.cancelAtPeriodEnd ? 1 : 0,
      sub.trialEndsAt || null,
      sub.createdAt || now,
      now
    ]);
    this.schedulePersist();
  }

  public updateSubscriptionPlan(
    userId: string,
    plan: SubscriptionPlanId,
    status: SubscriptionStatus = 'active',
    provider = 'stripe',
    externalSubId?: string,
    externalCustId?: string
  ): UserSubscription {
    const existing = this.getUserSubscription(userId);
    const now = Date.now();
    const updated: UserSubscription = {
      ...existing,
      plan,
      status,
      billingProvider: provider,
      externalSubscriptionId: externalSubId || existing.externalSubscriptionId,
      externalCustomerId: externalCustId || existing.externalCustomerId,
      updatedAt: now
    };
    this.saveUserSubscription(updated);
    return updated;
  }

  public updateUserSubscription(userId: string, updates: Partial<UserSubscription>): UserSubscription {
    const existing = this.getUserSubscription(userId);
    const updated: UserSubscription = {
      ...existing,
      ...updates,
      userId,
      updatedAt: Date.now()
    };
    this.saveUserSubscription(updated);
    return updated;
  }

  // ==========================================
  // BILLING AUDIT & WEBHOOK EVENTS
  // ==========================================

  public recordBillingEvent(event: Omit<BillingEvent, 'id' | 'createdAt'>): BillingEvent {
    if (!this.db) throw new Error('Database not initialized');
    const id = `bevt_${crypto.randomUUID().substring(0, 12)}`;
    const now = Date.now();

    this.db.run(`
      INSERT INTO billing_events (id, user_id, event_type, plan, provider, details, ip_address, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      event.userId,
      event.eventType,
      event.plan || null,
      event.provider,
      event.details ? JSON.stringify(event.details) : null,
      event.ipAddress || null,
      now
    ]);
    this.schedulePersist();

    return {
      ...event,
      id,
      createdAt: now
    };
  }

  public getBillingEvents(userId: string, limit = 50): BillingEvent[] {
    if (!this.db) throw new Error('Database not initialized');
    const res = this.db.exec("SELECT * FROM billing_events WHERE user_id = ? ORDER BY created_at DESC LIMIT ?", [userId, limit]);
    if (res.length === 0) return [];
    const cols = res[0].columns;
    return res[0].values.map(row => {
      const getVal = (c: string) => row[cols.indexOf(c)];
      return {
        id: getVal('id') as string,
        userId: getVal('user_id') as string,
        eventType: getVal('event_type') as any,
        plan: getVal('plan') ? (getVal('plan') as any) : undefined,
        provider: getVal('provider') as string,
        details: getVal('details') ? JSON.parse(getVal('details') as string) : undefined,
        ipAddress: getVal('ip_address') ? (getVal('ip_address') as string) : undefined,
        createdAt: Number(getVal('created_at'))
      };
    });
  }

  public isWebhookEventProcessed(eventId: string): boolean {
    if (!this.db) throw new Error('Database not initialized');
    const res = this.db.exec("SELECT count(*) as count FROM billing_webhook_events WHERE event_id = ?", [eventId]);
    if (res.length === 0 || res[0].values.length === 0) return false;
    return (res[0].values[0][0] as number) > 0;
  }

  public recordWebhookEvent(eventId: string, provider: string, eventType: string, payloadHash?: string, status = 'PROCESSED'): void {
    if (!this.db) throw new Error('Database not initialized');
    const now = Date.now();
    this.db.run(`
      INSERT OR REPLACE INTO billing_webhook_events (event_id, provider, event_type, payload_hash, processed_at, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [eventId, provider, eventType, payloadHash || null, now, status]);
    this.schedulePersist();
  }

  // ==========================================
  // NOTIFICATION DELIVERY QUEUE
  // ==========================================

  public recordNotificationDelivery(delivery: Partial<NotificationDelivery> & { userId: string; channel: any; destination?: string }): NotificationDelivery {
    if (!this.db) throw new Error('Database not initialized');
    const id = delivery.id || `notif_${crypto.randomUUID().substring(0, 16)}`;
    const now = delivery.createdAt || Date.now();

    this.db.run(`
      INSERT OR REPLACE INTO notification_deliveries (
        id, alert_trigger_id, user_id, channel, destination,
        status, attempts, max_attempts, next_attempt_at, last_attempt_at,
        delivered_at, last_error, payload, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      delivery.alertTriggerId || null,
      delivery.userId,
      delivery.channel,
      delivery.destination || null,
      delivery.status || 'pending',
      delivery.attempts || 0,
      delivery.maxAttempts || 4,
      delivery.nextAttemptAt || null,
      delivery.lastAttemptAt || null,
      delivery.deliveredAt || null,
      delivery.lastError || null,
      delivery.payload ? JSON.stringify(delivery.payload) : null,
      now
    ]);
    this.schedulePersist();

    return {
      id,
      userId: delivery.userId,
      channel: delivery.channel,
      destination: delivery.destination || '',
      status: delivery.status || 'pending',
      attempts: delivery.attempts || 0,
      maxAttempts: delivery.maxAttempts || 4,
      createdAt: now,
      ...delivery
    };
  }

  public createNotificationDelivery(delivery: Omit<NotificationDelivery, 'id' | 'createdAt' | 'attempts'>): NotificationDelivery {
    if (!this.db) throw new Error('Database not initialized');
    const id = `notif_${crypto.randomUUID().substring(0, 16)}`;
    const now = Date.now();

    this.db.run(`
      INSERT INTO notification_deliveries (
        id, alert_trigger_id, user_id, channel, destination,
        status, attempts, max_attempts, next_attempt_at, last_attempt_at,
        delivered_at, last_error, payload, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      delivery.alertTriggerId || null,
      delivery.userId,
      delivery.channel,
      delivery.destination || null,
      delivery.status || 'pending',
      0,
      delivery.maxAttempts || 4,
      delivery.nextAttemptAt || now,
      delivery.lastAttemptAt || null,
      delivery.deliveredAt || null,
      delivery.lastError || null,
      delivery.payload ? JSON.stringify(delivery.payload) : null,
      now
    ]);
    this.schedulePersist();

    return {
      ...delivery,
      id,
      attempts: 0,
      maxAttempts: delivery.maxAttempts || 4,
      createdAt: now
    };
  }

  public getPendingNotificationDeliveries(limit = 25): NotificationDelivery[] {
    if (!this.db) throw new Error('Database not initialized');
    const now = Date.now();
    const res = this.db.exec(`
      SELECT * FROM notification_deliveries 
      WHERE status IN ('pending', 'sending') AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
      ORDER BY created_at ASC 
      LIMIT ?
    `, [now, limit]);

    if (res.length === 0) return [];
    const cols = res[0].columns;
    return res[0].values.map(row => {
      const getVal = (c: string) => row[cols.indexOf(c)];
      return {
        id: getVal('id') as string,
        alertTriggerId: getVal('alert_trigger_id') ? (getVal('alert_trigger_id') as string) : undefined,
        userId: getVal('user_id') as string,
        channel: getVal('channel') as any,
        destination: getVal('destination') ? (getVal('destination') as string) : '',
        status: getVal('status') as any,
        attempts: Number(getVal('attempts')),
        maxAttempts: Number(getVal('max_attempts')),
        nextAttemptAt: getVal('next_attempt_at') ? Number(getVal('next_attempt_at')) : undefined,
        lastAttemptAt: getVal('last_attempt_at') ? Number(getVal('last_attempt_at')) : undefined,
        deliveredAt: getVal('delivered_at') ? Number(getVal('delivered_at')) : undefined,
        lastError: getVal('last_error') ? (getVal('last_error') as string) : undefined,
        payload: getVal('payload') ? JSON.parse(getVal('payload') as string) : undefined,
        createdAt: Number(getVal('created_at'))
      };
    });
  }

  public updateNotificationDelivery(
    id: string,
    updates: Partial<Pick<NotificationDelivery, 'status' | 'attempts' | 'nextAttemptAt' | 'lastAttemptAt' | 'deliveredAt' | 'lastError'>>
  ): void {
    if (!this.db) throw new Error('Database not initialized');
    const clauses: string[] = [];
    const params: any[] = [];

    if (updates.status !== undefined) {
      clauses.push("status = ?");
      params.push(updates.status);
    }
    if (updates.attempts !== undefined) {
      clauses.push("attempts = ?");
      params.push(updates.attempts);
    }
    if (updates.nextAttemptAt !== undefined) {
      clauses.push("next_attempt_at = ?");
      params.push(updates.nextAttemptAt);
    }
    if (updates.lastAttemptAt !== undefined) {
      clauses.push("last_attempt_at = ?");
      params.push(updates.lastAttemptAt);
    }
    if (updates.deliveredAt !== undefined) {
      clauses.push("delivered_at = ?");
      params.push(updates.deliveredAt);
    }
    if (updates.lastError !== undefined) {
      clauses.push("last_error = ?");
      params.push(updates.lastError);
    }

    if (clauses.length === 0) return;
    params.push(id);

    this.db.run(`UPDATE notification_deliveries SET ${clauses.join(', ')} WHERE id = ?`, params);
    this.schedulePersist();
  }

  public getNotificationDeliveryById(id: string): NotificationDelivery | null {
    if (!this.db) throw new Error('Database not initialized');
    const res = this.db.exec("SELECT * FROM notification_deliveries WHERE id = ?", [id]);
    if (res.length === 0 || res[0].values.length === 0) return null;
    const cols = res[0].columns;
    const row = res[0].values[0];
    const getVal = (c: string) => row[cols.indexOf(c)];
    return {
      id: getVal('id') as string,
      alertTriggerId: getVal('alert_trigger_id') ? (getVal('alert_trigger_id') as string) : undefined,
      userId: getVal('user_id') as string,
      channel: getVal('channel') as any,
      destination: getVal('destination') ? (getVal('destination') as string) : '',
      status: getVal('status') as any,
      attempts: Number(getVal('attempts')),
      maxAttempts: Number(getVal('max_attempts')),
      nextAttemptAt: getVal('next_attempt_at') ? Number(getVal('next_attempt_at')) : undefined,
      lastAttemptAt: getVal('last_attempt_at') ? Number(getVal('last_attempt_at')) : undefined,
      deliveredAt: getVal('delivered_at') ? Number(getVal('delivered_at')) : undefined,
      lastError: getVal('last_error') ? (getVal('last_error') as string) : undefined,
      payload: getVal('payload') ? JSON.parse(getVal('payload') as string) : undefined,
      createdAt: Number(getVal('created_at'))
    };
  }

  public getNotificationDeliveries(status?: string, limit = 100): NotificationDelivery[] {
    if (!this.db) throw new Error('Database not initialized');
    let sql = "SELECT * FROM notification_deliveries";
    const params: any[] = [];
    if (status) {
      sql += " WHERE status = ?";
      params.push(status);
    }
    sql += " ORDER BY created_at DESC LIMIT ?";
    params.push(limit);

    const res = this.db.exec(sql, params);
    if (res.length === 0) return [];
    const cols = res[0].columns;
    return res[0].values.map(row => {
      const getVal = (c: string) => row[cols.indexOf(c)];
      return {
        id: getVal('id') as string,
        alertTriggerId: getVal('alert_trigger_id') ? (getVal('alert_trigger_id') as string) : undefined,
        userId: getVal('user_id') as string,
        channel: getVal('channel') as any,
        destination: getVal('destination') ? (getVal('destination') as string) : '',
        status: getVal('status') as any,
        attempts: Number(getVal('attempts')),
        maxAttempts: Number(getVal('max_attempts')),
        nextAttemptAt: getVal('next_attempt_at') ? Number(getVal('next_attempt_at')) : undefined,
        lastAttemptAt: getVal('last_attempt_at') ? Number(getVal('last_attempt_at')) : undefined,
        deliveredAt: getVal('delivered_at') ? Number(getVal('delivered_at')) : undefined,
        lastError: getVal('last_error') ? (getVal('last_error') as string) : undefined,
        payload: getVal('payload') ? JSON.parse(getVal('payload') as string) : undefined,
        createdAt: Number(getVal('created_at'))
      };
    });
  }

  public getFailedNotificationDeliveries(limit = 100): NotificationDelivery[] {
    if (!this.db) throw new Error('Database not initialized');
    const res = this.db.exec("SELECT * FROM notification_deliveries WHERE status = 'failed' ORDER BY created_at DESC LIMIT ?", [limit]);
    if (res.length === 0) return [];
    const cols = res[0].columns;
    return res[0].values.map(row => {
      const getVal = (c: string) => row[cols.indexOf(c)];
      return {
        id: getVal('id') as string,
        alertTriggerId: getVal('alert_trigger_id') ? (getVal('alert_trigger_id') as string) : undefined,
        userId: getVal('user_id') as string,
        channel: getVal('channel') as any,
        destination: getVal('destination') ? (getVal('destination') as string) : '',
        status: getVal('status') as any,
        attempts: Number(getVal('attempts')),
        maxAttempts: Number(getVal('max_attempts')),
        nextAttemptAt: getVal('next_attempt_at') ? Number(getVal('next_attempt_at')) : undefined,
        lastAttemptAt: getVal('last_attempt_at') ? Number(getVal('last_attempt_at')) : undefined,
        deliveredAt: getVal('delivered_at') ? Number(getVal('delivered_at')) : undefined,
        lastError: getVal('last_error') ? (getVal('last_error') as string) : undefined,
        payload: getVal('payload') ? JSON.parse(getVal('payload') as string) : undefined,
        createdAt: Number(getVal('created_at'))
      };
    });
  }

  public getNotificationDeliveryCount24h(userId: string): number {
    if (!this.db) throw new Error('Database not initialized');
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const res = this.db.exec("SELECT count(*) as count FROM notification_deliveries WHERE user_id = ? AND created_at >= ?", [userId, cutoff]);
    if (res.length === 0 || res[0].values.length === 0) return 0;
    return res[0].values[0][0] as number;
  }

  // ==========================================
  // ADMIN USERS & PLATFORM QUERIES
  // ==========================================

  public getAllUsersWithDetails(): Array<{
    id: string;
    email: string;
    name: string;
    role: UserRole;
    plan: SubscriptionPlanId;
    subscriptionStatus: SubscriptionStatus;
    createdAt: number;
    activeAlertsCount: number;
    watchlistItemsCount: number;
  }> {
    if (!this.db) throw new Error('Database not initialized');
    const res = this.db.exec(`
      SELECT 
        u.id, u.email, u.name, u.role, u.created_at,
        COALESCE(s.plan, 'FREE') as plan,
        COALESCE(s.status, 'active') as sub_status,
        (SELECT count(*) FROM alert_rules r WHERE r.user_id = u.id AND r.enabled = 1) as active_alerts,
        (SELECT count(*) FROM watchlist_items wi JOIN watchlists w ON wi.watchlist_id = w.id WHERE w.user_id = u.id) as wl_items
      FROM users u
      LEFT JOIN subscriptions s ON u.id = s.user_id
      ORDER BY u.created_at DESC
    `);

    if (res.length === 0) return [];
    const cols = res[0].columns;
    return res[0].values.map(row => {
      const getVal = (c: string) => row[cols.indexOf(c)];
      return {
        id: getVal('id') as string,
        email: getVal('email') as string,
        name: getVal('name') as string,
        role: getVal('role') as UserRole,
        plan: (getVal('plan') as SubscriptionPlanId) || 'FREE',
        subscriptionStatus: (getVal('sub_status') as SubscriptionStatus) || 'active',
        createdAt: Number(getVal('created_at')),
        activeAlertsCount: Number(getVal('active_alerts')) || 0,
        watchlistItemsCount: Number(getVal('wl_items')) || 0
      };
    });
  }

  public getAllUsers(): UserProfile[] {
    if (!this.db) throw new Error('Database not initialized');
    const res = this.db.exec("SELECT id, email, name, role, created_at FROM users ORDER BY created_at DESC");
    if (res.length === 0) return [];
    const cols = res[0].columns;
    return res[0].values.map(row => {
      const getVal = (c: string) => row[cols.indexOf(c)];
      return {
        id: getVal('id') as string,
        email: getVal('email') as string,
        name: getVal('name') as string,
        role: getVal('role') as UserRole,
        createdAt: Number(getVal('created_at'))
      };
    });
  }

  public updateUserRole(userId: string, newRole: UserRole): void {
    if (!this.db) throw new Error('Database not initialized');
    this.db.run("UPDATE users SET role = ?, updated_at = ? WHERE id = ?", [newRole, Date.now(), userId]);
    this.schedulePersist();
  }
}

