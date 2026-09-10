'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchPlans, fetchSubscription } from '@/lib/api';
import type { ActionResult } from '@/types/index';
import type { PlanDefinition, UserSubscription } from '@/types/index';

export interface UseBillingResult {
  subscription: UserSubscription | null;
  setSubscription: React.Dispatch<React.SetStateAction<UserSubscription | null>>;
  plans: PlanDefinition[];
  openPricing: (highlightPlan?: string, reason?: string | null) => void;
  refreshSubscription: () => Promise<void>;
  refreshPlans: () => Promise<void>;
  handleStartCheckout: (planId: string, interval: 'monthly' | 'annual') => Promise<ActionResult>;
  handleOpenBillingPortal: () => Promise<void>;
}

/** Billing state: subscription, plans and navigation to the standalone pricing page. */
export function useBilling(enabled: boolean): UseBillingResult {
  const router = useRouter();
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [plans, setPlans] = useState<PlanDefinition[]>([]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    fetchSubscription()
      .then((d) => !cancelled && setSubscription(d))
      .catch(() => {});
    fetchPlans()
      .then((d) => !cancelled && setPlans(d))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  // Opens the standalone pricing page. Optional plan/reason are passed via the URL.
  const openPricing = useCallback(
    (plan = 'PRO', reason: string | null = null) => {
      const params = new URLSearchParams();
      if (plan) params.set('plan', plan);
      if (reason) params.set('reason', reason);
      router.push(`/pricing?${params.toString()}`);
    },
    [router],
  );

  const refreshSubscription = useCallback(async (): Promise<void> => {
    try {
      setSubscription(await fetchSubscription());
    } catch {
      // ignore
    }
  }, []);

  const refreshPlans = useCallback(async (): Promise<void> => {
    try {
      setPlans(await fetchPlans());
    } catch {
      // ignore
    }
  }, []);

  // Manual QR flow: "checkout" simply opens the pricing page pay section for the plan.
  const handleStartCheckout = useCallback(
    async (planId: string, interval: 'monthly' | 'annual'): Promise<ActionResult> => {
      router.push(`/pricing?plan=${encodeURIComponent(planId)}&interval=${interval === 'annual' ? 'yearly' : 'monthly'}`);
      return { ok: true };
    },
    [router],
  );

  const handleOpenBillingPortal = useCallback(async (): Promise<void> => {
    router.push('/pricing');
  }, [router]);

  return {
    subscription,
    setSubscription,
    plans,
    openPricing,
    refreshSubscription,
    refreshPlans,
    handleStartCheckout,
    handleOpenBillingPortal,
  };
}
