import React, { useState, useEffect } from 'react';
import { Settings, Shield, Radio, Volume2, Send, Save, CheckCircle2, RefreshCw, AlertCircle, Lock, Mail } from 'lucide-react';
import { ConnectorStatus, ExchangeId, UserSettings } from '../../types/index.js';
import { fetchIntegrationsStatus } from '../../lib/api.js';

interface SettingsViewProps {
  settings: UserSettings;
  connectors: ConnectorStatus[];
  onSaveSettings: (settings: Partial<UserSettings>) => Promise<void>;
  onRefreshHealth: () => Promise<void>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  connectors,
  onSaveSettings,
  onRefreshHealth
}) => {
  const [form, setForm] = useState<UserSettings>(settings);
  const [savedSuccess, setSavedSuccess] = useState(false);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSaveSettings(form);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const toggleExchange = (ex: ExchangeId) => {
    const list = form.enabledExchanges.includes(ex)
      ? form.enabledExchanges.filter(e => e !== ex)
      : [...form.enabledExchanges, ex];
    setForm(prev => ({ ...prev, enabledExchanges: list }));
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0B0E11] overflow-hidden select-none text-xs">
      {/* Header */}
      <div className="p-4 border-b border-[#2B2F36] bg-[#181A20] flex items-center justify-between flex-none">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded bg-[#F0B90B]/10 border border-[#F0B90B]/30 text-[#F0B90B]">
            <Settings size={20} />
          </div>
          <div>
            <h1 className="text-base font-bold text-white uppercase tracking-tight">Terminal & Engine Settings</h1>
            <p className="text-xs text-[#848E9C]">Configure exchange gateways, wall algorithms, audio triggers, and external integrations</p>
          </div>
        </div>

        <button
          onClick={handleSubmit}
          className="flex items-center space-x-1.5 px-4 py-2 rounded bg-[#F0B90B] hover:bg-[#F0B90B]/90 text-black font-bold transition shadow"
        >
          <Save size={14} />
          <span>{savedSuccess ? 'Settings Saved!' : 'Save Changes'}</span>
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-6">
        {/* OPTIONAL INTEGRATION STATUS MATRIX */}
        <div className="bg-[#181A20] border border-[#2B2F36] rounded-xl p-4 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <Shield size={14} className="text-[#F0B90B]" />
              <span className="font-bold text-white text-xs uppercase tracking-wider">
                External Integrations Status (Optional in Development)
              </span>
            </div>
            <span className="text-[10px] bg-[#2B2F36] text-[#848E9C] px-2 py-0.5 rounded font-mono">
              ZERO CONFIG REQUIRED FOR CORE ENGINE
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            {/* Stripe Billing */}
            <div className="p-3 bg-[#0B0E11] border border-[#2B2F36] rounded-lg">
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-white">Stripe Billing</span>
                <span className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded ${
                  integrationStatus.billing ? 'bg-[#0ECB81]/15 text-[#0ECB81]' : 'bg-[#2B2F36] text-[#848E9C]'
                }`}>
                  {integrationStatus.billing ? 'ACTIVE' : 'OPTIONAL (UNSET)'}
                </span>
              </div>
              <p className="text-[11px] text-[#848E9C]">
                {integrationStatus.billing ? 'Checkout enabled' : 'Billing not configured'}
              </p>
            </div>

            {/* Telegram Bot */}
            <div className="p-3 bg-[#0B0E11] border border-[#2B2F36] rounded-lg">
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-white">Telegram Bot</span>
                <span className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded ${
                  integrationStatus.telegram ? 'bg-[#0ECB81]/15 text-[#0ECB81]' : 'bg-[#2B2F36] text-[#848E9C]'
                }`}>
                  {integrationStatus.telegram ? 'ACTIVE' : 'OPTIONAL (UNSET)'}
                </span>
              </div>
              <p className="text-[11px] text-[#848E9C]">
                {integrationStatus.telegram ? 'Direct dispatch enabled' : 'Notifications disabled'}
              </p>
            </div>

            {/* SMTP Email */}
            <div className="p-3 bg-[#0B0E11] border border-[#2B2F36] rounded-lg">
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-white">SMTP Email</span>
                <span className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded ${
                  integrationStatus.email ? 'bg-[#0ECB81]/15 text-[#0ECB81]' : 'bg-[#2B2F36] text-[#848E9C]'
                }`}>
                  {integrationStatus.email ? 'ACTIVE' : 'OPTIONAL (UNSET)'}
                </span>
              </div>
              <p className="text-[11px] text-[#848E9C]">
                {integrationStatus.email ? 'Email dispatch enabled' : 'Notifications disabled'}
              </p>
            </div>

            {/* Webhook Signing */}
            <div className="p-3 bg-[#0B0E11] border border-[#2B2F36] rounded-lg">
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-white">Webhook Signing</span>
                <span className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded ${
                  integrationStatus.webhook ? 'bg-[#0ECB81]/15 text-[#0ECB81]' : 'bg-[#2B2F36] text-[#848E9C]'
                }`}>
                  {integrationStatus.webhook ? 'ACTIVE' : 'OPTIONAL (UNSET)'}
                </span>
              </div>
              <p className="text-[11px] text-[#848E9C]">
                {integrationStatus.webhook ? 'HMAC signing enabled' : 'Delivery disabled'}
              </p>
            </div>
          </div>
        </div>

        {/* SECTION 1: EXCHANGE CONNECTORS MATRIX */}
        <div className="bg-[#181A20] border border-[#2B2F36] rounded-xl overflow-hidden shadow-lg">
          <div className="p-3 border-b border-[#2B2F36] bg-[#1E2329] flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Radio size={14} className="text-[#F0B90B]" />
              <span className="font-bold text-[#EAECEF] text-xs">Exchange Connectors & Gateway Health</span>
            </div>
            <button
              onClick={onRefreshHealth}
              className="p-1 rounded hover:bg-[#2B2F36] text-[#848E9C] hover:text-white transition"
              title="Refresh Health"
            >
              <RefreshCw size={13} />
            </button>
          </div>

          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-[#181A20] text-[10px] font-bold text-[#848E9C] uppercase tracking-wider">
              <tr>
                <th className="py-2.5 px-4">Exchange</th>
                <th className="py-2.5 px-4">Category</th>
                <th className="py-2.5 px-4">Gateway Status</th>
                <th className="py-2.5 px-4 text-right">Ping / Latency</th>
                <th className="py-2.5 px-4 text-right">Ingested Tickers</th>
                <th className="py-2.5 px-4 text-center">Enable/Disable</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2B2F36] font-mono text-[11px]">
              {connectors.map(c => {
                const isEnabled = form.enabledExchanges.includes(c.exchange);
                return (
                  <tr key={c.exchange} className="hover:bg-[#1E2329] transition">
                    <td className="py-3 px-4 font-bold text-white font-sans">
                      {c.name}
                    </td>
                    <td className="py-3 px-4 text-[#848E9C]">
                      {c.exchange === 'NASDAQ' || c.exchange === 'NYSE' ? 'US STOCKS' : 'CRYPTO'}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center w-max ${
                        c.connected ? 'bg-[#0ECB81]/15 text-[#0ECB81]' : 'bg-[#2B2F36] text-[#848E9C]'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${c.connected ? 'bg-[#0ECB81] animate-pulse' : 'bg-[#848E9C]'}`} />
                        {c.connected ? 'CONNECTED' : 'DISCONNECTED'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right text-[#EAECEF]">
                      {c.pingMs ? `${c.pingMs}ms` : '--'}
                    </td>
                    <td className="py-3 px-4 text-right text-[#F0B90B] font-bold">
                      {c.tickerCount.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => toggleExchange(c.exchange)}
                        className={`px-3 py-1 rounded text-xs font-bold transition border ${
                          isEnabled
                            ? 'bg-[#F0B90B]/20 text-[#F0B90B] border-[#F0B90B]/40'
                            : 'bg-[#0B0E11] text-[#848E9C] border-[#2B2F36]'
                        }`}
                      >
                        {isEnabled ? 'ENABLED' : 'MUTED'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* SECTION 2: WALL ENGINE DEFAULTS */}
        <div className="bg-[#181A20] border border-[#2B2F36] rounded-xl p-4 shadow-xl">
          <div className="text-xs font-bold text-white uppercase tracking-wider mb-3 flex items-center space-x-2">
            <Shield size={14} className="text-[#F0B90B]" />
            <span>Wall Engine Default Architectural Parameters</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-[#848E9C] uppercase mb-1">
                Default Min Wall Liquidity ($)
              </label>
              <input
                type="number"
                value={form.wallMinVolumeDefaultUsd}
                onChange={(e) => setForm(prev => ({ ...prev, wallMinVolumeDefaultUsd: Number(e.target.value) }))}
                className="w-full bg-[#0B0E11] border border-[#2B2F36] rounded px-3 py-2 text-white font-mono focus:border-[#F0B90B] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-[#848E9C] uppercase mb-1">
                Cross-Exchange Aggregation Default
              </label>
              <div className="flex items-center justify-between p-2 rounded bg-[#0B0E11] border border-[#2B2F36]">
                <span className="text-[#EAECEF] font-mono text-xs">
                  {form.defaultCrossExchangeAggregation ? 'Enabled' : 'Disabled (Mandatory Default)'}
                </span>
                <button
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, defaultCrossExchangeAggregation: !prev.defaultCrossExchangeAggregation }))}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    form.defaultCrossExchangeAggregation ? 'bg-[#F0B90B]' : 'bg-[#2B2F36]'
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                      form.defaultCrossExchangeAggregation ? 'translate-x-4' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-[#848E9C] uppercase mb-1">
                Price Decimal Precision
              </label>
              <input
                type="number"
                min="0"
                max="8"
                value={form.pricePrecision}
                onChange={(e) => setForm(prev => ({ ...prev, pricePrecision: Number(e.target.value) }))}
                className="w-full bg-[#0B0E11] border border-[#2B2F36] rounded px-3 py-2 text-white font-mono focus:border-[#F0B90B] focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* SECTION 3: NOTIFICATION ADAPTERS */}
        <div className="bg-[#181A20] border border-[#2B2F36] rounded-xl p-4 shadow-xl">
          <div className="text-xs font-bold text-white uppercase tracking-wider mb-3 flex items-center space-x-2">
            <Send size={14} className="text-[#F0B90B]" />
            <span>External Notification Webhooks & Telegram Integration</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-[#848E9C] uppercase mb-1">
                Telegram Bot Token
              </label>
              <input
                type="password"
                placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                value={form.telegramBotToken || ''}
                onChange={(e) => setForm(prev => ({ ...prev, telegramBotToken: e.target.value }))}
                className="w-full bg-[#0B0E11] border border-[#2B2F36] rounded px-3 py-2 text-white font-mono focus:border-[#F0B90B] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-[#848E9C] uppercase mb-1">
                Telegram Chat / Group ID
              </label>
              <input
                type="text"
                placeholder="-1001234567890"
                value={form.telegramChatId || ''}
                onChange={(e) => setForm(prev => ({ ...prev, telegramChatId: e.target.value }))}
                className="w-full bg-[#0B0E11] border border-[#2B2F36] rounded px-3 py-2 text-white font-mono focus:border-[#F0B90B] focus:outline-none"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-[10px] font-bold text-[#848E9C] uppercase mb-1">
                Custom Webhook URL (JSON payload POST)
              </label>
              <input
                type="url"
                placeholder="https://api.yourdomain.com/trading-alerts"
                value={form.webhookUrl || ''}
                onChange={(e) => setForm(prev => ({ ...prev, webhookUrl: e.target.value }))}
                className="w-full bg-[#0B0E11] border border-[#2B2F36] rounded px-3 py-2 text-white font-mono focus:border-[#F0B90B] focus:outline-none"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
