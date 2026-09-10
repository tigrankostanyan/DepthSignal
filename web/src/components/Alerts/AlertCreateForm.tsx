import React, { useState, useEffect } from 'react';
import type {
  AlertCondition,
  AlertConditionType,
  AlertRule,
  ExchangeId,
  MarketType,
  Timeframe,
} from '@/types/index';
import { fetchIntegrationsStatus } from '@/lib/api';
import { TIMEFRAMES } from '@/lib/constants';
import { Badge } from '@/components/ui/Badge';
import { FormField } from '@/components/ui/FormField';

const formInputCls =
  'w-full bg-primary border border-divider rounded px-3 py-2 text-main focus:border-[#168FD6] focus:outline-none';
const condInputCls =
  'w-full bg-card border border-divider rounded px-2.5 py-1.5 text-main font-mono';

const TIMEFRAME_LABELS: Record<Timeframe, string> = {
  '30s': '30 seconds',
  '1m': '1 minute',
  '5m': '5 minutes',
  '15m': '15 minutes',
  '1h': '1 hour',
  '4h': '4 hours',
  '1d': '24 hours',
};

const conditionTypes: { type: AlertConditionType; label: string; desc: string }[] = [
  { type: 'WALL_DETECTED', label: 'Order Book Wall Detected', desc: 'Alerts when large liquidity barrier forms' },
  { type: 'PRICE_ABOVE', label: 'Price Above Threshold ($)', desc: 'Alerts when price crosses above a target' },
  { type: 'PRICE_BELOW', label: 'Price Below Threshold ($)', desc: 'Alerts when price drops below a target' },
  { type: 'PERCENTAGE_CHANGE', label: 'Rapid % Movement', desc: 'Alerts on sudden multi-timeframe pump/dump' },
  { type: 'VOLUME_SPIKE', label: 'Abnormal Volume Surge', desc: 'Alerts when volume exceeds multi-multiplier' },
  { type: 'RSI_OVERBOUGHT', label: 'RSI Overbought (>= 70)', desc: 'Technical exhaustion indicator' },
  { type: 'RSI_OVERSOLD', label: 'RSI Oversold (<= 30)', desc: 'Technical oversold rebound signal' },
  { type: 'FUNDING_RATE_ANOMALY', label: 'Futures Funding Anomaly', desc: 'Extreme positive/negative perp rate' },
];

interface AlertCreateFormProps {
  onClose: () => void;
  onSave: (rule: Partial<AlertRule>) => Promise<void>;
}

export const AlertCreateForm: React.FC<AlertCreateFormProps> = ({ onClose, onSave }) => {
  const [integrationStatus, setIntegrationStatus] = useState<{
    billing: boolean;
    telegram: boolean;
    email: boolean;
    webhook: boolean;
  }>({
    billing: false,
    telegram: false,
    email: false,
    webhook: false,
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
        rsiThreshold,
      },
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
      notifyChannels: channels,
    };

    await onSave(newRule);
    onClose();
    setName('');
  };

  return (
    <div className="mb-6 bg-card border border-[#168FD6]/40 rounded-xl p-5 shadow-2xl text-xs">
      <div className="flex items-center justify-between pb-3 border-b border-divider mb-4">
        <span className="font-bold text-white text-sm">Configure New Alert Rule</span>
        <button
          onClick={onClose}
          className="text-muted hover:text-white"
        >
          ✕
        </button>
      </div>

      <form onSubmit={handleCreateRule} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Rule Name">
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. BTC $1M Support Wall Alert"
              className={formInputCls}
            />
          </FormField>

          <FormField label="Target Symbols (Comma separated, or ALL)">
            <input
              type="text"
              value={symbolsInput}
              onChange={(e) => setSymbolsInput(e.target.value)}
              placeholder="BTCUSDT, ETHUSDT, SOLUSDT"
              className={formInputCls}
            />
          </FormField>
        </div>

        {/* Condition Selection */}
        <FormField label="Condition Trigger">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {conditionTypes.map(c => (
              <button
                type="button"
                key={c.type}
                onClick={() => setCondType(c.type)}
                className={`p-2.5 rounded-lg border text-left transition ${
                  condType === c.type
                    ? 'bg-accent/15 border-[#24C4E8] text-[#24C4E8]'
                    : 'bg-surface border-divider text-main hover:border-[#168FD6]/50'
                }`}
              >
                <div className="font-bold text-xs">{c.label}</div>
                <div className="text-[10px] text-muted mt-0.5">{c.desc}</div>
              </button>
            ))}
          </div>
        </FormField>

        {/* Condition Parameters */}
        <div className="p-4 rounded-lg bg-primary border border-divider space-y-3">
          <span className="text-[11px] font-bold text-accent uppercase tracking-wider block">
            Condition Parameters ({condType})
          </span>

          {condType === 'WALL_DETECTED' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-muted mb-1">Min Wall Liquidity ($)</label>
                <input
                  type="number"
                  value={minWallVolumeUsd}
                  onChange={(e) => setMinWallVolumeUsd(Number(e.target.value))}
                  className={condInputCls}
                />
              </div>
              <div>
                <label className="block text-muted mb-1">Max Distance from Price (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={maxWallDistancePercent}
                  onChange={(e) => setMaxWallDistancePercent(Number(e.target.value))}
                  className={condInputCls}
                />
              </div>
            </div>
          )}

          {(condType === 'PRICE_ABOVE' || condType === 'PRICE_BELOW') && (
            <div>
              <label className="block text-muted mb-1">Target Trigger Price ($)</label>
              <input
                type="number"
                value={targetPrice}
                onChange={(e) => setTargetPrice(Number(e.target.value))}
                className={condInputCls}
              />
            </div>
          )}

          {condType === 'PERCENTAGE_CHANGE' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-muted mb-1">Percentage Threshold (±%)</label>
                <input
                  type="number"
                  step="0.5"
                  value={percentageThreshold}
                  onChange={(e) => setPercentageThreshold(Number(e.target.value))}
                  className={condInputCls}
                />
              </div>
              <div>
                <label className="block text-muted mb-1">Evaluation Timeframe</label>
                <select
                  value={timeframe}
                  onChange={(e) => setTimeframe(e.target.value as Timeframe)}
                  className={condInputCls}
                >
                  {TIMEFRAMES.map((tf) => (
                    <option key={tf} value={tf}>{TIMEFRAME_LABELS[tf]}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {(condType === 'RSI_OVERBOUGHT' || condType === 'RSI_OVERSOLD') && (
            <div>
              <label className="block text-muted mb-1">RSI Threshold Level</label>
              <input
                type="number"
                value={rsiThreshold}
                onChange={(e) => setRsiThreshold(Number(e.target.value))}
                className={condInputCls}
              />
            </div>
          )}
        </div>

        {/* Cooldown & Channel Settings */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Anti-Spam Cooldown (Seconds)">
            <input
              type="number"
              value={cooldownSeconds}
              onChange={(e) => setCooldownSeconds(Number(e.target.value))}
              className={formInputCls}
            />
          </FormField>

          <FormField label="Delivery Channels">
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
                        ? 'bg-accent/20 text-[#24C4E8] border-[#24C4E8]/50'
                        : 'bg-primary text-muted border-divider hover:text-white'
                    }`}
                  >
                    <span>{ch}</span>
                    {isUnconfigured && <Badge tone="neutral">Unset</Badge>}
                  </button>
                );
              })}
            </div>
            {(!integrationStatus.telegram || !integrationStatus.email || !integrationStatus.webhook) && (
              <p className="text-[10px] text-muted mt-1.5 font-sans">
                Note: External channels without server credentials will safely record events to the in-app audit log without failing alert evaluation.
              </p>
            )}
          </FormField>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end space-x-2 pt-3 border-t border-divider">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded bg-panel hover:bg-panel text-main font-semibold"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-5 py-2 rounded-lg bg-[#168FD6] hover:bg-[#1C9AE5] text-white font-bold shadow-md shadow-[#168FD6]/20 cursor-pointer active:scale-95"
          >
            Save & Enable Rule
          </button>
        </div>
      </form>
    </div>
  );
};