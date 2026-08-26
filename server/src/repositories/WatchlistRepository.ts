// ==========================================
// WATCHLIST REPOSITORY (Sequelize / MySQL Data Access Layer)
// ==========================================

import { Watchlist, WatchlistAttributes } from '../models/trading/index.js';

export class WatchlistRepository {
  public static async getByUserId(userId: string): Promise<Watchlist[]> {
    try {
      return await Watchlist.findAll({ where: { userId }, order: [['createdAt', 'ASC']] });
    } catch (e) {
      return [];
    }
  }

  public static async create(data: WatchlistAttributes): Promise<Watchlist> {
    return await Watchlist.create(data as any);
  }

  public static async updateSymbols(id: string, userId: string, symbols: string[]): Promise<boolean> {
    try {
      const [affected] = await Watchlist.update(
        { symbols: JSON.stringify(symbols) },
        { where: { id, userId } }
      );
      return affected > 0;
    } catch (e) {
      return false;
    }
  }

  public static async delete(id: string, userId: string): Promise<boolean> {
    try {
      const deleted = await Watchlist.destroy({ where: { id, userId } });
      return deleted > 0;
    } catch (e) {
      return false;
    }
  }
}
