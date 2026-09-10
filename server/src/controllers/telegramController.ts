import { Request, Response, NextFunction } from 'express';
import '../security/authMiddleware.js';
import { TelegramLinkingService } from '../services/notifications/TelegramLinkingService.js';

//  telegram controller
export class TelegramController {
  constructor(private readonly telegramLinkingService: TelegramLinkingService) {}

  // Status endpoint
  status = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.json(await this.telegramLinkingService.getStatus(req.user!.id));
    } catch (err) {
      next(err);
    }
  };

  // Link token endpoint
  linkToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.json(await this.telegramLinkingService.createLinkingToken(req.user!.id));
    } catch (err) {
      next(err);
    }
  };

  // Test alert endpoint
  testAlert = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.telegramLinkingService.sendTestAlert(req.user!.id);
      if (!result.success) {
        res.status(400).json(result);
        return;
      }
      res.json(result);
    } catch (err) {
      next(err);
    }
  };

  // Disconnect endpoint
  disconnect = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.telegramLinkingService.disconnect(req.user!.id, req.ip);
      res.json({ success: true, message: 'Telegram account disconnected successfully.' });
    } catch (err) {
      next(err);
    }
  };

  // Webhook endpoint
  webhook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const secretHeader = req.headers['x-telegram-bot-api-secret-token'] as string | undefined;
      const result = await this.telegramLinkingService.processWebhookUpdate(req.body, secretHeader);

      if (result.unauthorized) {
        res.status(401).json({ error: 'UNAUTHORIZED_WEBHOOK', message: result.error });
        return;
      }

      res.json({ ok: true, action: result.action });
    } catch (err) {
      next(err);
    }
  };
}
