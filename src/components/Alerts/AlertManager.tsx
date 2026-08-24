import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  Plus, 
  Trash2, 
  Bell, 
  Check, 
  AlertCircle, 
  Sliders, 
  CheckCircle2,
  Clock,
  Send,
  Zap,
  Volume2
} from 'lucide-react';
import { 
  AlertCondition, 
  AlertConditionType, 
  AlertRule, 
  AlertTrigger, 
  ExchangeId, 
  MarketType, 
  Timeframe 
} from '../../types/index.js';
import { fetchIntegrationsStatus } from '../../lib/api.js';

interface AlertManagerProps {
  rules: AlertRule[];
  triggers: AlertTrigger[];
  onSaveRule: (rule: Partial<AlertRule>) => Promise<void>;
  onDeleteRule: (id: string) => Promise<void>;
  onMarkRead: (id?: string) => Promise<void>;
  onClearTriggers: () => Promise<void>;
  onTestSimulation: () => Promise<void>;
}

export const AlertManager: React.FC<AlertManagerProps> = ({
  rules,
  triggers,
  onSaveRule,
  onDeleteRule,
  onMarkRead,
  onClearTriggers,
  onTestSimulation
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'rules' | 'triggers'>('rules');
  const [isCreating, setIsCreating] = useState(false);
  const [integrationStatus, setIntegrationStatus] = useState<{
    billing: boolean;
    telegram: boolean;
    email: boolean;
    webhook: boolean;
  }>({
    billing: false,
    telegram: false,
    email: false,
    webhook: false
  });

  useEffect(() => {
    fetchIntegrationsStatus()
      .then(setIntegrationStatus)
      .catch(() => {});
  }, []);

  // New Rule Form State
  const [name, setName] = useState('');
  const [symbolsInput, setSymbolsInput] = useState('BTCUSDT, ETHUSDT');
  const [selectedExchanges, setSelectedExchanges] = useState<ExchangeId[]>(['BINANCE', 'BYBIT']);
  const [selectedMarketTypes, setSelectedMarketTypes] = useState<MarketType[]>(['SPOT', 'FUTURES']);
  const [logic, setLogic] = useState<'AND' | 'OR'>('AND');
  const [cooldownSeconds, setCooldownSeconds] = useState(180);
  const [channels, setChannels] = useState<('IN_APP' | 'TELEGRAM' | 'EMAIL' | 'WEBHOOK')[]>(['IN_APP']);

  // Condition 1
  const [condType, setCondType] = useState<AlertConditionType>('WALL_DETECTED');
  const [targetPrice, setTargetPrice] = useState<number>(100000);
  const [percentageThreshold, setPercentageThreshold] = useState<number>(3.0);
  const [timeframe, setTimeframe] = useState<Timeframe>('1h');
  const [minWallVolumeUsd, setMinWallVolumeUsd] = useState<number>(500000);
  const [maxWallDistancePercent, setMaxWallDistancePercent] = useState<number>(2.5);
  const [rsiThreshold, setRsiThreshold] = useState<number>(70);

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const symbols = symbolsInput.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);

    const condition: AlertCondition = {
      id: `c_${Date.now()}`,
      type: condType,
      params: {
        targetPrice,
        percentageThreshold,
        timeframe,
        minWallVolumeUsd,
        maxWallDistancePercent,
        rsiThreshold
      }
    };

    const newRule: Partial<AlertRule> = {
      name,
      enabled: true,
      symbols: symbols.length > 0 ? symbols : ['ALL'],
      exchanges: selectedExchanges,
      marketTypes: selectedMarketTypes,
      logic,
      conditions: [condition],
      cooldownSeconds,
      notifyChannels: channels
    };

    await onSaveRule(newRule);
    setIsCreating(false);
    setName('');
  };

  const conditionTypes: { type: AlertConditionType; label: string; desc: string }[] = [
    { type: 'WALL_DETECTED', label: 'Order Book Wall Detected', desc: 'Alerts when large liquidity barrier forms' },
    { type: 'PRICE_ABOVE', label: 'Price Above Threshold ($)', desc: 'Alerts when price crosses above a target' },
    { type: 'PRICE_BELOW', label: 'Price Below Threshold ($)', desc: 'Alerts when price drops below a target' },
    { type: 'PERCENTAGE_CHANGE', label: 'Rapid % Movement', desc: 'Alerts on sudden multi-timeframe pump/dump' },
    { type: 'VOLUME_SPIKE', label: 'Abnormal Volume Surge', desc: 'Alerts when volume exceeds multi-multiplier' },
    { type: 'RSI_OVERBOUGHT', label: 'RSI Overbought (>= 70)', desc: 'Technical exhaustion indicator' },
    { type: 'RSI_OVERSOLD', label: 'RSI Oversold (<= 30)', desc: 'Technical oversold rebound signal' },
    { type: 'FUNDING_RATE_ANOMALY', label: 'Futures Funding Anomaly', desc: 'Extreme positive/negative perp rate' }
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0B0E11] overflow-hidden select-none">
      {/* Alerts Header */}
      <div className="p-4 border-b border-[#2B2F36] bg-[#181A20] flex flex-wrap items-center justify-between gap-3 flex-none">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded bg-[#1E2329] border border-[#2B2F36] text-[#F0B90B]">
            <ShieldAlert size={20} />
          </div>
          <div>
            <h1 className="text-base font-bold text-white uppercase tracking-tight">Institutional Alert Engine</h1>
            <p className="text-xs text-[#848E9C]">Real-time condition evaluation with cooldown protection and multi-channel adapters</p>
          </div>
        </div>

        {/* Tab & Action buttons */}
        <div className="flex items-center space-x-2">
          <div className="flex bg-[#0B0E11] rounded p-0.5 border border-[#2B2F36]">
            <button
              onClick={() => setActiveSubTab('rules')}
              className={`px-3 py-1.5 rounded text-xs font-semibold tracking-wide transition ${
                activeSubTab === 'rules' ? 'bg-[#2B2F36] text-white shadow-sm' : 'text-[#848E9C] hover:text-white'
              }`}
            >
              Active Rules ({rules.length})
            </button>
            <button
              onClick={() => setActiveSubTab('triggers')}
              className={`px-3 py-1.5 rounded text-xs font-semibold tracking-wide transition flex items-center space-x-1.5 ${
                activeSubTab === 'triggers' ? 'bg-[#2B2F36] text-white shadow-sm' : 'text-[#848E9C] hover:text-white'
              }`}
            >
              <span>Live Trigger Feed</span>
              {triggers.filter(t => !t.read).length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-[#F6465D] text-white text-[10px] font-bold">
                  {triggers.filter(t => !t.read).length}
                </span>
              )}
            </button>
          </div>

          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-[#F0B90B] hover:bg-[#dfa700] text-black font-bold text-xs transition shadow"
          >
            <Plus size={14} />
            <span>Create Rule</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto p-4">
        {/* CREATE RULE MODAL / FORM */}
        {isCreating && (
          <div className="mb-6 bg-[#181A20] border border-[#F0B90B]/50 rounded-xl p-5 shadow-2xl text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-[#2B2F36] mb-4">
              <span className="font-bold text-white text-sm">Configure New Alert Rule</span>
              <button
                onClick={() => setIsCreating(false)}
                className="text-[#848E9C] hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateRule} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-[#848E9C] uppercase tracking-wider mb-1">
                    Rule Name
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. BTC $1M Support Wall Alert"
                    className="w-full bg-[#0B0E11] border border-[#2B2F36] rounded px-3 py-2 text-[#EAECEF] focus:border-[#F0B90B] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#848E9C] uppercase tracking-wider mb-1">
                    Target Symbols (Comma separated, or ALL)
                  </label>
                  <input
                    type="text"
                    value={symbolsInput}
                    onChange={(e) => setSymbolsInput(e.target.value)}
                    placeholder="BTCUSDT, ETHUSDT, SOLUSDT"
                    className="w-full bg-[#0B0E11] border border-[#2B2F36] rounded px-3 py-2 text-[#EAECEF] font-mono focus:border-[#F0B90B] focus:outline-none"
                  />
                </div>
              </div>

              {/* Condition Selection */}
              <div>
                <label className="block text-[11px] font-bold text-[#848E9C] uppercase tracking-wider mb-2">
                  Condition Trigger
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                  {conditionTypes.map(c => (
                    <button
                      type="button"
                      key={c.type}
                      onClick={() => setCondType(c.type)}
                      className={`p-2.5 rounded-lg border text-left transition ${
                        condType === c.type
                          ? 'bg-[#F0B90B]/15 border-[#F0B90B] text-[#F0B90B]'
                          : 'bg-[#1E2329] border-[#2B2F36] text-[#EAECEF] hover:border-[#848E9C]'
                      }`}
                    >
                      <div className="font-bold text-xs">{c.label}</div>
                      <div className="text-[10px] text-[#848E9C] mt-0.5">{c.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Condition Parameters */}
              <div className="p-4 rounded-lg bg-[#0B0E11] border border-[#2B2F36] space-y-3">
                <span className="text-[11px] font-bold text-[#F0B90B] uppercase tracking-wider block">
                  Condition Parameters ({condType})
                </span>

                {condType === 'WALL_DETECTED' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[#848E9C] mb-1">Min Wall Liquidity ($)</label>
                      <input
                        type="number"
                        value={minWallVolumeUsd}
                        onChange={(e) => setMinWallVolumeUsd(Number(e.target.value))}
                        className="w-full bg-[#181A20] border border-[#2B2F36] rounded px-2.5 py-1.5 text-[#EAECEF] font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[#848E9C] mb-1">Max Distance from Price (%)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={maxWallDistancePercent}
                        onChange={(e) => setMaxWallDistancePercent(Number(e.target.value))}
                        className="w-full bg-[#181A20] border border-[#2B2F36] rounded px-2.5 py-1.5 text-[#EAECEF] font-mono"
                      />
                    </div>
                  </div>
                )}

                {(condType === 'PRICE_ABOVE' || condType === 'PRICE_BELOW') && (
                  <div>
                    <label className="block text-[#848E9C] mb-1">Target Trigger Price ($)</label>
                    <input
                      type="number"
                      value={targetPrice}
                      onChange={(e) => setTargetPrice(Number(e.target.value))}
                      className="w-full bg-[#181A20] border border-[#2B2F36] rounded px-2.5 py-1.5 text-[#EAECEF] font-mono"
                    />
                  </div>
                )}

                {condType === 'PERCENTAGE_CHANGE' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[#848E9C] mb-1">Percentage Threshold (±%)</label>
                      <input
                        type="number"
                        step="0.5"
                        value={percentageThreshold}
                        onChange={(e) => setPercentageThreshold(Number(e.target.value))}
                        className="w-full bg-[#181A20] border border-[#2B2F36] rounded px-2.5 py-1.5 text-[#EAECEF] font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[#848E9C] mb-1">Evaluation Timeframe</label>
                      <select
                        value={timeframe}
                        onChange={(e) => setTimeframe(e.target.value as Timeframe)}
                        className="w-full bg-[#181A20] border border-[#2B2F36] rounded px-2.5 py-1.5 text-[#EAECEF] font-mono"
                      >
                        <option value="1m">1 minute</option>
                        <option value="5m">5 minutes</option>
                        <option value="15m">15 minutes</option>
                        <option value="1h">1 hour</option>
                        <option value="1d">24 hours</option>
                      </select>
                    </div>
                  </div>
                )}

                {(condType === 'RSI_OVERBOUGHT' || condType === 'RSI_OVERSOLD') && (
                  <div>
                    <label className="block text-[#848E9C] mb-1">RSI Threshold Level</label>
                    <input
                      type="number"
                      value={rsiThreshold}
                      onChange={(e) => setRsiThreshold(Number(e.target.value))}
                      className="w-full bg-[#181A20] border border-[#2B2F36] rounded px-2.5 py-1.5 text-[#EAECEF] font-mono"
                    />
                  </div>
                )}
              </div>

              {/* Cooldown & Channel Settings */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-[#848E9C] uppercase tracking-wider mb-1">
                    Anti-Spam Cooldown (Seconds)
                  </label>
                  <input
                    type="number"
                    value={cooldownSeconds}
                    onChange={(e) => setCooldownSeconds(Number(e.target.value))}
                    className="w-full bg-[#0B0E11] border border-[#2B2F36] rounded px-3 py-2 text-[#EAECEF] font-mono focus:border-[#F0B90B] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#848E9C] uppercase tracking-wider mb-1">
                    Delivery Channels
                  </label>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {(['IN_APP', 'TELEGRAM', 'EMAIL', 'WEBHOOK'] as const).map(ch => {
                      const isUnconfigured = 
                        (ch === 'TELEGRAM' && !integrationStatus.telegram) ||
                        (ch === 'EMAIL' && !integrationStatus.email) ||
                        (ch === 'WEBHOOK' && !integrationStatus.webhook);

                      return (
                        <button
                          type="button"
                          key={ch}
                          onClick={() => {
                            if (channels.includes(ch)) {
                              if (channels.length > 1) setChannels(channels.filter(c => c !== ch));
                            } else {
                              setChannels([...channels, ch]);
                            }
                          }}
                          className={`px-2.5 py-1 rounded text-[11px] font-bold border transition flex items-center space-x-1.5 ${
                            channels.includes(ch)
                              ? 'bg-[#F0B90B]/20 text-[#F0B90B] border-[#F0B90B]/40'
                              : 'bg-[#0B0E11] text-[#848E9C] border-[#2B2F36]'
                          }`}
                        >
                          <span>{ch}</span>
                          {isUnconfigured && (
                            <span className="text-[9px] px-1 py-0.2 rounded bg-[#2B2F36] text-[#848E9C] font-mono">
                              Unset
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  {(!integrationStatus.telegram || !integrationStatus.email || !integrationStatus.webhook) && (
                    <p className="text-[10px] text-[#848E9C] mt-1.5 font-sans">
                      Note: External channels without server credentials will safely record events to the in-app audit log without failing alert evaluation.
                    </p>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-[#2B2F36]">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-4 py-2 rounded bg-[#2B2F36] hover:bg-[#34383F] text-[#EAECEF] font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded bg-[#F0B90B] hover:bg-[#dfa700] text-black font-bold shadow"
                >
                  Save & Enable Rule
                </button>
              </div>
            </form>
          </div>
        )}

        {/* SUBTAB 1: ACTIVE RULES LIST */}
        {activeSubTab === 'rules' && (
          <div className="space-y-3">
            {rules.length === 0 ? (
              <div className="p-12 text-center text-[#848E9C] text-xs bg-[#181A20] rounded-xl border border-[#2B2F36]">
                <ShieldAlert size={28} className="mx-auto mb-2 opacity-40 text-[#F0B90B]" />
                <div>No alert rules configured.</div>
                <button
                  onClick={() => setIsCreating(true)}
                  className="mt-3 px-4 py-1.5 rounded bg-[#F0B90B] text-black font-bold text-xs"
                >
                  Create First Alert Rule
                </button>
              </div>
            ) : (
              rules.map(rule => (
                <div
                  key={rule.id}
                  className="p-4 rounded-xl bg-[#181A20] border border-[#2B2F36] hover:border-[#F0B90B]/30 transition flex flex-wrap items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-start space-x-3">
                    <div className={`p-2 rounded-lg ${rule.enabled ? 'bg-[#1E2329] text-[#F0B90B] border border-[#2B2F36]' : 'bg-[#1E2329] text-[#848E9C]'}`}>
                      <Zap size={18} />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-white text-sm">{rule.name}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          rule.enabled ? 'bg-[#0ECB81]/15 text-[#0ECB81] border border-[#0ECB81]/30' : 'bg-[#2B2F36] text-[#848E9C]'
                        }`}>
                          {rule.enabled ? 'ACTIVE' : 'DISABLED'}
                        </span>
                      </div>
                      <div className="text-[#848E9C] mt-1 flex flex-wrap items-center gap-2 text-[11px]">
                        <span>Symbols: <strong className="text-[#EAECEF]">{rule.symbols.join(', ')}</strong></span>
                        <span>•</span>
                        <span>Conditions: <strong className="text-[#F0B90B]">{rule.conditions.map(c => c.type).join(` ${rule.logic} `)}</strong></span>
                        <span>•</span>
                        <span>Cooldown: <strong className="text-[#EAECEF] font-mono">{rule.cooldownSeconds}s</strong></span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => onSaveRule({ ...rule, enabled: !rule.enabled })}
                      className={`px-3 py-1.5 rounded text-xs font-bold border transition ${
                        rule.enabled ? 'bg-[#2B2F36] text-[#F0B90B] border-[#2B2F36]' : 'bg-[#2B2F36] text-[#0ECB81] border-[#2B2F36]'
                      }`}
                    >
                      {rule.enabled ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      onClick={() => onDeleteRule(rule.id)}
                      className="p-1.5 rounded hover:bg-[#F6465D]/20 text-[#848E9C] hover:text-[#F6465D] transition"
                      title="Delete rule"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* SUBTAB 2: LIVE TRIGGER FEED */}
        {activeSubTab === 'triggers' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#2B2F36]">
              <span className="text-xs text-[#848E9C] font-medium">Historical Trigger Log ({triggers.length} events)</span>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => onMarkRead()}
                  className="px-2.5 py-1 rounded bg-[#1E2329] hover:bg-[#2B2F36] text-[#EAECEF] text-xs font-medium border border-[#2B2F36] transition"
                >
                  Mark All Read
                </button>
                <button
                  onClick={onClearTriggers}
                  className="px-2.5 py-1 rounded bg-[#F6465D]/15 hover:bg-[#F6465D]/25 text-[#F6465D] text-xs font-medium border border-[#F6465D]/30 transition"
                >
                  Clear Feed
                </button>
              </div>
            </div>

            {triggers.length === 0 ? (
              <div className="p-12 text-center text-[#848E9C] text-xs bg-[#181A20] rounded-xl border border-[#2B2F36]">
                <Bell size={28} className="mx-auto mb-2 opacity-40 text-[#F0B90B]" />
                <div>No alerts triggered yet.</div>
                <div className="text-[#848E9C] text-[11px] mt-1">Live market ticks will populate this feed as conditions are met.</div>
              </div>
            ) : (
              triggers.map(trig => (
                <div
                  key={trig.id}
                  onClick={() => onMarkRead(trig.id)}
                  className={`p-3.5 rounded-xl border transition cursor-pointer text-xs ${
                    trig.read
                      ? 'bg-[#181A20]/60 border-[#2B2F36] opacity-80'
                      : 'bg-[#1E2329] border-[#F0B90B]/40 shadow-lg'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-white text-sm font-sans">{trig.symbol}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#0B0E11] text-[#848E9C] border border-[#2B2F36] font-mono">
                        {trig.exchange} {trig.marketType}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#F0B90B]/15 text-[#F0B90B] font-bold">
                        {trig.conditionType}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-[#848E9C]">
                      {new Date(trig.timestamp).toLocaleString()}
                    </span>
                  </div>

                  <div className="text-[#EAECEF] text-xs mb-2 font-medium">
                    {trig.message}
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-[#848E9C] pt-1.5 border-t border-[#2B2F36]">
                    <span>Triggered by: <strong className="text-white">{trig.ruleName}</strong></span>
                    <span className="font-mono text-[#F0B90B] font-bold">
                      Price at Event: ${trig.triggerPrice?.toLocaleString()}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
