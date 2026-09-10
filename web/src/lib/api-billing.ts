// ==========================================
// BILLING & SUBSCRIPTION API
// ==========================================

import type { PlanDefinition, UserSubscription, UsageStats } from '@/types/index';
import { authFetch, safeFetch } from './api-core';

export async function fetchPlans(): Promise<PlanDefinition[]> {
  const data = await safeFetch<{ plans: PlanDefinition[]; billingConfigured: boolean }>('/api/billing/plans', undefined, { plans: [], billingConfigured: false });
  return data?.plans || [];
}

export async function fetchBillingConfig(): Promise<{ configured: boolean; provider: string }> {
  const data = await authFetch<{
    configured: boolean;
    provider: string;
    cryptoConfigured: boolean;
    cryptoProvider: string;
  }>('/api/billing/config');
  return {
    configured: data.cryptoConfigured ?? data.configured,
    provider: data.cryptoProvider ?? data.provider,
  };
}

export async function fetchIntegrationsStatus(): Promise<{
  billing: boolean;
  telegram: boolean;
  email: boolean;
  webhook: boolean;
}> {
  return authFetch('/api/integrations/status');
}

export async function fetchSubscription(): Promise<UserSubscription> {
  const data = await authFetch<{
    subscription: UserSubscription;
    usage: Record<string, unknown>;
    billingConfigured: boolean;
  }>('/api/billing/subscription');
  return data.subscription;
}

export interface BillingOverview {
  subscription: UserSubscription;
  usage: UsageStats;
  billingConfigured: boolean;
}

export async function fetchBillingOverview(): Promise<BillingOverview> {
  return authFetch<BillingOverview>('/api/billing/subscription');
}

export async function createCheckout(
  plan: string,
  billingInterval: 'monthly' | 'annual' = 'monthly',
): Promise<{ checkoutUrl: string }> {
  const res = await authFetch<{
    checkoutUrl?: string;
    url: string;
    sessionId: string;
    mode: string;
    provider: string;
  }>('/api/billing/checkout', {
    method: 'POST',
    body: JSON.stringify({
      plan,
      interval: billingInterval === 'annual' ? 'yearly' : 'monthly',
    }),
  });
  return { checkoutUrl: res.checkoutUrl || res.url };
}

export async function createPortalSession(): Promise<{ url: string }> {
  return authFetch<{ url: string }>('/api/billing/portal', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export interface BillingEvent {
  id: string;
  eventType: string;
  plan?: string;
  provider: string;
  amount?: number;
  currency?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  createdAt: number | string;
}

export async function fetchBillingEvents(): Promise<BillingEvent[]> {
  return authFetch<BillingEvent[]>('/api/billing/events');
}

export async function fetchBillingHistory(): Promise<BillingEvent[]> {
  try {
    return await authFetch<BillingEvent[]>('/api/billing/history');
  } catch {
    return await authFetch<BillingEvent[]>('/api/billing/events');
  }
}

// ── Manual QR payment ──────────────────────────────────────────────────

export interface ManualPaymentConfig {
  enabled: boolean;
  method: 'qr_link' | 'static_image';
  qrValue: string;
  qrImageUrl?: string;
  recipientName?: string;
  network?: string;
  currency: string;
  instructions: string[];
}

export async function fetchManualPaymentConfig(): Promise<ManualPaymentConfig> {
  const data = await authFetch<{ manualPayment: ManualPaymentConfig }>('/api/billing/config');
  return data.manualPayment || { enabled: false, method: 'qr_link', qrValue: '', currency: 'USD', instructions: [] };
}

// ── Payment receipts ───────────────────────────────────────────────────

export type PaymentReceiptStatus = 'pending' | 'approved' | 'rejected';

export interface PaymentReceiptRow {
  id: string;
  plan: string;
  interval: 'monthly' | 'yearly';
  amountUsd: number;
  currency: string;
  note?: string;
  mimeType: string;
  status: PaymentReceiptStatus;
  reviewedAt?: number;
  createdAt: number;
}

export async function submitPaymentReceipt(input: {
  plan: string;
  interval: 'monthly' | 'yearly';
  imageData: string;
  mimeType: string;
  note?: string;
}): Promise<{ status: string }> {
  return authFetch<{ status: string }>('/api/billing/receipts', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function fetchMyPaymentReceipts(): Promise<PaymentReceiptRow[]> {
  return authFetch<PaymentReceiptRow[]>('/api/billing/receipts');
}

