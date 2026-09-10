import { Op } from 'sequelize';
import { Watchlist } from '../models/Watchlist.js';
import { WatchlistItem } from '../models/WatchlistItem.js';

//  watchlist repository
export class WatchlistRepository {
  // Find by user
  async findByUser(userId: string): Promise<Watchlist[]> {
    return Watchlist.findAll({ where: { userId }, order: [['createdAt', 'ASC']] });
  }

  // Find by id
  async findById(id: string, userId: string): Promise<Watchlist | null> {
    return Watchlist.findOne({ where: { id, userId } });
  }

  // Create
  async create(data: { id: string; userId: string; name?: string }): Promise<Watchlist> {
    return Watchlist.create({ ...data, createdAt: Date.now() } as any);
  }

  // Delete
  async delete(id: string, userId: string): Promise<boolean> {
    await WatchlistItem.destroy({ where: { watchlistId: id } });
    const deleted = await Watchlist.destroy({ where: { id, userId } });
    return deleted > 0;
  }

  // ── Items ─────────────────────────────────────────────────────────────

  // Find items
  async findItems(watchlistId: string): Promise<WatchlistItem[]> {
    return WatchlistItem.findAll({ where: { watchlistId }, order: [['added_at', 'ASC']] });
  }

  // Add item
  async addItem(data: { id: string; watchlistId: string; symbol?: string; exchange?: string; marketType?: string; notes?: string }): Promise<WatchlistItem> {
    return WatchlistItem.create({ ...data, addedAt: Date.now() } as any);
  }

  // Remove item
  async removeItem(id: string, watchlistId: string): Promise<boolean> {
    const deleted = await WatchlistItem.destroy({ where: { id, watchlistId } });
    return deleted > 0;
  }

  // Remove item by unique
  async removeItemByUnique(
    watchlistId: string,
    symbol: string,
    exchange: string,
    marketType: string
  ): Promise<boolean> {
    const deleted = await WatchlistItem.destroy({
      where: { watchlistId, symbol, exchange, marketType },
    });
    return deleted > 0;
  }
}