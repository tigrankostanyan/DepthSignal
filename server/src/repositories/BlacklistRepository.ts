import { Op } from 'sequelize';
import { BlacklistEntry } from '../models/BlacklistEntry.js';

//  blacklist repository
export class BlacklistRepository {
  // Find all
  async findAll(): Promise<BlacklistEntry[]> {
    return BlacklistEntry.findAll({ order: [['added_at', 'DESC']] });
  }

  // Find by symbol
  async findBySymbol(symbol: string): Promise<BlacklistEntry | null> {
    return BlacklistEntry.findOne({ where: { symbol } });
  }

  // Find by exchange
  async findByExchange(exchange: string): Promise<BlacklistEntry[]> {
    return BlacklistEntry.findAll({ where: { exchange } });
  }

  // Find symbols
  async findSymbols(): Promise<string[]> {
    // Symbol-level entries are identified by having a symbol populated
    // (seed data uses category 'CRYPTO'), not by a 'SYMBOL' category label.
    const entries = await BlacklistEntry.findAll({ where: { symbol: { [Op.ne]: null } } });
    return entries.map((e) => e.symbol).filter(Boolean) as string[];
  }

  // Find exchanges
  async findExchanges(): Promise<string[]> {
    const entries = await BlacklistEntry.findAll({ where: { exchange: { [Op.ne]: null } } });
    return entries.map((e) => e.exchange).filter(Boolean) as string[];
  }

  // Create
  async create(data: { id: string; symbol?: string; exchange?: string; category?: string; reason?: string }): Promise<BlacklistEntry> {
    return BlacklistEntry.create({ ...data, addedAt: Date.now() } as any);
  }

  // Delete
  async delete(id: string): Promise<void> {
    await BlacklistEntry.destroy({ where: { id } });
  }
}