import crypto from 'crypto';


//  memory user
interface MemoryUser {
  id: string;
  email: string;
  passwordHash: string;
  passwordSalt: string;
  name: string;
  role: string;
  createdAt: number;
  updatedAt: number;
}

//  memory session
interface MemorySession {
  id: string;
  token: string;
  userId: string;
  expiresAt: number;
  revokedAt: number | null;
  ipAddress?: string;
  userAgent?: string;
}

//  memory alert rule
interface MemoryAlertRule {
  id: string;
  userId: string;
  name: string;
  enabled: number;
  symbols: string;
  exchanges: string;
  marketTypes: string;
  logic: string;
  conditionsJson: string;
  cooldownSeconds: number;
  lastTriggeredAt: number | null;
  notifyChannels: string;
  createdAt: number;
  updatedAt: number;
}

//  memory alert trigger
interface MemoryAlertTrigger {
  id: string;
  userId: string;
  ruleId: string;
  ruleName: string;
  symbol: string;
  exchange: string;
  marketType: string;
  message: string;
  conditionType: string;
  metricValue: string;
  triggerPrice: number;
  channel: string;
  read: number;
  timestamp: number;
}

//  memory watchlist
interface MemoryWatchlist {
  id: string;
  userId: string;
  name: string;
  createdAt: number;
}

//  memory watchlist item
interface MemoryWatchlistItem {
  id: string;
  watchlistId: string;
  symbol: string;
  exchange: string;
  marketType: string;
  notes?: string;
  addedAt: number;
}

//  memory subscription
interface MemorySubscription {
  userId: string;
  plan: string;
  status: string;
  billingProvider: string;
  externalCustomerId?: string;
  externalSubscriptionId?: string;
  currentPeriodStart: number;
  currentPeriodEnd: number;
  cancelAtPeriodEnd: number;
  trialEndsAt?: number;
  createdAt: number;
  updatedAt: number;
}

//  memory billing event
interface MemoryBillingEvent {
  id: string;
  userId: string;
  eventType: string;
  plan?: string;
  provider: string;
  details?: string;
  ipAddress?: string;
  createdAt: number;
}

//  memory notification delivery
interface MemoryNotificationDelivery {
  id: string;
  userId: string;
  alertTriggerId?: string;
  channel: string;
  destination: string;
  status: string;
  attempts: number;
  maxAttempts: number;
  nextAttemptAt?: number;
  lastAttemptAt?: number;
  deliveredAt?: number;
  lastError?: string;
  payload?: string;
  createdAt: number;
}

//  memory blacklist entry
interface MemoryBlacklistEntry {
  id: string;
  symbol?: string;
  exchange?: string;
  category?: string;
  reason: string;
  addedAt: number;
}

//  memory telegram link
interface MemoryTelegramLink {
  userId: string;
  telegramChatId: string;
  telegramUserId: string;
  telegramUsername?: string;
  linkedAt: number;
  enabled: number;
}

//  memory audit log
interface MemoryAuditLog {
  id: string;
  userId: string;
  action: string;
  resource: string;
  resourceId?: string;
  detailsJson?: string;
  ipAddress?: string;
  createdAt: number;
}

//  memory user settings
interface MemoryUserSettings {
  id: string;
  userId: string;
  theme: string;
  decimalPrecision: number;
  currency: string;
  refreshRateMs: number;
  defaultPresetId?: string;
  defaultCrossExchangeAggregation: number;
  wallMinVolumeDefaultUsd: number;
  wallMinDurationDefaultSec: number;
  wallDistanceDefaultPercent: number;
  enabledExchanges: string;
  soundEnabled: number;
  telegramBotToken?: string;
  telegramChatId?: string;
  emailRecipient?: string;
  webhookUrl?: string;
  finnhubApiKey?: string;
  polygonApiKey?: string;
  updatedAt: number;
}

//  memory saved filter preset
interface MemorySavedFilterPreset {
  id: string;
  userId: string;
  name: string;
  isDefault: number;
  filtersJson: string;
  createdAt: number;
}

// ─── In-Memory Store ────────────────────────

//  memory store
export class MemoryStore {
  // Instance property
  private static instance: MemoryStore;
  // Users property
  private users = new Map<string, MemoryUser>();
  // Sessions property
  private sessions = new Map<string, MemorySession>();
  // Alert rules property
  private alertRules = new Map<string, MemoryAlertRule>();
  // Alert triggers property
  private alertTriggers = new Map<string, MemoryAlertTrigger>();
  // Watchlists property
  private watchlists = new Map<string, MemoryWatchlist>();
  // Watchlist items property
  private watchlistItems = new Map<string, MemoryWatchlistItem>();
  // Subscriptions property
  private subscriptions = new Map<string, MemorySubscription>();
  // Billing events property
  private billingEvents = new Map<string, MemoryBillingEvent>();
  // Notifications property
  private notifications = new Map<string, MemoryNotificationDelivery>();
  // Blacklist property
  private blacklist = new Map<string, MemoryBlacklistEntry>();
  // Telegram links property
  private telegramLinks = new Map<string, MemoryTelegramLink>();
  // Audit logs property
  private auditLogs = new Map<string, MemoryAuditLog>();
  // User settings property
  private userSettings = new Map<string, MemoryUserSettings>();
  // Filter presets property
  private filterPresets = new Map<string, MemorySavedFilterPreset>();
  // Webhook events property
  private webhookEvents = new Set<string>();

  private constructor() {}

  // Get instance
  public static getInstance(): MemoryStore {
    if (!MemoryStore.instance) {
      MemoryStore.instance = new MemoryStore();
    }
    return MemoryStore.instance;
  }

  // ── Users ──────────────────────────────────

  // Find user by id
  public findUserById(id: string): MemoryUser | undefined {
    return this.users.get(id);
  }

  // Find user by email
  public findUserByEmail(email: string): MemoryUser | undefined {
    for (const user of this.users.values()) {
      if (user.email === email) return user;
    }
    return undefined;
  }

  // Find all users
  public findAllUsers(): MemoryUser[] {
    return Array.from(this.users.values());
  }

  // Save user
  public saveUser(user: MemoryUser): void {
    this.users.set(user.id, user);
  }

  // Delete user
  public deleteUser(id: string): void {
    this.users.delete(id);
  }

  // Count users
  public countUsers(): number {
    return this.users.size;
  }

  // ── Sessions ──────────────────────────────

  // Find session by token
  public findSessionByToken(token: string): MemorySession | undefined {
    for (const session of this.sessions.values()) {
      if (session.token === token && !session.revokedAt) return session;
    }
    return undefined;
  }

  // Find sessions by user
  public findSessionsByUser(userId: string): MemorySession[] {
    const result: MemorySession[] = [];
    for (const session of this.sessions.values()) {
      if (session.userId === userId) result.push(session);
    }
    return result;
  }

  // Save session
  public saveSession(session: MemorySession): void {
    this.sessions.set(session.id, session);
  }

  // Revoke session
  public revokeSession(token: string): void {
    for (const session of this.sessions.values()) {
      if (session.token === token && !session.revokedAt) {
        session.revokedAt = Date.now();
        break;
      }
    }
  }

  // Delete sessions by user
  public deleteSessionsByUser(userId: string): void {
    for (const [key, session] of this.sessions.entries()) {
      if (session.userId === userId) this.sessions.delete(key);
    }
  }

  // Cleanup expired sessions
  public cleanupExpiredSessions(): void {
    const now = Date.now();
    for (const [key, session] of this.sessions.entries()) {
      if (session.expiresAt <= now || session.revokedAt) {
        this.sessions.delete(key);
      }
    }
  }

  // ── Alert Rules ────────────────────────────

  // Find alert rule by id
  public findAlertRuleById(id: string): MemoryAlertRule | undefined {
    return this.alertRules.get(id);
  }

  // Find alert rules by user
  public findAlertRulesByUser(userId: string): MemoryAlertRule[] {
    const result: MemoryAlertRule[] = [];
    for (const rule of this.alertRules.values()) {
      if (rule.userId === userId) result.push(rule);
    }
    return result;
  }

  // Find all alert rules
  public findAllAlertRules(): MemoryAlertRule[] {
    return Array.from(this.alertRules.values());
  }

  // Save alert rule
  public saveAlertRule(rule: MemoryAlertRule): void {
    this.alertRules.set(rule.id, rule);
  }

  // Delete alert rule
  public deleteAlertRule(id: string): void {
    this.alertRules.delete(id);
  }

  // Update alert rule last triggered
  public updateAlertRuleLastTriggered(id: string, timestamp: number): void {
    const rule = this.alertRules.get(id);
    if (rule) rule.lastTriggeredAt = timestamp;
  }

  // ── Alert Triggers ─────────────────────────

  // Find alert triggers by user
  public findAlertTriggersByUser(userId: string, limit: number): MemoryAlertTrigger[] {
    const result: MemoryAlertTrigger[] = [];
    for (const trigger of this.alertTriggers.values()) {
      if (trigger.userId === userId) result.push(trigger);
    }
    result.sort((a, b) => b.timestamp - a.timestamp);
    return result.slice(0, limit);
  }

  // Save alert trigger
  public saveAlertTrigger(trigger: MemoryAlertTrigger): void {
    this.alertTriggers.set(trigger.id, trigger);
  }

  // Mark alert trigger read
  public markAlertTriggerRead(id: string, userId: string): void {
    const trigger = this.alertTriggers.get(id);
    if (trigger && trigger.userId === userId) trigger.read = 1;
  }

  // Mark all alert triggers read
  public markAllAlertTriggersRead(userId: string): void {
    for (const trigger of this.alertTriggers.values()) {
      if (trigger.userId === userId) trigger.read = 1;
    }
  }

  // Clear alert triggers
  public clearAlertTriggers(userId: string): void {
    for (const [key, trigger] of this.alertTriggers.entries()) {
      if (trigger.userId === userId) this.alertTriggers.delete(key);
    }
  }

  // Delete alert triggers by user
  public deleteAlertTriggersByUser(userId: string): void {
    for (const [key, trigger] of this.alertTriggers.entries()) {
      if (trigger.userId === userId) this.alertTriggers.delete(key);
    }
  }

  // ── Watchlists ─────────────────────────────

  // Find watchlists by user
  public findWatchlistsByUser(userId: string): MemoryWatchlist[] {
    const result: MemoryWatchlist[] = [];
    for (const wl of this.watchlists.values()) {
      if (wl.userId === userId) result.push(wl);
    }
    return result;
  }

  // Find watchlist by id
  public findWatchlistById(id: string, userId?: string): MemoryWatchlist | undefined {
    const wl = this.watchlists.get(id);
    if (wl && (!userId || wl.userId === userId)) return wl;
    return undefined;
  }

  // Save watchlist
  public saveWatchlist(wl: MemoryWatchlist): void {
    this.watchlists.set(wl.id, wl);
  }

  // Delete watchlist
  public deleteWatchlist(id: string): void {
    // Delete items too
    for (const [key, item] of this.watchlistItems.entries()) {
      if (item.watchlistId === id) this.watchlistItems.delete(key);
    }
    this.watchlists.delete(id);
  }

  // Find watchlist items
  public findWatchlistItems(watchlistId: string): MemoryWatchlistItem[] {
    const result: MemoryWatchlistItem[] = [];
    for (const item of this.watchlistItems.values()) {
      if (item.watchlistId === watchlistId) result.push(item);
    }
    return result;
  }

  // Find watchlist item by unique
  public findWatchlistItemByUnique(watchlistId: string, symbol: string, exchange: string, marketType: string): MemoryWatchlistItem | undefined {
    for (const item of this.watchlistItems.values()) {
      if (item.watchlistId === watchlistId && item.symbol === symbol && item.exchange === exchange && item.marketType === marketType) {
        return item;
      }
    }
    return undefined;
  }

  // Save watchlist item
  public saveWatchlistItem(item: MemoryWatchlistItem): void {
    this.watchlistItems.set(item.id, item);
  }

  // Delete watchlist item
  public deleteWatchlistItem(id: string): void {
    this.watchlistItems.delete(id);
  }

  // Delete watchlist items by user
  public deleteWatchlistItemsByUser(userId: string): void {
    // Get all watchlist IDs for user
    const wlIds = new Set<string>();
    for (const wl of this.watchlists.values()) {
      if (wl.userId === userId) wlIds.add(wl.id);
    }
    for (const [key, item] of this.watchlistItems.entries()) {
      if (wlIds.has(item.watchlistId)) this.watchlistItems.delete(key);
    }
  }

  // ── Subscriptions ──────────────────────────

  // Find subscription by user
  public findSubscriptionByUser(userId: string): MemorySubscription | undefined {
    return this.subscriptions.get(userId);
  }

  // Save subscription
  public saveSubscription(sub: MemorySubscription): void {
    this.subscriptions.set(sub.userId, sub);
  }

  // Delete subscription by user
  public deleteSubscriptionByUser(userId: string): void {
    this.subscriptions.delete(userId);
  }

  // ── Billing Events ─────────────────────────

  // Find billing events by user
  public findBillingEventsByUser(userId: string, limit: number): MemoryBillingEvent[] {
    const result: MemoryBillingEvent[] = [];
    for (const evt of this.billingEvents.values()) {
      if (evt.userId === userId) result.push(evt);
    }
    result.sort((a, b) => b.createdAt - a.createdAt);
    return result.slice(0, limit);
  }

  // Save billing event
  public saveBillingEvent(evt: MemoryBillingEvent): void {
    this.billingEvents.set(evt.id, evt);
  }

  // Delete billing events by user
  public deleteBillingEventsByUser(userId: string): void {
    for (const [key, evt] of this.billingEvents.entries()) {
      if (evt.userId === userId) this.billingEvents.delete(key);
    }
  }

  // ── Webhook Events ─────────────────────────

  // Is webhook event processed
  public isWebhookEventProcessed(eventId: string): boolean {
    return this.webhookEvents.has(eventId);
  }

  // Record webhook event
  public recordWebhookEvent(eventId: string): void {
    this.webhookEvents.add(eventId);
  }

  // ── Notifications ──────────────────────────

  // Find notification by id
  public findNotificationById(id: string): MemoryNotificationDelivery | undefined {
    return this.notifications.get(id);
  }

  // Find pending notifications
  public findPendingNotifications(limit: number): MemoryNotificationDelivery[] {
    const result: MemoryNotificationDelivery[] = [];
    const now = Date.now();
    for (const n of this.notifications.values()) {
      if (n.status === 'pending' && n.nextAttemptAt && n.nextAttemptAt <= now) {
        result.push(n);
      }
    }
    result.sort((a, b) => (a.nextAttemptAt || 0) - (b.nextAttemptAt || 0));
    return result.slice(0, limit);
  }

  // Find failed notifications
  public findFailedNotifications(limit: number): MemoryNotificationDelivery[] {
    const result: MemoryNotificationDelivery[] = [];
    for (const n of this.notifications.values()) {
      if (n.status === 'failed') result.push(n);
    }
    result.sort((a, b) => a.createdAt - b.createdAt);
    return result.slice(0, limit);
  }

  // Find notifications by status
  public findNotificationsByStatus(status: string, limit: number): MemoryNotificationDelivery[] {
    const result: MemoryNotificationDelivery[] = [];
    for (const n of this.notifications.values()) {
      if (n.status === status) result.push(n);
    }
    result.sort((a, b) => a.createdAt - b.createdAt);
    return result.slice(0, limit);
  }

  // Save notification
  public saveNotification(n: MemoryNotificationDelivery): void {
    this.notifications.set(n.id, n);
  }

  // Update notification
  public updateNotification(id: string, updates: Partial<MemoryNotificationDelivery>): void {
    const existing = this.notifications.get(id);
    if (existing) {
      Object.assign(existing, updates);
    }
  }

  // Delete notifications by user
  public deleteNotificationsByUser(userId: string): void {
    for (const [key, n] of this.notifications.entries()) {
      if (n.userId === userId) this.notifications.delete(key);
    }
  }

  // Count notifications recent by user
  public countNotificationsRecentByUser(userId: string): number {
    const now = Date.now();
    const dayAgo = now - 24 * 60 * 60 * 1000;
    let count = 0;
    for (const n of this.notifications.values()) {
      if (n.userId === userId && n.createdAt >= dayAgo) count++;
    }
    return count;
  }

  // ── Blacklist ──────────────────────────────

  // Find all blacklist entries
  public findAllBlacklistEntries(): MemoryBlacklistEntry[] {
    return Array.from(this.blacklist.values());
  }

  // Save blacklist entry
  public saveBlacklistEntry(entry: MemoryBlacklistEntry): void {
    this.blacklist.set(entry.id, entry);
  }

  // Delete blacklist entry
  public deleteBlacklistEntry(id: string): void {
    this.blacklist.delete(id);
  }

  // ── Telegram Links ─────────────────────────

  // Find telegram link by user
  public findTelegramLinkByUser(userId: string): MemoryTelegramLink | undefined {
    return this.telegramLinks.get(userId);
  }

  // Find telegram link by telegram user id
  public findTelegramLinkByTelegramUserId(telegramUserId: string): MemoryTelegramLink | undefined {
    for (const link of this.telegramLinks.values()) {
      if (link.telegramUserId === telegramUserId) return link;
    }
    return undefined;
  }

  // Find telegram link by chat id
  public findTelegramLinkByChatId(chatId: string): MemoryTelegramLink | undefined {
    for (const link of this.telegramLinks.values()) {
      if (link.telegramChatId === chatId) return link;
    }
    return undefined;
  }

  // Save telegram link
  public saveTelegramLink(link: MemoryTelegramLink): void {
    this.telegramLinks.set(link.userId, link);
  }

  // Delete telegram link
  public deleteTelegramLink(userId: string): void {
    this.telegramLinks.delete(userId);
  }

  // ── Audit Logs ─────────────────────────────

  // Save audit log
  public saveAuditLog(log: MemoryAuditLog): void {
    this.auditLogs.set(log.id, log);
  }

  // Find audit logs
  public findAuditLogs(limit: number, userId?: string): MemoryAuditLog[] {
    const result: MemoryAuditLog[] = [];
    for (const log of this.auditLogs.values()) {
      if (!userId || log.userId === userId) result.push(log);
    }
    result.sort((a, b) => b.createdAt - a.createdAt);
    return result.slice(0, limit);
  }

  // Delete audit logs by user
  public deleteAuditLogsByUser(userId: string): void {
    for (const [key, log] of this.auditLogs.entries()) {
      if (log.userId === userId) this.auditLogs.delete(key);
    }
  }

  // ── User Settings ──────────────────────────

  // Find user settings
  public findUserSettings(userId: string): MemoryUserSettings | undefined {
    return this.userSettings.get(userId);
  }

  // Save user settings
  public saveUserSettings(settings: MemoryUserSettings): void {
    this.userSettings.set(settings.userId, settings);
  }

  // Delete user settings
  public deleteUserSettings(userId: string): void {
    this.userSettings.delete(userId);
  }

  // ── Filter Presets ─────────────────────────

  // Find filter presets
  public findFilterPresets(userId: string): MemorySavedFilterPreset[] {
    const result: MemorySavedFilterPreset[] = [];
    for (const preset of this.filterPresets.values()) {
      if (preset.userId === userId) result.push(preset);
    }
    result.sort((a, b) => a.createdAt - b.createdAt);
    return result;
  }

  // Save filter preset
  public saveFilterPreset(preset: MemorySavedFilterPreset): void {
    this.filterPresets.set(preset.id, preset);
  }

  // Delete filter preset
  public deleteFilterPreset(id: string): void {
    this.filterPresets.delete(id);
  }

  // ── Clear all data for user ────────────────

  // Clear user data
  public clearUserData(userId: string): void {
    // Delete user's sessions
    for (const [key, session] of this.sessions.entries()) {
      if (session.userId === userId) this.sessions.delete(key);
    }
    // Delete alert rules
    for (const [key, rule] of this.alertRules.entries()) {
      if (rule.userId === userId) this.alertRules.delete(key);
    }
    // Delete alert triggers
    for (const [key, trigger] of this.alertTriggers.entries()) {
      if (trigger.userId === userId) this.alertTriggers.delete(key);
    }
    // Delete watchlists and items
    const wlIds = new Set<string>();
    for (const [key, wl] of this.watchlists.entries()) {
      if (wl.userId === userId) {
        wlIds.add(wl.id);
        this.watchlists.delete(key);
      }
    }
    for (const [key, item] of this.watchlistItems.entries()) {
      if (wlIds.has(item.watchlistId)) this.watchlistItems.delete(key);
    }
    // Delete subscription
    this.subscriptions.delete(userId);
    // Delete billing events
    for (const [key, evt] of this.billingEvents.entries()) {
      if (evt.userId === userId) this.billingEvents.delete(key);
    }
    // Delete notifications
    for (const [key, n] of this.notifications.entries()) {
      if (n.userId === userId) this.notifications.delete(key);
    }
    // Delete telegram link
    this.telegramLinks.delete(userId);
    // Delete settings
    this.userSettings.delete(userId);
    // Delete presets
    for (const [key, preset] of this.filterPresets.entries()) {
      if (preset.userId === userId) this.filterPresets.delete(key);
    }
    // Delete audit logs
    for (const [key, log] of this.auditLogs.entries()) {
      if (log.userId === userId) this.auditLogs.delete(key);
    }
    // Finally delete user
    this.users.delete(userId);
  }

  // Clear all
  public clearAll(): void {
    this.users.clear();
    this.sessions.clear();
    this.alertRules.clear();
    this.alertTriggers.clear();
    this.watchlists.clear();
    this.watchlistItems.clear();
    this.subscriptions.clear();
    this.billingEvents.clear();
    this.notifications.clear();
    this.blacklist.clear();
    this.telegramLinks.clear();
    this.auditLogs.clear();
    this.userSettings.clear();
    this.filterPresets.clear();
    this.webhookEvents.clear();
  }
}