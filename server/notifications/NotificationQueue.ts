// ==========================================
// NOTIFICATION DISPATCH QUEUE
// Database-backed job queue for asynchronous alert delivery
// ==========================================

import { AlertTrigger, NotificationChannelType, NotificationDelivery } from '../../src/types/index.js';
import { DatabaseService } from '../db/database.js';

export class NotificationQueue {
  private static instance: NotificationQueue;
  private db: DatabaseService;

  private constructor() {
    this.db = DatabaseService.getInstance();
  }

  public static getInstance(): NotificationQueue {
    if (!NotificationQueue.instance) {
      NotificationQueue.instance = new NotificationQueue();
    }
    return NotificationQueue.instance;
  }

  /**
   * Enqueues an alert notification job
   */
  public enqueue(
    trigger: AlertTrigger,
    channel: NotificationChannelType,
    destination: string
  ): NotificationDelivery {
    const job = this.db.createNotificationDelivery({
      alertTriggerId: trigger.id,
      userId: trigger.userId || 'usr_default_trader',
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

  public getPendingJobs(limit = 25): NotificationDelivery[] {
    return this.db.getPendingNotificationDeliveries(limit);
  }

  public markDelivered(id: string, deliveredAt = Date.now()): void {
    this.db.updateNotificationDelivery(id, {
      status: 'delivered',
      deliveredAt
    });
  }

  public markFailed(
    id: string,
    currentAttempts: number,
    maxAttempts: number,
    error: string,
    isRetryable: boolean
  ): void {
    const newAttempts = currentAttempts + 1;
    const now = Date.now();

    if (isRetryable && newAttempts < maxAttempts) {
      // Exponential backoff: 5s, 30s, 2m, 10m
      const backoffIntervals = [5000, 30000, 120000, 600000];
      const backoffMs = backoffIntervals[newAttempts - 1] || 600000;
      const nextAttemptAt = now + backoffMs;

      this.db.updateNotificationDelivery(id, {
        status: 'pending',
        attempts: newAttempts,
        nextAttemptAt,
        lastAttemptAt: now,
        lastError: error
      });
    } else {
      // Permanent failure
      this.db.updateNotificationDelivery(id, {
        status: 'failed',
        attempts: newAttempts,
        lastAttemptAt: now,
        lastError: error
      });
    }
  }
}
