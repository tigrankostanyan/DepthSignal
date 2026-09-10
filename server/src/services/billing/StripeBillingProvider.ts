// STRIPE BILLING PROVIDER ADAPTER
// Supports real Stripe production/test mode & Sandbox mode

import crypto from 'crypto';
import Stripe from 'stripe';
import { SubscriptionPlanId, SubscriptionStatus } from '../../types/index.js';
import { DatabaseService } from '../../db/database.js';
import { BillingProvider, CheckoutSessionResult, CustomerPortalResult, WebhookProcessingResult } from './BillingProvider.js';
import { SUBSCRIPTION_PLANS } from './planConfig.js';

//  stripe billing provider
export class StripeBillingProvider implements BillingProvider {
  // Provider name property
  public readonly providerName = 'stripe';
  // Stripe client property
  private stripeClient: Stripe | null = null;
  // Secret key property
  private secretKey: string | undefined;
  // Webhook secret property
  private webhookSecret: string | undefined;
  // Db property
  private db: DatabaseService;

  constructor(options?: { webhookSecret?: string }) {
    this.secretKey = process.env.STRIPE_SECRET_KEY;
    this.webhookSecret = options?.webhookSecret || process.env.STRIPE_WEBHOOK_SECRET;
    this.db = DatabaseService.getInstance();

    if (this.secretKey) {
      this.stripeClient = new Stripe(this.secretKey);
    }
  }

  public get isConfigured(): boolean {
    return Boolean(this.secretKey && this.stripeClient);
  }

  // Create checkout session
  public async createCheckoutSession(
    userId: string,
    plan: SubscriptionPlanId,
    interval: 'monthly' | 'yearly' = 'monthly',
    successUrl: string,
    cancelUrl: string
  ): Promise<CheckoutSessionResult> {
    if (plan === 'FREE') {
      throw new Error('Cannot create checkout session for FREE tier.');
    }

    const planDef = SUBSCRIPTION_PLANS[plan];
    if (!planDef) {
      throw new Error(`Invalid plan: ${plan}`);
    }

    const user = await this.db.getUserById(userId);
    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    if (!this.isConfigured || !this.stripeClient) {
      throw new Error('Billing not configured: Stripe credentials (STRIPE_SECRET_KEY) are missing in environment.');
    }

    // Live / Test Stripe Checkout
    const priceId = interval === 'yearly'
      ? (plan === 'PRO' ? process.env.STRIPE_PRO_YEARLY_PRICE_ID : process.env.STRIPE_ADVANCED_YEARLY_PRICE_ID)
      : (plan === 'PRO' ? process.env.STRIPE_PRO_PRICE_ID : process.env.STRIPE_ADVANCED_PRICE_ID);

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = priceId
      ? [{ price: priceId, quantity: 1 }]
      : [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: `Trading Screener - ${planDef.name}`,
                description: planDef.description
              },
              unit_amount: (interval === 'yearly' ? planDef.priceYearlyUsd : planDef.priceMonthlyUsd) * 100,
              recurring: {
                interval: interval === 'yearly' ? 'year' : 'month'
              }
            },
            quantity: 1
          }
        ];

    const session = await this.stripeClient.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      customer_email: user.email,
      line_items: lineItems,
      success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}&plan=${plan}`,
      cancel_url: cancelUrl,
      client_reference_id: userId,
      metadata: {
        userId,
        plan,
        interval
      }
    });

    await this.db.recordBillingEvent({
      userId,
      eventType: 'checkout_started',
      plan,
      provider: 'stripe',
      details: { sessionId: session.id, interval, livemode: session.livemode }
    });

    return {
      url: session.url || successUrl,
      sessionId: session.id,
      mode: session.livemode ? 'live' : 'test',
      provider: 'stripe'
    };
  }

  // Create customer portal session
  public async createCustomerPortalSession(
    userId: string,
    returnUrl: string
  ): Promise<CustomerPortalResult> {
    if (!this.isConfigured || !this.stripeClient) {
      throw new Error('Billing not configured: Stripe credentials (STRIPE_SECRET_KEY) are missing in environment.');
    }

    const sub = await this.db.getUserSubscription(userId);
    
    if (sub.externalCustomerId) {
      const portalSession = await this.stripeClient.billingPortal.sessions.create({
        customer: sub.externalCustomerId,
        return_url: returnUrl
      });
      return { url: portalSession.url };
    }

    return { url: returnUrl };
  }

  // Get subscription
  public async getSubscription(externalSubscriptionId: string): Promise<any> {
    if (this.isConfigured && this.stripeClient) {
      return await this.stripeClient.subscriptions.retrieve(externalSubscriptionId);
    }
    return null;
  }

  // Handle webhook
  public async handleWebhook(
    rawBody: string | Buffer,
    signature: string
  ): Promise<WebhookProcessingResult> {
    if (!signature) {
      throw new Error('Missing webhook signature');
    }

    const secret = this.webhookSecret || process.env.STRIPE_WEBHOOK_SECRET;

    // 1. Real Stripe Webhook Signature Verification (when stripe signature header format is passed)
    if (this.isConfigured && this.stripeClient && secret && signature.includes('t=')) {
      let event: Stripe.Event;
      try {
        event = this.stripeClient.webhooks.constructEvent(rawBody, signature, secret);
      } catch (err: any) {
        console.error('[StripeBillingProvider] Webhook signature verification failed:', err.message);
        throw new Error(`Webhook Signature Error: ${err.message}`);
      }

      // Check Idempotency
      if (await this.db.isWebhookEventProcessed(event.id)) {
        console.log(`[StripeBillingProvider] Webhook event ${event.id} already processed. Skipping idempotently.`);
        return {
          eventId: event.id,
          type: event.type,
          provider: 'stripe'
        };
      }

      const result = this.parseStripeEvent(event);
      await this.db.recordWebhookEvent(event.id, 'stripe', event.type, undefined, 'PROCESSED');
      return result;
    }

    // 2. Direct HMAC verification (for tests or custom HMAC payloads)
    if (secret) {
      const expectedSig = crypto
        .createHmac('sha256', secret)
        .update(typeof rawBody === 'string' ? rawBody : rawBody.toString('utf-8'))
        .digest('hex');

      const cleanSig = signature.replace(/^t=\d+,v1=/, '').replace(/^v1=/, '');
      
      let isValid = false;
      try {
        const bufExpected = Buffer.from(expectedSig, 'hex');
        const bufReceived = Buffer.from(cleanSig, 'hex');
        if (bufExpected.length === bufReceived.length) {
          isValid = crypto.timingSafeEqual(bufExpected, bufReceived);
        }
      } catch {
        isValid = false;
      }

      if (!isValid) {
        throw new Error('Invalid webhook signature');
      }

      const payload = JSON.parse(typeof rawBody === 'string' ? rawBody : rawBody.toString('utf-8'));
      const eventId = payload.id || `evt_${crypto.randomUUID()}`;

      if (await this.db.isWebhookEventProcessed(eventId)) {
        return {
          eventId,
          type: payload.type || 'unknown',
          provider: 'stripe'
        };
      }

      const result: WebhookProcessingResult = {
        eventId,
        type: payload.type || 'checkout.session.completed',
        provider: 'stripe',
        userId: payload.userId || payload.data?.userId,
        plan: payload.plan || payload.data?.plan || 'PRO',
        status: payload.status || 'active',
        externalCustomerId: payload.customerId || `cus_${payload.userId}`,
        externalSubscriptionId: payload.subscriptionId || `sub_${payload.userId}`,
        currentPeriodStart: Date.now(),
        currentPeriodEnd: Date.now() + 30 * 24 * 60 * 60 * 1000,
        cancelAtPeriodEnd: false
      };

      await this.db.recordWebhookEvent(eventId, 'stripe', payload.type || 'stripe.event', undefined, 'PROCESSED');
      return result;
    }

    throw new Error('Billing not configured: STRIPE_WEBHOOK_SECRET is not configured.');
  }

  // Parse stripe event
  private parseStripeEvent(event: Stripe.Event): WebhookProcessingResult {
    const type = event.type;
    const dataObj = event.data.object as any;

    let userId = dataObj.client_reference_id || dataObj.metadata?.userId;
    let plan = (dataObj.metadata?.plan as SubscriptionPlanId) || 'PRO';
    let status: SubscriptionStatus = 'active';

    if (type === 'checkout.session.completed') {
      return {
        eventId: event.id,
        type,
        provider: 'stripe',
        userId,
        plan,
        status: 'active',
        externalCustomerId: dataObj.customer,
        externalSubscriptionId: dataObj.subscription
      };
    }

    if (type === 'customer.subscription.updated' || type === 'customer.subscription.created') {
      const stripeStatus = dataObj.status;
      if (stripeStatus === 'active') status = 'active';
      else if (stripeStatus === 'past_due') status = 'past_due';
      else if (stripeStatus === 'canceled' || stripeStatus === 'unpaid') status = 'cancelled';
      else if (stripeStatus === 'trialing') status = 'trialing';

      return {
        eventId: event.id,
        type,
        provider: 'stripe',
        userId,
        plan,
        status,
        externalCustomerId: dataObj.customer,
        externalSubscriptionId: dataObj.id,
        currentPeriodStart: dataObj.current_period_start * 1000,
        currentPeriodEnd: dataObj.current_period_end * 1000,
        cancelAtPeriodEnd: dataObj.cancel_at_period_end
      };
    }

    if (type === 'customer.subscription.deleted') {
      return {
        eventId: event.id,
        type,
        provider: 'stripe',
        userId,
        status: 'cancelled',
        externalCustomerId: dataObj.customer,
        externalSubscriptionId: dataObj.id
      };
    }

    if (type === 'invoice.payment_failed') {
      return {
        eventId: event.id,
        type,
        provider: 'stripe',
        userId,
        status: 'past_due',
        externalCustomerId: dataObj.customer,
        externalSubscriptionId: dataObj.subscription
      };
    }

    return {
      eventId: event.id,
      type,
      provider: 'stripe',
      userId
    };
  }

  // Parse sandbox event
  private parseSandboxEvent(eventId: string, payload: any): WebhookProcessingResult {
    return {
      eventId,
      type: payload.type || 'checkout.session.completed',
      provider: 'sandbox',
      userId: payload.userId || payload.data?.userId,
      plan: payload.plan || payload.data?.plan || 'PRO',
      status: payload.status || 'active',
      externalCustomerId: payload.customerId || `cus_sb_${payload.userId}`,
      externalSubscriptionId: payload.subscriptionId || `sub_sb_${payload.userId}`,
      currentPeriodStart: Date.now(),
      currentPeriodEnd: Date.now() + 30 * 24 * 60 * 60 * 1000,
      cancelAtPeriodEnd: false
    };
  }
}
