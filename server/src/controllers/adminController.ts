import { Request, Response, NextFunction } from 'express';
import '../security/authMiddleware.js';
import { DatabaseService } from '../db/database.js';
import { UsageService } from '../services/billing/UsageService.js';
import { SSEManager } from '../services/realtime/sseManager.js';
import { SubscriptionPlanId } from '../types/index.js';

//  admin controller
export class AdminController {
  constructor(
    private readonly db: DatabaseService,
    private readonly usageService: UsageService,
    private readonly sseManager: SSEManager
  ) {}

  // Users endpoint
  users = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const users = await this.db.getAllUsers();
      const enriched = await Promise.all(
        users.map(async (u) => {
          const sub = await this.db.getUserSubscription(u.id);
          const usage = await this.usageService.getUsage(u.id);
          return { ...u, subscription: sub, usage };
        })
      );
      res.json(enriched);
    } catch (err) {
      next(err);
    }
  };

  // Set plan endpoint
  setPlan = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const targetUserId = req.params.id;
      const { plan, status } = req.body;

      if (!plan || !['FREE', 'PRO', 'ADVANCED'].includes(plan)) {
        res.status(400).json({ error: 'INVALID_PLAN', message: 'Plan must be FREE, PRO, or ADVANCED' });
        return;
      }

      const updated = await this.db.updateUserSubscription(targetUserId, {
        plan: plan as SubscriptionPlanId,
        status: status || 'active',
        billingProvider: 'manual_admin'
      });

      await this.db.recordBillingEvent({
        userId: targetUserId,
        eventType: 'manual_override',
        plan: plan as SubscriptionPlanId,
        provider: 'admin',
        details: { overriddenBy: req.user!.id, newPlan: plan }
      });

      await this.db.addAuditLog({
        userId: req.user!.id,
        action: 'ADMIN_PLAN_MODIFIED',
        resource: 'USER_SUBSCRIPTION',
        resourceId: targetUserId,
        details: { targetUserId, plan, status },
        ipAddress: req.ip
      });

      this.sseManager.broadcastUser(targetUserId, 'subscription_updated', updated);
      res.json({ status: 'ok', subscription: updated });
    } catch (err) {
      next(err);
    }
  };

  // Set role endpoint
  setRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const targetUserId = req.params.id;
      const { role } = req.body;

      const normalizedRole = typeof role === 'string' ? role.toUpperCase() : role;
      if (!normalizedRole || !['TRADER', 'ADMIN'].includes(normalizedRole)) {
        res.status(400).json({ error: 'INVALID_ROLE', message: 'Role must be TRADER or ADMIN' });
        return;
      }

      await this.db.updateUserRole(targetUserId, normalizedRole);
      await this.db.addAuditLog({
        userId: req.user!.id,
        action: 'ADMIN_ROLE_MODIFIED',
        resource: 'USER',
        resourceId: targetUserId,
        details: { targetUserId, role: normalizedRole },
        ipAddress: req.ip
      });

      res.json({ status: 'ok', role: normalizedRole });
    } catch (err) {
      next(err);
    }
  };

  // Notification deliveries endpoint
  notificationDeliveries = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const status = req.query.status as string | undefined;
      const deliveries = await this.db.getNotificationDeliveries(status, limit);
      res.json({ count: deliveries.length, data: deliveries });
    } catch (err) {
      next(err);
    }
  };

  // Retry notification endpoint
  retryNotification = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const deliveryId = req.params.id;
      await this.db.updateNotificationDelivery(deliveryId, {
        status: 'pending',
        attempts: 0,
        nextAttemptAt: Date.now()
      });

      res.json({ status: 'ok', message: 'Notification delivery re-queued for immediate dispatch' });
    } catch (err) {
      next(err);
    }
  };

  // Stats endpoint
  stats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const users = await this.db.getAllUsers();
      const plansCount: Record<string, number> = { FREE: 0, PRO: 0, ADVANCED: 0 };

      await Promise.all(
        users.map(async (u) => {
          const sub = await this.db.getUserSubscription(u.id);
          if (plansCount[sub.plan] !== undefined) {
            plansCount[sub.plan]++;
          }
        })
      );

      const failedDeliveries = await this.db.getNotificationDeliveries('failed', 500);

      res.json({
        totalUsers: users.length,
        planDistribution: plansCount,
        activeWsClients: this.sseManager.getActiveClientCount(),
        failedDeliveriesCount: failedDeliveries.length
      });
    } catch (err) {
      next(err);
    }
  };

  // Receipts endpoint (payment proofs with user context)
  receipts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const proofs = await this.db.getAllPaymentProofs(200);
      const enriched = await Promise.all(
        proofs.map(async (p) => {
          const u = await this.db.getUserById(p.userId);
          return {
            ...p,
            userEmail: u?.email,
            userName: u?.name,
          };
        })
      );
      res.json(enriched);
    } catch (err) {
      next(err);
    }
  };

  // Activate receipt endpoint (manual plan upgrade after payment proof)
  activateReceipt = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const proof = await this.db.getPaymentProofById(req.params.id);
      if (!proof) {
        res.status(404).json({ error: 'NOT_FOUND', message: 'Receipt not found.' });
        return;
      }
      if (proof.status === 'approved') {
        res.status(409).json({ error: 'ALREADY_APPROVED', message: 'This receipt is already approved.' });
        return;
      }

      // 1. Atomic status update with expectedStatus='pending' to prevent race conditions
      const updatedProof = await this.db.updatePaymentProofStatus(proof.id, 'approved', req.user!.id, 'pending');
      if (!updatedProof) {
        res.status(409).json({ error: 'ALREADY_PROCESSED', message: 'This receipt was already processed by another admin.' });
        return;
      }

      const periodMs = proof.interval === 'yearly' ? 365 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000;
      const now = Date.now();

      const updated = await this.db.updateUserSubscription(proof.userId, {
        plan: proof.plan,
        status: 'active',
        billingProvider: 'manual_qr',
        currentPeriodStart: now,
        currentPeriodEnd: now + periodMs,
        cancelAtPeriodEnd: false,
      });

      await this.db.recordBillingEvent({
        userId: proof.userId,
        eventType: 'subscription_activated',
        plan: proof.plan,
        provider: 'manual_qr',
        details: { proofId: proof.id, amountUsd: proof.amountUsd, interval: proof.interval, activatedBy: req.user!.id },
        ipAddress: req.ip,
      });

      await this.db.addAuditLog({
        userId: req.user!.id,
        action: 'ADMIN_RECEIPT_ACTIVATED',
        resource: 'PAYMENT_PROOF',
        resourceId: proof.id,
        details: { targetUserId: proof.userId, plan: proof.plan, interval: proof.interval, amountUsd: proof.amountUsd },
        ipAddress: req.ip
      });

      this.sseManager.broadcastUser(proof.userId, 'subscription_updated', updated);
      res.json({ status: 'ok', subscription: updated });
    } catch (err) {
      next(err);
    }
  };

  // Reject receipt endpoint
  rejectReceipt = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const proof = await this.db.getPaymentProofById(req.params.id);
      if (!proof) {
        res.status(404).json({ error: 'NOT_FOUND', message: 'Receipt not found.' });
        return;
      }

      const updatedProof = await this.db.updatePaymentProofStatus(proof.id, 'rejected', req.user!.id, 'pending');
      if (!updatedProof) {
        res.status(409).json({ error: 'ALREADY_PROCESSED', message: 'This receipt was already processed by another admin.' });
        return;
      }

      await this.db.addAuditLog({
        userId: req.user!.id,
        action: 'ADMIN_RECEIPT_REJECTED',
        resource: 'PAYMENT_PROOF',
        resourceId: proof.id,
        details: { targetUserId: proof.userId, plan: proof.plan },
        ipAddress: req.ip
      });

      res.json({ status: 'ok', message: 'Receipt rejected.' });
    } catch (err) {
      next(err);
    }
  };
}
