'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  TrendingUp,
  ShieldAlert,
  Layers,
  Eye,
  History,
  Ban,
  Settings,
  CheckCircle2,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  CreditCard,
  Lock,
  User,
} from 'lucide-react';
import { useApp, useRealtimeData } from '@/providers/AppProviders';
import { BrandLogo } from '@/components/ui/BrandLogo';

export type NavTab =
  | 'screener'
  | 'walls'
  | 'alerts'
  | 'focus'
  | 'watchlists'
  | 'history'
  | 'blacklist'
  | 'profile'
  | 'settings'
  | 'admin'
  | 'tests';

const TAB_ROUTES: Record<string, string> = {
  screener: '/screener',
  walls: '/walls',
  alerts: '/alerts',
  focus: '/focus',
  watchlists: '/watchlists',
  history: '/history',
  blacklist: '/blacklist',
  profile: '/profile',
  admin: '/admin',
  settings: '/settings',
  tests: '/tests',
};

interface SidebarProps {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = React.memo(({ collapsed, setCollapsed }) => {
  const pathname = usePathname();
  const { user, openPricing, requiresUpgrade } = useApp();
  const userRole = user?.role ?? 'USER';

  const PREMIUM_ROUTES = new Set<NavTab>(['screener', 'alerts', 'watchlists']);

  const activeTab = (Object.entries(TAB_ROUTES).find(
    ([, route]) => pathname === route,
  )?.[0] ?? 'screener') as NavTab;

  const navItems = [
    { id: 'screener' as NavTab, label: 'Market Screener', icon: TrendingUp, badge: null },
    {
      id: 'walls' as NavTab,
      label: 'Order Book Walls',
      icon: Layers,
      badge: 'WALLS_BADGE',
    },
    {
      id: 'alerts' as NavTab,
      label: 'Alert Engine',
      icon: ShieldAlert,
      badge: 'ALERTS_BADGE',
    },
    { id: 'focus' as NavTab, label: 'Symbol Focus L2', icon: SlidersHorizontal, badge: null },
    { id: 'watchlists' as NavTab, label: 'Watchlists', icon: Eye, badge: null },
    { id: 'history' as NavTab, label: 'Historical Walls', icon: History, badge: null },
    { id: 'blacklist' as NavTab, label: 'Global Blacklist', icon: Ban, badge: null },
    { id: 'profile' as NavTab, label: 'User Profile & Billing', icon: User, badge: null },
    ...(userRole === 'ADMIN'
      ? [{ id: 'admin' as NavTab, label: 'Admin Ops', icon: ShieldCheck, badge: 'ADMIN', badgeColor: 'bg-[#3B82F6]/15 text-[#3B82F6] border-[#3B82F6]/30' }]
      : []),
    { id: 'settings' as NavTab, label: 'Terminal Settings', icon: Settings, badge: null },
    { id: 'tests' as NavTab, label: 'Verification Tests', icon: CheckCircle2, badge: 'VERIFY', badgeColor: 'bg-bid/15 text-bid border-[#0ECB81]/30' },
  ];

  return (
    <aside
      className={`relative flex flex-col border-r border-divider bg-primary transition-all duration-300 select-none flex-none ${
        collapsed ? 'w-16' : 'w-60'
      }`}
    >
      {/* Brand Header */}
      <div className="h-14 flex items-center justify-between px-3 border-b border-divider bg-primary">
        {!collapsed ? (
          <Link href="/screener" className="flex items-center space-x-2 overflow-hidden cursor-pointer group">
            <BrandLogo lockup="horizontal" theme="dark" size={30} priority />
          </Link>
        ) : (
          <Link href="/screener" className="flex items-center justify-center mx-auto cursor-pointer" title="MyScreener">
            <BrandLogo lockup="symbol" theme="dark" size={28} responsive priority />
          </Link>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 rounded hover:bg-[#0B1E33] text-muted hover:text-main transition shrink-0 ml-1 cursor-pointer"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          // Absolute admin bypass: ADMINs (any casing) are never locked out of any menu item.
          const isLocked = (user?.role ?? '').toUpperCase() !== 'ADMIN' && requiresUpgrade && PREMIUM_ROUTES.has(item.id);
          const isActive = !isLocked && activeTab === item.id;

          const handleClick = (e: React.MouseEvent) => {
            if (isLocked) {
              e.preventDefault();
              e.stopPropagation();
              openPricing('PRO', `${item.label} requires a Premium subscription`);
            }
          };

          return (
            <Link
              key={item.id}
              href={isLocked ? '#' : (TAB_ROUTES[item.id] ?? '/screener')}
              prefetch={!isLocked ? true : undefined}
              onClick={handleClick}
              title={collapsed ? (isLocked ? `${item.label} (Locked - Upgrade Required)` : item.label) : undefined}
              className={`w-full flex items-center px-3 py-2.5 rounded text-xs font-medium tracking-wide transition group relative cursor-pointer ${
                isLocked
                  ? 'text-gray-500 hover:text-gray-400 hover:bg-[#0B1E33]/30'
                  : isActive
                  ? 'bg-[#0B1E33] text-white border-l-2 border-[#168FD6]'
                  : 'text-muted hover:text-main hover:bg-[#0B1E33]/60'
              }`}
            >
              <Icon
                size={18}
                className={`shrink-0 ${
                  isLocked
                    ? 'text-gray-500 group-hover:text-gray-400'
                    : isActive
                    ? 'text-[#24C4E8]'
                    : 'text-muted group-hover:text-main'
                }`}
              />
              {!collapsed && (
                <div className="ml-3 flex-1 flex items-center justify-between min-w-0">
                  <span className={`truncate ${isLocked ? 'text-gray-500 group-hover:text-gray-400' : ''}`}>
                    {item.label}
                  </span>
                  {isLocked && (
                    <Lock size={13} className="text-gray-400 shrink-0 ml-1.5" />
                  )}
                  {!isLocked && item.badge === 'WALLS_BADGE' && <WallsBadge />}
                  {!isLocked && item.badge === 'ALERTS_BADGE' && <AlertsBadge />}
                  {!isLocked && item.badge !== null && item.badge !== 'WALLS_BADGE' && item.badge !== 'ALERTS_BADGE' && (
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border ${item.badgeColor || 'bg-[#0B1E33] text-muted'}`}>
                      {item.badge}
                    </span>
                  )}
                </div>
              )}
              {collapsed && isLocked && (
                <span className="absolute top-1.5 right-1.5 flex items-center justify-center text-gray-400">
                  <Lock size={10} />
                </span>
              )}
              {collapsed && !isLocked && (item.badge === 'WALLS_BADGE' || item.badge === 'ALERTS_BADGE') && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-brand" />
              )}
              {collapsed && !isLocked && item.badge !== null && item.badge !== 'WALLS_BADGE' && item.badge !== 'ALERTS_BADGE' && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-brand" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Pricing / Plan trigger */}
      {!collapsed ? (
        <div className="p-2 border-t border-divider bg-primary">
          <button
            onClick={() => openPricing()}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-gradient-to-r from-[#173D9A]/30 via-[#168FD6]/20 to-[#24C4E8]/20 border border-[#168FD6]/40 hover:border-[#24C4E8] text-xs font-semibold text-main hover:text-white transition group cursor-pointer shadow-sm"
          >
            <div className="flex items-center space-x-2">
              <CreditCard size={15} className="text-[#24C4E8] shrink-0" />
              <span className="font-semibold tracking-tight">Plans & Billing</span>
            </div>
            <span className="text-[10px] font-extrabold text-[#BCEFFF] group-hover:translate-x-0.5 transition font-mono px-1.5 py-0.5 rounded bg-brand/30 border border-[#24C4E8]/40">
              PRO →
            </span>
          </button>
        </div>
      ) : (
        <div className="p-2 border-t border-divider bg-primary flex justify-center">
          <button
            onClick={() => openPricing()}
            className="p-2 rounded-lg bg-brand/15 hover:bg-brand/30 text-[#24C4E8] transition cursor-pointer"
            title="Subscription & Billing"
          >
            <CreditCard size={16} />
          </button>
        </div>
      )}

      {/* Bottom Status Info */}
      {!collapsed && (
        <div className="p-3 border-t border-divider bg-[#0B1E33]/40 text-[11px] text-muted space-y-1.5">
          <div className="flex justify-between items-center">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-bid" />
              Binance L2 Stream:
            </span>
            <span className="font-mono text-bid font-bold text-[10px]">CONNECTED</span>
          </div>
          <div className="flex justify-between items-center text-[10px] text-muted">
            <span>Order Book Depth:</span>
            <span className="font-mono text-main">20 Levels Full</span>
          </div>
        </div>
      )}
    </aside>
  );
});

// Extracted badges to prevent full sidebar re-render on data ticks
function WallsBadge() {
  const { activeWalls } = useRealtimeData();
  const count = activeWalls.length;
  if (count === 0) return null;
  return (
    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border bg-[#168FD6]/20 text-[#24C4E8] border-[#24C4E8]/40">
      {count}
    </span>
  );
}

function AlertsBadge() {
  const { alertTriggers } = useRealtimeData();
  const count = alertTriggers.filter((t) => !t.read).length;
  if (count === 0) return null;
  return (
    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border bg-ask/15 text-ask border-[#F6465D]/30">
      {count}
    </span>
  );
}