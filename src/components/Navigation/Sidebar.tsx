import React from 'react';
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
  TrendingDown,
  ShieldCheck,
  CreditCard
} from 'lucide-react';
import { UserRole } from '../../types/index.js';

export type NavTab = 
  | 'screener' 
  | 'walls' 
  | 'alerts' 
  | 'focus' 
  | 'watchlists' 
  | 'history' 
  | 'blacklist' 
  | 'settings' 
  | 'admin'
  | 'tests';

interface SidebarProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  activeWallCount: number;
  unreadAlertCount: number;
  userRole?: UserRole;
  onOpenPricing?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  collapsed,
  setCollapsed,
  activeWallCount,
  unreadAlertCount,
  userRole = 'TRADER',
  onOpenPricing
}) => {
  const navItems = [
    { id: 'screener' as NavTab, label: 'Market Screener', icon: TrendingUp, badge: null },
    { id: 'walls' as NavTab, label: 'Order Book Walls', icon: Layers, badge: activeWallCount > 0 ? activeWallCount : null, badgeColor: 'bg-[#F0B90B]/15 text-[#F0B90B] border-[#F0B90B]/30' },
    { id: 'alerts' as NavTab, label: 'Alert Engine', icon: ShieldAlert, badge: unreadAlertCount > 0 ? unreadAlertCount : null, badgeColor: 'bg-[#F6465D]/15 text-[#F6465D] border-[#F6465D]/30' },
    { id: 'focus' as NavTab, label: 'Symbol Focus L2', icon: SlidersHorizontal, badge: null },
    { id: 'watchlists' as NavTab, label: 'Watchlists', icon: Eye, badge: null },
    { id: 'history' as NavTab, label: 'Historical Walls', icon: History, badge: null },
    { id: 'blacklist' as NavTab, label: 'Global Blacklist', icon: Ban, badge: null },
    ...(userRole === 'ADMIN' ? [{ id: 'admin' as NavTab, label: 'Admin Ops', icon: ShieldCheck, badge: 'ROOT', badgeColor: 'bg-[#3B82F6]/15 text-[#3B82F6] border-[#3B82F6]/30' }] : []),
    { id: 'settings' as NavTab, label: 'Terminal Settings', icon: Settings, badge: null },
    { id: 'tests' as NavTab, label: 'Verification Tests', icon: CheckCircle2, badge: 'VERIFY', badgeColor: 'bg-[#0ECB81]/15 text-[#0ECB81] border-[#0ECB81]/30' }
  ];

  return (
    <aside 
      className={`relative flex flex-col border-r border-[#2B2F36] bg-[#181A20] transition-all duration-300 select-none flex-none ${
        collapsed ? 'w-16' : 'w-60'
      }`}
    >
      {/* Brand Header */}
      <div className="h-14 flex items-center justify-between px-3 border-b border-[#2B2F36] bg-[#181A20]">
        {!collapsed ? (
          <div className="flex items-center space-x-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded bg-[#F0B90B] flex items-center justify-center font-black text-black text-sm shadow-md shrink-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5">
                <path d="M3 3v18h18" />
                <path d="m19 9-5 5-4-4-3 3" />
              </svg>
            </div>
            <div className="truncate">
              <div className="text-sm font-bold tracking-tight text-white uppercase font-sans">
                QUANT<span className="text-[#F0B90B]">SCREEN</span>
              </div>
              <div className="text-[10px] text-[#848E9C] font-mono tracking-wider">INSTITUTIONAL L2</div>
            </div>
          </div>
        ) : (
          <div className="w-8 h-8 rounded bg-[#F0B90B] flex items-center justify-center font-bold text-black text-xs mx-auto shadow">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5">
              <path d="M3 3v18h18" />
              <path d="m19 9-5 5-4-4-3 3" />
            </svg>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 rounded hover:bg-[#2B2F36] text-[#848E9C] hover:text-[#EAECEF] transition shrink-0 ml-1 cursor-pointer"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center px-3 py-2.5 rounded text-xs font-medium tracking-wide transition group relative cursor-pointer ${
                isActive
                  ? 'bg-[#2B2F36] text-white border-l-2 border-[#F0B90B]'
                  : 'text-[#848E9C] hover:text-[#EAECEF] hover:bg-[#1E2329]'
              }`}
              title={collapsed ? item.label : undefined}
            >
              <Icon 
                size={18} 
                className={`shrink-0 ${isActive ? 'text-[#F0B90B]' : 'text-[#848E9C] group-hover:text-[#EAECEF]'}`} 
              />
              {!collapsed && (
                <span className="ml-3 truncate flex-1 text-left">{item.label}</span>
              )}
              {!collapsed && item.badge !== null && (
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border ${item.badgeColor || 'bg-[#2B2F36] text-[#848E9C]'}`}>
                  {item.badge}
                </span>
              )}
              {collapsed && item.badge !== null && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#F0B90B]" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Pricing / Plan trigger */}
      {!collapsed ? (
        <div className="p-2 border-t border-[#2B2F36] bg-[#181A20]">
          <button
            onClick={onOpenPricing}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-gradient-to-r from-[#F0B90B]/20 via-[#F0B90B]/10 to-[#3B82F6]/15 border border-[#F0B90B]/40 hover:border-[#F0B90B] text-xs font-bold text-[#EAECEF] hover:text-white transition group cursor-pointer shadow-sm"
          >
            <div className="flex items-center space-x-2">
              <CreditCard size={15} className="text-[#F0B90B] shrink-0" />
              <span className="font-bold tracking-tight">Plans & Billing</span>
            </div>
            <span className="text-[10px] font-extrabold text-[#F0B90B] group-hover:translate-x-0.5 transition font-mono px-1.5 py-0.5 rounded bg-[#F0B90B]/20 border border-[#F0B90B]/30">
              PRO →
            </span>
          </button>
        </div>
      ) : (
        <div className="p-2 border-t border-[#2B2F36] bg-[#181A20] flex justify-center">
          <button
            onClick={onOpenPricing}
            className="p-2 rounded-lg bg-[#F0B90B]/10 hover:bg-[#F0B90B]/20 text-[#F0B90B] transition cursor-pointer"
            title="Subscription & Billing"
          >
            <CreditCard size={16} />
          </button>
        </div>
      )}

      {/* Bottom Status Info */}
      {!collapsed && (
        <div className="p-3 border-t border-[#2B2F36] bg-[#1E2329]/60 text-[11px] text-[#848E9C] space-y-1.5">
          <div className="flex justify-between items-center">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#0ECB81] animate-pulse" />
              Binance L2 Stream:
            </span>
            <span className="font-mono text-[#0ECB81] font-bold text-[10px]">CONNECTED</span>
          </div>
          <div className="flex justify-between items-center text-[10px] text-[#848E9C]">
            <span>Order Book Depth:</span>
            <span className="font-mono text-[#EAECEF]">20 Levels Full</span>
          </div>
        </div>
      )}
    </aside>
  );
};
