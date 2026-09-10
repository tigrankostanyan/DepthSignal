'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { SubscriptionPaywall } from '@/components/Billing/SubscriptionPaywall';
import { useApp } from '@/providers/AppProviders';

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const {
    isAuthenticated,
    isLoading,
    openPricing,
    requiresUpgrade,
    subscriptionStatus,
    user,
  } = useApp();
  const router = useRouter();
  const pathname = usePathname();

  // Defer render until client mount to avoid SSR mismatch.
  useEffect(() => {
    setMounted(true);
  }, []);

  // Login guard.
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  if (!mounted || isLoading || !isAuthenticated) {
    return null;
  }

  const isProfilePage = pathname === '/profile';
  // The pricing page is always reachable so users can upgrade / renew there.
  const isPricingPage = pathname === '/pricing';
  // Absolute admin bypass: an ADMIN (any casing) is never subject to the subscription paywall.
  const isAdmin = (user?.role ?? '').toUpperCase() === 'ADMIN';
  const showPaywall = !isAdmin && requiresUpgrade && !isProfilePage && !isPricingPage;

  const isExpired =
    subscriptionStatus === 'expired' ||
    subscriptionStatus === 'cancelled' ||
    subscriptionStatus === 'past_due';

  const overlayTitle = isExpired ? 'Subscription Expired' : 'Premium Subscription Required';
  const overlayDescription = isExpired
    ? 'Your subscription period has ended. Renew your plan to regain full access to institutional order book walls, live screener feeds, and real-time alerts.'
    : 'Real-time order book walls, live screener feeds, and signal alerts require an active premium subscription.';

  return (
    <div className="flex h-screen overflow-hidden bg-primary text-main">
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      <div className="flex flex-col flex-1 min-w-0">
        <TopBar />
        <main className="relative flex-1 overflow-y-auto min-h-0">
          <div
            style={
              showPaywall
                ? {
                    pointerEvents: 'none',
                    userSelect: 'none',
                    opacity: 0.4,
                  }
                : undefined
            }
            className={
              showPaywall
                ? 'pointer-events-none select-none opacity-40 flex flex-col min-h-0'
                : 'flex flex-col min-h-0'
            }
          >
            {children}
          </div>
          {showPaywall && (
            <SubscriptionPaywall
              title={overlayTitle}
              description={overlayDescription}
              buttonText="Upgrade Now"
              onUpgrade={() => openPricing('PRO', overlayTitle)}
            />
          )}
        </main>
      </div>
    </div>
  );
};
