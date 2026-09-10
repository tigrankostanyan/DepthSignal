import { Request, Response, NextFunction } from 'express';
import { DatabaseService } from '../db/database.js';

//  blacklist controller
export class BlacklistController {
  constructor(private readonly db: DatabaseService) {}

  // List endpoint
  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.json(await this.db.getBlacklist());
    } catch (err) {
      next(err);
    }
  };

  // Add endpoint
  add = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const entry = await this.db.addBlacklistEntry(req.body);
      await this.db.addAuditLog({
        userId: req.user!.id,
        action: 'BLACKLIST_ENTRY_ADDED',
        resource: 'BLACKLIST',
        resourceId: entry.id,
        details: { symbol: entry.symbol, exchange: entry.exchange, reason: entry.reason },
        ipAddress: req.ip
      });
      res.json(entry);
    } catch (err) {
      next(err);
    }
  };

  // Remove endpoint
  remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.db.removeBlacklistEntry(req.params.id);
      await this.db.addAuditLog({
        userId: req.user!.id,
        action: 'BLACKLIST_ENTRY_REMOVED',
        resource: 'BLACKLIST',
        resourceId: req.params.id,
        ipAddress: req.ip
      });
      res.json({ status: 'ok' });
    } catch (err) {
      next(err);
    }
  };
}
