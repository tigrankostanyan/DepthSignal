// CENTRAL ENTITLEMENT & PLAN POLICY SERVICE
// Server-authoritative enforcement of subscription limits
import { 
  AlertCondition, 
  AlertRule, 
  EntitlementCheckResult, 
  ExchangeId, 
  NotificationChannelType, 
  SubscriptionPlanId 
} from '../../types/index.js';
import { DatabaseService } from '../../db/database.js';
import { getPlanDefinition } from './planConfig.js';
import { UsageService } from './UsageService.js';

//  entitlement service
export class EntitlementService {
  // Instance property
  private static instance: EntitlementService;
  // Db property
  private db: DatabaseService;
  // Usage service property
  private usageService: UsageService;

  private constructor() {
    this.db = DatabaseService.getInstance();
    this.usageService = UsageService.getInstance();
  }

  // Get instance
  public static getInstance(): EntitlementService {
    if (!EntitlementService.instance) {
      EntitlementService.instance = new EntitlementService();
    }
    return EntitlementService.instance;
  }

  // Admins (master role) bypass every plan entitlement limit
  private async isAdminUser(userId: string): Promise<boolean> {
    const user = await this.db.getUserById(userId);
    return (user?.role ?? '').toUpperCase() === 'ADMIN';
  }

  // Can create alert
  public async canCreateAlert(userId: string, rule: Partial<AlertRule>): Promise<EntitlementCheckResult> {
    if (await this.isAdminUser(userId)) return { allowed: true };

    const sub = await this.db.getUserSubscription(userId);
    const plan = getPlanDefinition(sub.plan);
    const usage = await this.usageService.getUsage(userId);

    // 1. Check max active alerts limit
    if (usage.activeAlertsCount >= plan.limits.maxActiveAlerts) {
      return {
        allowed: false,
        code: 'PLAN_LIMIT_REACHED',
        reason: `Your ${plan.name} plan limit of ${plan.limits.maxActiveAlerts} active alerts has been reached. Upgrade your plan to create more alerts.`,
        limit: plan.limits.maxActiveAlerts,
        currentUsage: usage.activeAlertsCount
      };
    }

    // 2. Check wall detection rules limit
    const isWallRule = rule.conditions?.some(c => c.type === 'WALL_DETECTED');
    if (isWallRule && usage.wallRulesCount >= plan.limits.maxActiveWallRules) {
      return {
        allowed: false,
        code: 'PLAN_LIMIT_REACHED',
        reason: `Your ${plan.name} plan allows up to ${plan.limits.maxActiveWallRules} active wall detection rules. Please upgrade to add more.`,
        limit: plan.limits.maxActiveWallRules,
        currentUsage: usage.wallRulesCount
      };
    }

    // 3. Check notification channels allowed
    if (rule.notifyChannels && rule.notifyChannels.length > 0) {
      for (const ch of rule.notifyChannels) {
        if (!plan.limits.allowedNotificationChannels.includes(ch)) {
          return {
            allowed: false,
            code: 'CHANNEL_NOT_ALLOWED',
            reason: `Notification channel '${ch}' is not available on ${plan.name}. ${ch === 'TELEGRAM' ? 'Upgrade to PRO to unlock Telegram alerts.' : 'Upgrade to ADVANCED to unlock custom Webhook alerts.'}`
          };
        }
      }
    }

    // 4. Check exchanges allowed
    if (rule.exchanges && rule.exchanges.length > 0) {
      for (const ex of rule.exchanges) {
        if (!plan.limits.allowedExchanges.includes(ex)) {
          return {
            allowed: false,
            code: 'EXCHANGE_NOT_ALLOWED',
            reason: `Exchange '${ex}' is not available on ${plan.name}. Upgrade to PRO to monitor all global crypto exchanges and stock feeds.`
          };
        }
      }
    }

    // 5. Check advanced condition types
    const advancedTypes = ['RSI_OVERBOUGHT', 'RSI_OVERSOLD', 'FUNDING_RATE_ANOMALY', 'VOLUME_SPIKE'];
    const hasAdvancedCondition = rule.conditions?.some(c => advancedTypes.includes(c.type));
    if (hasAdvancedCondition && !plan.limits.advancedFilters) {
      return {
        allowed: false,
        code: 'FEATURE_NOT_AVAILABLE',
        reason: `Technical indicator alerts (RSI, Funding Rate Anomaly) require a PRO or ADVANCED subscription.`
      };
    }

    return { allowed: true };
  }

  // Can add watchlist item
  public async canAddWatchlistItem(userId: string, exchange?: ExchangeId): Promise<EntitlementCheckResult> {
    if (await this.isAdminUser(userId)) return { allowed: true };

    const sub = await this.db.getUserSubscription(userId);
    const plan = getPlanDefinition(sub.plan);
    const usage = await this.usageService.getUsage(userId);

    // 1. Max watchlist items
    if (usage.watchlistItemsCount >= plan.limits.maxWatchlistItems) {
      return {
        allowed: false,
        code: 'PLAN_LIMIT_REACHED',
        reason: `Watchlist limit reached (${usage.watchlistItemsCount}/${plan.limits.maxWatchlistItems} items on ${plan.name}). Upgrade to add more items.`,
        limit: plan.limits.maxWatchlistItems,
        currentUsage: usage.watchlistItemsCount
      };
    }

    // 2. Exchange access
    if (exchange && !plan.limits.allowedExchanges.includes(exchange)) {
      return {
        allowed: false,
        code: 'EXCHANGE_NOT_ALLOWED',
        reason: `Exchange '${exchange}' is not accessible on ${plan.name}. Upgrade to PRO for multi-exchange monitoring.`
      };
    }

    return { allowed: true };
  }

  // Can use cross exchange aggregation
  public async canUseCrossExchangeAggregation(userId: string): Promise<EntitlementCheckResult> {
    if (await this.isAdminUser(userId)) return { allowed: true };

    const sub = await this.db.getUserSubscription(userId);
    const plan = getPlanDefinition(sub.plan);

    if (!plan.limits.crossExchangeAggregation) {
      return {
        allowed: false,
        code: 'FEATURE_NOT_AVAILABLE',
        reason: `Cross-exchange wall aggregation requires an ADVANCED Institutional plan.`
      };
    }

    return { allowed: true };
  }

  // Can use advanced filters
  public async canUseAdvancedFilters(userId: string): Promise<EntitlementCheckResult> {
    if (await this.isAdminUser(userId)) return { allowed: true };

    const sub = await this.db.getUserSubscription(userId);
    const plan = getPlanDefinition(sub.plan);

    if (!plan.limits.advancedFilters) {
      return {
        allowed: false,
        code: 'FEATURE_NOT_AVAILABLE',
        reason: `Advanced quantitative indicators and filters are unlocked on PRO and ADVANCED plans.`
      };
    }

    return { allowed: true };
  }

  // Can access history
  public async canAccessHistory(userId: string, requestedDays: number): Promise<EntitlementCheckResult> {
    if (await this.isAdminUser(userId)) return { allowed: true };

    const sub = await this.db.getUserSubscription(userId);
    const plan = getPlanDefinition(sub.plan);

    if (requestedDays > plan.limits.wallHistoryAccessDays) {
      return {
        allowed: false,
        code: 'PLAN_LIMIT_REACHED',
        reason: `${plan.name} allows up to ${plan.limits.wallHistoryAccessDays} days of historical wall analysis. Upgrade to access up to 90 days.`,
        limit: plan.limits.wallHistoryAccessDays
      };
    }

    return { allowed: true };
  }

  // Can use channel
  public async canUseChannel(userId: string, channel: NotificationChannelType): Promise<EntitlementCheckResult> {
    if (await this.isAdminUser(userId)) return { allowed: true };

    const sub = await this.db.getUserSubscription(userId);
    const plan = getPlanDefinition(sub.plan);

    if (!plan.limits.allowedNotificationChannels.includes(channel)) {
      return {
        allowed: false,
        code: 'CHANNEL_NOT_ALLOWED',
        reason: `Channel '${channel}' requires a ${channel === 'WEBHOOK' ? 'ADVANCED' : 'PRO'} subscription.`
      };
    }

    return { allowed: true };
  }
}