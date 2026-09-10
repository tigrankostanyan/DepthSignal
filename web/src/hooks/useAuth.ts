'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApiError, fetchCurrentUser, logout } from '@/lib/api';
import type { UserProfile, TrialInfo, SubscriptionStatus, SubscriptionPlanId } from '@/types/index';

export interface UseAuthResult {
  user: UserProfile | null;
  setUser: React.Dispatch<React.SetStateAction<UserProfile | null>>;
  isAuthenticated: boolean;
  isLoading: boolean;
  trial: TrialInfo | null;
  subscriptionStatus: SubscriptionStatus | null;
  subscriptionPlan: SubscriptionPlanId | null;
  signOut: () => Promise<void>;
}

export function useAuth(): UseAuthResult {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [trial, setTrial] = useState<TrialInfo | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null);
  const [subscriptionPlan, setSubscriptionPlan] = useState<SubscriptionPlanId | null>(null);

  useEffect(() => {
    let active = true;
    fetchCurrentUser()
      .then((data) => {
        if (!active) return;
        setUser(data.user);
        setTrial(data.trial);
        setSubscriptionStatus((data.subscription?.status as SubscriptionStatus) ?? null);
        setSubscriptionPlan((data.subscription?.plan as SubscriptionPlanId) ?? null);
        setIsAuthenticated(true);
      })
      .catch(() => {
        if (!active) return;
        setUser(null);
        setTrial(null);
        setSubscriptionStatus(null);
        setSubscriptionPlan(null);
        setIsAuthenticated(false);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const signOut = useCallback(async (): Promise<void> => {
    try {
      await logout();
    } catch {
      // ignore
    }
    setUser(null);
    setTrial(null);
    setSubscriptionStatus(null);
    setSubscriptionPlan(null);
    setIsAuthenticated(false);
    router.replace('/login');
  }, [router]);

  return {
    user,
    setUser,
    isAuthenticated,
    isLoading,
    trial,
    subscriptionStatus,
    subscriptionPlan,
    signOut,
  };
}
