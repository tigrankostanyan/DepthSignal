import { Op } from 'sequelize';
import { AlertRule } from '../models/AlertRule.js';
import { AlertTrigger } from '../models/AlertTrigger.js';

//  alert rule repository
export class AlertRuleRepository {
  // Find by user
  async findByUser(userId: string): Promise<AlertRule[]> {
    return AlertRule.findAll({ where: { userId }, order: [['created_at', 'DESC']] });
  }

  // Find all
  async findAll(): Promise<AlertRule[]> {
    return AlertRule.findAll();
  }

  // Find enabled
  async findEnabled(): Promise<AlertRule[]> {
    return AlertRule.findAll({ where: { enabled: 1 } });
  }

  // Find by id
  async findById(id: string, userId: string): Promise<AlertRule | null> {
    return AlertRule.findOne({ where: { id, userId } });
  }

  // Create
  async create(data: {
    id: string;
    userId: string;
    name?: string;
    enabled?: number;
    symbols?: string;
    exchanges?: string;
    marketTypes?: string;
    logic?: string;
    conditionsJson?: string;
    cooldownSeconds?: number;
    notifyChannels?: string;
  }): Promise<AlertRule> {
    const now = Date.now();
    return AlertRule.create({
      ...data,
      enabled: data.enabled ?? 1,
      logic: data.logic ?? 'AND',
      cooldownSeconds: data.cooldownSeconds ?? 300,
      notifyChannels: data.notifyChannels ?? 'IN_APP',
      createdAt: now,
      updatedAt: now,
    } as any);
  }

  // Update
  async update(
    id: string,
    userId: string,
    data: Partial<{
      name: string;
      enabled: number;
      symbols: string;
      exchanges: string;
      marketTypes: string;
      logic: string;
      conditionsJson: string;
      cooldownSeconds: number;
      notifyChannels: string;
    }>
  ): Promise<AlertRule | null> {
    await AlertRule.update({ ...data, updatedAt: Date.now() }, { where: { id, userId } });
    return this.findById(id, userId);
  }

  // Update last triggered
  async updateLastTriggered(id: string, timestamp: number): Promise<void> {
    await AlertRule.update({ lastTriggeredAt: timestamp, updatedAt: Date.now() }, { where: { id } });
  }

  // Delete
  async delete(id: string, userId: string): Promise<boolean> {
    const deleted = await AlertRule.destroy({ where: { id, userId } });
    return deleted > 0;
  }
}

//  alert trigger repository
export class AlertTriggerRepository {
  // Find by user
  async findByUser(userId: string, limit = 100): Promise<AlertTrigger[]> {
    // Original sql.js semantics: user-scoped OR global (user_id IS NULL).
    return AlertTrigger.findAll({
      where: { [Op.or]: [{ userId }, { userId: null }] },
      order: [['timestamp', 'DESC']],
      limit,
    });
  }

  // Find by symbol
  async findBySymbol(symbol: string, limit = 100): Promise<AlertTrigger[]> {
    return AlertTrigger.findAll({ where: { symbol }, order: [['timestamp', 'DESC']], limit });
  }

  // Create
  async create(data: {
    id: string;
    userId?: string;
    ruleId?: string;
    ruleName?: string;
    symbol?: string;
    exchange?: string;
    marketType?: string;
    message?: string;
    conditionType?: string;
    metricValue?: string;
    triggerPrice?: number;
    channel?: string;
  }): Promise<AlertTrigger> {
    return AlertTrigger.create({ ...data, channel: data.channel ?? 'IN_APP', timestamp: Date.now() } as any);
  }

  // Mark read
  async markRead(id: string, userId: string): Promise<void> {
    await AlertTrigger.update(
      { read: 1 },
      { where: { id, [Op.or]: [{ userId }, { userId: null }] } }
    );
  }

  // Mark all read
  async markAllRead(userId: string): Promise<void> {
    await AlertTrigger.update(
      { read: 1 },
      { where: { [Op.or]: [{ userId }, { userId: null }] } }
    );
  }

  // Clear
  async clear(userId: string): Promise<void> {
    await AlertTrigger.destroy({ where: { [Op.or]: [{ userId }, { userId: null }] } });
  }

  // Count since
  async countSince(userId: string, cutoff: number): Promise<number> {
    return AlertTrigger.count({ where: { userId, timestamp: { [Op.gte]: cutoff } } });
  }
}