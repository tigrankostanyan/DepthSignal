'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import type {
  MarketTicker,
  DetectedWall,
  AlertRule,
  AlertTrigger,
  Watchlist,
  BlacklistEntry,
  SavedFilterPreset,
  ScreenerFilters,
  UserSettings,
  ConnectorStatus,
  ExchangeId,
  MarketType,
  UserProfile,
  TrialInfo,
  SubscriptionStatus,
} from '@/types/index';
import type { PlanDefinition, UserSubscription } from '@/types/index';
import type { ActionResult } from '@/types/index';

import { DEFAULT_SCREENER_FILTERS } from '@/lib/constants';

import { applyThemeClass, useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { useBilling } from '@/hooks/useBilling';
import { useMarketData } from '@/hooks/useMarketData';
import { useAlerts } from '@/hooks/useAlerts';
import { useWatchlists } from '@/hooks/useWatchlists';
import { useBlacklist } from '@/hooks/useBlacklist';
import { usePresets } from '@/hooks/usePresets';
import { useAlertAudio } from '@/hooks/useAlertAudio';
import { useRealtimeAlerts } from '@/hooks/useRealtimeAlerts';

import { AlertToastContainer } from '@/components/AlertToast/AlertToastContainer';

export interface AppContextValue {
  // ── Theme ──
  theme: 'dark';
  toggleTheme: () => void;

  // ── Auth ──
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signOut: () => Promise<void>;
  setUser: (user: UserProfile | null) => void;
  trial: TrialInfo | null;
  subscriptionStatus: SubscriptionStatus | null;
  requiresUpgrade: boolean;

  // ── Billing / Pricing (standalone /pricing page) ──
  subscription: UserSubscription | null;
  plans: PlanDefinition[];
  openPricing: (highlightPlan?: string, reason?: string) => void;
  refreshSubscription: () => Promise<void>;
  refreshPlans: () => Promise<void>;
  handleStartCheckout: (planId: string, interval: 'monthly' | 'annual') => Promise<ActionResult>;
  handleOpenBillingPortal: () => Promise<void>;

  // ── Market Data ──
  alertRules: AlertRule[];

  // ── Watchlists ──
  watchlists: Watchlist[];
  isSymbolWatchlisted: (symbol: string, exchange: ExchangeId, marketType: MarketType) => boolean;
  handleToggleWatchlist: (symbol: string, exchange: ExchangeId, marketType: MarketType) => Promise<boolean>;
  refreshWatchlists: () => Promise<void>;

  // ── Blacklist ──
  blacklist: BlacklistEntry[];
  handleAddBlacklist: (entry: Omit<BlacklistEntry, 'id' | 'addedAt'>) => Promise<ActionResult>;
  handleRemoveBlacklist: (id: string) => Promise<void>;

  // ── Presets ──
  presets: SavedFilterPreset[];
  refreshPresets: () => Promise<void>;
  handleSavePreset: (name: string) => Promise<void>;

  // ── Screener filters ──
  filters: ScreenerFilters;
  setFilters: React.Dispatch<React.SetStateAction<ScreenerFilters>>;

  // ── Settings ──
  settings: UserSettings | null;
  connectors: ConnectorStatus[];
  handleSaveSettings: (patch: Partial<UserSettings>) => Promise<ActionResult>;
  handleRefreshHealth: () => Promise<ActionResult>;

  // ── Wall Engine Config ──
  minVolumeUsd: number;
  maxDistancePercent: number;
  crossExchangeAggregation: boolean;
  handleUpdateMinVolume: (value: number) => Promise<void>;
  handleUpdateMaxDistance: (value: number) => Promise<void>;
  handleToggleAggregation: () => Promise<void>;

  // ── Alert Handlers ──
  handleSaveAlertRule: (rule: Partial<AlertRule>) => Promise<ActionResult>;
  handleDeleteAlertRule: (id: string) => Promise<void>;
  handleMarkAlertRead: (id: string) => Promise<void>;
  handleClearAlertTriggers: () => Promise<void>;
  handleTestSimulation: (rule: Partial<AlertRule>) => Promise<ActionResult>;

  // ── Navigation helper ──
  openSymbolFocus: (symbol: string, exchange: ExchangeId, marketType: MarketType) => void;
}

export interface RealtimeContextValue {
  tickers: MarketTicker[];
  activeWalls: DetectedWall[];
  // High-frequency data lives here so alert bursts don't re-render every useApp() consumer.
  alertTriggers: AlertTrigger[];
}

const AppContext = createContext<AppContextValue | null>(null);
const RealtimeContext = createContext<RealtimeContextValue | null>(null);


export function AppProviders({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  // ── Domain hooks ──
  const { user, setUser, isAuthenticated, isLoading, trial, subscriptionStatus, subscriptionPlan, signOut } = useAuth();

  // Admins (master role) bypass subscription gating entirely — unrestricted access to every feature.
  // Compare case-insensitively so a role stored as 'admin'/'Admin' can never re-lock the account.
  const isAdmin = (user?.role ?? '').toUpperCase() === 'ADMIN';
  const requiresUpgrade =
    !isAdmin &&
    (subscriptionPlan === 'FREE' ||
      subscriptionStatus === 'expired' ||
      subscriptionStatus === 'cancelled' ||
      subscriptionStatus === 'past_due');
  const { theme, setTheme, toggleTheme } = useTheme(user);

  const {
    subscription,
    setSubscription,
    plans,
    openPricing,
    refreshSubscription,
    refreshPlans,
    handleStartCheckout,
    handleOpenBillingPortal,
  } = useBilling(isAuthenticated && !requiresUpgrade);

  const {
    tickers,
    setTickers,
    activeWalls,
    setActiveWalls,
    settings,
    connectors,
    handleSaveSettings,
    handleRefreshHealth,
    minVolumeUsd,
    maxDistancePercent,
    crossExchangeAggregation,
    handleUpdateMinVolume,
    handleUpdateMaxDistance,
    handleToggleAggregation,
  } = useMarketData(isAuthenticated && !requiresUpgrade);

  // ── Screener filters (pure UI state) ──
  const [filters, setFilters] = useState<ScreenerFilters>(DEFAULT_SCREENER_FILTERS);

  // Opens the pricing page for plan-limit errors, highlighting the user's current plan.
  const openPricingForLimit = useCallback(
    (resource: string) => openPricing(subscription?.plan ?? 'PRO', resource),
    [openPricing, subscription?.plan],
  );

  const {
    alertRules,
    alertTriggers,
    addAlertTrigger,
    handleSaveAlertRule,
    handleDeleteAlertRule,
    handleMarkAlertRead,
    handleClearAlertTriggers,
    handleTestSimulation: testSimulation,
  } = useAlerts(isAuthenticated && !requiresUpgrade, openPricingForLimit);

  const { watchlists, isSymbolWatchlisted, handleToggleWatchlist, refreshWatchlists } = useWatchlists(
    isAuthenticated && !requiresUpgrade,
    openPricingForLimit,
  );

  const { blacklist, handleAddBlacklist, handleRemoveBlacklist } = useBlacklist(isAuthenticated && !requiresUpgrade);
  const { presets, refreshPresets, handleSavePreset } = usePresets(isAuthenticated && !requiresUpgrade, filters);

  // ── Alert sound (respects the sound-enabled setting) ──
  const playAlertSound = useAlertAudio(settings?.soundEnabled ?? true);

  // ── Institutional Dark Theme Enforcement ──
  useEffect(() => {
    applyThemeClass('dark');
    if (settings?.theme && (settings.theme as string) !== 'dark') {
      handleSaveSettings({ theme: 'dark' as any }).catch(() => {});
    }
  }, [settings?.theme, handleSaveSettings]);

  // ── SSE Realtime ──
  useRealtimeAlerts({
    enabled: isAuthenticated && !requiresUpgrade,
    onTickers: setTickers,
    setActiveWalls,
    onAlertTrigger: (trigger) => {
      addAlertTrigger(trigger);
      playAlertSound();
    },
    onSubscriptionUpdated: setSubscription,
  });

  // ── Alert test simulation plays the sound on successful delivery ──
  const handleTestSimulation = useCallback(
    (rule: Partial<AlertRule>): Promise<ActionResult> => testSimulation(rule, playAlertSound),
    [testSimulation, playAlertSound],
  );

  // ── Navigation ──
  const openSymbolFocus = useCallback(
    (symbol: string, exchange: ExchangeId, marketType: MarketType) => {
      router.push(
        `/focus?sym=${encodeURIComponent(symbol)}&ex=${encodeURIComponent(exchange)}&mt=${encodeURIComponent(marketType)}`,
      );
    },
    [router],
  );

  const value = useMemo<AppContextValue>(
    () => ({
      theme,
      toggleTheme,
      user,
      isAuthenticated,
      isLoading,
      signOut,
      setUser,
      trial,
      subscriptionStatus,
      requiresUpgrade,
      subscription,
      plans,
      openPricing,
      refreshSubscription,
      refreshPlans,
      handleStartCheckout,
      handleOpenBillingPortal,
      alertRules,
      watchlists,
      isSymbolWatchlisted,
      handleToggleWatchlist,
      refreshWatchlists,
      blacklist,
      handleAddBlacklist,
      handleRemoveBlacklist,
      presets,
      refreshPresets,
      handleSavePreset,
      filters,
      setFilters,
      settings,
      connectors,
      handleSaveSettings,
      handleRefreshHealth,
      minVolumeUsd,
      maxDistancePercent,
      crossExchangeAggregation,
      handleUpdateMinVolume,
      handleUpdateMaxDistance,
      handleToggleAggregation,
      handleSaveAlertRule,
      handleDeleteAlertRule,
      handleMarkAlertRead,
      handleClearAlertTriggers,
      handleTestSimulation,
      openSymbolFocus,
    }),
    [
      theme, toggleTheme, user, isAuthenticated, isLoading, signOut, setUser, trial, subscriptionStatus, requiresUpgrade, subscription, plans,
      openPricing, refreshSubscription, refreshPlans, handleStartCheckout,
      handleOpenBillingPortal, alertRules, watchlists,
      isSymbolWatchlisted, handleToggleWatchlist, refreshWatchlists, blacklist, handleAddBlacklist,
      handleRemoveBlacklist, presets, refreshPresets, handleSavePreset, filters, setFilters,
      settings, connectors, handleSaveSettings,
      handleRefreshHealth, minVolumeUsd, maxDistancePercent, crossExchangeAggregation,
      handleUpdateMinVolume, handleUpdateMaxDistance, handleToggleAggregation, handleSaveAlertRule,
      handleDeleteAlertRule, handleMarkAlertRead, handleClearAlertTriggers, handleTestSimulation,
      openSymbolFocus,
    ],
  );

  const realtimeValue = useMemo<RealtimeContextValue>(
    () => ({
      tickers,
      activeWalls,
      alertTriggers,
    }),
    [tickers, activeWalls, alertTriggers],
  );

  return (
    <AppContext.Provider value={value}>
      <RealtimeContext.Provider value={realtimeValue}>
        {children}
        <AlertToastContainer />
      </RealtimeContext.Provider>
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useApp must be used within AppProviders');
  }
  return ctx;
}

export function useRealtimeData(): RealtimeContextValue {
  const ctx = useContext(RealtimeContext);
  if (!ctx) {
    throw new Error('useRealtimeData must be used within AppProviders');
  }
  return ctx;
}
