// ==========================================
// NOTIFICATION DISPATCH QUEUE
// Database-backed job queue for asynchronous alert delivery
// ==========================================

import { AlertTrigger, NotificationChannelType, NotificationDelivery } from '../../types/index.js';
import { DatabaseService } from '../../db/database.js';

//  notification queue
export class NotificationQueue {
  // Instance property
  private static instance: NotificationQueue;
  // Db property
  private db: DatabaseService;

  private constructor() {
    this.db = DatabaseService.getInstance();
  }

  // Get instance
  public static getInstance(): NotificationQueue {
    if (!NotificationQueue.instance) {
      NotificationQueue.instance = new NotificationQueue();
    }
    return NotificationQueue.instance;
  }

  // Enqueue
  public async enqueue(
    trigger: AlertTrigger,
    channel: NotificationChannelType,
    destination: string
  ): Promise<NotificationDelivery> {
    // Deliveries must always target a registered user.
    if (!trigger.userId) {
      throw new Error('NotificationQueue.enqueue requires a trigger bound to a registered user');
    }

    const job = await this.db.createNotificationDelivery({
      alertTriggerId: trigger.id,
      userId: trigger.userId,
      channel,
      destination,
      status: 'pending',
      maxAttempts: 4,
      nextAttemptAt: Date.now(),
      payload: {
        ruleId: trigger.ruleId,
        ruleName: trigger.ruleName,
        symbol: trigger.symbol,
        exchange: trigger.exchange,
        marketType: trigger.marketType,
        message: trigger.message,
        triggerPrice: trigger.triggerPrice,
        timestamp: trigger.timestamp
      }
    });

    return job;
  }

  // Get pending jobs
  public async getPendingJobs(limit = 25): Promise<NotificationDelivery[]> {
    return this.db.getPendingNotificationDeliveries(limit);
  }

  // Mark delivered
  public async markDelivered(id: string, deliveredAt = Date.now()): Promise<void> {
    await this.db.updateNotificationDelivery(id, {
      status: 'delivered',
      deliveredAt
    });
  }

  // Mark failed
  public async markFailed(
    id: string,
    currentAttempts: number,
    maxAttempts: number,
    error: string,
    isRetryable: boolean
  ): Promise<void> {
    const newAttempts = currentAttempts + 1;
    const now = Date.now();

    if (isRetryable && newAttempts < maxAttempts) {
      // Exponential backoff: 5s, 30s, 2m, 10m
      const backoffIntervals = [5000, 30000, 120000, 600000];
      const backoffMs = backoffIntervals[newAttempts - 1] || 600000;
      const nextAttemptAt = now + backoffMs;

      await this.db.updateNotificationDelivery(id, {
        status: 'pending',
        attempts: newAttempts,
        nextAttemptAt,
        lastAttemptAt: now,
        lastError: error
      });
    } else {
      // Permanent failure
      await this.db.updateNotificationDelivery(id, {
        status: 'failed',
        attempts: newAttempts,
        lastAttemptAt: now,
        lastError: error
      });
    }
  }
}
