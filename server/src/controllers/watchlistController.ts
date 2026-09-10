import { Request, Response, NextFunction } from 'express';
import { DatabaseService } from '../db/database.js';
import { EntitlementService } from '../services/billing/EntitlementService.js';

//  watchlist controller
export class WatchlistController {
  constructor(
    private readonly db: DatabaseService,
    private readonly entitlementService: EntitlementService
  ) {}

  // List endpoint
  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.json(await this.db.getWatchlists(req.user!.id));
    } catch (err) {
      next(err);
    }
  };

  // Create endpoint
  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const wl = await this.db.createWatchlist(req.body.name, req.user!.id);
      res.status(201).json(wl);
    } catch (err) {
      next(err);
    }
  };

  // Remove endpoint
  remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const deleted = await this.db.deleteWatchlist(req.params.id, req.user!.id);
      if (!deleted) {
        res.status(404).json({ error: 'NOT_FOUND', message: 'Watchlist not found or unauthorized' });
        return;
      }
      res.json({ status: 'ok' });
    } catch (err) {
      next(err);
    }
  };

  // Add item endpoint
  addItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const entitlementCheck = await this.entitlementService.canAddWatchlistItem(req.user!.id, req.body.exchange);
      if (!entitlementCheck.allowed) {
        res.status(403).json({
          error: entitlementCheck.code || 'PLAN_LIMIT_REACHED',
          message: entitlementCheck.reason,
          limit: entitlementCheck.limit,
          currentUsage: entitlementCheck.currentUsage
        });
        return;
      }

      const item = await this.db.addWatchlistItem(req.params.id, req.body, req.user!.id);
      if (!item) {
        res.status(404).json({ error: 'NOT_FOUND', message: 'Watchlist not found or unauthorized' });
        return;
      }
      res.json(item);
    } catch (err) {
      next(err);
    }
  };

  // Remove item endpoint
  removeItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { symbol, exchange, marketType } = req.body;
      const removed = await this.db.removeWatchlistItem(req.params.id, symbol, exchange, marketType, req.user!.id);
      if (!removed) {
        res.status(404).json({ error: 'NOT_FOUND', message: 'Watchlist not found or unauthorized' });
        return;
      }
      res.json({ status: 'ok' });
    } catch (err) {
      next(err);
    }
  };
}
