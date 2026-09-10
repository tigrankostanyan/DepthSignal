// ==========================================
// BILLING PROVIDER ABSTRACTION
// ==========================================

import { SubscriptionPlanId, SubscriptionStatus } from '../../types/index.js';

//  checkout session result
export interface CheckoutSessionResult {
  url: string;
  sessionId: string;
  mode: 'live' | 'test' | 'sandbox';
  provider: string;
  merchantTradeNo?: string;
  qrCodeUrl?: string;
  qrContent?: string;
  deeplink?: string;
  expiresAt?: number;
}

//  customer portal result
export interface CustomerPortalResult {
  url: string;
}

//  webhook processing result
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
  transactionId?: string;
  interval?: 'monthly' | 'yearly';
  amount?: number;
  currency?: string;
}

//  billing provider
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
