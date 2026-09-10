import { Request, Response, NextFunction } from 'express';
import { DatabaseService } from '../db/database.js';
import { WallEngine } from '../services/wall-engine/WallEngine.js';
import { MarketType } from '../types/index.js';

//  wall controller
export class WallController {
  constructor(
    private readonly db: DatabaseService,
    private readonly wallEngine: WallEngine
  ) {}

  // Active endpoint
  active = (req: Request, res: Response): void => {
    const symbol = req.query.symbol as string | undefined;
    const marketType = req.query.marketType as MarketType | undefined;
    const walls = this.wallEngine.getActiveWalls(symbol, marketType);
    res.json({ count: walls.length, data: walls });
  };

  // History endpoint
  history = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const symbol = req.query.symbol as string | undefined;
      const exchange = req.query.exchange as string | undefined;
      const limit = req.query.limit ? Math.min(parseInt(req.query.limit as string, 10), 500) : 100;
      const history = await this.db.getWallHistory(symbol, exchange, limit);
      res.json({ count: history.length, data: history });
    } catch (err) {
      next(err);
    }
  };

  // Daily aggregates endpoint
  dailyAggregates = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const days = req.query.days ? Math.min(parseInt(req.query.days as string, 10), 90) : 30;
      const aggregates = await this.db.getDailyWallAggregates(days);
      res.json({ count: aggregates.length, data: aggregates });
    } catch (err) {
      next(err);
    }
  };

  // Get config endpoint
  getConfig = (_req: Request, res: Response): void => {
    res.json(this.wallEngine.getConfig());
  };

  // Set config endpoint
  setConfig = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      this.wallEngine.setConfig(req.body);
      await this.db.addAuditLog({
        userId: req.user!.id,
        action: 'WALL_CONFIG_UPDATE',
        resource: 'WALL_ENGINE',
        details: req.body,
        ipAddress: req.ip
      });
      res.json({ status: 'ok', config: this.wallEngine.getConfig() });
    } catch (err) {
      next(err);
    }
  };
}
