import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Sidebar, NavTab } from './components/Navigation/Sidebar.js';
import { TopBar } from './components/Navigation/TopBar.js';
import { MarketScreener } from './components/Screener/MarketScreener.js';
import { WallMonitor } from './components/Walls/WallMonitor.js';
import { AlertManager } from './components/Alerts/AlertManager.js';
import { SymbolFocusView } from './components/Focus/SymbolFocusView.js';
import { WatchlistView } from './components/Watchlists/WatchlistView.js';
import { HistoricalWallsView } from './components/History/HistoricalWallsView.js';
import { BlacklistManager } from './components/Blacklist/BlacklistManager.js';
import { SettingsView } from './components/Settings/SettingsView.js';
import { TestSuiteModal } from './components/Tests/TestSuiteModal.js';
import { PricingModal } from './components/Billing/PricingModal.js';
import { AdminPanelView } from './components/Admin/AdminPanelView.js';
import { 
  AlertRule, 
  AlertTrigger, 
  BlacklistEntry, 
  ConnectorStatus, 
  DetectedWall, 
  ExchangeId, 
  MarketTicker, 
  MarketType, 
  SavedFilterPreset, 
  ScreenerFilters, 
  UserProfile,
  UserSettings, 
  Watchlist,
  SubscriptionPlanId,
  UserSubscription
} from './types/index.js';
import { 
  addBlacklistEntry, 
  addWatchlistItem, 
  clearAlertTriggers, 
  deleteAlertRule, 
  fetchAlertRules, 
  fetchAlertTriggers, 
  fetchBlacklist, 
  fetchConnectorHealth, 
  fetchCurrentUser,
  fetchPresets, 
  fetchSettings, 
  fetchSubscription,
  fetchTickers, 
  fetchWatchlists, 
  fetchActiveWalls,
  getAuthToken,
  markAlertRead, 
  removeBlacklistEntry, 
  removeWatchlistItem, 
  saveAlertRule, 
  savePreset, 
  testTriggerAlert, 
  updateSettings, 
  updateWallConfig 
} from './lib/api.js';

export function App() {
  // Navigation & Layout state
  const [activeTab, setActiveTab] = useState<NavTab>('screener');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // User & Subscription state
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [isPricingOpen, setIsPricingOpen] = useState(false);
  const [pricingReason, setPricingReason] = useState<string | undefined>(undefined);
  const [highlightPlan, setHighlightPlan] = useState<SubscriptionPlanId | undefined>(undefined);

  // Selected symbol for Symbol Focus View
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [selectedExchange, setSelectedExchange] = useState<ExchangeId>('BINANCE');
  const [selectedMarketType, setSelectedMarketType] = useState<MarketType>('SPOT');

  // Market & Engine State
  const [tickers, setTickers] = useState<MarketTicker[]>([]);
  const [activeWalls, setActiveWalls] = useState<DetectedWall[]>([]);
  const [alertRules, setAlertRules] = useState<AlertRule[]>([]);
  const [alertTriggers, setAlertTriggers] = useState<AlertTrigger[]>([]);
  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [blacklist, setBlacklist] = useState<BlacklistEntry[]>([]);
  const [presets, setPresets] = useState<SavedFilterPreset[]>([]);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [connectors, setConnectors] = useState<ConnectorStatus[]>([]);

  // Screener Filters State
  const [filters, setFilters] = useState<ScreenerFilters>({
    searchQuery: '',
    category: 'ALL',
    marketType: 'ALL',
    exchanges: [],
    timeframe: '1d',
    onlyWithWalls: false,
    onlyWatchlist: false,
    hideBlacklisted: true,
    sortBy: 'volumeUsd',
    sortOrder: 'desc'
  });

  // Wall Config local state
  const [minVolumeUsd, setMinVolumeUsd] = useState(500000);
  const [maxDistancePercent, setMaxDistancePercent] = useState(2.5);
  const [crossExchangeAggregation, setCrossExchangeAggregation] = useState(false);

  const openPricingModal = (reason?: string, plan?: SubscriptionPlanId) => {
    setPricingReason(reason);
    setHighlightPlan(plan || 'PRO');
    setIsPricingOpen(true);
  };

  // Audio tone synthesizer for real-time alerts
  const playAlertSound = useCallback(() => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
      osc.frequency.exponentialRampToValueAtTime(1760, audioCtx.currentTime + 0.15); // A6
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.25);
    } catch (e) {
      // Audio not permitted without user gesture
    }
  }, []);

  // Initial Data Load
  useEffect(() => {
    const loadInitial = async () => {
      try {
        const [
          initialTickers,
          initialWalls,
          rules,
          triggers,
          wls,
          bl,
          pre,
          userSet,
          connHealth,
          uProfile,
          subInfo
        ] = await Promise.all([
          fetchTickers(),
          fetchActiveWalls(),
          fetchAlertRules(),
          fetchAlertTriggers(),
          fetchWatchlists(),
          fetchBlacklist(),
          fetchPresets(),
          fetchSettings(),
          fetchConnectorHealth(),
          fetchCurrentUser().catch(() => null),
          fetchSubscription().catch(() => null)
        ]);

        setTickers(initialTickers);
        setActiveWalls(initialWalls);
        setAlertRules(rules);
        setAlertTriggers(triggers);
        setWatchlists(wls);
        setBlacklist(bl);
        setPresets(pre);
        setSettings(userSet);
        setConnectors(connHealth);
        if (uProfile) setUserProfile(uProfile);
        if (subInfo?.subscription) setSubscription(subInfo.subscription);

        if (userSet) {
          setMinVolumeUsd(userSet.wallMinVolumeDefaultUsd);
          setCrossExchangeAggregation(userSet.defaultCrossExchangeAggregation);
        }
      } catch (err) {
        console.error('Failed to load initial data:', err);
      }
    };

    loadInitial();
  }, []);

  // Real-time SSE Stream Connection
  useEffect(() => {
    let eventSource: EventSource | null = null;

    const connectSSE = () => {
      const token = getAuthToken();
      eventSource = new EventSource(`/api/realtime/stream?token=${encodeURIComponent(token)}`);

      eventSource.addEventListener('tickers_batch', (event) => {
        const batch: MarketTicker[] = JSON.parse(event.data);
        setTickers(batch);
      });

      eventSource.addEventListener('wall_event', (event) => {
        const { wall, eventType } = JSON.parse(event.data);
        setActiveWalls(prev => {
          if (eventType === 'CONFIRMED' || eventType === 'FORMING') {
            const existingIdx = prev.findIndex(w => w.id === wall.id);
            if (existingIdx >= 0) {
              const updated = [...prev];
              updated[existingIdx] = wall;
              return updated;
            }
            return [wall, ...prev];
          } else if (eventType === 'REMOVED' || eventType === 'FILLED') {
            return prev.filter(w => w.id !== wall.id);
          }
          return prev;
        });
      });

      eventSource.addEventListener('alert_trigger', (event) => {
        const trigger: AlertTrigger = JSON.parse(event.data);
        setAlertTriggers(prev => [trigger, ...prev]);
        playAlertSound();
      });

      eventSource.addEventListener('subscription_updated', (event) => {
        const updatedSub: UserSubscription = JSON.parse(event.data);
        setSubscription(updatedSub);
      });

      eventSource.onerror = () => {
        if (eventSource) eventSource.close();
        setTimeout(connectSSE, 3000);
      };
    };

    connectSSE();

    return () => {
      if (eventSource) eventSource.close();
    };
  }, [playAlertSound]);

  // Handler: Select symbol for focus terminal
  const handleSelectSymbol = (symbol: string, exchange: ExchangeId = 'BINANCE', marketType: string = 'SPOT') => {
    setSelectedSymbol(symbol);
    setSelectedExchange(exchange);
    setSelectedMarketType(marketType as MarketType);
    setActiveTab('focus');
  };

  // Handler: Watchlist toggle with entitlement checking
  const handleToggleWatchlist = async (symbol: string, exchange: ExchangeId, marketType: string) => {
    const targetWl = watchlists[0];
    if (!targetWl) return;

    const exists = targetWl.items.some(
      i => i.symbol === symbol && i.exchange === exchange && i.marketType === marketType
    );

    try {
      if (exists) {
        await removeWatchlistItem(targetWl.id, { symbol, exchange, marketType });
      } else {
        await addWatchlistItem(targetWl.id, { symbol, exchange, marketType });
      }

      const updated = await fetchWatchlists();
      setWatchlists(updated);
    } catch (err: any) {
      if (err.statusCode === 403 || err.errorCode === 'PLAN_LIMIT_REACHED') {
        openPricingModal(err.message || 'You have reached your watchlist item limit. Upgrade to PRO or ADVANCED for expanded watchlists.', 'PRO');
      } else {
        alert(err.message || 'Failed to update watchlist');
      }
    }
  };

  // Handler: Save current filter preset
  const handleSavePreset = async () => {
    const name = prompt('Enter a name for this filter preset:', 'My Custom Preset');
    if (!name) return;
    await savePreset({ name, filters });
    const pre = await fetchPresets();
    setPresets(pre);
  };

  // Handler: Update Wall Engine config
  const handleUpdateMinVolume = async (val: number) => {
    setMinVolumeUsd(val);
    await updateWallConfig({ minVolumeUsd: val });
    const walls = await fetchActiveWalls();
    setActiveWalls(walls);
  };

  const handleToggleAggregation = async (val: boolean) => {
    setCrossExchangeAggregation(val);
    await updateWallConfig({ crossExchangeAggregation: val });
    const walls = await fetchActiveWalls();
    setActiveWalls(walls);
  };

  const handleUpdateMaxDistance = async (val: number) => {
    setMaxDistancePercent(val);
    await updateWallConfig({ minVolumeUsd });
  };

  // Handler: Alert rule actions with entitlement checking
  const handleSaveAlertRule = async (rule: Partial<AlertRule>) => {
    try {
      await saveAlertRule(rule);
      const rules = await fetchAlertRules();
      setAlertRules(rules);
    } catch (err: any) {
      if (err.statusCode === 403 || err.errorCode === 'PLAN_LIMIT_REACHED' || err.errorCode === 'CHANNEL_NOT_ALLOWED') {
        openPricingModal(err.message || 'Plan limits reached or notification channel requires upgrade.', 'PRO');
      } else {
        alert(err.message || 'Failed to save alert rule');
      }
    }
  };

  const handleDeleteAlertRule = async (id: string) => {
    await deleteAlertRule(id);
    const rules = await fetchAlertRules();
    setAlertRules(rules);
  };

  const handleMarkAlertRead = async (id?: string) => {
    await markAlertRead(id);
    const trigs = await fetchAlertTriggers();
    setAlertTriggers(trigs);
  };

  const handleClearAlertTriggers = async () => {
    await clearAlertTriggers();
    setAlertTriggers([]);
  };

  const handleTestSimulation = async () => {
    const trigger = await testTriggerAlert();
    setAlertTriggers(prev => [trigger, ...prev]);
    playAlertSound();
  };

  // Handler: Blacklist actions
  const handleAddBlacklist = async (entry: Partial<BlacklistEntry>) => {
    await addBlacklistEntry(entry);
    const bl = await fetchBlacklist();
    setBlacklist(bl);
    const refreshedTickers = await fetchTickers();
    setTickers(refreshedTickers);
  };

  const handleRemoveBlacklist = async (id: string) => {
    await removeBlacklistEntry(id);
    const bl = await fetchBlacklist();
    setBlacklist(bl);
    const refreshedTickers = await fetchTickers();
    setTickers(refreshedTickers);
  };

  // Handler: Settings save
  const handleSaveSettings = async (newSet: Partial<UserSettings>) => {
    const res = await updateSettings(newSet);
    setSettings(res.settings);
  };

  const handleRefreshHealth = async () => {
    const conn = await fetchConnectorHealth();
    setConnectors(conn);
  };

  const unreadAlerts = alertTriggers.filter(t => !t.read);

  return (
    <div className={`h-screen w-screen flex overflow-hidden ${theme === 'dark' ? 'bg-[#0B0E11] text-[#EAECEF]' : 'light bg-slate-50 text-slate-900'}`}>
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={(tab) => {
          if (tab === 'focus' && !selectedSymbol) {
            setSelectedSymbol('BTCUSDT');
          }
          setActiveTab(tab);
        }}
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        activeWallCount={activeWalls.length}
        unreadAlertCount={unreadAlerts.length}
        userRole={userProfile?.role || 'TRADER'}
        onOpenPricing={() => openPricingModal()}
      />

      {/* Main Content Pane */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar
          connectors={connectors}
          unreadAlerts={unreadAlerts}
          theme={theme}
          toggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          onSelectSymbol={(sym) => handleSelectSymbol(sym)}
          onOpenTestSimulation={handleTestSimulation}
          activeWallCount={activeWalls.length}
          tickers={tickers}
          plan={subscription?.plan || 'FREE'}
          onOpenPricing={() => openPricingModal()}
        />

        {/* Tab View Router */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {activeTab === 'screener' && (
            <MarketScreener
              tickers={tickers}
              filters={filters}
              setFilters={setFilters}
              presets={presets}
              watchlists={watchlists}
              activeWalls={activeWalls}
              onSelectSymbol={handleSelectSymbol}
              onToggleWatchlist={handleToggleWatchlist}
              onSavePreset={handleSavePreset}
            />
          )}

          {activeTab === 'walls' && (
            <WallMonitor
              walls={activeWalls}
              onSelectSymbol={handleSelectSymbol}
              crossExchangeAggregation={crossExchangeAggregation}
              onToggleAggregation={handleToggleAggregation}
              minVolumeUsd={minVolumeUsd}
              onUpdateMinVolume={handleUpdateMinVolume}
              maxDistancePercent={maxDistancePercent}
              onUpdateMaxDistance={handleUpdateMaxDistance}
            />
          )}

          {activeTab === 'alerts' && (
            <AlertManager
              rules={alertRules}
              triggers={alertTriggers}
              onSaveRule={handleSaveAlertRule}
              onDeleteRule={handleDeleteAlertRule}
              onMarkRead={handleMarkAlertRead}
              onClearTriggers={handleClearAlertTriggers}
              onTestSimulation={handleTestSimulation}
            />
          )}

          {activeTab === 'focus' && (
            <SymbolFocusView
              symbol={selectedSymbol || 'BTCUSDT'}
              exchange={selectedExchange}
              marketType={selectedMarketType}
              onBack={() => setActiveTab('screener')}
              onSelectSymbol={handleSelectSymbol}
              allTickers={tickers}
              onToggleWatchlist={handleToggleWatchlist}
              isWatchlisted={watchlists[0]?.items.some(i => i.symbol === (selectedSymbol || 'BTCUSDT')) || false}
            />
          )}

          {activeTab === 'watchlists' && (
            <WatchlistView
              watchlists={watchlists}
              tickers={tickers}
              onSelectSymbol={handleSelectSymbol}
              onRemoveItem={async (wlId, sym, ex, mType) => {
                await removeWatchlistItem(wlId, { symbol: sym, exchange: ex, marketType: mType });
                const updated = await fetchWatchlists();
                setWatchlists(updated);
              }}
              onAddItem={async (wlId, sym, ex, mType) => {
                try {
                  await addWatchlistItem(wlId, { symbol: sym, exchange: ex, marketType: mType });
                  const updated = await fetchWatchlists();
                  setWatchlists(updated);
                } catch (err: any) {
                  if (err.statusCode === 403 || err.errorCode === 'PLAN_LIMIT_REACHED') {
                    openPricingModal(err.message, 'PRO');
                  } else {
                    alert(err.message || 'Failed to add item to watchlist');
                  }
                }
              }}
            />
          )}

          {activeTab === 'history' && <HistoricalWallsView />}

          {activeTab === 'blacklist' && (
            <BlacklistManager
              entries={blacklist}
              onAddEntry={handleAddBlacklist}
              onRemoveEntry={handleRemoveBlacklist}
            />
          )}

          {activeTab === 'admin' && <AdminPanelView />}

          {activeTab === 'settings' && settings && (
            <SettingsView
              settings={settings}
              connectors={connectors}
              onSaveSettings={handleSaveSettings}
              onRefreshHealth={handleRefreshHealth}
            />
          )}

          {activeTab === 'tests' && <TestSuiteModal />}
        </main>
      </div>

      {/* Subscription & Pricing Modal */}
      <PricingModal
        isOpen={isPricingOpen}
        onClose={() => {
          setIsPricingOpen(false);
          setPricingReason(undefined);
        }}
        highlightPlan={highlightPlan}
        reasonMessage={pricingReason}
      />
    </div>
  );
}

export default App;

