// CENTRAL USAGE SERVICE
// Calculates actual current usage metrics per user

import { UsageStats } from '../../types/index.js';
import { DatabaseService } from '../../db/database.js';
import { getPlanDefinition } from './planConfig.js';

//  usage service
export class UsageService {
  // Instance property
  private static instance: UsageService;
  // Db property
  private db: DatabaseService;

  private constructor() {
    this.db = DatabaseService.getInstance();
  }

  // Get instance
  public static getInstance(): UsageService {
    if (!UsageService.instance) {
      UsageService.instance = new UsageService();
    }
    return UsageService.instance;
  }

  // Get usage
  public async getUsage(userId: string): Promise<UsageStats> {
    const subscription = await this.db.getUserSubscription(userId);
    const planDef = getPlanDefinition(subscription.plan);

    // 1. Active alert rules count
    const rules = await this.db.getAlertRules(userId);
    const activeAlertsCount = rules.filter(r => r.enabled).length;

    // 2. Total Watchlist items count across user's watchlists
    const watchlists = await this.db.getWatchlists(userId);
    let watchlistItemsCount = 0;
    for (const wl of watchlists) {
      watchlistItemsCount += wl.items.length;
    }

    // 3. Wall rules count (rules that have WALL_DETECTED condition)
    const wallRulesCount = rules.filter(r => 
      r.enabled && r.conditions.some(c => c.type === 'WALL_DETECTED')
    ).length;

    // 4. Notification deliveries in last 24h
    const notificationDeliveries24h = await this.db.getNotificationDeliveryCount24h(userId);

    return {
      userId,
      plan: subscription.plan,
      status: subscription.status,
      activeAlertsCount,
      maxActiveAlerts: planDef.limits.maxActiveAlerts,
      watchlistItemsCount,
      maxWatchlistItems: planDef.limits.maxWatchlistItems,
      wallRulesCount,
      maxWallRules: planDef.limits.maxActiveWallRules,
      notificationDeliveries24h,
      allowedExchanges: planDef.limits.allowedExchanges,
      allowedChannels: planDef.limits.allowedNotificationChannels,
      crossExchangeAggregation: planDef.limits.crossExchangeAggregation,
      advancedFilters: planDef.limits.advancedFilters,
      wallHistoryAccessDays: planDef.limits.wallHistoryAccessDays
    };
  }
}