// ==========================================
// ASYNCHRONOUS NOTIFICATION WORKER
// Background worker polling and dispatching notification deliveries
// ==========================================

import { NotificationChannelType, NotificationDelivery } from '../../src/types/index.js';
import { DatabaseService } from '../db/database.js';
import { NotificationQueue } from './NotificationQueue.js';
import { 
  IResilientNotifier, 
  ResilientEmailNotifier, 
  ResilientInAppNotifier, 
  ResilientTelegramNotifier, 
  ResilientWebhookNotifier 
} from './ResilientNotifiers.js';

export class NotificationWorker {
  private static instance: NotificationWorker;
  private queue: NotificationQueue;
  private db: DatabaseService;
  private notifiers = new Map<string, IResilientNotifier>();
  private intervalTimer: NodeJS.Timeout | null = null;
  private isProcessing = false;

  private constructor() {
    this.queue = NotificationQueue.getInstance();
    this.db = DatabaseService.getInstance();

    this.notifiers.set('IN_APP', new ResilientInAppNotifier());
    this.notifiers.set('EMAIL', new ResilientEmailNotifier());
    this.notifiers.set('TELEGRAM', new ResilientTelegramNotifier());
    this.notifiers.set('WEBHOOK', new ResilientWebhookNotifier());
  }

  public static getInstance(): NotificationWorker {
    if (!NotificationWorker.instance) {
      NotificationWorker.instance = new NotificationWorker();
    }
    return NotificationWorker.instance;
  }

  public start(pollIntervalMs = 1000): void {
    if (this.intervalTimer) return;
    console.log('[NotificationWorker] Starting resilient background delivery worker...');

    // On startup: immediately process any pending / unfinished jobs from prior run
    this.processPendingJobs().catch(err => {
      console.error('[NotificationWorker] Initial startup job processing error:', err);
    });

    this.intervalTimer = setInterval(() => {
      this.processPendingJobs().catch(err => {
        console.error('[NotificationWorker] Job processing error:', err);
      });
    }, pollIntervalMs);
  }

  public stop(): void {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
  }

  /**
   * Core worker loop: batches pending jobs and dispatches asynchronously
   */
  public async processPendingJobs(): Promise<number> {
    if (this.isProcessing) return 0;
    this.isProcessing = true;

    try {
      const jobs = this.queue.getPendingJobs(15);
      if (jobs.length === 0) {
        return 0;
      }

      for (const job of jobs) {
        await this.deliverJob(job);
      }

      return jobs.length;
    } finally {
      this.isProcessing = false;
    }
  }

  private async deliverJob(job: NotificationDelivery): Promise<void> {
    const notifier = this.notifiers.get(job.channel);
    if (!notifier) {
      this.queue.markFailed(
        job.id,
        job.attempts,
        job.maxAttempts,
        `No notifier found for channel '${job.channel}'`,
        false
      );
      return;
    }

    try {
      // Mark as sending
      this.db.updateNotificationDelivery(job.id, { status: 'sending', lastAttemptAt: Date.now() });

      const result = await notifier.send(job);

      if (result.success) {
        this.queue.markDelivered(job.id, result.deliveredAt || Date.now());
      } else {
        this.queue.markFailed(
          job.id,
          job.attempts,
          job.maxAttempts,
          result.error || 'Delivery failed',
          result.retryable
        );
      }
    } catch (err: any) {
      this.queue.markFailed(
        job.id,
        job.attempts,
        job.maxAttempts,
        `Unexpected worker exception: ${err.message}`,
        true
      );
    }
  }
}
