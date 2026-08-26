import React, { useState, useRef, useEffect } from 'react';
import { 
  Search, 
  Bell, 
  Activity, 
  Moon, 
  Sun, 
  Play, 
  Layers,
  Sparkles,
  Zap,
  Shield,
  CheckCheck,
  ExternalLink,
  ArrowRight
} from 'lucide-react';
import { ConnectorStatus, AlertTrigger, MarketTicker, ExchangeId } from '../../types/index.js';
import { SubscriptionPlanId } from '../../types/subscription.js';

interface TopBarProps {
  connectors: ConnectorStatus[];
  unreadAlerts: AlertTrigger[];
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  onSelectSymbol: (symbol: string, exchange?: ExchangeId, marketType?: string) => void;
  onOpenTestSimulation: () => void;
  activeWallCount: number;
  tickers: MarketTicker[];
  plan?: SubscriptionPlanId;
  onOpenPricing?: () => void;
  onMarkAlertRead?: (id?: string) => void;
  onNavigateToAlerts?: () => void;
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
  onOpenPricing,
  onMarkAlertRead,
  onNavigateToAlerts
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [showAlertsDropdown, setShowAlertsDropdown] = useState(false);
  const [selectedSearchIndex, setSelectedSearchIndex] = useState(0);

  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const alertsContainerRef = useRef<HTMLDivElement>(null);

  // Global Ctrl+K keyboard shortcut and Click Outside handling
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (alertsContainerRef.current && !alertsContainerRef.current.contains(target)) {
        setShowAlertsDropdown(false);
      }
      if (searchContainerRef.current && !searchContainerRef.current.contains(target)) {
        setShowSearchDropdown(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      // Global Ctrl+K / Cmd+K to open & focus search
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchInputRef.current?.focus();
        setShowSearchDropdown(true);
        return;
      }

      if (event.key === 'Escape') {
        setShowAlertsDropdown(false);
        setShowSearchDropdown(false);
        searchInputRef.current?.blur();
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

  const filteredSearchTickers = searchQuery.trim()
    ? tickers.filter(t => 
        t.symbol.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (t.baseAsset && t.baseAsset.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (t.exchange && t.exchange.toLowerCase().includes(searchQuery.toLowerCase()))
      ).slice(0, 10)
    : tickers.slice(0, 8); // Top market tickers when empty

  // Reset highlighted index when results change
  useEffect(() => {
    setSelectedSearchIndex(0);
  }, [searchQuery]);

  const handleSelectTicker = (t: MarketTicker) => {
    onSelectSymbol(t.symbol, t.exchange, t.marketType);
    setShowSearchDropdown(false);
    setSearchQuery('');
    searchInputRef.current?.blur();
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSearchDropdown || filteredSearchTickers.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedSearchIndex(prev => (prev + 1) % filteredSearchTickers.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedSearchIndex(prev => (prev - 1 + filteredSearchTickers.length) % filteredSearchTickers.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = filteredSearchTickers[selectedSearchIndex] || filteredSearchTickers[0];
      if (target) {
        handleSelectTicker(target);
      }
    }
  };

  const binanceStatus = connectors.find(c => c.exchange === 'BINANCE');
  const connectedCount = connectors.filter(c => c.connected).length;

  const handleAlertClick = (alert: AlertTrigger) => {
    if (onMarkAlertRead) {
      onMarkAlertRead(alert.id);
    }
    const exchange = (alert.exchange as ExchangeId) || 'BINANCE';
    const marketType = alert.marketType || 'SPOT';
    onSelectSymbol(alert.symbol, exchange, marketType);
    setShowAlertsDropdown(false);
  };

  const handleMarkAllRead = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onMarkAlertRead) {
      onMarkAlertRead(); // clears/marks all
    }
  };

  return (
    <header className="h-14 border-b border-[#2B2F36] bg-[#181A20] px-4 flex items-center justify-between text-xs select-none relative z-30 flex-none transition-colors">
      {/* Left: Global Search Palette */}
      <div ref={searchContainerRef} className="relative w-72 sm:w-88 md:w-96">
        <div className="flex items-center bg-[#0B0E11] border border-[#2B2F36] rounded px-3 py-1.5 focus-within:border-[#F0B90B] transition gap-2">
          <Search size={14} className="text-[#848E9C] shrink-0" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowSearchDropdown(true);
            }}
            onFocus={() => setShowSearchDropdown(true)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search symbol (e.g. BTC, NVDA, ETH)..."
            className="w-full bg-transparent text-[#EAECEF] placeholder-[#848E9C] focus:outline-none text-xs"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                searchInputRef.current?.focus();
              }}
              className="text-[#848E9C] hover:text-white shrink-0 cursor-pointer text-xs"
              title="Clear search"
            >
              ✕
            </button>
          )}
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[9px] font-mono font-bold text-[#848E9C] bg-[#1E2329] rounded border border-[#2B2F36] whitespace-nowrap shrink-0 leading-none select-none">
            Ctrl+K
          </kbd>
        </div>

        {/* Search Results Dropdown */}
        {showSearchDropdown && (
          <div 
            data-dropdown="search"
            className="absolute left-0 mt-1 w-full bg-[#1E2329] border border-[#2B2F36] rounded-lg shadow-2xl py-1 z-50 max-h-80 overflow-y-auto"
          >
            <div className="px-3 py-1.5 text-[10px] text-[#848E9C] uppercase font-bold border-b border-[#2B2F36] flex justify-between items-center">
              <span>{searchQuery.trim() ? 'Matching Instruments' : 'Popular Instruments'}</span>
              <span className="font-mono text-[9px] lowercase text-[#848E9C]/80">↑↓ to navigate · enter to select</span>
            </div>
            {filteredSearchTickers.length === 0 ? (
              <div className="px-4 py-4 text-center text-xs text-[#848E9C]">
                No symbol found matching "{searchQuery}"
              </div>
            ) : (
              filteredSearchTickers.map((t, idx) => {
                const isSelected = idx === selectedSearchIndex;
                return (
                  <button
                    key={`${t.exchange}-${t.marketType}-${t.symbol}`}
                    onClick={() => handleSelectTicker(t)}
                    onMouseEnter={() => setSelectedSearchIndex(idx)}
                    className={`w-full px-3 py-2 text-left flex items-center justify-between transition group cursor-pointer border-b border-[#2B2F36]/30 last:border-0 ${
                      isSelected ? 'bg-[#2B2F36] text-white' : 'hover:bg-[#2B2F36]/60'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <span className={`font-bold text-sm ${isSelected ? 'text-[#F0B90B]' : 'text-[#EAECEF] group-hover:text-[#F0B90B]'}`}>
                        {t.symbol}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#0B0E11] text-[#848E9C] border border-[#2B2F36] font-mono">
                        {t.exchange}
                      </span>
                      <span className="text-[9px] text-[#848E9C] font-mono uppercase font-semibold">{t.marketType}</span>
                    </div>
                    <div className="text-right font-mono">
                      <div className="text-[#EAECEF] font-bold text-xs">
                        ${t.lastPrice >= 1 ? t.lastPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : t.lastPrice}
                      </div>
                      <div className={`text-[10px] font-bold ${t.percentageChange >= 0 ? 'text-[#0ECB81]' : 'text-[#F6465D]'}`}>
                        {t.percentageChange >= 0 ? '+' : ''}{t.percentageChange.toFixed(2)}%
                      </div>
                    </div>
                  </button>
                );
              })
            )}
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
          className={`flex items-center space-x-1.5 px-2.5 py-1 rounded border text-xs font-bold transition shadow-sm cursor-pointer ${
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
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-[#F0B90B] hover:bg-[#dfa700] text-black font-bold transition text-xs shadow-sm cursor-pointer active:scale-95"
          title="Trigger a test alert simulation"
        >
          <Play size={12} className="fill-black" />
          <span className="hidden sm:inline">Simulate Alert</span>
        </button>

        {/* Notifications Bell */}
        <div ref={alertsContainerRef} className="relative">
          <button
            onClick={() => setShowAlertsDropdown(!showAlertsDropdown)}
            className="w-8 h-8 rounded bg-[#2B2F36] hover:bg-[#34383F] text-[#848E9C] hover:text-white flex items-center justify-center relative transition cursor-pointer"
            title="Alert Notifications"
          >
            <Bell size={15} />
            {unreadAlerts.length > 0 && (
              <span className="absolute -top-1 -right-1 px-1 min-w-4 h-4 bg-[#F6465D] text-white rounded-full text-[9px] font-bold flex items-center justify-center animate-bounce shadow-sm">
                {unreadAlerts.length}
              </span>
            )}
          </button>

          {showAlertsDropdown && (
            <div 
              data-dropdown="alerts"
              className="absolute right-0 mt-2 w-80 sm:w-96 bg-[#1E2329] border border-[#2B2F36] rounded-lg shadow-2xl z-50 overflow-hidden"
            >
              <div className="px-3 py-2.5 border-b border-[#2B2F36] flex items-center justify-between bg-[#181A20]">
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-[#EAECEF] text-xs">Real-Time Alert Feed</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#F0B90B]/20 text-[#F0B90B] font-bold border border-[#F0B90B]/30">
                    {unreadAlerts.length} Unread
                  </span>
                </div>
                {unreadAlerts.length > 0 && onMarkAlertRead && (
                  <button
                    onClick={handleMarkAllRead}
                    className="flex items-center space-x-1 text-[11px] text-[#848E9C] hover:text-[#F0B90B] font-medium transition cursor-pointer"
                    title="Mark all alerts as read"
                  >
                    <CheckCheck size={13} />
                    <span>Mark all read</span>
                  </button>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-[#2B2F36]">
                {unreadAlerts.length === 0 ? (
                  <div className="p-8 text-center text-[#848E9C] text-xs flex flex-col items-center justify-center space-y-2">
                    <Bell size={24} className="text-[#848E9C]/50" />
                    <p className="font-medium text-[#EAECEF]">No unread alerts</p>
                    <p className="text-[11px] text-[#848E9C]">Market conditions normal or all alerts read.</p>
                  </div>
                ) : (
                  unreadAlerts.slice(0, 15).map((alert) => (
                    <div
                      key={alert.id}
                      onClick={() => handleAlertClick(alert)}
                      className="p-3 hover:bg-[#2B2F36] cursor-pointer transition text-xs group relative"
                      title="Click to open symbol analysis & mark as read"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center space-x-1.5">
                          <span className="font-bold text-[#F0B90B] group-hover:underline flex items-center space-x-1">
                            <span>{alert.symbol}</span>
                            <ExternalLink size={11} className="opacity-0 group-hover:opacity-100 transition-opacity text-[#F0B90B]" />
                          </span>
                          {alert.exchange && (
                            <span className="text-[9px] px-1 py-0.2 rounded bg-[#0B0E11] text-[#848E9C] border border-[#2B2F36] font-mono">
                              {alert.exchange}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-[#848E9C] font-mono">
                          {new Date(alert.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="text-[#EAECEF] text-xs mb-1 font-normal leading-relaxed">
                        {alert.message}
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-[#848E9C]">
                        <span className="truncate max-w-[190px]">Rule: {alert.ruleName}</span>
                        {alert.triggerPrice ? (
                          <span className="font-mono text-[#F0B90B] font-bold">
                            ${alert.triggerPrice >= 1 ? alert.triggerPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : alert.triggerPrice}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Dropdown Footer */}
              {onNavigateToAlerts && (
                <div className="p-2.5 bg-[#181A20] border-t border-[#2B2F36] flex items-center justify-between">
                  <button
                    onClick={() => {
                      onNavigateToAlerts();
                      setShowAlertsDropdown(false);
                    }}
                    className="w-full flex items-center justify-center space-x-1.5 text-xs text-[#F0B90B] hover:text-[#dfa700] font-bold transition py-1.5 rounded hover:bg-[#2B2F36]/50 cursor-pointer"
                  >
                    <span>View All in Alert Rules Manager</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="w-8 h-8 rounded bg-[#2B2F36] hover:bg-[#34383F] text-[#848E9C] hover:text-white flex items-center justify-center transition cursor-pointer"
          title={theme === 'dark' ? 'Switch to Light mode' : 'Switch to Dark mode'}
        >
          {theme === 'dark' ? <Sun size={15} className="text-[#F0B90B]" /> : <Moon size={15} className="text-[#3B82F6]" />}
        </button>
      </div>
    </header>
  );
};

