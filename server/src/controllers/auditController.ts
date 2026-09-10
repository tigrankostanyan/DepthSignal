import { Request, Response, NextFunction } from 'express';
import { DatabaseService } from '../db/database.js';

//  audit controller
export class AuditController {
  constructor(private readonly db: DatabaseService) {}

  // List endpoint
  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const limit = req.query.limit ? Math.min(parseInt(req.query.limit as string, 10), 200) : 50;
      const logs = await this.db.getAuditLogs(limit, (req.user!.role || '').toUpperCase() === 'ADMIN' ? undefined : req.user!.id);
      res.json({ count: logs.length, data: logs });
    } catch (err) {
      next(err);
    }
  };
}
