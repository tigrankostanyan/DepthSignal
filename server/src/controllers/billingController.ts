import { Request, Response, NextFunction } from 'express';
import { DatabaseService } from '../db/database.js';
import { UsageService } from '../services/billing/UsageService.js';
import { BillingProvider, WebhookProcessingResult } from '../services/billing/BillingProvider.js';
import { BinancePayProvider } from '../services/billing/BinancePayProvider.js';
import { SSEManager } from '../services/realtime/sseManager.js';
import { SUBSCRIPTION_PLANS } from '../services/billing/planConfig.js';
import { getManualPaymentConfig } from '../services/billing/manualPaymentConfig.js';
import { SubscriptionPlanId } from '../types/index.js';

//  billing controller
export class BillingController {
  constructor(
    private readonly db: DatabaseService,
    private readonly usageService: UsageService,
    private readonly billingProvider: BillingProvider,
    private readonly sseManager: SSEManager,
    private readonly binancePayProvider: BinancePayProvider = new BinancePayProvider()
  ) {}

  // Config endpoint
  config = (_req: Request, res: Response): void => {
    res.json({
      configured: this.billingProvider.isConfigured,
      provider: this.billingProvider.providerName,
      cryptoConfigured: this.binancePayProvider.isConfigured,
      cryptoProvider: this.binancePayProvider.providerName,
      manualPayment: getManualPaymentConfig()
    });
  };

  // Plans endpoint
  plans = (_req: Request, res: Response): void => {
    res.json({
      plans: Object.values(SUBSCRIPTION_PLANS),
      billingConfigured: this.billingProvider.isConfigured,
      cryptoBillingConfigured: this.binancePayProvider.isConfigured,
      manualPayment: getManualPaymentConfig()
    });
  };

  // Subscription endpoint
  subscription = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const subscription = await this.db.getUserSubscription(req.user!.id);
      const usage = await this.usageService.getUsage(req.user!.id);
      res.json({ subscription, usage, billingConfigured: this.binancePayProvider.isConfigured });
    } catch (err) {
      next(err);
    }
  };

  // Checkout endpoint
  checkout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!this.binancePayProvider.isConfigured) {
        res.status(503).json({
          error: 'BILLING_NOT_CONFIGURED',
          message: 'Binance Pay not configured'
        });
        return;
      }

      const { plan, interval, successUrl, cancelUrl } = req.body;
      if (!plan || !['PRO', 'ADVANCED'].includes(plan)) {
        res.status(400).json({ error: 'INVALID_PLAN', message: 'Valid plans for checkout are PRO or ADVANCED.' });
        return;
      }
      if (interval && !['monthly', 'yearly'].includes(interval)) {
        res.status(400).json({ error: 'INVALID_INTERVAL', message: 'Interval must be monthly or yearly.' });
        return;
      }

      const defaultSuccessUrl = successUrl || `${req.protocol}://${req.get('host')}/?billing=success`;
      const defaultCancelUrl = cancelUrl || `${req.protocol}://${req.get('host')}/?billing=cancelled`;

      const session = await this.binancePayProvider.createCheckoutSession(
        req.user!.id,
        plan as SubscriptionPlanId,
        interval || 'monthly',
        defaultSuccessUrl,
        defaultCancelUrl
      );

      res.json({ ...session, checkoutUrl: session.url });
    } catch (err) {
      next(err);
    }
  };

  // Portal endpoint
  portal = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!this.billingProvider.isConfigured) {
        res.status(503).json({
          error: 'BILLING_NOT_CONFIGURED',
          message: 'Billing not configured'
        });
        return;
      }

      const returnUrl = req.body.returnUrl || `${req.protocol}://${req.get('host')}/`;
      const portal = await this.billingProvider.createCustomerPortalSession(req.user!.id, returnUrl);
      res.json(portal);
    } catch (err) {
      next(err);
    }
  };

  // Events endpoint
  events = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const events = await this.db.getBillingEvents(req.user!.id);
      res.json(events);
    } catch (err) {
      next(err);
    }
  };

  // Sandbox checkout endpoint
  sandboxCheckout = (_req: Request, res: Response): void => {
    res.status(503).send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Billing Not Configured</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0b0f19; color: #f3f4f6; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
          .card { background: #111827; border: 1px solid #374151; border-radius: 12px; padding: 32px; max-width: 440px; width: 100%; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); text-align: center; }
          h2 { margin: 0 0 12px 0; font-size: 22px; color: #fff; }
          p { color: #9ca3af; font-size: 14px; line-height: 1.6; margin: 0 0 24px 0; }
          .btn-back { display: inline-block; background: #2B2F36; color: #fff; text-decoration: none; border-radius: 8px; padding: 12px 24px; font-size: 14px; font-weight: 600; }
          .btn-back:hover { background: #374151; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>Billing not configured</h2>
          <p>Stripe credentials are not configured in this environment. Subscription checkout is disabled.</p>
          <a href="/" class="btn-back">Return to Terminal</a>
        </div>
      </body>
      </html>
    `);
  };

  // Webhook endpoint
  webhook = async (req: Request, res: Response): Promise<void> => {
    const signature = (req.headers['stripe-signature'] as string) || (req.headers['x-webhook-signature'] as string) || '';
    const rawBody = (req as any).rawBody || JSON.stringify(req.body);

    try {
      const result = await this.billingProvider.handleWebhook(rawBody, signature);
      await this.applySubscriptionUpdate(result, req.ip);
      res.status(200).json({ received: true, eventId: result.eventId });
    } catch (err: any) {
      console.error('[BillingWebhook] Processing failure:', err.message);
      res.status(400).json({ error: 'WEBHOOK_ERROR', message: err.message });
    }
  };

  // Binance Pay checkout endpoint
  binanceCheckout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!this.binancePayProvider.isConfigured) {
        res.status(503).json({ error: 'BILLING_NOT_CONFIGURED', message: 'Binance Pay not configured' });
        return;
      }

      const { plan, interval, successUrl, cancelUrl } = req.body;
      if (!plan || !['PRO', 'ADVANCED'].includes(plan)) {
        res.status(400).json({ error: 'INVALID_PLAN', message: 'Valid plans for checkout are PRO or ADVANCED.' });
        return;
      }
      if (interval && !['monthly', 'yearly'].includes(interval)) {
        res.status(400).json({ error: 'INVALID_INTERVAL', message: 'Interval must be monthly or yearly.' });
        return;
      }

      const defaultSuccessUrl = successUrl || `${req.protocol}://${req.get('host')}/?billing=success`;
      const defaultCancelUrl = cancelUrl || `${req.protocol}://${req.get('host')}/?billing=cancelled`;

      const session = await this.binancePayProvider.createCheckoutSession(
        req.user!.id,
        plan as SubscriptionPlanId,
        interval || 'monthly',
        defaultSuccessUrl,
        defaultCancelUrl
      );

      res.json({ ...session, checkoutUrl: session.url });
    } catch (err) {
      next(err);
    }
  };

  // Binance Pay webhook endpoint (signature + idempotency enforced in provider)
  binanceWebhook = async (req: Request, res: Response): Promise<void> => {
    const rawBody = (req as any).rawBody || JSON.stringify(req.body);
    const headers = {
      timestamp: this.header(req, 'binancepay-timestamp'),
      nonce: this.header(req, 'binancepay-nonce'),
      signature: this.header(req, 'binancepay-signature')
    };

    try {
      const result = await this.binancePayProvider.handleBinanceWebhook(rawBody, headers);
      await this.applySubscriptionUpdate(result, req.ip);
      res.status(200).json({ returnCode: 'SUCCESS', returnMessage: null });
    } catch (err: any) {
      console.error('[BinanceWebhook] Processing failure:', err.message);
      const unauthorized = /signature|timestamp|nonce/i.test(err.message || '');
      res.status(unauthorized ? 401 : 400).json({ returnCode: 'FAIL', returnMessage: err.message });
    }
  };

  // Submit payment receipt (manual QR proof)
  submitReceipt = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { plan, interval, imageData, mimeType, note } = req.body || {};

      if (!plan || !['PRO', 'ADVANCED'].includes(plan)) {
        res.status(400).json({ error: 'INVALID_PLAN', message: 'Receipts are only accepted for PRO or ADVANCED plans.' });
        return;
      }
      if (!interval || !['monthly', 'yearly'].includes(interval)) {
        res.status(400).json({ error: 'INVALID_INTERVAL', message: 'Interval must be monthly or yearly.' });
        return;
      }
      if (!imageData || typeof imageData !== 'string' || !/^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=\s]+$/i.test(imageData)) {
        res.status(400).json({ error: 'INVALID_IMAGE', message: 'Attach a valid base64 image (PNG/JPEG/WebP/GIF) receipt screenshot.' });
        return;
      }
      if (!mimeType || typeof mimeType !== 'string') {
        res.status(400).json({ error: 'INVALID_MIME', message: 'Image mime type is required.' });
        return;
      }
      // 6MB upload cap (server body limit is 8mb).
      if (imageData.length > 6 * 1024 * 1024) {
        res.status(400).json({ error: 'IMAGE_TOO_LARGE', message: 'Receipt image must be under 6MB.' });
        return;
      }

      const planDef = SUBSCRIPTION_PLANS[plan as SubscriptionPlanId];
      const amountUsd = interval === 'yearly' ? planDef.priceYearlyUsd : planDef.priceMonthlyUsd;

      const receipt = await this.db.createPaymentProof({
        userId: req.user!.id,
        plan: plan as SubscriptionPlanId,
        interval,
        amountUsd,
        currency: 'USD',
        imageData,
        mimeType,
        note: typeof note === 'string' && note.trim() ? note.trim().slice(0, 2000) : undefined,
      });

      await this.db.addAuditLog({
        userId: req.user!.id,
        action: 'PAYMENT_RECEIPT_SUBMITTED',
        resource: 'PAYMENT_PROOF',
        resourceId: receipt.id,
        details: { plan, interval, amountUsd },
        ipAddress: req.ip
      });

      res.status(201).json({ status: 'ok', receipt });
    } catch (err) {
      next(err);
    }
  };

  // My receipts (metadata only — never resends the base64 payload to the client list)
  myReceipts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const proofs = await this.db.getPaymentProofsByUser(req.user!.id, 20);
      res.json(
        proofs.map((p) => ({
          id: p.id,
          plan: p.plan,
          interval: p.interval,
          amountUsd: p.amountUsd,
          currency: p.currency,
          note: p.note,
          mimeType: p.mimeType,
          status: p.status,
          reviewedAt: p.reviewedAt,
          createdAt: p.createdAt,
        }))
      );
    } catch (err) {
      next(err);
    }
  };

  private header(req: Request, name: string): string {
    const v = req.headers[name];
    return Array.isArray(v) ? v[0] || '' : v || '';
  }

  // Persist plan/status/period changes and notify the user
  private async applySubscriptionUpdate(result: WebhookProcessingResult, ipAddress?: string): Promise<void> {
    if (!result.userId || !result.plan) return;

    await this.db.updateUserSubscription(result.userId, {
      plan: result.plan,
      status: result.status || 'active',
      billingProvider: result.provider,
      externalCustomerId: result.externalCustomerId,
      externalSubscriptionId: result.externalSubscriptionId,
      currentPeriodStart: result.currentPeriodStart || Date.now(),
      currentPeriodEnd: result.currentPeriodEnd || (Date.now() + 30 * 24 * 60 * 60 * 1000),
      cancelAtPeriodEnd: result.cancelAtPeriodEnd ?? false
    });

    await this.db.recordBillingEvent({
      userId: result.userId,
      eventType: result.provider === 'binance_pay' ? 'subscription_activated' : (result.type as any),
      plan: result.plan,
      provider: result.provider,
      details: {
        eventId: result.eventId,
        type: result.type,
        status: result.status,
        transactionId: result.transactionId,
        interval: result.interval,
        amount: result.amount,
        currency: result.currency,
        currentPeriodEnd: result.currentPeriodEnd
      }
    });

    await this.db.addAuditLog({
      userId: result.userId,
      action: 'BILLING_WEBHOOK_PROCESSED',
      resource: 'BILLING',
      details: { eventId: result.eventId, type: result.type, plan: result.plan, provider: result.provider },
      ipAddress
    });

    const updatedSub = await this.db.getUserSubscription(result.userId);
    this.sseManager.broadcastUser(result.userId, 'subscription_updated', updatedSub);
  }
}