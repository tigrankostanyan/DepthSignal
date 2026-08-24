// ==========================================
// BILLING PROVIDER ABSTRACTION
// ==========================================

import { SubscriptionPlanId, SubscriptionStatus } from '../../src/types/index.js';

export interface CheckoutSessionResult {
  url: string;
  sessionId: string;
  mode: 'live' | 'test' | 'sandbox';
  provider: string;
}

export interface CustomerPortalResult {
  url: string;
}

export interface WebhookProcessingResult {
  eventId: string;
  type: string;
  provider: string;
  userId?: string;
  plan?: SubscriptionPlanId;
  status?: SubscriptionStatus;
  externalCustomerId?: string;
  externalSubscriptionId?: string;
  currentPeriodStart?: number;
  currentPeriodEnd?: number;
  cancelAtPeriodEnd?: boolean;
}

export interface BillingProvider {
  readonly providerName: string;
  readonly isConfigured: boolean;

  createCheckoutSession(
    userId: string,
    plan: SubscriptionPlanId,
    interval: 'monthly' | 'yearly',
    successUrl: string,
    cancelUrl: string
  ): Promise<CheckoutSessionResult>;

  createCustomerPortalSession(
    userId: string,
    returnUrl: string
  ): Promise<CustomerPortalResult>;

  getSubscription(externalSubscriptionId: string): Promise<any>;

  handleWebhook(
    rawBody: string | Buffer,
    signature: string
  ): Promise<WebhookProcessingResult>;
}
