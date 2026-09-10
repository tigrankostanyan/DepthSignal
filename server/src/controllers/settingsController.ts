import { Request, Response, NextFunction } from 'express';
import { DatabaseService } from '../db/database.js';
import { WallEngine } from '../services/wall-engine/WallEngine.js';

//  settings controller
export class SettingsController {
  constructor(
    private readonly db: DatabaseService,
    private readonly wallEngine: WallEngine
  ) {}

  // Mask
  private mask(settings: Record<string, any>): Record<string, any> {
    return {
      ...settings,
      telegramBotToken: settings.telegramBotToken ? '••••••••' + settings.telegramBotToken.slice(-4) : undefined,
      finnhubApiKey: settings.finnhubApiKey ? '••••••••' + settings.finnhubApiKey.slice(-4) : undefined,
      polygonApiKey: settings.polygonApiKey ? '••••••••' + settings.polygonApiKey.slice(-4) : undefined
    };
  }

  // Get endpoint
  get = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const settings = await this.db.getUserSettings(req.user!.id);
      res.json(this.mask(settings));
    } catch (err) {
      next(err);
    }
  };

  // Update endpoint
  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.db.updateUserSettings(req.body, req.user!.id);
      if (req.body.wallMinVolumeDefaultUsd !== undefined || req.body.defaultCrossExchangeAggregation !== undefined) {
        this.wallEngine.setConfig({
          minVolumeUsd: req.body.wallMinVolumeDefaultUsd,
          crossExchangeAggregation: req.body.defaultCrossExchangeAggregation
        });
      }

      if (req.body.telegramBotToken || req.body.webhookUrl || req.body.emailRecipient) {
        await this.db.addAuditLog({
          userId: req.user!.id,
          action: 'SETTINGS_NOTIFICATIONS_CHANGED',
          resource: 'USER_SETTINGS',
          details: {
            hasTelegram: Boolean(req.body.telegramBotToken),
            hasWebhook: Boolean(req.body.webhookUrl),
            hasEmail: Boolean(req.body.emailRecipient)
          },
          ipAddress: req.ip
        });
      }

      const settings = await this.db.getUserSettings(req.user!.id);
      res.json({ status: 'ok', settings: this.mask(settings) });
    } catch (err) {
      next(err);
    }
  };
}
