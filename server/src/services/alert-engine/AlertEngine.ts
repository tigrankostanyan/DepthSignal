import { 
  AlertCondition, 
  AlertRule, 
  AlertTrigger, 
  DetectedWall, 
  MarketTicker,
  NotificationChannelType 
} from '../../types/index.js';
import { DatabaseService } from '../../db/database.js';
import { MarketStateService } from '../market-data/MarketStateService.js';
import { NotificationQueue } from '../notifications/NotificationQueue.js';

export type AlertTriggerListener = (trigger: AlertTrigger) => void;

//  alert engine
export class AlertEngine {
  // Instance property
  private static instance: AlertEngine;
  // Db property
  private db: DatabaseService;
  // Market state property
  private marketState: MarketStateService;
  // Queue property
  private queue: NotificationQueue;
  // Listeners property
  private listeners: AlertTriggerListener[] = [];

  private constructor() {
    this.db = DatabaseService.getInstance();
    this.marketState = MarketStateService.getInstance();
    this.queue = NotificationQueue.getInstance();
  }

  // Get instance
  public static getInstance(): AlertEngine {
    if (!AlertEngine.instance) {
      AlertEngine.instance = new AlertEngine();
    }
    return AlertEngine.instance;
  }

  // On alert trigger
  public onAlertTrigger(listener: AlertTriggerListener): void {
    this.listeners.push(listener);
  }

  // Evaluate ticker
  public async evaluateTicker(ticker: MarketTicker): Promise<void> {
    const rules = (await this.db.getAllAlertRules()).filter(r => r.enabled);
    const now = Date.now();

    for (const rule of rules) {
      // 1. Symbol check
      if (!this.matchesSymbol(rule.symbols, ticker.symbol)) continue;
      // 2. Exchange check
      if (rule.exchanges.length > 0 && !rule.exchanges.includes(ticker.exchange)) continue;
      // 3. Market type check
      if (rule.marketTypes.length > 0 && !rule.marketTypes.includes(ticker.marketType)) continue;

      // 4. Cooldown check
      if (rule.lastTriggeredAt && (now - rule.lastTriggeredAt) < (rule.cooldownSeconds * 1000)) {
        continue;
      }

      // 5. Evaluate conditions
      const conditionResults = rule.conditions.map(cond => this.evalTickerCondition(cond, ticker));
      const isTriggered = rule.logic === 'AND'
        ? conditionResults.every(r => r.matched)
        : conditionResults.some(r => r.matched);

      if (isTriggered) {
        const matched = conditionResults.find(r => r.matched) || conditionResults[0];
        await this.triggerRule(rule, ticker, matched.message, matched.conditionType, matched.metricValue);
      }
    }
  }

  // Evaluate wall
  public async evaluateWall(wall: DetectedWall): Promise<void> {
    const rules = (await this.db.getAllAlertRules()).filter(r => r.enabled);
    const now = Date.now();

    for (const rule of rules) {
      if (!this.matchesSymbol(rule.symbols, wall.symbol)) continue;
      if (rule.exchanges.length > 0 && !rule.exchanges.includes(wall.exchange)) continue;
      if (rule.marketTypes.length > 0 && !rule.marketTypes.includes(wall.marketType)) continue;

      if (rule.lastTriggeredAt && (now - rule.lastTriggeredAt) < (rule.cooldownSeconds * 1000)) {
        continue;
      }

      for (const cond of rule.conditions) {
        if (cond.type === 'WALL_DETECTED') {
          const minVol = cond.params.minWallVolumeUsd || 500000;
          const maxDist = cond.params.maxWallDistancePercent || 3.0;
          const sidePref = cond.params.wallSide || 'ANY';

          const matchesSide = sidePref === 'ANY' || sidePref === wall.side;
          const matchesVol = wall.volumeUsd >= minVol;
          const matchesDist = wall.distancePercent <= maxDist;

          if (matchesSide && matchesVol && matchesDist) {
            const message = `Significant ${wall.side} wall detected: $${(wall.volumeUsd / 1e6).toFixed(2)}M at $${wall.price.toLocaleString()} (${wall.distancePercent.toFixed(2)}% away)`;
            await this.triggerWallAlert(rule, wall, message, 'WALL_DETECTED', `$${(wall.volumeUsd / 1e6).toFixed(2)}M`);
            break;
          }
        }
      }
    }
  }

  // Eval ticker condition
  private evalTickerCondition(
    condition: AlertCondition,
    ticker: MarketTicker
  ): { matched: boolean; message: string; conditionType: any; metricValue: string } {
    switch (condition.type) {
      case 'PRICE_ABOVE': {
        const target = condition.params.targetPrice || 0;
        const matched = ticker.lastPrice >= target;
        return {
          matched,
          message: `Price climbed above $${target.toLocaleString()} (current: $${ticker.lastPrice.toLocaleString()})`,
          conditionType: 'PRICE_ABOVE',
          metricValue: `$${ticker.lastPrice}`
        };
      }
      case 'PRICE_BELOW': {
        const target = condition.params.targetPrice || 0;
        const matched = ticker.lastPrice <= target;
        return {
          matched,
          message: `Price dropped below $${target.toLocaleString()} (current: $${ticker.lastPrice.toLocaleString()})`,
          conditionType: 'PRICE_BELOW',
          metricValue: `$${ticker.lastPrice}`
        };
      }
      case 'PERCENTAGE_CHANGE': {
        const tf = condition.params.timeframe || '1d';
        const threshold = condition.params.percentageThreshold || 3.0;
        const change = (ticker.changesByTimeframe && ticker.changesByTimeframe[tf] !== undefined)
          ? ticker.changesByTimeframe[tf]!
          : ticker.percentageChange;
        const matched = Math.abs(change) >= threshold;
        return {
          matched,
          message: `${tf} movement breached ${threshold}% (current: ${change > 0 ? '+' : ''}${change.toFixed(2)}%)`,
          conditionType: 'PERCENTAGE_CHANGE',
          metricValue: `${change.toFixed(2)}%`
        };
      }
      case 'VOLUME_SPIKE': {
        const mult = condition.params.volumeMultiplier || 3.0;
        // Check if 24h volume or rapid tick volume indicates spike
        const isSpike = ticker.volumeUsd > 50000000 && Math.abs(ticker.percentageChange) > 2.0;
        return {
          matched: isSpike,
          message: `Volume surge detected exceeding ${mult}x baseline ($${(ticker.volumeUsd / 1e6).toFixed(1)}M 24h vol)`,
          conditionType: 'VOLUME_SPIKE',
          metricValue: `$${(ticker.volumeUsd / 1e6).toFixed(1)}M`
        };
      }
      case 'RSI_OVERBOUGHT': {
        const threshold = condition.params.rsiThreshold || 70;
        const rsi = ticker.rsi || 50;
        return {
          matched: rsi >= threshold,
          message: `RSI reached overbought territory at ${rsi.toFixed(1)} (threshold: ${threshold})`,
          conditionType: 'RSI_OVERBOUGHT',
          metricValue: rsi.toFixed(1)
        };
      }
      case 'RSI_OVERSOLD': {
        const threshold = condition.params.rsiThreshold || 30;
        const rsi = ticker.rsi || 50;
        return {
          matched: rsi <= threshold,
          message: `RSI dropped to oversold levels at ${rsi.toFixed(1)} (threshold: ${threshold})`,
          conditionType: 'RSI_OVERSOLD',
          metricValue: rsi.toFixed(1)
        };
      }
      case 'FUNDING_RATE_ANOMALY': {
        const threshold = condition.params.fundingRateThreshold || 0.0005; // 0.05%
        const rate = ticker.fundingRate || 0;
        const matched = Math.abs(rate) >= threshold;
        return {
          matched,
          message: `Funding rate anomaly: ${(rate * 100).toFixed(4)}% per 8h`,
          conditionType: 'FUNDING_RATE_ANOMALY',
          metricValue: `${(rate * 100).toFixed(4)}%`
        };
      }
      default:
        return { matched: false, message: '', conditionType: condition.type, metricValue: '' };
    }
  }

  // Matches symbol
  private matchesSymbol(ruleSymbols: string[], symbol: string): boolean {
    if (ruleSymbols.includes('ALL') || ruleSymbols.length === 0) return true;
    return ruleSymbols.map(s => s.toUpperCase()).includes(symbol.toUpperCase());
  }

  // Trigger rule
  private async triggerRule(
    rule: AlertRule,
    ticker: MarketTicker,
    message: string,
    conditionType: any,
    metricValue: string
  ): Promise<void> {
    const now = Date.now();
    await this.db.updateAlertRuleLastTriggered(rule.id, now);
    // Alerts are only deliverable for rules owned by a registered user.
    const userId = rule.userId;
    if (!userId) return;
    const settings = await this.db.getUserSettings(userId);

    for (const ch of rule.notifyChannels) {
      const trigger: Omit<AlertTrigger, 'id'> = {
        userId,
        ruleId: rule.id,
        ruleName: rule.name,
        symbol: ticker.symbol,
        exchange: ticker.exchange,
        marketType: ticker.marketType,
        message,
        conditionType,
        metricValue,
        triggerPrice: ticker.lastPrice,
        timestamp: now,
        channel: ch,
        read: false
      };

      const saved = await this.db.saveAlertTrigger(trigger, userId);
      this.listeners.forEach(l => l(saved));

      // Resolve destination
      let destination = 'in_app';
      if (ch === 'EMAIL') destination = settings.emailRecipient || '';
      else if (ch === 'TELEGRAM') {
        const tgLink = await this.db.getUserTelegramLink(userId);
        destination = (tgLink?.enabled ? tgLink.telegramChatId : '') || settings.telegramChatId || '';
      }
      else if (ch === 'WEBHOOK') destination = settings.webhookUrl || '';

      // Enqueue to resilient asynchronous delivery queue
      await this.queue.enqueue(saved, ch as NotificationChannelType, destination);
    }
  }

  // Trigger wall alert
  private async triggerWallAlert(
    rule: AlertRule,
    wall: DetectedWall,
    message: string,
    conditionType: any,
    metricValue: string
  ): Promise<void> {
    const now = Date.now();
    await this.db.updateAlertRuleLastTriggered(rule.id, now);
    // Alerts are only deliverable for rules owned by a registered user.
    const userId = rule.userId;
    if (!userId) return;
    const settings = await this.db.getUserSettings(userId);

    for (const ch of rule.notifyChannels) {
      const trigger: Omit<AlertTrigger, 'id'> = {
        userId,
        ruleId: rule.id,
        ruleName: rule.name,
        symbol: wall.symbol,
        exchange: wall.exchange,
        marketType: wall.marketType,
        message,
        conditionType,
        metricValue,
        triggerPrice: wall.price,
        timestamp: now,
        channel: ch,
        read: false
      };

      const saved = await this.db.saveAlertTrigger(trigger, userId);
      this.listeners.forEach(l => l(saved));

      // Resolve destination
      let destination = 'in_app';
      if (ch === 'EMAIL') destination = settings.emailRecipient || '';
      else if (ch === 'TELEGRAM') {
        const tgLink = await this.db.getUserTelegramLink(userId);
        destination = (tgLink?.enabled ? tgLink.telegramChatId : '') || settings.telegramChatId || '';
      }
      else if (ch === 'WEBHOOK') destination = settings.webhookUrl || '';

      // Enqueue to resilient asynchronous delivery queue
      await this.queue.enqueue(saved, ch as NotificationChannelType, destination);
    }
  }
}
