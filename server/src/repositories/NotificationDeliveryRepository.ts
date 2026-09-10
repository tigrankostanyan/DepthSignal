import { Op } from 'sequelize';
import { NotificationDelivery } from '../models/NotificationDelivery.js';

//  notification delivery repository
export class NotificationDeliveryRepository {
  // Find pending
  async findPending(limit = 25): Promise<NotificationDelivery[]> {
    // Matches original sql.js semantics: status IN ('pending','sending')
    // AND (next_attempt_at IS NULL OR next_attempt_at <= now).
    return NotificationDelivery.findAll({
      where: { status: { [Op.in]: ['pending', 'sending'] }, nextAttemptAt: { [Op.or]: [{ [Op.lte]: Date.now() }, null] } },
      order: [['created_at', 'ASC']],
      limit,
    });
  }

  // Find by id
  async findById(id: string): Promise<NotificationDelivery | null> {
    return NotificationDelivery.findByPk(id);
  }

  // Find by status
  async findByStatus(status: string, limit = 100): Promise<NotificationDelivery[]> {
    return NotificationDelivery.findAll({ where: { status }, order: [['created_at', 'DESC']], limit });
  }

  // Find failed
  async findFailed(limit = 100): Promise<NotificationDelivery[]> {
    return this.findByStatus('failed', limit);
  }

  // Count recent by user
  async countRecentByUser(userId: string, hours = 24): Promise<number> {
    const cutoff = Date.now() - hours * 60 * 60 * 1000;
    return NotificationDelivery.count({ where: { userId, createdAt: { [Op.gte]: cutoff } } });
  }

  // Create
  async create(data: Partial<NotificationDelivery> & { id: string; userId: string; channel: string }): Promise<NotificationDelivery> {
    return NotificationDelivery.create({ ...data, createdAt: Date.now(), attempts: 0 } as any);
  }

  // Update
  async update(id: string, data: Partial<NotificationDelivery>): Promise<void> {
    await NotificationDelivery.update(data as any, { where: { id } });
  }
}