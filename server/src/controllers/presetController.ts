import { Request, Response, NextFunction } from 'express';
import { DatabaseService } from '../db/database.js';

//  preset controller
export class PresetController {
  constructor(private readonly db: DatabaseService) {}

  // List endpoint
  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.json(await this.db.getFilterPresets(req.user!.id));
    } catch (err) {
      next(err);
    }
  };

  // Save endpoint
  save = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const preset = await this.db.saveFilterPreset(req.body, req.user!.id);
      res.json(preset);
    } catch (err) {
      next(err);
    }
  };

  // Remove endpoint
  remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const deleted = await this.db.deleteFilterPreset(req.params.id, req.user!.id);
      if (!deleted) {
        res.status(404).json({ error: 'NOT_FOUND', message: 'Filter preset not found or unauthorized' });
        return;
      }
      res.json({ status: 'ok' });
    } catch (err) {
      next(err);
    }
  };
}
