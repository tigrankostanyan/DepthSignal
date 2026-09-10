'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell,
  Play,
  Sparkles,
  Zap,
  Shield,
  CheckCheck,
  ExternalLink,
  ArrowRight,
  Hourglass,
  AlertTriangle,
  User,
  LogOut,
  ChevronDown,
  Settings,
  CreditCard,
} from 'lucide-react';
import { useApp, useRealtimeData } from '@/providers/AppProviders';
import type { AlertTrigger } from '@/types/index';
import { formatPrice } from '@/lib/format';
import { Badge } from '@/components/ui/Badge';
import { IconButton } from '@/components/ui/IconButton';

export const RightControls: React.FC = () => {
  const router = useRouter();
  const {
    user,
    signOut,
    subscription,
    trial,
    openPricing,
    openSymbolFocus,
    handleMarkAlertRead,
    handleClearAlertTriggers,
  } = useApp();
  const { alertTriggers } = useRealtimeData();

  const [showAlertsDropdown, setShowAlertsDropdown] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const alertsContainerRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const unreadAlerts = alertTriggers.filter((t) => !t.read);
  // Admins hold unrestricted access — show an ADMIN tier instead of a FREE/Upgrade upsell.
  const isAdmin = (user?.role ?? '').toUpperCase() === 'ADMIN';
  const plan = isAdmin ? 'ADMIN' : subscription?.plan ?? 'FREE';
  const isTrialActive = trial?.status === 'active';
  const isTrialExpired = trial?.status === 'expired';

  // Click outside + Escape handling for dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (alertsContainerRef.current && !alertsContainerRef.current.contains(target)) {
        setShowAlertsDropdown(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(target)) {
        setShowUserDropdown(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowAlertsDropdown(false);
        setShowUserDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleAlertClick = (alert: AlertTrigger) => {
    handleMarkAlertRead(alert.id);
    const exchange = alert.exchange ?? 'BINANCE';
    const marketType = alert.marketType ?? 'SPOT';
    openSymbolFocus(alert.symbol, exchange as any, marketType as any);
    setShowAlertsDropdown(false);
  };

  const handleMarkAllRead = (e: React.MouseEvent) => {
    e.stopPropagation();
    handleClearAlertTriggers();
  };

  return (
    <div className="flex items-center space-x-2.5">
      {isTrialActive && trial && !isAdmin && (
        <button
          onClick={() => openPricing()}
          className="flex items-center space-x-1.5 px-2.5 py-1 rounded border border-emerald-500/50 bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition text-xs font-bold shadow-sm cursor-pointer"
          title="Free trial active"
        >
          <Hourglass size={13} />
          <span>Trial {trial.remainingDays}d left</span>
        </button>
      )}

      {isTrialExpired && !isAdmin && (
        <button
          onClick={() => openPricing()}
          className="flex items-center space-x-1.5 px-2.5 py-1 rounded border border-red-500/50 bg-red-500/15 text-red-400 hover:bg-red-500/25 transition text-xs font-bold shadow-sm cursor-pointer"
          title="Trial expired — subscribe to continue"
        >
          <AlertTriangle size={13} />
          <span>Trial Expired — Upgrade</span>
        </button>
      )}

      {/* Subscription Tier Pill */}
      <button
        onClick={() => openPricing()}
        className={`flex items-center space-x-1.5 px-2.5 py-1 rounded border text-xs font-bold transition shadow-sm cursor-pointer ${
          plan === 'ADVANCED'
            ? 'bg-[#3B82F6]/20 border-[#3B82F6]/50 text-[#60a5fa] hover:bg-[#3B82F6]/30'
            : plan === 'ADMIN'
              ? 'bg-[#0B1E33] border-[#24C4E8]/60 text-[#24C4E8] hover:bg-[#102A45]'
              : plan === 'PRO'
                ? 'bg-accent/20 border-[#24C4E8]/50 text-[#24C4E8] hover:bg-accent/30'
                : 'bg-panel border-divider text-muted hover:text-white hover:border-[#168FD6]/50'
        }`}
        title="View plan features & limits"
      >
        {plan === 'ADVANCED' ? (
          <Sparkles size={13} className="text-[#60a5fa]" />
        ) : plan === 'ADMIN' ? (
          <Shield size={13} className="text-[#24C4E8]" />
        ) : plan === 'PRO' ? (
          <Zap size={13} className="text-[#24C4E8]" />
        ) : (
          <Shield size={13} className="text-muted" />
        )}
        <span className="font-mono">{plan}</span>
        {plan === 'FREE' && (
          <span className="text-[10px] text-accent font-bold underline ml-1">Upgrade</span>
        )}
      </button>

      {/* Test simulation button */}
      <button
        onClick={() => router.push('/alerts?simulate=1')}
        className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-[#168FD6] hover:bg-[#1C9AE5] text-white font-bold transition text-xs shadow-sm shadow-[#168FD6]/20 cursor-pointer active:scale-95"
        title="Trigger a test alert simulation"
      >
        <Play size={12} className="fill-white text-white" />
        <span className="hidden sm:inline text-white">Simulate Alert</span>
      </button>


      {/* Notifications Bell */}
      <div ref={alertsContainerRef} className="relative z-[9999]">
        <IconButton
          onClick={() => setShowAlertsDropdown(!showAlertsDropdown)}
          title="Alert Notifications"
          className="relative"
          icon={
            <>
              <Bell size={15} />
              {unreadAlerts.length > 0 && (
                <span className="absolute -top-1 -right-1 px-1 min-w-4 h-4 bg-ask text-white rounded-full text-[9px] font-bold flex items-center justify-center animate-bounce shadow-sm">
                  {unreadAlerts.length}
                </span>
              )}
            </>
          }
        />

        {showAlertsDropdown && (
          <div
            data-dropdown="alerts"
            className="absolute right-0 mt-2 w-80 sm:w-96 bg-surface border border-divider rounded-lg shadow-2xl z-[9999] overflow-hidden"
          >
            <div className="px-3 py-2.5 border-b border-divider flex items-center justify-between bg-card">
              <div className="flex items-center space-x-2">
                <span className="font-bold text-main text-xs">Real-Time Alert Feed</span>
                <Badge tone="blue" size="sm">{unreadAlerts.length} Unread</Badge>
              </div>
              {unreadAlerts.length > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="flex items-center space-x-1 text-[11px] text-muted hover:text-accent font-medium transition cursor-pointer"
                  title="Mark all alerts as read"
                >
                  <CheckCheck size={13} />
                  <span>Mark all read</span>
                </button>
              )}
            </div>

            <div className="max-h-80 overflow-y-auto divide-y divide-divider">
              {unreadAlerts.length === 0 ? (
                <div className="p-8 text-center text-muted text-xs flex flex-col items-center justify-center space-y-2">
                  <Bell size={24} className="text-muted/50" />
                  <p className="font-medium text-main">No unread alerts</p>
                  <p className="text-[11px] text-muted">
                    Market conditions normal or all alerts read.
                  </p>
                </div>
              ) : (
                unreadAlerts.slice(0, 15).map((alert) => (
                  <div
                    key={alert.id}
                    onClick={() => handleAlertClick(alert)}
                    className="p-3 hover:bg-panel cursor-pointer transition text-xs group relative"
                    title="Click to open symbol analysis & mark as read"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center space-x-1.5">
                        <span className="font-bold text-accent group-hover:underline flex items-center space-x-1">
                          <span>{alert.symbol}</span>
                          <ExternalLink size={11} className="opacity-0 group-hover:opacity-100 transition-opacity text-accent" />
                        </span>
                        {alert.exchange && (
                          <Badge tone="neutral" size="sm">{alert.exchange}</Badge>
                        )}
                      </div>
                      <span className="text-[10px] text-muted font-mono">
                        {new Date(alert.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="text-main text-xs mb-1 font-normal leading-relaxed">
                      {alert.message}
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-muted">
                      <span className="truncate max-w-[190px]">Rule: {alert.ruleName}</span>
                      {alert.triggerPrice && (
                        <span className="font-mono text-accent font-bold">
                          {`$${formatPrice(alert.triggerPrice)}`}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Dropdown Footer */}
            <div className="p-2.5 bg-card border-t border-divider flex items-center justify-between">
              <button
                onClick={() => {
                  router.push('/alerts');
                  setShowAlertsDropdown(false);
                }}
                className="w-full flex items-center justify-center space-x-1.5 text-xs text-accent hover:text-[#24C4E8] font-bold transition py-1.5 rounded hover:bg-panel/50 cursor-pointer"
              >
                <span>View All in Alert Rules Manager</span>
                <ArrowRight size={13} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* User Account Menu */}
      <div ref={userMenuRef} className="relative z-[9999]">
        <button
          onClick={() => setShowUserDropdown(!showUserDropdown)}
          className="flex items-center space-x-1.5 p-1 pl-1.5 pr-2 rounded-lg border border-divider bg-[#0B1E33] hover:bg-[#102A45] hover:border-[#168FD6]/40 text-main transition cursor-pointer"
          title="User Account & Settings"
        >
          <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-[#168FD6] to-[#24C4E8] flex items-center justify-center text-[10px] font-black text-[#071522]">
            {user?.name ? user.name.slice(0, 1).toUpperCase() : 'U'}
          </div>
          <span className="hidden md:inline font-medium text-xs max-w-[100px] truncate">
            {user?.name || 'Account'}
          </span>
          <ChevronDown size={12} className={`text-muted transition-transform duration-200 ${showUserDropdown ? 'rotate-180' : ''}`} />
        </button>

        {showUserDropdown && (
          <div
            data-dropdown="user"
            className="absolute right-0 mt-2 w-64 bg-primary border border-divider rounded-xl shadow-2xl z-[9999] overflow-hidden text-xs"
          >
            {/* Header info */}
            <div className="p-3.5 border-b border-divider bg-[#0B1E33]/90">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#168FD6] to-[#24C4E8] p-0.5 flex-none">
                  <div className="w-full h-full rounded-full bg-primary flex items-center justify-center text-xs font-black text-[#24C4E8]">
                    {user?.name ? user.name.slice(0, 2).toUpperCase() : 'DS'}
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-white truncate text-xs">
                    {user?.name || 'Trading Member'}
                  </div>
                  <div className="text-[11px] text-muted truncate">
                    {user?.email || '—'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 mt-2.5">
                <Badge tone={plan === 'ADVANCED' ? 'purple' : plan === 'PRO' ? 'yellow' : 'neutral'} size="sm">
                  {plan} TIER
                </Badge>
                {user?.role && (
                  <Badge tone="blue" size="sm">
                    {user.role}
                  </Badge>
                )}
              </div>
            </div>

            {/* Links */}
            <div className="p-1.5 space-y-0.5">
              <button
                onClick={() => {
                  router.push('/profile');
                  setShowUserDropdown(false);
                }}
                className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-main hover:bg-[#0B1E33] hover:text-[#24C4E8] transition cursor-pointer font-medium"
              >
                <User size={14} className="text-[#24C4E8]" />
                <span>User Profile & Billing</span>
              </button>

              <button
                onClick={() => {
                  openPricing();
                  setShowUserDropdown(false);
                }}
                className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-main hover:bg-[#0B1E33] hover:text-accent transition cursor-pointer font-medium"
              >
                <CreditCard size={14} className="text-accent" />
                <span>Plans & Subscriptions</span>
              </button>

              <button
                onClick={() => {
                  router.push('/settings');
                  setShowUserDropdown(false);
                }}
                className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-main hover:bg-[#0B1E33] hover:text-white transition cursor-pointer font-medium"
              >
                <Settings size={14} className="text-muted" />
                <span>Terminal Settings</span>
              </button>
            </div>

            {/* Logout Action */}
            <div className="p-1.5 border-t border-divider bg-[#0B1E33]/40">
              <button
                onClick={async () => {
                  if (isLoggingOut) return;
                  setIsLoggingOut(true);
                  try {
                    await signOut();
                  } catch (err) {
                    console.error('[RightControls] Logout failed:', err);
                    router.replace('/login');
                  }
                }}
                disabled={isLoggingOut}
                className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-ask hover:bg-ask/15 transition cursor-pointer font-bold disabled:opacity-50"
              >
                <LogOut size={14} className={isLoggingOut ? 'animate-spin' : ''} />
                <span>{isLoggingOut ? 'Logging out...' : 'Log Out'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};