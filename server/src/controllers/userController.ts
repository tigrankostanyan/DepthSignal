import { Request, Response, NextFunction } from 'express';
import { DatabaseService } from '../db/database.js';
import { clearAuthCookies } from '../security/authMiddleware.js';

//  user controller
export class UserController {
  constructor(private readonly db: DatabaseService) {}

  // Export data endpoint
  exportData = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'UNAUTHORIZED', message: 'User not authenticated' });
        return;
      }
      const data = await this.db.exportUserData(userId);
      res.json(data);
    } catch (err) {
      next(err);
    }
  };

  // Delete account endpoint
  deleteAccount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'UNAUTHORIZED', message: 'User not authenticated' });
        return;
      }
      // Require explicit confirmation from the client.
      const { confirm } = req.body;
      if (!confirm || confirm !== 'DELETE') {
        res.status(400).json({ error: 'CONFIRMATION_REQUIRED', message: 'Please confirm deletion by sending { confirm: "DELETE" }' });
        return;
      }
      // Wipe the account + all owned records and tombstone the email permanently.
      await this.db.deleteUserAccount(userId);
      // Forcefully invalidate the session cookies on the browser.
      clearAuthCookies(res);
      res.json({ status: 'ok', message: 'Account deleted successfully' });
    } catch (err) {
      next(err);
    }
  };
}