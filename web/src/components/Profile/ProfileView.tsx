'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  User,
  Mail,
  Shield,
  Calendar,
  CreditCard,
  Zap,
  Sparkles,
  LogOut,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Copy,
  Check,
  Receipt,
  Layers,
  Activity,
  ArrowUpRight,
  ShieldAlert,
  Trash2,
  Radio,
  Bell,
  Sliders,
  ChevronRight,
  Lock,
  Smartphone,
  Wallet,
} from 'lucide-react';
import { useApp } from '@/providers/AppProviders';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { formatTime } from '@/lib/format';
import { fetchBillingHistory, type BillingEvent, fetchCurrentUser, deleteUserAccount } from '@/lib/api';

export const ProfileView: React.FC = () => {
  const router = useRouter();
  const {
    user,
    setUser,
    trial,
    subscription,
    subscriptionStatus,
    openPricing,
    handleOpenBillingPortal,
    signOut,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'modules' | 'billing'>('modules');
  const [billingEvents, setBillingEvents] = useState<BillingEvent[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<boolean>(false);

  // Permanent account deletion state
  const [deleteOpen, setDeleteOpen] = useState<boolean>(false);
  const [deleteText, setDeleteText] = useState<string>('');
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const deleteConfirmed = deleteText.trim().toUpperCase() === 'DELETE';

  // Fetch billing history on mount
  const loadBillingHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    setHistoryError(null);
    try {
      const events = await fetchBillingHistory();
      setBillingEvents(Array.isArray(events) ? events : []);
    } catch (err: any) {
      console.error('[ProfileView] Failed to load billing history:', err);
      setHistoryError(err?.message || 'Failed to load billing history');
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    loadBillingHistory();
  }, [loadBillingHistory]);

  // Refresh user state and billing history
  const handleRefreshAll = async () => {
    setIsRefreshing(true);
    try {
      const [userData] = await Promise.allSettled([
        fetchCurrentUser(),
        loadBillingHistory(),
      ]);
      if (userData.status === 'fulfilled' && userData.value?.user) {
        setUser(userData.value.user);
      }
    } catch (err) {
      console.error('[ProfileView] Error refreshing profile:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleCopyId = (id: string) => {
    if (!id) return;
    navigator.clipboard.writeText(id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await signOut();
    } catch (err) {
      console.error('[ProfileView] Logout error:', err);
      router.replace('/login');
    }
  };

  const handleOpenDelete = () => {
    setDeleteError(null);
    setDeleteText('');
    setDeleteOpen(true);
  };

  const handleDeleteAccount = async () => {
    if (isDeleting || !deleteConfirmed) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await deleteUserAccount('DELETE');
      try {
        await signOut();
      } catch {
        // Ignore client logout errors if already deleted on backend
      }
      router.replace('/login');
    } catch (err: any) {
      console.error('[ProfileView] Delete account error:', err);
      setDeleteError(err?.message || 'Failed to delete account. Please try again.');
      setIsDeleting(false);
    }
  };

  const plan = subscription?.plan ?? 'FREE';
  const role = user?.role ?? 'USER';
  const isAdmin = (role ?? '').toUpperCase() === 'ADMIN';
  const isTrialActive = trial?.status === 'active';
  const isTrialExpired = trial?.status === 'expired';

  // Format subscription expiration or renewal date
  const periodEndDate = subscription?.currentPeriodEnd
    ? formatTime(subscription.currentPeriodEnd)
    : trial?.trialEndDate
      ? formatTime(trial.trialEndDate)
      : null;

  const getEventTone = (eventType: string): 'green' | 'red' | 'yellow' | 'blue' | 'purple' | 'neutral' => {
    const t = eventType.toLowerCase();
    if (t.includes('active') || t.includes('succeed') || t.includes('complete')) return 'green';
    if (t.includes('fail') || t.includes('cancel') || t.includes('expire')) return 'red';
    if (t.includes('start') || t.includes('pending')) return 'yellow';
    if (t.includes('change') || t.includes('update')) return 'blue';
    return 'neutral';
  };

  // Modules list for the timeline (matches reference design layout)
  const platformModules = [
    {
      id: 'walls',
      title: 'Order Book Wall Engine',
      category: 'Whale Liquidity & Spoof Detection',
      description: 'Real-time 20-level depth wall detection with automated size aggregation and pressure metrics.',
      status: 'Active • 20 Levels',
      statusTone: 'green' as const,
      route: '/walls',
      icon: Layers,
    },
    {
      id: 'stream',
      title: 'Real-Time Streaming Feeds',
      category: 'Low Latency Exchange Ingestion',
      description: 'Zero-lag direct WebSocket feeds for Binance L2 Futures, Spot books, and trades.',
      status: 'Live Connected',
      statusTone: 'blue' as const,
      route: '/',
      icon: Radio,
    },
    {
      id: 'alerts',
      title: 'Alert Triggers & Telegram Bot',
      category: 'Signals & Push Dispatches',
      description: 'Instant institutional sound alerts, webhook integration, and Telegram alert triggers.',
      status: isAdmin || plan === 'ADVANCED' ? 'Unlimited Triggers' : plan === 'PRO' ? '25 Active Rules' : '3 Basic Triggers',
      statusTone: 'purple' as const,
      route: '/alerts',
      icon: Bell,
    },
    {
      id: 'watchlists',
      title: 'Watchlists & Matrix Focus',
      category: 'Multi-Symbol Tracking',
      description: 'Organize high-conviction symbols into custom watchlists with persistent order book filters.',
      status: isAdmin || plan === 'ADVANCED' ? 'Unlimited Capacity' : plan === 'PRO' ? '50 Symbols' : '5 Symbols',
      statusTone: 'green' as const,
      route: '/watchlists',
      icon: Activity,
    },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#071522] select-none text-xs text-main">
      {/* Top Header */}
      <div className="flex-none">
        <PageHeader
          icon={<User size={18} />}
          iconClassName="p-2 rounded-lg bg-[#168FD6]/15 border border-[#168FD6]/30 text-[#24C4E8]"
          title="User Profile & Account"
          subtitle="Manage credentials, subscription tiers, platform entitlements, and billing data"
          actions={
            <div className="flex items-center space-x-2">
              <button
                onClick={handleRefreshAll}
                disabled={isRefreshing}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-[#1A3654] bg-[#0B1E33] hover:bg-[#102A45] text-muted hover:text-white transition cursor-pointer disabled:opacity-50"
                title="Refresh profile and billing history"
              >
                <RefreshCw size={13} className={isRefreshing ? 'animate-spin text-[#24C4E8]' : ''} />
                <span className="hidden sm:inline">Refresh</span>
              </button>

              <button
                onClick={() => openPricing()}
                className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-[#168FD6] to-[#24C4E8] text-white font-bold transition shadow-sm hover:brightness-110 active:scale-95 cursor-pointer"
                title="View plans and upgrade"
              >
                <Sparkles size={13} />
                <span>Upgrade Plan</span>
              </button>

              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-[#F6465D]/30 bg-[#F6465D]/10 hover:bg-[#F6465D]/20 text-[#F6465D] font-bold transition cursor-pointer disabled:opacity-50 active:scale-95"
                title="Log out of your account"
              >
                <LogOut size={13} className={isLoggingOut ? 'animate-spin' : ''} />
                <span className="hidden sm:inline">{isLoggingOut ? 'Logging out...' : 'Log Out'}</span>
              </button>
            </div>
          }
        />
      </div>

      {/* Main Content Scrollable Area */}
      <div className="flex-1 overflow-y-auto min-h-0 p-4 sm:p-6 space-y-6 max-w-7xl w-full mx-auto">
        {/* ══════════════════════════════════════════════════════════════
            ROW 1: Profile Summary (Left) + Payment Data (Right)
            ══════════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Card 1: User Profile Card (Reference-style Left Card, ~7-8 cols) */}
          <div className="lg:col-span-8 bg-[#0B1E33] rounded-2xl border border-[#1A3654] p-6 shadow-xl relative overflow-hidden flex flex-col justify-between">
            {/* Soft Ambient Glow */}
            <div className="absolute -right-10 -top-10 w-48 h-48 bg-[#168FD6]/10 rounded-full blur-3xl pointer-events-none" />

            <div>
              {/* Profile Top Row: Avatar & Name */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#1A3654]/70">
                <div className="flex items-center space-x-4">
                  {/* Avatar circle with glow and active dot */}
                  <div className="relative">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-[#168FD6] via-[#2455C3] to-[#24C4E8] p-[2px] shadow-lg flex-none">
                      <div className="w-full h-full rounded-full bg-[#071522] flex items-center justify-center text-lg font-black tracking-wider text-[#24C4E8]">
                        {user?.name ? user.name.slice(0, 2).toUpperCase() : 'DS'}
                      </div>
                    </div>
                    {/* Status indicator */}
                    <div className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-[#0ECB81] border-2 border-[#071522] shadow" title="Online & Authenticated" />
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center space-x-2.5 flex-wrap">
                      <h2 className="text-lg font-bold text-white tracking-tight truncate">
                        {user?.name || 'Trading Member'}
                      </h2>
                      <Badge tone={isAdmin ? 'purple' : plan === 'ADVANCED' ? 'purple' : plan === 'PRO' ? 'yellow' : 'blue'} size="sm">
                        {isAdmin ? 'ADMIN' : plan}
                      </Badge>
                    </div>
                    <p className="text-xs text-[#8CA0B8] flex items-center space-x-1.5 mt-1 truncate">
                      <Mail size={13} className="shrink-0 text-[#168FD6]" />
                      <span className="truncate">{user?.email || '—'}</span>
                    </p>
                  </div>
                </div>

                {/* Top-Right Quick Badge / Session Status */}
                <div className="flex items-center space-x-2">
                  <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-[#0F253C] border border-[#1A3654] text-[11px] text-[#24C4E8]">
                    <span className="w-2 h-2 rounded-full bg-[#0ECB81] animate-pulse" />
                    <span>Session Active</span>
                  </div>
                </div>
              </div>

              {/* Profile Details Grid (Key-Value pairs like reference image) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-6 py-4 text-xs">
                {/* Registration Date */}
                <div className="flex items-center justify-between py-1 border-b border-[#1A3654]/40">
                  <span className="text-[#8CA0B8] flex items-center space-x-2">
                    <Calendar size={13} className="text-[#168FD6]" />
                    <span>Member Since:</span>
                  </span>
                  <span className="font-mono text-white">
                    {user?.createdAt ? new Date(user.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'Active Member'}
                  </span>
                </div>

                {/* Account ID */}
                <div className="flex items-center justify-between py-1 border-b border-[#1A3654]/40">
                  <span className="text-[#8CA0B8] flex items-center space-x-2">
                    <User size={13} className="text-[#168FD6]" />
                    <span>Account ID:</span>
                  </span>
                  <div className="flex items-center space-x-1.5 font-mono">
                    <span className="text-[11px] bg-[#071522] px-2 py-0.5 rounded border border-[#1A3654] text-white">
                      {user?.id ? `${user.id.slice(0, 10)}...` : '—'}
                    </span>
                    {user?.id && (
                      <button
                        onClick={() => handleCopyId(user.id)}
                        className="p-1 rounded hover:bg-[#102A45] text-[#8CA0B8] hover:text-[#24C4E8] transition cursor-pointer"
                        title="Copy full User ID"
                      >
                        {copiedId ? <Check size={12} className="text-[#0ECB81]" /> : <Copy size={12} />}
                      </button>
                    )}
                  </div>
                </div>

                {/* Security Level */}
                <div className="flex items-center justify-between py-1 border-b border-[#1A3654]/40">
                  <span className="text-[#8CA0B8] flex items-center space-x-2">
                    <Shield size={13} className="text-[#0ECB81]" />
                    <span>Security Level:</span>
                  </span>
                  <span className="flex items-center space-x-1 text-[#0ECB81] font-semibold">
                    <Lock size={12} />
                    <span>Hardened Cookie Auth</span>
                  </span>
                </div>

                {/* Data Connector */}
                <div className="flex items-center justify-between py-1 border-b border-[#1A3654]/40">
                  <span className="text-[#8CA0B8] flex items-center space-x-2">
                    <Radio size={13} className="text-[#24C4E8]" />
                    <span>Connected Feed:</span>
                  </span>
                  <span className="font-mono text-[#24C4E8] font-bold">
                    Binance L2 + Spot
                  </span>
                </div>
              </div>
            </div>

            {/* Profile Bottom Action Bar / Channel Badges */}
            <div className="pt-3 border-t border-[#1A3654]/70 flex flex-wrap items-center justify-between gap-3 text-[11px]">
              <div className="flex items-center space-x-2 flex-wrap">
                <span className="text-[#8CA0B8]">Channels & Alerts:</span>
                <span className="px-2 py-0.5 rounded bg-[#071522] border border-[#1A3654] text-[#8CA0B8] flex items-center gap-1">
                  <Bell size={11} className="text-[#24C4E8]" /> Audio Alerts
                </span>
                <span className="px-2 py-0.5 rounded bg-[#071522] border border-[#1A3654] text-[#8CA0B8] flex items-center gap-1">
                  <Smartphone size={11} className="text-[#0ECB81]" /> Telegram Bot
                </span>
                <span className="px-2 py-0.5 rounded bg-[#071522] border border-[#1A3654] text-[#8CA0B8] flex items-center gap-1">
                  <Shield size={11} className="text-purple-400" /> SSL Secured
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => router.push('/settings')}
                  className="text-[#24C4E8] hover:text-white transition flex items-center space-x-1 font-semibold cursor-pointer"
                >
                  <Sliders size={12} />
                  <span>Preferences</span>
                </button>
              </div>
            </div>
          </div>

          {/* Card 2: Payment & Billing Data (Reference-style Right Card, ~4-5 cols) */}
          <div className="lg:col-span-4 bg-[#0B1E33] rounded-2xl border border-[#1A3654] p-6 shadow-xl relative overflow-hidden flex flex-col justify-between">
            <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-[#24C4E8]/5 rounded-full blur-2xl pointer-events-none" />

            <div>
              {/* Card Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <div className="p-2 rounded-lg bg-[#168FD6]/15 border border-[#168FD6]/30 text-[#24C4E8]">
                    <CreditCard size={16} />
                  </div>
                  <h3 className="font-bold text-white text-sm">Payment & Billing</h3>
                </div>
                <Badge tone="blue" size="sm">SECURE</Badge>
              </div>

              <p className="text-xs text-[#8CA0B8] mb-4">
                Active payment method & billing gateway integration:
              </p>

              {/* Masked Card / Gateway Box (Directly inspired by reference card number box) */}
              <div className="bg-[#071522] rounded-xl border border-[#1A3654] p-3.5 mb-4 space-y-2">
                <div className="flex items-center justify-between text-[11px] text-[#8CA0B8]">
                  <span>Payment Gateway</span>
                  <span className="font-mono uppercase text-[#24C4E8] font-bold">
                    {subscription?.billingProvider || 'Stripe / Crypto'}
                  </span>
                </div>
                <div className="font-mono text-sm tracking-widest text-white font-bold flex items-center justify-between">
                  <span>•••• •••• •••• 4289</span>
                  <Shield size={14} className="text-[#0ECB81]" />
                </div>
                <div className="flex items-center justify-between text-[10px] text-[#8CA0B8] pt-1 border-t border-[#1A3654]/50">
                  <span>Status: Verified & Encrypted</span>
                  <span className="text-[#0ECB81]">Ready</span>
                </div>
              </div>

              {/* Supported / Active Payment Providers Logos / Badges */}
              <div className="mb-4">
                <span className="text-[11px] text-[#8CA0B8] block mb-2 font-medium">Supported Payment Methods:</span>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="py-1.5 px-2 rounded-lg bg-[#071522] border border-[#1A3654] font-bold text-[11px] text-[#24C4E8] tracking-wider shadow-sm flex items-center justify-center">
                    VISA
                  </div>
                  <div className="py-1.5 px-2 rounded-lg bg-[#071522] border border-[#1A3654] font-bold text-[11px] text-[#F6465D] tracking-wider shadow-sm flex items-center justify-center">
                    MC
                  </div>
                  <div className="py-1.5 px-2 rounded-lg bg-[#071522] border border-[#1A3654] font-bold text-[11px] text-[#0ECB81] tracking-wider shadow-sm flex items-center justify-center">
                    GPay
                  </div>
                  <div className="py-1.5 px-2 rounded-lg bg-[#071522] border border-[#1A3654] font-bold text-[11px] text-yellow-400 tracking-wider shadow-sm flex items-center justify-center">
                    Crypto
                  </div>
                </div>
              </div>
            </div>

            {/* Manage Portal Action */}
            <div className="pt-3 border-t border-[#1A3654]/70">
              <button
                onClick={handleOpenBillingPortal}
                className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl border border-[#168FD6]/40 bg-[#168FD6]/10 hover:bg-[#168FD6]/20 text-[#24C4E8] font-bold text-xs transition cursor-pointer shadow-sm active:scale-98"
              >
                <ExternalLink size={13} />
                <span>Manage Billing & Invoices</span>
              </button>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════
            ROW 2: Platform Modules Timeline (Left) + Subscription Tier (Right)
            ══════════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Main Left Section: Modules & Timeline OR Billing History Tab (~7-8 cols) */}
          <div className="lg:col-span-8 bg-[#0B1E33] rounded-2xl border border-[#1A3654] p-6 shadow-xl flex flex-col justify-between">
            <div>
              {/* Section Header with Tabs */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-4 border-b border-[#1A3654]/70 gap-3">
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">
                    {activeTab === 'modules' ? 'Platform Entitlements & Modules' : 'Billing & Transaction Invoices'}
                  </h3>
                  <p className="text-xs text-[#8CA0B8] mt-0.5">
                    {activeTab === 'modules'
                      ? 'Live indicators for detection engines, feed connectors, and alert pipelines'
                      : 'Verified logs of checkout sessions, subscription renewals, and upgrades'}
                  </p>
                </div>

                {/* Tab Switcher */}
                <div className="flex items-center p-1 rounded-xl bg-[#071522] border border-[#1A3654] self-start sm:self-auto">
                  <button
                    onClick={() => setActiveTab('modules')}
                    className={`px-3 py-1.5 rounded-lg font-bold text-xs transition cursor-pointer flex items-center space-x-1.5 ${
                      activeTab === 'modules'
                        ? 'bg-[#168FD6] text-white shadow'
                        : 'text-[#8CA0B8] hover:text-white'
                    }`}
                  >
                    <Layers size={13} />
                    <span>Modules</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('billing')}
                    className={`px-3 py-1.5 rounded-lg font-bold text-xs transition cursor-pointer flex items-center space-x-1.5 ${
                      activeTab === 'billing'
                        ? 'bg-[#168FD6] text-white shadow'
                        : 'text-[#8CA0B8] hover:text-white'
                    }`}
                  >
                    <Receipt size={13} />
                    <span>Invoices</span>
                    {billingEvents.length > 0 && (
                      <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 text-white font-mono">
                        {billingEvents.length}
                      </span>
                    )}
                  </button>
                </div>
              </div>

              {/* TAB 1: Platform Modules Timeline (Reference "Мои курсы" visual style) */}
              {activeTab === 'modules' && (
                <div className="relative pl-6 sm:pl-8 space-y-4 my-2">
                  {/* Vertical connecting line */}
                  <div className="absolute left-2.5 sm:left-3.5 top-5 bottom-5 w-[2px] bg-gradient-to-b from-[#168FD6] via-[#24C4E8] to-[#1A3654]" />

                  {platformModules.map((mod, index) => {
                    const IconComp = mod.icon;
                    return (
                      <div key={mod.id} className="relative group">
                        {/* Timeline Node Circle */}
                        <div className="absolute -left-6 sm:-left-8 top-4 w-5 h-5 rounded-full bg-[#071522] border-2 border-[#24C4E8] flex items-center justify-center shadow-md group-hover:border-[#0ECB81] transition-colors">
                          <div className="w-2 h-2 rounded-full bg-[#24C4E8] group-hover:bg-[#0ECB81] transition-colors" />
                        </div>

                        {/* Module Card (Matches the reference course card) */}
                        <div className="bg-[#071522] hover:bg-[#0F253C] rounded-xl border border-[#1A3654] p-4 transition-all duration-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 group-hover:border-[#168FD6]/40">
                          <div className="space-y-1">
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-white text-sm group-hover:text-[#24C4E8] transition-colors">
                                {mod.title}
                              </span>
                              <span className="text-[11px] text-[#8CA0B8]">— {mod.category}</span>
                            </div>
                            <p className="text-xs text-[#8CA0B8] leading-relaxed max-w-xl">
                              {mod.description}
                            </p>
                          </div>

                          <div className="flex items-center space-x-3 self-end sm:self-center shrink-0">
                            <Badge tone={mod.statusTone} size="sm">
                              {mod.status}
                            </Badge>

                            <button
                              onClick={() => router.push(mod.route)}
                              className="w-8 h-8 rounded-lg bg-[#0B1E33] border border-[#1A3654] hover:bg-[#168FD6] hover:text-white text-[#24C4E8] flex items-center justify-center transition cursor-pointer shadow-sm"
                              title={`Open ${mod.title}`}
                            >
                              <ArrowUpRight size={15} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* TAB 2: Billing & Invoice History Table */}
              {activeTab === 'billing' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs text-[#8CA0B8]">
                    <span>Transaction records fetched from <code className="text-[#24C4E8] font-mono">/api/billing/history</code></span>
                    <button
                      onClick={loadBillingHistory}
                      disabled={isLoadingHistory}
                      className="flex items-center space-x-1 hover:text-white transition cursor-pointer"
                    >
                      <RefreshCw size={12} className={isLoadingHistory ? 'animate-spin text-[#24C4E8]' : ''} />
                      <span>Reload</span>
                    </button>
                  </div>

                  {isLoadingHistory ? (
                    <div className="py-12 flex flex-col items-center justify-center space-y-3">
                      <RefreshCw size={24} className="animate-spin text-[#24C4E8]" />
                      <span className="text-xs text-[#8CA0B8]">Loading billing transaction history...</span>
                    </div>
                  ) : historyError ? (
                    <div className="p-6 text-center space-y-3 bg-[#071522] rounded-xl border border-[#1A3654]">
                      <ShieldAlert size={24} className="text-[#F6465D] mx-auto" />
                      <p className="text-xs text-[#F6465D] font-bold">{historyError}</p>
                      <button
                        onClick={loadBillingHistory}
                        className="px-3 py-1.5 rounded-lg bg-[#0B1E33] border border-[#1A3654] text-xs text-white hover:bg-[#102A45] cursor-pointer"
                      >
                        Retry Loading
                      </button>
                    </div>
                  ) : billingEvents.length === 0 ? (
                    <div className="py-12 bg-[#071522] rounded-xl border border-[#1A3654] flex flex-col items-center justify-center p-6 text-center">
                      <Receipt size={32} className="text-[#8CA0B8]/50 mb-2" />
                      <h4 className="font-bold text-sm text-white mb-1">No Past Invoices Recorded</h4>
                      <p className="text-[#8CA0B8] max-w-sm mb-4 text-xs">
                        When you start a checkout session or renew your subscription, records will appear here.
                      </p>
                      <button
                        onClick={() => openPricing()}
                        className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-[#168FD6] hover:bg-[#1C9AE5] text-white font-bold text-xs transition cursor-pointer shadow shadow-[#168FD6]/20"
                      >
                        <Sparkles size={13} />
                        <span>View Subscription Plans</span>
                      </button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-[#1A3654] bg-[#071522]">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-[#1A3654] bg-[#0B1E33] text-[11px] text-[#8CA0B8] uppercase font-bold tracking-wider">
                            <th className="py-3 px-4">Event</th>
                            <th className="py-3 px-4">Plan Tier</th>
                            <th className="py-3 px-4">Gateway</th>
                            <th className="py-3 px-4">Status</th>
                            <th className="py-3 px-4 text-right">Date</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#1A3654]/60 text-xs">
                          {billingEvents.map((evt) => {
                            const tone = getEventTone(evt.eventType);
                            const formattedDate = formatTime(evt.createdAt);
                            const displayTitle = evt.eventType.replace(/_/g, ' ');

                            return (
                              <tr key={evt.id} className="hover:bg-[#0B1E33]/60 transition-colors">
                                <td className="py-3 px-4 font-semibold text-white capitalize">
                                  {displayTitle}
                                </td>
                                <td className="py-3 px-4">
                                  {evt.plan ? (
                                    <Badge tone={evt.plan === 'ADVANCED' ? 'purple' : evt.plan === 'PRO' ? 'yellow' : 'neutral'} size="sm">
                                      {evt.plan}
                                    </Badge>
                                  ) : (
                                    <span className="text-[#8CA0B8]">—</span>
                                  )}
                                </td>
                                <td className="py-3 px-4 font-mono text-[11px] text-[#8CA0B8]">
                                  {evt.provider || 'Stripe'}
                                </td>
                                <td className="py-3 px-4">
                                  <Badge tone={tone} size="sm">
                                    {evt.eventType.includes('fail')
                                      ? 'Failed'
                                      : evt.eventType.includes('active') || evt.eventType.includes('complete')
                                        ? 'Succeeded'
                                        : 'Processed'}
                                  </Badge>
                                </td>
                                <td className="py-3 px-4 text-right font-mono text-[11px] text-[#8CA0B8]">
                                  {formattedDate}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Bottom summary info */}
            <div className="mt-4 pt-3 border-t border-[#1A3654]/70 flex items-center justify-between text-[11px] text-[#8CA0B8]">
              <span>Latency SLA: Sub-20ms WebSocket Stream</span>
              <span>Global WebSocket Clusters Active</span>
            </div>
          </div>

          {/* Right Subscription Highlight Card (Exact reference style purple card, ~4-5 cols) */}
          <div className="lg:col-span-4 rounded-2xl p-6 shadow-2xl relative overflow-hidden flex flex-col justify-between border border-[#24C4E8]/30 bg-gradient-to-br from-[#173D9A] via-[#102A45] to-[#0B1E33]">
            {/* Top decorative glow */}
            <div className="absolute top-0 right-0 w-44 h-44 bg-[#24C4E8]/15 rounded-full blur-3xl pointer-events-none" />

            <div>
              {/* Badge & Title */}
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#BCEFFF] px-2.5 py-0.5 rounded-full bg-[#24C4E8]/20 border border-[#24C4E8]/30">
                  {isAdmin ? 'ADMINISTRATIVE PRIVILEGE' : plan === 'ADVANCED' ? 'INSTITUTIONAL TIER' : plan === 'PRO' ? 'PRO TRADER' : 'FREE EXPLORER'}
                </span>
                <Sparkles size={16} className="text-[#24C4E8]" />
              </div>

              <h3 className="text-xl font-black text-white tracking-tight leading-snug mb-2">
                {isAdmin
                  ? 'Institutional Master Access'
                  : plan === 'ADVANCED'
                    ? 'Advanced Institutional L2'
                    : plan === 'PRO'
                      ? 'Pro Market Screener'
                      : 'MyScreener Institutional Suite'}
              </h3>

              <p className="text-xs text-[#BCEFFF]/80 mb-5 leading-relaxed">
                {isAdmin
                  ? 'All institutional L2 feeds, depth walls, automated signals, and unlimited watchlists are fully unlocked for your account.'
                  : isTrialActive
                    ? `Your full-access trial is active with ${trial?.remainingDays} days remaining.`
                    : 'Unlock millisecond-grade order book wall detection, spoofing analytics, and real-time audio triggers.'}
              </p>

              {/* Feature Checklist (Exact bullet list from reference image) */}
              <div className="space-y-3 py-4 border-t border-white/10 text-xs">
                <div className="flex items-center space-x-2.5 text-[#F4F7FA]">
                  <CheckCircle2 size={15} className="text-[#0ECB81] shrink-0" />
                  <span>20 depth levels full order book wall detection</span>
                </div>
                <div className="flex items-center space-x-2.5 text-[#F4F7FA]">
                  <CheckCircle2 size={15} className="text-[#0ECB81] shrink-0" />
                  <span>Real-time Binance L2 WebSocket streaming</span>
                </div>
                <div className="flex items-center space-x-2.5 text-[#F4F7FA]">
                  <CheckCircle2 size={15} className="text-[#0ECB81] shrink-0" />
                  <span>Unlimited alert triggers & Telegram bot push</span>
                </div>
                <div className="flex items-center space-x-2.5 text-[#F4F7FA]">
                  <CheckCircle2 size={15} className="text-[#0ECB81] shrink-0" />
                  <span>Custom watchlists & persistent wall filters</span>
                </div>
                <div className="flex items-center space-x-2.5 text-[#F4F7FA]">
                  <CheckCircle2 size={15} className="text-[#0ECB81] shrink-0" />
                  <span>Cancel, switch, or manage anytime in 1-click</span>
                </div>
              </div>

              {/* Expiration or Status metadata if present */}
              {periodEndDate && (
                <div className="mt-2 py-2 px-3 rounded-lg bg-black/20 border border-white/10 text-[11px] text-[#BCEFFF] flex items-center justify-between">
                  <span>{isTrialActive ? 'Trial Ends:' : 'Renewal Date:'}</span>
                  <span className="font-mono text-white font-bold">{periodEndDate}</span>
                </div>
              )}
            </div>

            {/* Bottom High-Contrast CTA Button (Matches white button in reference) */}
            <div className="mt-6 pt-4 border-t border-white/10">
              <button
                onClick={() => openPricing()}
                className="w-full py-3 px-4 rounded-xl bg-white hover:bg-[#F4F7FA] text-[#071522] font-black text-xs uppercase tracking-wider transition duration-150 shadow-lg hover:shadow-xl active:scale-98 cursor-pointer flex items-center justify-center space-x-2"
              >
                <span>{isAdmin ? 'Review Plans & Tiers' : plan === 'FREE' ? 'Upgrade to Pro' : 'Manage Subscription'}</span>
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════
            ROW 3: Security, Session Management & Danger Zone
            ══════════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2">
          {/* Card: Active Session & Sign Out */}
          <div className="bg-[#0B1E33] rounded-2xl border border-[#1A3654] p-5 shadow-lg flex flex-col justify-between">
            <div className="space-y-1 mb-4">
              <h4 className="font-bold text-white text-sm flex items-center space-x-2">
                <LogOut size={15} className="text-[#168FD6]" />
                <span>Session & Authentication</span>
              </h4>
              <p className="text-xs text-[#8CA0B8] leading-relaxed">
                Terminate your authenticated session on this device. Secure session cookies will be safely cleared.
              </p>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-[#1A3654]/70">
              <span className="text-[11px] text-[#8CA0B8]">Session: Encrypted AES</span>
              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="flex items-center space-x-1.5 px-4 py-2 rounded-lg border border-[#1A3654] bg-[#071522] hover:bg-[#102A45] text-white font-bold text-xs transition cursor-pointer disabled:opacity-50"
              >
                <LogOut size={13} className={isLoggingOut ? 'animate-spin' : ''} />
                <span>{isLoggingOut ? 'Logging out...' : 'Sign Out'}</span>
              </button>
            </div>
          </div>

          {/* Card: Permanent Account Deletion */}
          <div className="bg-[#1A0B10] rounded-2xl border border-[#F6465D]/30 p-5 shadow-lg flex flex-col justify-between">
            <div className="space-y-1 mb-4">
              <h4 className="font-bold text-[#F6465D] text-sm flex items-center space-x-2">
                <ShieldAlert size={15} className="text-[#F6465D]" />
                <span>Permanent Account Deletion</span>
              </h4>
              <p className="text-xs text-[#8CA0B8] leading-relaxed">
                Irreversibly wipe your account, custom watchlists, alerts, and billing history from the server.
              </p>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-[#F6465D]/20">
              <span className="text-[11px] text-[#F6465D]/70">Permanent & Irreversible</span>
              <button
                onClick={handleOpenDelete}
                className="flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-[#F6465D] hover:bg-[#d63b50] text-white font-bold text-xs transition shadow cursor-pointer active:scale-95"
              >
                <Trash2 size={13} />
                <span>Delete Account</span>
              </button>
            </div>
          </div>
        </div>

        {/* Delete Account Confirmation Modal */}
        <Modal
          open={deleteOpen}
          onClose={() => { if (!isDeleting) setDeleteOpen(false); }}
          title="Delete Account — Permanent"
          maxWidth="max-w-lg"
          description="Warning: Deleting your account is permanent and irreversible. Once deleted, you will never be able to register again using this email address."
          footer={
            <>
              <button
                onClick={() => { if (!isDeleting) setDeleteOpen(false); }}
                disabled={isDeleting}
                className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={!deleteConfirmed || isDeleting}
                className="px-4 py-2 rounded-lg bg-[#F6465D] hover:bg-[#d63b50] text-white text-xs font-bold transition shadow disabled:opacity-40 disabled:cursor-not-allowed flex items-center space-x-1.5"
              >
                {isDeleting ? (
                  <>
                    <Trash2 size={13} className="animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={13} />
                    <span>Permanently Delete</span>
                  </>
                )}
              </button>
            </>
          }
        >
          <div className="space-y-3">
            <div className="flex items-start space-x-2 text-xs rounded-lg bg-[#F6465D]/10 border border-[#F6465D]/20 px-3 py-2 text-[#FFD9DE]">
              <AlertTriangle size={14} className="shrink-0 mt-0.5 text-[#F6465D]" />
              <span>
                This will permanently delete the account{' '}
                <strong className="text-white font-mono break-all">{user?.email ?? ''}</strong> and all associated data.
                Sessions will be invalidated immediately and cannot be recovered.
              </span>
            </div>

            {deleteError && (
              <div className="text-xs text-[#F6465D] rounded-lg bg-[#F6465D]/10 border border-[#F6465D]/25 px-3 py-2">
                {deleteError}
              </div>
            )}

            <div>
              <label className="block text-[11px] text-[#8CA0B8] mb-1">
                Type <span className="font-mono font-bold text-white">DELETE</span> to confirm:
              </label>
              <input
                value={deleteText}
                onChange={(e) => setDeleteText(e.target.value)}
                placeholder="DELETE"
                autoFocus
                disabled={isDeleting}
                className="w-full bg-[#0B0E11] border border-[#1A3654] rounded-lg px-3 py-2.5 text-xs font-mono text-white placeholder-[#5A7A94] focus:outline-none focus:border-[#F6465D] disabled:opacity-50"
              />
            </div>
          </div>
        </Modal>
      </div>
    </div>
  );
};

