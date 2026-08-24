import React, { useState } from 'react';
import { 
  Search, 
  Bell, 
  Activity, 
  Moon, 
  Sun, 
  Play, 
  Layers,
  Radio,
  Sparkles,
  Zap,
  Shield
} from 'lucide-react';
import { ConnectorStatus, AlertTrigger, MarketTicker } from '../../types/index.js';
import { SubscriptionPlanId } from '../../types/subscription.js';

interface TopBarProps {
  connectors: ConnectorStatus[];
  unreadAlerts: AlertTrigger[];
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  onSelectSymbol: (symbol: string) => void;
  onOpenTestSimulation: () => void;
  activeWallCount: number;
  tickers: MarketTicker[];
  plan?: SubscriptionPlanId;
  onOpenPricing?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  connectors,
  unreadAlerts,
  theme,
  toggleTheme,
  onSelectSymbol,
  onOpenTestSimulation,
  activeWallCount,
  tickers,
  plan = 'FREE',
  onOpenPricing
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [showAlertsDropdown, setShowAlertsDropdown] = useState(false);

  const filteredSearchTickers = searchQuery.trim()
    ? tickers.filter(t => t.symbol.toLowerCase().includes(searchQuery.toLowerCase()) || t.baseAsset.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 8)
    : [];

  const binanceStatus = connectors.find(c => c.exchange === 'BINANCE');
  const connectedCount = connectors.filter(c => c.connected).length;

  return (
    <header className="h-14 border-b border-[#2B2F36] bg-[#181A20] px-4 flex items-center justify-between text-xs select-none relative z-30 flex-none">
      {/* Left: Global Search Palette */}
      <div className="relative w-64 sm:w-80">
        <div className="flex items-center bg-[#0B0E11] border border-[#2B2F36] rounded px-3 py-1.5 focus-within:border-[#F0B90B] transition">
          <Search size={14} className="text-[#848E9C] mr-2 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowSearchDropdown(true);
            }}
            onFocus={() => setShowSearchDropdown(true)}
            placeholder="Search symbol (e.g. BTC, NVDA)..."
            className="w-full bg-transparent text-[#EAECEF] placeholder-[#848E9C] focus:outline-none text-xs"
          />
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[9px] font-mono text-[#848E9C] bg-[#1E2329] rounded border border-[#2B2F36]">
            ⌘K
          </kbd>
        </div>

        {/* Search Results Dropdown */}
        {showSearchDropdown && filteredSearchTickers.length > 0 && (
          <div 
            className="absolute left-0 mt-1 w-80 bg-[#1E2329] border border-[#2B2F36] rounded shadow-2xl py-1 z-50 max-h-72 overflow-y-auto"
            onMouseLeave={() => setShowSearchDropdown(false)}
          >
            <div className="px-3 py-1 text-[10px] text-[#848E9C] uppercase font-semibold border-b border-[#2B2F36]">
              Verified Market Tickers
            </div>
            {filteredSearchTickers.map((t) => (
              <button
                key={`${t.exchange}-${t.marketType}-${t.symbol}`}
                onClick={() => {
                  onSelectSymbol(t.symbol);
                  setShowSearchDropdown(false);
                  setSearchQuery('');
                }}
                className="w-full px-3 py-2 text-left flex items-center justify-between hover:bg-[#2B2F36] transition group"
              >
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-white group-hover:text-[#F0B90B]">{t.symbol}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#0B0E11] text-[#848E9C] border border-[#2B2F36]">
                    {t.exchange}
                  </span>
                  <span className="text-[9px] text-[#848E9C] font-mono">{t.marketType}</span>
                </div>
                <div className="text-right font-mono">
                  <div className="text-[#EAECEF]">${t.lastPrice >= 1 ? t.lastPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : t.lastPrice}</div>
                  <div className={`text-[10px] font-bold ${t.percentageChange >= 0 ? 'text-[#0ECB81]' : 'text-[#F6465D]'}`}>
                    {t.percentageChange >= 0 ? '+' : ''}{t.percentageChange.toFixed(2)}%
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Middle: Active Exchanges & Health */}
      <div className="hidden lg:flex items-center space-x-3 text-[#848E9C]">
        <div className="flex items-center space-x-2 px-3 py-1 bg-[#1E2329] rounded border border-[#2B2F36]">
          <div className="w-2 h-2 rounded-full bg-[#0ECB81] animate-pulse"></div>
          <span className="text-xs text-[#848E9C]">
            Binance: <span className="text-[#0ECB81] font-mono font-medium">{binanceStatus?.pingMs ? `${binanceStatus.pingMs}ms` : 'Connected'}</span>
          </span>
        </div>

        <div className="flex items-center space-x-1.5 px-3 py-1 rounded bg-[#1E2329] border border-[#2B2F36]">
          <Layers size={13} className="text-[#F0B90B]" />
          <span className="text-xs text-[#848E9C]">Order Book Walls:</span>
          <span className="font-mono text-[#F0B90B] font-bold">{activeWallCount}</span>
        </div>

        <div className="flex items-center space-x-1.5 px-3 py-1 rounded bg-[#1E2329] border border-[#2B2F36]">
          <Activity size={13} className="text-[#EAECEF]" />
          <span className="text-xs text-[#848E9C]">Gateways:</span>
          <span className="font-mono text-[#EAECEF]">{connectedCount} Active</span>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center space-x-2.5">
        {/* Subscription Tier Pill */}
        <button
          onClick={onOpenPricing}
          className={`flex items-center space-x-1.5 px-2.5 py-1 rounded border text-xs font-bold transition shadow-sm ${
            plan === 'ADVANCED'
              ? 'bg-[#3B82F6]/20 border-[#3B82F6]/50 text-[#60a5fa] hover:bg-[#3B82F6]/30'
              : plan === 'PRO'
              ? 'bg-[#F0B90B]/20 border-[#F0B90B]/50 text-[#F0B90B] hover:bg-[#F0B90B]/30'
              : 'bg-[#2B2F36] border-[#374151] text-[#848E9C] hover:text-white hover:border-[#F0B90B]'
          }`}
          title="View plan features & limits"
        >
          {plan === 'ADVANCED' ? (
            <Sparkles size={13} className="text-[#60a5fa]" />
          ) : plan === 'PRO' ? (
            <Zap size={13} className="text-[#F0B90B]" />
          ) : (
            <Shield size={13} className="text-[#848E9C]" />
          )}
          <span className="font-mono">{plan}</span>
          {plan === 'FREE' && (
            <span className="text-[10px] text-[#F0B90B] font-bold underline ml-1">Upgrade</span>
          )}
        </button>

        {/* Test simulation button */}
        <button
          onClick={onOpenTestSimulation}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-[#F0B90B] hover:bg-[#dfa700] text-black font-bold transition text-xs shadow-sm"
          title="Trigger a test alert simulation"
        >
          <Play size={12} className="fill-black" />
          <span className="hidden sm:inline">Simulate Alert</span>
        </button>

        {/* Notifications Bell */}
        <div className="relative">
          <button
            onClick={() => setShowAlertsDropdown(!showAlertsDropdown)}
            className="w-8 h-8 rounded bg-[#2B2F36] hover:bg-[#34383F] text-[#848E9C] hover:text-white flex items-center justify-center relative transition"
            title="Alert Notifications"
          >
            <Bell size={15} />
            {unreadAlerts.length > 0 && (
              <span className="absolute -top-1 -right-1 px-1 min-w-4 h-4 bg-[#F6465D] text-white rounded-full text-[9px] font-bold flex items-center justify-center animate-bounce">
                {unreadAlerts.length}
              </span>
            )}
          </button>

          {showAlertsDropdown && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-[#1E2329] border border-[#2B2F36] rounded shadow-2xl z-50 overflow-hidden">
              <div className="px-3 py-2 border-b border-[#2B2F36] flex items-center justify-between bg-[#181A20]">
                <span className="font-bold text-white text-xs">Real-Time Alert Feed</span>
                <span className="text-[10px] font-mono text-[#F0B90B] font-bold">{unreadAlerts.length} Unread</span>
              </div>
              <div className="max-h-80 overflow-y-auto divide-y divide-[#2B2F36]">
                {unreadAlerts.length === 0 ? (
                  <div className="p-6 text-center text-[#848E9C] text-xs">
                    No unread alerts. Market conditions normal.
                  </div>
                ) : (
                  unreadAlerts.slice(0, 10).map((alert) => (
                    <div key={alert.id} className="p-3 hover:bg-[#2B2F36] transition text-xs">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-[#F0B90B]">{alert.symbol}</span>
                        <span className="text-[10px] text-[#848E9C] font-mono">
                          {new Date(alert.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="text-[#EAECEF] text-xs mb-1">{alert.message}</div>
                      <div className="flex items-center justify-between text-[10px] text-[#848E9C]">
                        <span>Rule: {alert.ruleName}</span>
                        <span className="font-mono text-[#F0B90B]">${alert.triggerPrice?.toLocaleString()}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="w-8 h-8 rounded bg-[#2B2F36] hover:bg-[#34383F] text-[#848E9C] hover:text-white flex items-center justify-center transition"
          title={theme === 'dark' ? 'Switch to Light theme' : 'Switch to Dark theme'}
        >
          {theme === 'dark' ? <Sun size={15} className="text-[#F0B90B]" /> : <Moon size={15} className="text-white" />}
        </button>
      </div>
    </header>
  );
};
