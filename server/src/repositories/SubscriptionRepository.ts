import { Op } from 'sequelize';
import { Subscription } from '../models/Subscription.js';
import { BillingEvent } from '../models/BillingEvent.js';
import { BillingWebhookEvent } from '../models/BillingWebhookEvent.js';

//  subscription repository
export class SubscriptionRepository {
  // Find by user
  async findByUser(userId: string): Promise<Subscription | null> {
    return Subscription.findByPk(userId);
  }

  // Upsert
  async upsert(data: Partial<Subscription> & { userId: string }): Promise<Subscription> {
    const existing = await this.findByUser(data.userId);
    const now = Date.now();
    const payload = { ...data, updatedAt: now };
    if (existing) {
      await Subscription.update(payload as any, { where: { userId: data.userId } });
      return (await this.findByUser(data.userId))!;
    }
    // Use the caller-provided values (plan/status/billingProvider) verbatim —
    // matches original INSERT OR REPLACE semantics.
    return Subscription.create({ ...payload, createdAt: now } as any);
  }

  // Update
  async update(userId: string, data: Partial<Subscription>): Promise<Subscription> {
    await Subscription.update({ ...data, updatedAt: Date.now() } as any, { where: { userId } });
    return (await this.findByUser(userId))!;
  }

  // ── BillingEvent ──────────────────────────────────────────────────────

  // Create billing event
  async createBillingEvent(data: { id: string; userId: string; eventType: string; plan?: string; provider: string; details?: string; ipAddress?: string }): Promise<BillingEvent> {
    return BillingEvent.create({ ...data, createdAt: Date.now() } as any);
  }

  // Find billing events
  async findBillingEvents(userId: string, limit = 50): Promise<BillingEvent[]> {
    return BillingEvent.findAll({ where: { userId }, order: [['created_at', 'DESC']], limit });
  }

  // ── BillingWebhookEvent ───────────────────────────────────────────────

  // Is webhook processed
  async isWebhookProcessed(eventId: string): Promise<boolean> {
    const ev = await BillingWebhookEvent.findByPk(eventId);
    return ev !== null;
  }

  // Record webhook
  async recordWebhook(data: { eventId: string; provider: string; eventType: string; payloadHash?: string; status?: string }): Promise<BillingWebhookEvent> {
    return BillingWebhookEvent.create({ ...data, processedAt: Date.now() } as any);
  }
}