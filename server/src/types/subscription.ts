import { ExchangeId } from './index.js';
export type SubscriptionPlanId = 'FREE' | 'PRO' | 'ADVANCED';
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'cancelled' | 'expired';
export type BillingProviderType = 'stripe' | 'lemonsqueezy' | 'sandbox' | 'binance_pay';
export type NotificationChannelType = 'IN_APP' | 'EMAIL' | 'TELEGRAM' | 'WEBHOOK';

//  plan limits
export interface PlanLimits {
  maxWatchlistItems: number;
  maxActiveAlerts: number;
  maxActiveWallRules: number;
  allowedExchanges: ExchangeId[];
  alertHistoryRetentionDays: number;
  wallHistoryAccessDays: number;
  realtimeFeatureAccess: boolean;
  allowedNotificationChannels: NotificationChannelType[];
  advancedFilters: boolean;
  crossExchangeAggregation: boolean;
  maxConnectionsPerUser: number;
}

//  plan definition
export interface PlanDefinition {
  id: SubscriptionPlanId;
  name: string;
  priceMonthlyUsd: number;
  priceYearlyUsd: number;
  description: string;
  badge?: string;
  popular?: boolean;
  limits: PlanLimits;
  features: string[];
}

//  user subscription
export interface UserSubscription {
  userId: string;
  plan: SubscriptionPlanId;
  status: SubscriptionStatus;
  billingProvider: string;
  externalCustomerId?: string;
  externalSubscriptionId?: string;
  currentPeriodStart: number;
  currentPeriodEnd: number;
  cancelAtPeriodEnd: boolean;
  trialEndsAt?: number;
  createdAt: number;
  updatedAt: number;
}

export type EntitlementErrorCode = 
  | 'PLAN_LIMIT_REACHED'
  | 'FEATURE_NOT_AVAILABLE'
  | 'SUBSCRIPTION_REQUIRED'
  | 'EXCHANGE_NOT_ALLOWED'
  | 'CHANNEL_NOT_ALLOWED';

//  entitlement check result
export interface EntitlementCheckResult {
  allowed: boolean;
  reason?: string;
  code?: EntitlementErrorCode;
  limit?: number;
  currentUsage?: number;
}

//  usage stats
export interface UsageStats {
  userId: string;
  plan: SubscriptionPlanId;
  status: SubscriptionStatus;
  activeAlertsCount: number;
  maxActiveAlerts: number;
  watchlistItemsCount: number;
  maxWatchlistItems: number;
  wallRulesCount: number;
  maxWallRules: number;
  notificationDeliveries24h: number;
  allowedExchanges: ExchangeId[];
  allowedChannels: NotificationChannelType[];
  crossExchangeAggregation: boolean;
  advancedFilters: boolean;
  wallHistoryAccessDays: number;
}

//  billing event
export interface BillingEvent {
  id: string;
  userId: string;
  eventType: 'checkout_started' | 'subscription_activated' | 'plan_changed' | 'payment_failed' | 'subscription_cancelled' | 'subscription_expired' | 'manual_override';
  plan?: SubscriptionPlanId;
  provider: string;
  details?: Record<string, any>;
  ipAddress?: string;
  createdAt: number;
}

//  notification delivery
export interface NotificationDelivery {
  id: string;
  alertTriggerId?: string;
  userId: string;
  channel: NotificationChannelType;
  destination: string;
  status: 'pending' | 'sending' | 'delivered' | 'failed';
  attempts: number;
  maxAttempts: number;
  nextAttemptAt?: number;
  lastAttemptAt?: number;
  deliveredAt?: number;
  lastError?: string;
  payload?: any;
  createdAt: number;
}

//  payment receipt status
export type ReceiptStatus = 'pending' | 'approved' | 'rejected';

//  payment proof (manual QR receipt)
export interface PaymentProof {
  id: string;
  userId: string;
  plan: SubscriptionPlanId;
  interval: 'monthly' | 'yearly';
  amountUsd: number;
  currency: string;
  imageData: string;
  mimeType: string;
  note?: string;
  status: ReceiptStatus;
  reviewedBy?: string;
  reviewedAt?: number;
  createdAt: number;
}
