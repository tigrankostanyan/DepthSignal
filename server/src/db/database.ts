import crypto from 'crypto';
import { Op } from 'sequelize';
import { getSequelize, initSequelize, closeSequelize, sequelize } from './sequelize.js';
import '../models/index.js';
import { logger } from '../utils/logger.js';
import { SessionRepository } from '../repositories/SessionRepository.js';
import { AlertRuleRepository, AlertTriggerRepository } from '../repositories/AlertRepository.js';
import { WatchlistRepository } from '../repositories/WatchlistRepository.js';
import { BlacklistRepository } from '../repositories/BlacklistRepository.js';
import { TelegramRepository } from '../repositories/TelegramRepository.js';
import { DetectedWallRepository, WallHistoryRepository } from '../repositories/WallRepository.js';
import { SubscriptionRepository } from '../repositories/SubscriptionRepository.js';
import { PaymentProofRepository } from '../repositories/PaymentProofRepository.js';
import { NotificationDeliveryRepository } from '../repositories/NotificationDeliveryRepository.js';
import { UserRepository } from '../repositories/UserRepository.js';
import { User, UserSettings, Session, Watchlist, WatchlistItem, SavedFilterPreset as SavedFilterPresetModel, AlertRule as AlertRuleModel, AlertTrigger as AlertTriggerModel, Subscription as SubscriptionModel, BillingEvent as BillingEventModel, NotificationDelivery as NotificationDeliveryModel, PaymentProof as PaymentProofModel, TelegramLinkToken as TelegramLinkTokenModel, UserTelegramLink as UserTelegramLinkModel, AuditLog as AuditLogModel, DeletedAccount as DeletedAccountModel } from '../models/index.js';
import { MemoryStore } from './memoryRepositories.js';

import type {
  AlertRule, AlertTrigger, AuditLogEntry, BillingEvent, BlacklistEntry,
  DailyWallAggregate, DetectedWall, HistoricalWallRecord, NotificationDelivery,
  PaymentProof, ReceiptStatus, SavedFilterPreset, SubscriptionPlanId, SubscriptionStatus, UserProfile,
  UserRole, UserSettings as UserSettingsType, UserSubscription,
  UserTelegramLink, Watchlist as WatchlistType, WatchlistItem as WatchlistItemType,
} from '../types/index.js';

// ── Mapping helpers ────────────────────────────────────────────────────

// To user profile
function toUserProfile(u: any): UserProfile {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: ((u.role as UserRole) || 'USER').toUpperCase() as UserRole,
    createdAt: Number(u.createdAt),
    trialStartDate: u.trialStartDate ? Number(u.trialStartDate) : undefined,
    trialEndDate: u.trialEndDate ? Number(u.trialEndDate) : undefined,
  };
}

// To user settings
function toUserSettings(s: any): UserSettingsType {
  return {
    theme: (s.theme as 'dark' | 'light') || 'dark',
    decimalPrecision: Number(s.decimalPrecision) || 2,
    currency: (s.currency as 'USD' | 'USDT') || 'USD',
    refreshRateMs: Number(s.refreshRateMs) || 1000,
    defaultPresetId: s.defaultPresetId || undefined,
    defaultCrossExchangeAggregation: Boolean(s.defaultCrossExchangeAggregation),
    wallMinVolumeDefaultUsd: Number(s.wallMinVolumeDefaultUsd) || 500000,
    wallMinDurationDefaultSec: Number(s.wallMinDurationDefaultSec) || 15,
    wallDistanceDefaultPercent: Number(s.wallDistanceDefaultPercent) || 2.5,
    enabledExchanges: ((s.enabledExchanges as string) || 'BINANCE,BYBIT,OKX').split(',') as any,
    soundEnabled: Boolean(s.soundEnabled),
    telegramBotToken: (s.telegramBotToken as string) || undefined,
    telegramChatId: (s.telegramChatId as string) || undefined,
    emailRecipient: (s.emailRecipient as string) || undefined,
    webhookUrl: (s.webhookUrl as string) || undefined,
    finnhubApiKey: (s.finnhubApiKey as string) || undefined,
    polygonApiKey: (s.polygonApiKey as string) || undefined,
  };
}

// To alert rule
function toAlertRule(r: any): AlertRule {
  return {
    id: r.id,
    name: r.name,
    enabled: Boolean(r.enabled),
    symbols: JSON.parse((r.symbols as string) || '[]'),
    exchanges: JSON.parse((r.exchanges as string) || '[]'),
    marketTypes: JSON.parse((r.marketTypes as string) || '[]'),
    logic: (r.logic as 'AND' | 'OR') || 'AND',
    conditions: JSON.parse((r.conditionsJson as string) || '[]'),
    cooldownSeconds: Number(r.cooldownSeconds) || 300,
    lastTriggeredAt: r.lastTriggeredAt ? Number(r.lastTriggeredAt) : undefined,
    notifyChannels: ((r.notifyChannels as string) || 'IN_APP').split(',') as any,
    createdAt: Number(r.createdAt),
    updatedAt: Number(r.updatedAt),
  };
}

// To alert trigger
function toAlertTrigger(t: any): AlertTrigger {
  return {
    id: t.id,
    ruleId: t.ruleId,
    ruleName: t.ruleName,
    symbol: t.symbol,
    exchange: t.exchange as any,
    marketType: t.marketType as any,
    message: t.message,
    conditionType: t.conditionType as any,
    metricValue: t.metricValue as string,
    triggerPrice: Number(t.triggerPrice),
    channel: (t.channel as any) || 'IN_APP',
    read: Boolean(t.read),
    timestamp: Number(t.timestamp),
  };
}

// To telegram link
function toTelegramLink(l: any): UserTelegramLink {
  return {
    userId: l.userId,
    telegramChatId: l.telegramChatId,
    telegramUserId: l.telegramUserId,
    telegramUsername: l.telegramUsername || undefined,
    linkedAt: Number(l.linkedAt),
    enabled: Boolean(l.enabled),
  };
}

// To notification delivery
function toNotificationDelivery(n: any): NotificationDelivery {
  return {
    id: n.id,
    alertTriggerId: (n.alertTriggerId as string) || undefined,
    userId: n.userId,
    channel: n.channel as any,
    destination: (n.destination as string) || '',
    status: n.status as any,
    attempts: Number(n.attempts),
    maxAttempts: Number(n.maxAttempts),
    nextAttemptAt: n.nextAttemptAt ? Number(n.nextAttemptAt) : undefined,
    lastAttemptAt: n.lastAttemptAt ? Number(n.lastAttemptAt) : undefined,
    deliveredAt: n.deliveredAt ? Number(n.deliveredAt) : undefined,
    lastError: (n.lastError as string) || undefined,
    payload: n.payload ? JSON.parse(n.payload as string) : undefined,
    createdAt: Number(n.createdAt),
  };
}

// To subscription
function toSubscription(s: any): UserSubscription {
  const now = Date.now();
  return {
    userId: s.userId,
    plan: (s.plan as SubscriptionPlanId) || 'FREE',
    status: (s.status as SubscriptionStatus) || 'active',
    billingProvider: (s.billingProvider as string) || 'manual',
    externalCustomerId: (s.externalCustomerId as string) || undefined,
    externalSubscriptionId: (s.externalSubscriptionId as string) || undefined,
    currentPeriodStart: Number(s.currentPeriodStart) || now,
    currentPeriodEnd: Number(s.currentPeriodEnd) || (now + 30 * 24 * 60 * 60 * 1000),
    cancelAtPeriodEnd: Boolean(s.cancelAtPeriodEnd),
    trialEndsAt: s.trialEndsAt ? Number(s.trialEndsAt) : undefined,
    createdAt: Number(s.createdAt) || now,
    updatedAt: Number(s.updatedAt) || now,
  };
}

// To watchlist
function toWatchlist(w: any, items: any[]): WatchlistType {
  return {
    id: w.id,
    name: w.name,
    items: items.map((i: any) => ({
      id: i.id,
      symbol: i.symbol,
      exchange: i.exchange as any,
      marketType: i.marketType as any,
      notes: (i.notes as string) || undefined,
      addedAt: Number(i.addedAt),
    })),
    createdAt: Number(w.createdAt),
  };
}

// To audit log entry
function toAuditLogEntry(a: any): AuditLogEntry {
  return {
    id: a.id,
    userId: a.userId,
    action: a.action,
    resource: a.resource,
    resourceId: (a.resourceId as string) || undefined,
    details: a.detailsJson ? JSON.parse(a.detailsJson as string) : undefined,
    ipAddress: (a.ipAddress as string) || undefined,
    createdAt: Number(a.createdAt),
  };
}

// To historical wall
function toHistoricalWall(w: any): HistoricalWallRecord {
  return {
    id: w.id,
    symbol: w.symbol,
    exchange: w.exchange as any,
    marketType: w.marketType as any,
    side: w.side as any,
    price: Number(w.price),
    volumeAmount: 0,
    volumeUsd: Number(w.volumeUsd),
    referencePrice: Number(w.referencePrice),
    distancePercent: Number(w.distancePercent),
    firstSeenAt: Number(w.firstSeenAt),
    lastSeenAt: Number(w.lastSeenAt),
    durationSeconds: Number(w.durationSeconds),
    state: (w.finalState as any) || 'CONFIRMED',
    initialVolumeUsd: Number(w.volumeUsd),
    peakVolumeUsd: Number(w.peakVolumeUsd) || Number(w.volumeUsd),
    remainingVolumeUsd: 0,
    isAggregated: Boolean(w.isAggregated),
    createdAt: Number(w.createdAt),
    updatedAt: Number(w.createdAt),
    fillPercentage: w.fillPercentage ? Number(w.fillPercentage) : undefined,
  };
}

// To daily aggregate
function toDailyAggregate(a: any): DailyWallAggregate {
  return {
    id: a.id,
    date: a.date,
    symbol: a.symbol,
    exchange: a.exchange as any,
    marketType: a.marketType as any,
    wallCount: Number(a.wallCount),
    bidWallCount: Number(a.bidWallCount),
    askWallCount: Number(a.askWallCount),
    avgVolumeUsd: Number(a.avgVolumeUsd),
    peakVolumeUsd: Number(a.peakVolumeUsd),
    avgDurationSeconds: Number(a.avgDurationSeconds),
    filledCount: Number(a.filledCount),
    removedCount: Number(a.removedCount),
  };
}

// To blacklist entry
function toBlacklistEntry(b: any): BlacklistEntry {
  return {
    id: b.id,
    symbol: (b.symbol as string) || undefined,
    exchange: (b.exchange as any) || undefined,
    category: (b.category as any) || undefined,
    reason: b.reason,
    addedAt: Number(b.addedAt),
  };
}

// To billing event
function toBillingEvent(e: any): BillingEvent {
  return {
    id: e.id,
    userId: e.userId,
    eventType: e.eventType as any,
    plan: (e.plan as any) || undefined,
    provider: e.provider,
    details: e.details ? JSON.parse(e.details as string) : undefined,
    ipAddress: (e.ipAddress as string) || undefined,
    createdAt: Number(e.createdAt),
  };
}

// To payment proof
function toPaymentProof(p: any): PaymentProof {
  return {
    id: p.id,
    userId: p.userId,
    plan: p.plan as any,
    interval: (p.interval as 'monthly' | 'yearly') || 'monthly',
    amountUsd: Number(p.amountUsd),
    currency: (p.currency as string) || 'USD',
    imageData: p.imageData,
    mimeType: p.mimeType,
    note: (p.note as string) || undefined,
    status: (p.status as ReceiptStatus) || 'pending',
    reviewedBy: (p.reviewedBy as string) || undefined,
    reviewedAt: p.reviewedAt ? Number(p.reviewedAt) : undefined,
    createdAt: Number(p.createdAt),
  };
}

// ── Facade ─────────────────────────────────────────────────────────────

//  database service
export class DatabaseService {
  // Instance property
  private static instance: DatabaseService;
  // Is initialized property
  private isInitialized = false;

  // User repo property
  private userRepo = new UserRepository();
  // Session repo property
  private sessionRepo = new SessionRepository();
  // Alert rule repo property
  private alertRuleRepo = new AlertRuleRepository();
  // Alert trigger repo property
  private alertTriggerRepo = new AlertTriggerRepository();
  // Watchlist repo property
  private watchlistRepo = new WatchlistRepository();
  // Blacklist repo property
  private blacklistRepo = new BlacklistRepository();
  // Telegram repo property
  private telegramRepo = new TelegramRepository();
  // Detected wall repo property
  private detectedWallRepo = new DetectedWallRepository();
  // Wall history repo property
  private wallHistoryRepo = new WallHistoryRepository();
  // Subscription repo property
  private subscriptionRepo = new SubscriptionRepository();
  // Notif repo property
  private notifRepo = new NotificationDeliveryRepository();
  // Payment proof repo property
  private paymentProofRepo = new PaymentProofRepository();
  // Memory store property
  private memoryStore = MemoryStore.getInstance();
  // Db available property
  private dbAvailable = true;
  // Health check interval property
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null;

  private constructor() {}

  // Get instance
  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────

  // Initialize
  public async initialize(): Promise<void> {
    if (this.isInitialized) return;
    await initSequelize();
    await this.syncSchema();
    this.isInitialized = true;
    logger.info('Sequelize connected to MySQL database');
  }

  // Sync schema to current models — additive only, never destructive.
  // Model changes are applied automatically, but existing tables/columns/data are
  // never dropped or rewritten, so user records, roles and sessions survive restarts.
  private async syncSchema(): Promise<void> {
    const queryInterface = sequelize.getQueryInterface();
    const models = Object.values(sequelize.models);

    for (const model of models) {
      const tableName = String(model.getTableName());
      try {
        let existingColumns: Record<string, any> | null = null;
        try {
          existingColumns = await queryInterface.describeTable(tableName);
        } catch {
          existingColumns = null;
        }

        // Table does not exist yet → create it (plus its indexes).
        if (!existingColumns) {
          await model.sync();
          logger.info(`[DB] Created missing table: ${tableName}`);
          continue;
        }

        // Table exists → add only the columns the model added since last run.
        const attributes = model.getAttributes();
        for (const [attributeName, attribute] of Object.entries(attributes)) {
          const columnName = (attribute as any).field || attributeName;
          if (!existingColumns[columnName]) {
            await queryInterface.addColumn(tableName, columnName, attribute as any);
            logger.info(`[DB] Added missing column: ${tableName}.${columnName}`);
          }
        }
      } catch (err: any) {
        // Log and keep going — a failed schema step must never delete anything.
        logger.error(`[DB] Schema update skipped for ${tableName}: ${err?.message || err}`);
      }
    }
  }

  // Run integrity check
  public async runIntegrityCheck(): Promise<void> {
    try {
      // For MySQL, simply check connection health
      await sequelize.authenticate();
      console.log('[DB] MySQL connection is healthy');
    } catch (e: any) {
      console.error('[DB] MySQL connection check error:', e.message);
    }
  }

  // Schedule persist
  public schedulePersist(): void {}
  // Persist to disk
  public persistToDisk(): void {}


  // Create user
  public async createUser(user: { email: string; passwordHash: string; passwordSalt: string; name: string; role?: UserRole; trialStartDate?: number; trialEndDate?: number }): Promise<UserProfile> {
    const id = `usr_${Math.random().toString(36).substring(2, 9)}`;
    const now = Date.now();
    // First-time registration defaults to the plain USER role.
    const role: UserRole = user.role || 'USER';
    const storedRole = String(role).toLowerCase();
    const trialStart = user.trialStartDate || now;
    const trialEnd = user.trialEndDate || (now + 3 * 24 * 60 * 60 * 1000);

    await this.userRepo.create({ id, email: user.email, passwordHash: user.passwordHash, passwordSalt: user.passwordSalt, name: user.name, role: storedRole, trialStartDate: trialStart, trialEndDate: trialEnd });

    // Initialize default settings
    await UserSettings.create({
      id: `set_${id}`,
      userId: id,
      theme: 'dark',
      decimalPrecision: 2,
      currency: 'USD',
      refreshRateMs: 1000,
      defaultCrossExchangeAggregation: 0,
      wallMinVolumeDefaultUsd: 500000,
      wallMinDurationDefaultSec: 15,
      wallDistanceDefaultPercent: 2.5,
      enabledExchanges: 'BINANCE,BYBIT,OKX,MEXC',
      soundEnabled: 1,
      updatedAt: now,
    } as any);

    // Initialize default watchlist
    const watchlistId = `wl_${Math.random().toString(36).substring(2, 9)}`;
    await this.watchlistRepo.create({ id: watchlistId, userId: id, name: 'My Favorites' });

    return { id, email: user.email, name: user.name, role, createdAt: now };
  }

  // Get user by email
  public async getUserByEmail(email: string): Promise<(UserProfile & { passwordHash: string; passwordSalt: string }) | null> {
    try {
      const user = await this.userRepo.findByEmail(email);
      if (!user) return null;
      return {
        ...toUserProfile(user),
        passwordHash: user.passwordHash,
        passwordSalt: user.passwordSalt,
      };
    } catch (error) {
      if (!this.dbAvailable || (error instanceof Error && error.message.includes('ECONNREFUSED'))) {
        this.dbAvailable = false;
        // Fallback to memory
        const user = this.memoryStore.findUserByEmail(email);
        if (!user) return null;
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role as UserRole,
          createdAt: user.createdAt,
          passwordHash: user.passwordHash,
          passwordSalt: user.passwordSalt,
        };
      }
      throw error;
    }
  }

  // Get user by id
  public async getUserById(id: string): Promise<UserProfile | null> {
    try {
      const user = await this.userRepo.findById(id);
      return user ? toUserProfile(user) : null;
    } catch (error) {
      if (!this.dbAvailable || (error instanceof Error && error.message.includes('ECONNREFUSED'))) {
        this.dbAvailable = false;
        const user = this.memoryStore.findUserById(id);
        return user ? { id: user.id, email: user.email, name: user.name, role: user.role as UserRole, createdAt: user.createdAt } : null;
      }
      throw error;
    }
  }

  // Create session (stores only the hashed refresh token)
  public async createSession(userId: string, tokenHash: string, expiresAt: number, ipAddress?: string, userAgent?: string, fingerprintHash?: string): Promise<void> {
    const id = `sess_${Math.random().toString(36).substring(2, 9)}`;
    await this.sessionRepo.create({ id, tokenHash, userId, expiresAt, ipAddress, userAgent, fingerprintHash });
  }

  // Get session by hashed refresh token
  public async getSessionByTokenHash(tokenHash: string): Promise<{ session: any; user: UserProfile } | null> {
    const result = await this.sessionRepo.findByTokenHash(tokenHash);
    if (!result) return null;
    return {
      session: {
        id: result.session.id,
        tokenHash: result.session.tokenHash,
        userId: result.session.userId,
        expiresAt: Number(result.session.expiresAt),
        revokedAt: result.session.revokedAt ? Number(result.session.revokedAt) : null,
        ipAddress: result.session.ipAddress,
        userAgent: result.session.userAgent,
        fingerprintHash: result.session.fingerprintHash,
      },
      user: toUserProfile(result.user),
    };
  }

  // Revoke session by hashed refresh token
  public async revokeSession(tokenHash: string): Promise<void> {
    await this.sessionRepo.revoke(tokenHash);
  }

  // Revoke all user sessions
  public async revokeAllUserSessions(userId: string): Promise<void> {
    await this.sessionRepo.revokeAllByUser(userId);
  }

  // Cleanup expired sessions
  public async cleanupExpiredSessions(): Promise<void> {
    await this.sessionRepo.cleanupExpired();
  }

  // Count active sessions
  public async countActiveSessions(userId: string): Promise<number> {
    return this.sessionRepo.countByUser(userId);
  }

  // Revoke oldest session
  public async revokeOldestSession(userId: string): Promise<void> {
    const sessions = await Session.findAll({
      where: { userId, revokedAt: null },
      order: [['createdAt', 'ASC']],
      limit: 1
    });
    if (sessions.length > 0) {
      await this.revokeSession(sessions[0].tokenHash);
    }
  }

  // ── Audit Logging ─────────────────────────────────────────────────────

  // Add audit log
  public async addAuditLog(entry: { userId: string; action: string; resource: string; resourceId?: string; details?: Record<string, any>; ipAddress?: string }): Promise<void> {
    const id = `aud_${Math.random().toString(36).substring(2, 9)}`;
    await this.userRepo.createAuditLog({
      id,
      userId: entry.userId,
      action: entry.action,
      resource: entry.resource,
      resourceId: entry.resourceId,
      detailsJson: entry.details ? JSON.stringify(entry.details) : undefined,
      ipAddress: entry.ipAddress,
    });
  }

  // Get audit logs
  public async getAuditLogs(limit = 100, userId?: string): Promise<AuditLogEntry[]> {
    const logs = await this.userRepo.findAuditLogs(limit, userId);
    return logs.map(toAuditLogEntry);
  }

  // ── User Settings ─────────────────────────────────────────────────────

  // Get user settings
  public async getUserSettings(userId: string): Promise<UserSettingsType> {
    const settings = await this.userRepo.findSettings(userId);
    if (!settings) {
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
        soundEnabled: true,
      };
    }
    return toUserSettings(settings);
  }

  // Update user settings
  public async updateUserSettings(settings: Partial<UserSettingsType>, userId: string): Promise<void> {
    const current = await this.getUserSettings(userId);
    const updated = { ...current, ...settings };
    await this.userRepo.upsertSettings(userId, {
      id: `set_${userId}`,
      userId,
      theme: updated.theme,
      decimalPrecision: updated.decimalPrecision,
      currency: updated.currency,
      refreshRateMs: updated.refreshRateMs,
      defaultPresetId: updated.defaultPresetId || null,
      defaultCrossExchangeAggregation: updated.defaultCrossExchangeAggregation ? 1 : 0,
      wallMinVolumeDefaultUsd: updated.wallMinVolumeDefaultUsd,
      wallMinDurationDefaultSec: updated.wallMinDurationDefaultSec,
      wallDistanceDefaultPercent: updated.wallDistanceDefaultPercent,
      enabledExchanges: updated.enabledExchanges.join(','),
      soundEnabled: updated.soundEnabled ? 1 : 0,
      telegramBotToken: updated.telegramBotToken || null,
      telegramChatId: updated.telegramChatId || null,
      emailRecipient: updated.emailRecipient || null,
      webhookUrl: updated.webhookUrl || null,
      finnhubApiKey: updated.finnhubApiKey || null,
      polygonApiKey: updated.polygonApiKey || null,
    });
  }

  // ── Telegram Linking ──────────────────────────────────────────────────

  // Create telegram link token
  public async createTelegramLinkToken(userId: string, tokenHash: string, ttlMs = 10 * 60 * 1000): Promise<{ id: string; expiresAt: number }> {
    const id = `tgl_${Math.random().toString(36).substring(2, 9)}`;
    const expiresAt = Date.now() + ttlMs;
    await this.telegramRepo.createToken({ id, userId, tokenHash, expiresAt });
    return { id, expiresAt };
  }

  // Get telegram link token by hash
  public async getTelegramLinkTokenByHash(tokenHash: string): Promise<{ id: string; userId: string; tokenHash: string; expiresAt: number; usedAt: number | null; createdAt: number } | null> {
    const token = await this.telegramRepo.findTokenByHash(tokenHash);
    if (!token) return null;
    return {
      id: token.id,
      userId: token.userId,
      tokenHash: token.tokenHash,
      expiresAt: Number(token.expiresAt),
      usedAt: token.usedAt ? Number(token.usedAt) : null,
      createdAt: Number(token.createdAt),
    };
  }

  // Mark telegram link token used
  public async markTelegramLinkTokenUsed(tokenId: string): Promise<void> {
    await this.telegramRepo.markTokenUsed(tokenId);
  }

  // Get user telegram link
  public async getUserTelegramLink(userId: string): Promise<UserTelegramLink | null> {
    const link = await this.telegramRepo.findByUser(userId);
    return link ? toTelegramLink(link) : null;
  }

  // Get telegram link by telegram user id
  public async getTelegramLinkByTelegramUserId(telegramUserId: string): Promise<UserTelegramLink | null> {
    const link = await this.telegramRepo.findByTelegramUserId(telegramUserId);
    return link ? toTelegramLink(link) : null;
  }

  // Get telegram link by chat id
  public async getTelegramLinkByChatId(chatId: string): Promise<UserTelegramLink | null> {
    const link = await this.telegramRepo.findByChatId(chatId);
    return link ? toTelegramLink(link) : null;
  }

  // Save user telegram link
  public async saveUserTelegramLink(link: { userId: string; telegramChatId: string; telegramUserId: string; telegramUsername?: string; enabled?: boolean }): Promise<UserTelegramLink> {
    const result = await this.telegramRepo.upsertLink(link);
    // Also sync to user_settings (upsert so new users without a settings row are covered)
    await this.updateUserSettings({ telegramChatId: String(link.telegramChatId) }, link.userId);
    return toTelegramLink(result);
  }

  // Disconnect user telegram
  public async disconnectUserTelegram(userId: string): Promise<void> {
    await this.telegramRepo.delete(userId);
    await UserSettings.update({ telegramChatId: null }, { where: { userId } });
  }

  // ── Watchlists ────────────────────────────────────────────────────────

  // Get watchlists
  public async getWatchlists(userId: string): Promise<WatchlistType[]> {
    const wls = await this.watchlistRepo.findByUser(userId);
    const result: WatchlistType[] = [];
    for (const wl of wls) {
      const items = await this.watchlistRepo.findItems(wl.id);
      result.push(toWatchlist(wl, items));
    }
    return result;
  }

  // Get watchlist by id
  public async getWatchlistById(watchlistId: string, userId: string): Promise<WatchlistType | null> {
    const wl = await this.watchlistRepo.findById(watchlistId, userId);
    if (!wl) return null;
    const items = await this.watchlistRepo.findItems(wl.id);
    return toWatchlist(wl, items);
  }

  // Create watchlist
  public async createWatchlist(name: string, userId: string): Promise<WatchlistType> {
    const id = `wl_${Math.random().toString(36).substring(2, 9)}`;
    const createdAt = Date.now();
    await this.watchlistRepo.create({ id, userId, name });
    return { id, name, items: [], createdAt };
  }

  // Delete watchlist
  public async deleteWatchlist(watchlistId: string, userId: string): Promise<boolean> {
    return this.watchlistRepo.delete(watchlistId, userId);
  }

  // Add watchlist item
  public async addWatchlistItem(watchlistId: string, item: Omit<WatchlistItemType, 'id' | 'addedAt'>, userId: string): Promise<WatchlistItemType | null> {
    // Verify ownership
    const wl = await this.watchlistRepo.findById(watchlistId, userId);
    if (!wl) return null;
    const id = `wli_${Math.random().toString(36).substring(2, 9)}`;
    const addedAt = Date.now();
    const created = await this.watchlistRepo.addItem({ id, watchlistId, symbol: item.symbol, exchange: item.exchange, marketType: item.marketType, notes: item.notes });
    return { id: created.id, symbol: created.symbol, exchange: created.exchange as any, marketType: created.marketType as any, notes: created.notes || undefined, addedAt: Number(created.addedAt) };
  }

  // Remove watchlist item
  public async removeWatchlistItem(watchlistId: string, symbol: string, exchange: string, marketType: string, userId: string): Promise<boolean> {
    // Verify ownership
    const wl = await this.watchlistRepo.findById(watchlistId, userId);
    if (!wl) return false;
    return this.watchlistRepo.removeItemByUnique(watchlistId, symbol, exchange, marketType);
  }

  // ── Global Blacklist ──────────────────────────────────────────────────

  // Get blacklist
  public async getBlacklist(): Promise<BlacklistEntry[]> {
    const entries = await this.blacklistRepo.findAll();
    return entries.map(toBlacklistEntry);
  }

  // Add blacklist entry
  public async addBlacklistEntry(entry: Omit<BlacklistEntry, 'id' | 'addedAt'>): Promise<BlacklistEntry> {
    const id = `blk_${Math.random().toString(36).substring(2, 9)}`;
    const created = await this.blacklistRepo.create({ id, ...entry });
    return { id, ...entry, addedAt: Number(created.addedAt) };
  }

  // Remove blacklist entry
  public async removeBlacklistEntry(id: string): Promise<void> {
    await this.blacklistRepo.delete(id);
  }

  // ── Alert Rules ───────────────────────────────────────────────────────

  // Get all alert rules across every registered user (engine-wide scan)
  public async getAllAlertRules(): Promise<AlertRule[]> {
    const rules = await this.alertRuleRepo.findAll();
    return rules.map(toAlertRule);
  }

  // Get alert rules
  public async getAlertRules(userId: string): Promise<AlertRule[]> {
    const rules = await this.alertRuleRepo.findByUser(userId);
    return rules.map(toAlertRule);
  }

  // Get alert rule by id
  public async getAlertRuleById(ruleId: string, userId: string): Promise<AlertRule | null> {
    const rule = await this.alertRuleRepo.findById(ruleId, userId);
    return rule ? toAlertRule(rule) : null;
  }

  // Save alert rule
  public async saveAlertRule(rule: Omit<AlertRule, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }, userId: string): Promise<AlertRule> {
    const now = Date.now();
    if (rule.id) {
      const existing = await this.alertRuleRepo.findById(rule.id, userId);
      if (!existing) {
        // Check if it exists under another user
        const allRules = await this.alertRuleRepo.findAll();
        const other = allRules.find(r => r.id === rule.id);
        if (other) {
          const error: any = new Error('Unauthorized to modify alert rule');
          error.statusCode = 403;
          throw error;
        }
      }
    }

    const id = rule.id || `rl_${Math.random().toString(36).substring(2, 9)}`;
    const created = await this.alertRuleRepo.create({
      id,
      userId,
      name: rule.name,
      enabled: rule.enabled ? 1 : 0,
      symbols: JSON.stringify(rule.symbols),
      exchanges: JSON.stringify(rule.exchanges),
      marketTypes: JSON.stringify(rule.marketTypes),
      logic: rule.logic,
      conditionsJson: JSON.stringify(rule.conditions),
      cooldownSeconds: rule.cooldownSeconds,
      notifyChannels: (rule.notifyChannels || ['IN_APP']).join(','),
    });

    return {
      ...rule,
      id,
      notifyChannels: rule.notifyChannels || ['IN_APP'],
      createdAt: now,
      updatedAt: now,
    };
  }

  // Create alert rule
  public async createAlertRule(rule: Omit<AlertRule, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }, userId: string): Promise<AlertRule> {
    return this.saveAlertRule(rule, userId);
  }

  // Update alert rule last triggered
  public async updateAlertRuleLastTriggered(ruleId: string, timestamp: number): Promise<void> {
    await this.alertRuleRepo.updateLastTriggered(ruleId, timestamp);
  }

  // Delete alert rule
  public async deleteAlertRule(ruleId: string, userId: string): Promise<boolean> {
    return this.alertRuleRepo.delete(ruleId, userId);
  }

  // ── Alert Triggers ────────────────────────────────────────────────────

  // Save alert trigger
  public async saveAlertTrigger(trigger: Omit<AlertTrigger, 'id'>, userId: string): Promise<AlertTrigger> {
    const id = `trg_${Math.random().toString(36).substring(2, 9)}`;
    const created = await this.alertTriggerRepo.create({
      id,
      userId,
      ruleId: trigger.ruleId,
      ruleName: trigger.ruleName,
      symbol: trigger.symbol,
      exchange: trigger.exchange,
      marketType: trigger.marketType,
      message: trigger.message,
      conditionType: trigger.conditionType,
      metricValue: String(trigger.metricValue),
      triggerPrice: trigger.triggerPrice,
      channel: trigger.channel,
    });
    return { ...trigger, id };
  }

  // Get alert triggers
  public async getAlertTriggers(limit: number, userId: string): Promise<AlertTrigger[]> {
    const triggers = await this.alertTriggerRepo.findByUser(userId, limit);
    return triggers.map(toAlertTrigger);
  }

  // Mark alert trigger read
  public async markAlertTriggerRead(triggerId: string | undefined, userId: string): Promise<void> {
    if (triggerId) {
      await this.alertTriggerRepo.markRead(triggerId, userId);
    } else {
      await this.alertTriggerRepo.markAllRead(userId);
    }
  }

  // Clear alert triggers
  public async clearAlertTriggers(userId: string): Promise<void> {
    await this.alertTriggerRepo.clear(userId);
  }

  // ── Filter Presets ────────────────────────────────────────────────────

  // Get filter presets
  public async getFilterPresets(userId: string): Promise<SavedFilterPreset[]> {
    const presets = await this.userRepo.findPresets(userId);
    return presets.map(p => ({
      id: p.id,
      name: p.name || '',
      isDefault: Boolean(p.isDefault),
      filters: JSON.parse(p.filtersJson || '{}'),
      createdAt: Number(p.createdAt),
    }));
  }

  // Save filter preset
  public async saveFilterPreset(preset: Omit<SavedFilterPreset, 'id' | 'createdAt'> & { id?: string }, userId: string): Promise<SavedFilterPreset> {
    const id = preset.id || `pst_${Math.random().toString(36).substring(2, 9)}`;
    const createdAt = Date.now();

    // Clear existing defaults
    if (preset.isDefault) {
      const existing = await this.userRepo.findPresets(userId);
      for (const ep of existing) {
        if (ep.isDefault) {
          await this.userRepo.deletePreset(ep.id, userId);
          await this.userRepo.createPreset({ id: ep.id, userId, name: ep.name || undefined, isDefault: 0, filtersJson: ep.filtersJson });
        }
      }
    }

    await this.userRepo.createPreset({ id, userId, name: preset.name, isDefault: preset.isDefault ? 1 : 0, filtersJson: JSON.stringify(preset.filters) });
    return { id, ...preset, createdAt };
  }

  // Delete filter preset
  public async deleteFilterPreset(presetId: string, userId: string): Promise<boolean> {
    return this.userRepo.deletePreset(presetId, userId);
  }

  // ── Wall Persistence & History ────────────────────────────────────────

  // Save wall record
  public async saveWallRecord(wall: DetectedWall): Promise<void> {
    await this.detectedWallRepo.upsert(wall as any);
  }

  // Record wall historical outcome
  public async recordWallHistoricalOutcome(wall: DetectedWall, finalState: 'REMOVED' | 'FILLED', fillPercentage = 0): Promise<void> {
    const historyId = `wh_${wall.id}`;
    const now = Date.now();

    await this.wallHistoryRepo.create({
      id: historyId,
      symbol: wall.symbol,
      exchange: wall.exchange,
      marketType: wall.marketType,
      side: wall.side,
      price: wall.price,
      volumeUsd: wall.volumeUsd,
      referencePrice: wall.referencePrice,
      distancePercent: wall.distancePercent,
      firstSeenAt: wall.firstSeenAt,
      lastSeenAt: wall.lastSeenAt,
      durationSeconds: wall.durationSeconds,
      finalState,
      fillPercentage,
      peakVolumeUsd: wall.peakVolumeUsd,
      isAggregated: wall.isAggregated ? 1 : 0,
    } as any);

    // Update daily aggregates
    await this.updateDailyAggregate(wall, finalState);
  }

  // Update daily aggregate
  private async updateDailyAggregate(wall: DetectedWall, finalState: 'REMOVED' | 'FILLED'): Promise<void> {
    const dateStr = new Date().toISOString().split('T')[0];
    const exchange = wall.isAggregated ? 'AGGREGATED' : wall.exchange;

    const existing = await this.wallHistoryRepo.findDaily(dateStr, wall.symbol, exchange, wall.marketType);
    if (!existing) {
      await this.wallHistoryRepo.upsertDaily(dateStr, {
        id: `agg_${dateStr}_${wall.symbol}_${exchange}_${wall.marketType}`,
        date: dateStr,
        symbol: wall.symbol,
        exchange,
        marketType: wall.marketType,
        wallCount: 1,
        bidWallCount: wall.side === 'BID' ? 1 : 0,
        askWallCount: wall.side === 'ASK' ? 1 : 0,
        avgVolumeUsd: wall.volumeUsd,
        peakVolumeUsd: wall.peakVolumeUsd,
        avgDurationSeconds: wall.durationSeconds,
        filledCount: finalState === 'FILLED' ? 1 : 0,
        removedCount: finalState === 'REMOVED' ? 1 : 0,
        createdAt: Date.now(),
      } as any);
    } else {
      const currentCount = existing.wallCount;
      const newCount = currentCount + 1;
      const newAvgVol = (existing.avgVolumeUsd * currentCount + wall.volumeUsd) / newCount;
      const newPeak = Math.max(existing.peakVolumeUsd, wall.peakVolumeUsd);
      const newAvgDur = (existing.avgDurationSeconds * currentCount + wall.durationSeconds) / newCount;

      await this.wallHistoryRepo.upsertDaily(dateStr, {
        id: existing.id,
        date: dateStr,
        symbol: wall.symbol,
        exchange,
        marketType: wall.marketType,
        wallCount: newCount,
        bidWallCount: existing.bidWallCount + (wall.side === 'BID' ? 1 : 0),
        askWallCount: existing.askWallCount + (wall.side === 'ASK' ? 1 : 0),
        avgVolumeUsd: newAvgVol,
        peakVolumeUsd: newPeak,
        avgDurationSeconds: newAvgDur,
        filledCount: existing.filledCount + (finalState === 'FILLED' ? 1 : 0),
        removedCount: existing.removedCount + (finalState === 'REMOVED' ? 1 : 0),
      } as any);
    }
  }

  // Get wall history
  public async getWallHistory(symbol?: string, exchange?: string, limit = 100): Promise<HistoricalWallRecord[]> {
    const records = await this.wallHistoryRepo.findRecent(symbol, exchange, limit);
    return records.map(toHistoricalWall);
  }

  // Get daily wall aggregates
  public async getDailyWallAggregates(days = 30): Promise<DailyWallAggregate[]> {
    const aggregates = await this.wallHistoryRepo.findRecentAggregates(days);
    return aggregates.map(toDailyAggregate);
  }

  // Clean old wall history
  public async cleanOldWallHistory(retentionDays = 90): Promise<void> {
    await this.wallHistoryRepo.cleanOld(retentionDays);
  }

  // ── Subscription & Billing ────────────────────────────────────────────

  // Get user subscription
  public async getUserSubscription(userId: string): Promise<UserSubscription> {
    const sub = await this.subscriptionRepo.findByUser(userId);
    if (!sub) {
      // Auto-create FREE subscription
      const now = Date.now();
      const defaultSub: UserSubscription = {
        userId,
        plan: 'FREE',
        status: 'active',
        billingProvider: 'manual',
        currentPeriodStart: now,
        currentPeriodEnd: now + 365 * 24 * 60 * 60 * 1000,
        cancelAtPeriodEnd: false,
        createdAt: now,
        updatedAt: now,
      };
      await this.subscriptionRepo.upsert(defaultSub as any);
      return defaultSub;
    }
    return toSubscription(sub);
  }

  // Save user subscription
  public async saveUserSubscription(sub: UserSubscription): Promise<void> {
    await this.subscriptionRepo.upsert(sub as any);
  }

  // Update subscription plan
  public async updateSubscriptionPlan(userId: string, plan: SubscriptionPlanId, status: SubscriptionStatus = 'active', provider = 'stripe', externalSubId?: string, externalCustId?: string): Promise<UserSubscription> {
    const existing = await this.getUserSubscription(userId);
    const updated: UserSubscription = {
      ...existing,
      plan,
      status,
      billingProvider: provider,
      externalSubscriptionId: externalSubId || existing.externalSubscriptionId,
      externalCustomerId: externalCustId || existing.externalCustomerId,
      updatedAt: Date.now(),
    };
    await this.subscriptionRepo.upsert(updated as any);
    return updated;
  }

  // Update user subscription
  public async updateUserSubscription(userId: string, updates: Partial<UserSubscription>): Promise<UserSubscription> {
    const existing = await this.getUserSubscription(userId);
    const updated: UserSubscription = {
      ...existing,
      ...updates,
      userId,
      updatedAt: Date.now(),
    };
    await this.subscriptionRepo.upsert(updated as any);
    return updated;
  }

  // ── Billing Events ────────────────────────────────────────────────────

  // Record billing event
  public async recordBillingEvent(event: Omit<BillingEvent, 'id' | 'createdAt'>): Promise<BillingEvent> {
    const id = `bevt_${crypto.randomUUID().substring(0, 12)}`;
    const created = await this.subscriptionRepo.createBillingEvent({
      id,
      userId: event.userId,
      eventType: event.eventType,
      plan: event.plan,
      provider: event.provider,
      details: event.details ? JSON.stringify(event.details) : undefined,
      ipAddress: event.ipAddress,
    });
    return { ...event, id, createdAt: Number(created.createdAt) };
  }

  // Get billing events
  public async getBillingEvents(userId: string, limit = 50): Promise<BillingEvent[]> {
    const events = await this.subscriptionRepo.findBillingEvents(userId, limit);
    return events.map(toBillingEvent);
  }

  // Is webhook event processed
  public async isWebhookEventProcessed(eventId: string): Promise<boolean> {
    return this.subscriptionRepo.isWebhookProcessed(eventId);
  }

  // Record webhook event
  public async recordWebhookEvent(eventId: string, provider: string, eventType: string, payloadHash?: string, status = 'PROCESSED'): Promise<void> {
    await this.subscriptionRepo.recordWebhook({ eventId, provider, eventType, payloadHash, status });
  }

  // ── Payment Proofs (manual QR receipts) ──────────────────────────────

  // Create payment proof
  public async createPaymentProof(data: {
    userId: string;
    plan: SubscriptionPlanId;
    interval: 'monthly' | 'yearly';
    amountUsd: number;
    currency?: string;
    imageData: string;
    mimeType: string;
    note?: string;
  }): Promise<PaymentProof> {
    const id = `proof_${crypto.randomUUID().substring(0, 12)}`;
    const created = await this.paymentProofRepo.create({
      id,
      userId: data.userId,
      plan: data.plan,
      interval: data.interval,
      amountUsd: data.amountUsd,
      currency: data.currency || 'USD',
      imageData: data.imageData,
      mimeType: data.mimeType,
      note: data.note || null,
      status: 'pending',
    } as any);
    return toPaymentProof(created);
  }

  // Get payment proofs by user
  public async getPaymentProofsByUser(userId: string, limit = 10): Promise<PaymentProof[]> {
    const proofs = await this.paymentProofRepo.findByUser(userId, limit);
    return proofs.map(toPaymentProof);
  }

  // Get all payment proofs
  public async getAllPaymentProofs(limit = 200): Promise<PaymentProof[]> {
    const proofs = await this.paymentProofRepo.findAll(limit);
    return proofs.map(toPaymentProof);
  }

  // Get payment proof by id
  public async getPaymentProofById(id: string): Promise<PaymentProof | null> {
    const proof = await this.paymentProofRepo.findById(id);
    return proof ? toPaymentProof(proof) : null;
  }

  // Update payment proof status (guarded by expectedStatus to prevent double-processing)
  public async updatePaymentProofStatus(id: string, status: 'pending' | 'approved' | 'rejected', reviewedBy?: string, expectedStatus?: 'pending' | 'approved' | 'rejected'): Promise<PaymentProof | null> {
    const updated = await this.paymentProofRepo.updateStatus(id, status, reviewedBy, expectedStatus);
    return updated ? toPaymentProof(updated) : null;
  }

  // ── Notification Delivery Queue ───────────────────────────────────────

  // Record notification delivery
  public async recordNotificationDelivery(delivery: Partial<NotificationDelivery> & { userId: string; channel: any; destination?: string }): Promise<NotificationDelivery> {
    const id = delivery.id || `notif_${crypto.randomUUID().substring(0, 16)}`;
    const now = delivery.createdAt || Date.now();

    // INSERT OR REPLACE semantics: find by id and update, or create
    const existing = await this.notifRepo.findById(id);
    if (existing) {
      await this.notifRepo.update(id, {
        status: delivery.status || 'pending',
        attempts: delivery.attempts ?? existing.attempts,
        nextAttemptAt: delivery.nextAttemptAt ?? existing.nextAttemptAt,
        lastAttemptAt: delivery.lastAttemptAt ?? existing.lastAttemptAt,
        deliveredAt: delivery.deliveredAt ?? existing.deliveredAt,
        lastError: delivery.lastError ?? existing.lastError,
      } as any);
    } else {
      await this.notifRepo.create({
        id,
        userId: delivery.userId,
        channel: delivery.channel,
        alertTriggerId: delivery.alertTriggerId,
        destination: delivery.destination,
        status: delivery.status || 'pending',
        maxAttempts: delivery.maxAttempts || 4,
        nextAttemptAt: delivery.nextAttemptAt,
        lastAttemptAt: delivery.lastAttemptAt,
        deliveredAt: delivery.deliveredAt,
        lastError: delivery.lastError,
        payload: delivery.payload ? JSON.stringify(delivery.payload) : undefined,
      } as any);
    }

    return {
      id,
      userId: delivery.userId,
      channel: delivery.channel,
      destination: delivery.destination || '',
      status: delivery.status || 'pending',
      attempts: existing ? existing.attempts : 0,
      maxAttempts: delivery.maxAttempts || 4,
      createdAt: now,
      ...delivery,
    } as any;
  }

  // Create notification delivery
  public async createNotificationDelivery(delivery: Omit<NotificationDelivery, 'id' | 'createdAt' | 'attempts'>): Promise<NotificationDelivery> {
    const id = `notif_${crypto.randomUUID().substring(0, 16)}`;
    const now = Date.now();
    const created = await this.notifRepo.create({
      id,
      userId: delivery.userId,
      channel: delivery.channel,
      alertTriggerId: delivery.alertTriggerId,
      destination: delivery.destination,
      status: delivery.status || 'pending',
      maxAttempts: delivery.maxAttempts || 4,
      nextAttemptAt: delivery.nextAttemptAt || now,
      lastAttemptAt: delivery.lastAttemptAt,
      deliveredAt: delivery.deliveredAt,
      lastError: delivery.lastError,
      payload: delivery.payload ? JSON.stringify(delivery.payload) : undefined,
    } as any);
    return {
      ...delivery,
      id,
      attempts: 0,
      maxAttempts: delivery.maxAttempts || 4,
      createdAt: now,
    };
  }

  // Get pending notification deliveries
  public async getPendingNotificationDeliveries(limit = 25): Promise<NotificationDelivery[]> {
    const deliveries = await this.notifRepo.findPending(limit);
    return deliveries.map(toNotificationDelivery);
  }

  // Update notification delivery
  public async updateNotificationDelivery(id: string, updates: Partial<Pick<NotificationDelivery, 'status' | 'attempts' | 'nextAttemptAt' | 'lastAttemptAt' | 'deliveredAt' | 'lastError'>>): Promise<void> {
    await this.notifRepo.update(id, updates as any);
  }

  // Get notification delivery by id
  public async getNotificationDeliveryById(id: string): Promise<NotificationDelivery | null> {
    const n = await this.notifRepo.findById(id);
    return n ? toNotificationDelivery(n) : null;
  }

  // Get notification deliveries
  public async getNotificationDeliveries(status?: string, limit = 100): Promise<NotificationDelivery[]> {
    const deliveries = status
      ? await this.notifRepo.findByStatus(status, limit)
      : await this.notifRepo.findByStatus('', limit);
    // findByStatus with empty string returns all
    if (!status) {
      return deliveries.map(toNotificationDelivery);
    }
    return deliveries.map(toNotificationDelivery);
  }

  // Get failed notification deliveries
  public async getFailedNotificationDeliveries(limit = 100): Promise<NotificationDelivery[]> {
    const deliveries = await this.notifRepo.findFailed(limit);
    return deliveries.map(toNotificationDelivery);
  }

  // Get notification delivery count24h
  public async getNotificationDeliveryCount24h(userId: string): Promise<number> {
    return this.notifRepo.countRecentByUser(userId);
  }

  // ── Admin Queries ─────────────────────────────────────────────────────

  // Get all users with details
  public async getAllUsersWithDetails(): Promise<Array<{ id: string; email: string; name: string; role: UserRole; plan: SubscriptionPlanId; subscriptionStatus: SubscriptionStatus; createdAt: number; activeAlertsCount: number; watchlistItemsCount: number }>> {
    const [rows]: any = await sequelize.query(`
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
    return rows.map((r: any) => ({
      id: r.id,
      email: r.email,
      name: r.name,
      role: r.role as UserRole,
      plan: (r.plan as SubscriptionPlanId) || 'FREE',
      subscriptionStatus: (r.sub_status as SubscriptionStatus) || 'active',
      createdAt: Number(r.created_at),
      activeAlertsCount: Number(r.active_alerts) || 0,
      watchlistItemsCount: Number(r.wl_items) || 0,
    }));
  }

  // Get all users
  public async getAllUsers(): Promise<UserProfile[]> {
    const users = await this.userRepo.findAll();
    return users.map(toUserProfile);
  }

  // Update user role
  public async updateUserRole(userId: string, newRole: UserRole): Promise<void> {
    // Store the lowercase enum value used by the DB; reads are upper-cased by the mapper.
    await this.userRepo.updateRole(userId, String(newRole).toLowerCase());
  }

  // ── GDPR / User Data ──────────────────────────────────────────────────

  // Export user data
  public async exportUserData(userId: string): Promise<object> {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new Error(`User not found: ${userId}`);

    const settings = await this.userRepo.findSettings(userId);
    const watchlists = await this.getWatchlists(userId);
    const alertRules = await this.getAlertRules(userId);
    const alertTriggers = await this.getAlertTriggers(1000, userId);
    const subscription = await this.getUserSubscription(userId);
    const billingEvents = await this.getBillingEvents(userId, 1000);
    const auditLogs = await this.getAuditLogs(1000, userId);
    const telegramLink = await this.getUserTelegramLink(userId);
    const blacklist = await this.getBlacklist(); // global, not per user, but include if user has entries? Actually blacklist is global, but we can include user-specific items? The blacklist is global so we skip.

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        createdAt: user.createdAt,
      },
      settings: settings || null,
      watchlists,
      alertRules,
      alertTriggers,
      subscription,
      billingEvents,
      auditLogs,
      telegramLink,
    };
  }

  // Check whether an email is permanently deleted (tombstone)
  public async isEmailPermanentlyDeleted(email: string): Promise<boolean> {
    try {
      const row = await DeletedAccountModel.findOne({ where: { email: email.toLowerCase().trim() } });
      return Boolean(row);
    } catch {
      return false;
    }
  }

  // Mark an email as permanently deleted (blocks re-registration)
  public async markEmailPermanentlyDeleted(email: string, transaction?: any): Promise<void> {
    const normalized = email.toLowerCase().trim();
    const existing = await DeletedAccountModel.findOne({ where: { email: normalized }, transaction });
    if (existing) return;
    await DeletedAccountModel.create(
      {
        id: `del_${Math.random().toString(36).substring(2, 11)}`,
        email: normalized,
        deletedAt: Date.now(),
      } as any,
      { transaction }
    );
  }

  // Delete user account (permanent wipe + email tombstone)
  public async deleteUserAccount(userId: string): Promise<void> {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new Error(`User not found: ${userId}`);

    // Use transaction to ensure all-or-nothing
    const transaction = await sequelize.transaction();

    try {
      // Delete all related data
      // 1. Watchlist items and watchlists
      const watchlists = await this.watchlistRepo.findByUser(userId);
      for (const wl of watchlists) {
        await WatchlistItem.destroy({ where: { watchlistId: wl.id }, transaction });
        await Watchlist.destroy({ where: { id: wl.id, userId }, transaction });
      }

      // 2. Alert rules and triggers
      const rules = await this.alertRuleRepo.findByUser(userId);
      for (const rule of rules) {
        await AlertTriggerModel.destroy({ where: { ruleId: rule.id }, transaction });
        await AlertRuleModel.destroy({ where: { id: rule.id, userId }, transaction });
      }
      // Triggers: delete by userId
      await AlertTriggerModel.destroy({ where: { userId }, transaction });

      // 3. Subscription and billing events
      await SubscriptionModel.destroy({ where: { userId }, transaction });
      await BillingEventModel.destroy({ where: { userId }, transaction });

      // 4. Notification deliveries
      await NotificationDeliveryModel.destroy({ where: { userId }, transaction });

      // 5. Telegram link + pending link tokens
      await UserTelegramLinkModel.destroy({ where: { userId }, transaction });
      await TelegramLinkTokenModel.destroy({ where: { userId }, transaction });

      // 6. Payment proofs (manual QR receipts)
      await PaymentProofModel.destroy({ where: { userId }, transaction });

      // 7. User settings + saved filter presets
      await UserSettings.destroy({ where: { userId }, transaction });
      await SavedFilterPresetModel.destroy({ where: { userId }, transaction });

      // 8. Audit logs
      await AuditLogModel.destroy({ where: { userId }, transaction });

      // 9. Sessions
      await Session.destroy({ where: { userId }, transaction });

      // 10. Tombstone the email BEFORE dropping the user row so this address
      //     can never be registered again (permanent deletion guarantee).
      if (user.email) {
        await this.markEmailPermanentlyDeleted(user.email, transaction);
      }

      // 11. Finally delete the user
      await User.destroy({ where: { id: userId }, transaction });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  // ── Shutdown ──────────────────────────────────────────────────────────

  // Close
  public async close(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    await closeSequelize();
    this.isInitialized = false;
  }
}