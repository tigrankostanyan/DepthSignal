import { Op } from 'sequelize';
import { DetectedWall } from '../models/DetectedWall.js';
import { WallHistory } from '../models/WallHistory.js';
import { DailyWallAggregate } from '../models/DailyWallAggregate.js';

//  detected wall repository
export class DetectedWallRepository {
  // Find all active
  async findAllActive(): Promise<DetectedWall[]> {
    return DetectedWall.findAll({ where: { state: { [Op.in]: ['FORMING', 'CONFIRMED'] } } });
  }

  // Find by symbol exchange
  async findBySymbolExchange(symbol: string, exchange: string): Promise<DetectedWall[]> {
    return DetectedWall.findAll({ where: { symbol, exchange, state: { [Op.in]: ['FORMING', 'CONFIRMED'] } } });
  }

  // Find by id
  async findById(id: string): Promise<DetectedWall | null> {
    return DetectedWall.findByPk(id);
  }

  // Upsert
  async upsert(wall: Partial<DetectedWall> & { id: string }): Promise<void> {
    const now = Date.now();
    // Use Sequelize's built-in upsert which works with SQLite via INSERT OR REPLACE
    await DetectedWall.upsert({
      ...wall,
      createdAt: wall.createdAt ?? now,
      updatedAt: now,
    } as any);
  }

  // Update state
  async updateState(id: string, state: string, extra: Partial<Record<string, unknown>> = {}): Promise<void> {
    await DetectedWall.update({ state, ...extra, updatedAt: Date.now() } as any, { where: { id } });
  }

  // Delete
  async delete(id: string): Promise<void> {
    await DetectedWall.destroy({ where: { id } });
  }

  // Count active
  async countActive(): Promise<number> {
    return DetectedWall.count({ where: { state: { [Op.in]: ['FORMING', 'CONFIRMED'] } } });
  }
}

//  wall history repository
export class WallHistoryRepository {
  // Create
  async create(data: Record<string, unknown> & { id: string }): Promise<WallHistory> {
    // Preserve original sql.js "INSERT OR REPLACE" semantics: if the id already
    // exists (e.g. re-run of a lifecycle test), refresh the row instead of
    // returning the stale record with an old createdAt.
    const existing = await WallHistory.findByPk(data.id);
    if (existing) {
      await WallHistory.update({ ...data, createdAt: Date.now() } as any, { where: { id: data.id } });
      return (await WallHistory.findByPk(data.id))!;
    }
    return WallHistory.create({ ...data, createdAt: Date.now() } as any);
  }

  // Find recent
  async findRecent(symbol?: string, exchange?: string, limit = 100): Promise<WallHistory[]> {
    const where: any = {};
    if (symbol) where.symbol = symbol;
    if (exchange) where.exchange = exchange;
    return WallHistory.findAll({ where, order: [['createdAt', 'DESC']], limit });
  }

  // Clean old
  async cleanOld(retentionDays = 90): Promise<number> {
    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    // Original sql.js semantics: delete wall_history AND detected_walls.
    await DetectedWall.destroy({ where: { updatedAt: { [Op.lt]: cutoff } } });
    return WallHistory.destroy({ where: { createdAt: { [Op.lt]: cutoff } } });
  }

  // ── DailyWallAggregate ────────────────────────────────────────────────

  // Find daily
  async findDaily(
    date: string,
    symbol: string,
    exchange: string,
    marketType: string
  ): Promise<DailyWallAggregate | null> {
    return DailyWallAggregate.findOne({ where: { date, symbol, exchange, marketType } });
  }

  // Upsert daily
  async upsertDaily(date: string, data: Record<string, unknown>): Promise<void> {
    const existing = await this.findDaily(
      date,
      data.symbol as string,
      data.exchange as string,
      data.marketType as string
    );
    if (existing) {
      // Do NOT overwrite createdAt — only the aggregate values change.
      await DailyWallAggregate.update(data as any, { where: { id: existing.id } });
    } else {
      await DailyWallAggregate.create({
        ...data,
        id: `agg_${date}_${data.symbol}_${data.exchange}_${data.marketType}`,
        createdAt: Date.now(),
      } as any);
    }
  }

  // Find recent aggregates
  async findRecentAggregates(days = 30): Promise<DailyWallAggregate[]> {
    // Original sql.js semantics: LIMIT days*20, newest first.
    return DailyWallAggregate.findAll({ order: [['date', 'DESC']], limit: days * 20 });
  }
}