import { Request, Response, NextFunction } from 'express';
import { DatabaseService } from '../db/database.js';
import { EntitlementService } from '../services/billing/EntitlementService.js';
import { MarketStateService } from '../services/market-data/MarketStateService.js';
import { SSEManager } from '../services/realtime/sseManager.js';
import { MarketTicker } from '../types/index.js';

//  alert controller
export class AlertController {
  constructor(
    private readonly db: DatabaseService,
    private readonly entitlementService: EntitlementService,
    private readonly marketState: MarketStateService,
    private readonly sseManager: SSEManager
  ) {}

  // List rules endpoint
  listRules = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.json(await this.db.getAlertRules(req.user!.id));
    } catch (err) {
      next(err);
    }
  };

  // Create rule endpoint
  createRule = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const entitlementCheck = await this.entitlementService.canCreateAlert(req.user!.id, req.body);
      if (!entitlementCheck.allowed) {
        res.status(403).json({
          error: entitlementCheck.code || 'PLAN_LIMIT_REACHED',
          message: entitlementCheck.reason,
          limit: entitlementCheck.limit,
          currentUsage: entitlementCheck.currentUsage
        });
        return;
      }

      const saved = await this.db.saveAlertRule(req.body, req.user!.id);
      await this.db.addAuditLog({
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
  };

  // Delete rule endpoint
  deleteRule = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const deleted = await this.db.deleteAlertRule(req.params.id, req.user!.id);
      if (!deleted) {
        res.status(404).json({ error: 'NOT_FOUND', message: 'Alert rule not found or not authorized to delete' });
        return;
      }
      await this.db.addAuditLog({
        userId: req.user!.id,
        action: 'ALERT_RULE_DELETED',
        resource: 'ALERT_RULE',
        resourceId: req.params.id,
        ipAddress: req.ip
      });
      res.json({ status: 'ok' });
    } catch (err) {
      next(err);
    }
  };

  // List triggers endpoint
  listTriggers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const limit = req.query.limit ? Math.min(parseInt(req.query.limit as string, 10), 500) : 100;
      res.json(await this.db.getAlertTriggers(limit, req.user!.id));
    } catch (err) {
      next(err);
    }
  };

  // Mark trigger read endpoint
  markTriggerRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.db.markAlertTriggerRead(req.body.id, req.user!.id);
      res.json({ status: 'ok' });
    } catch (err) {
      next(err);
    }
  };

  // Clear triggers endpoint
  clearTriggers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.db.clearAlertTriggers(req.user!.id);
      res.json({ status: 'ok' });
    } catch (err) {
      next(err);
    }
  };

  // Test trigger endpoint
  testTrigger = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const sampleTicker: MarketTicker =
        (await this.marketState.getTicker('BINANCE', 'SPOT', 'BTCUSDT')) || {
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

      const trigger = await this.db.saveAlertTrigger(
        {
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
        },
        req.user!.id
      );

      this.sseManager.broadcastUser(req.user!.id, 'alert_trigger', trigger);
      res.json(trigger);
    } catch (err) {
      next(err);
    }
  };
}
