import React, { useState, useEffect } from 'react';
import { Settings, Save } from 'lucide-react';
import type { ConnectorStatus, ExchangeId, SavedFilterPreset, UserSettings } from '@/types/index';
import { fetchIntegrationsStatus } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { IntegrationStatusCard, IntegrationStatus } from './IntegrationStatusCard';
import { ExchangeConnectorsTable } from './ExchangeConnectorsTable';
import { WallEngineSettings } from './WallEngineSettings';
import { UIPreferencesSection } from './UIPreferencesSection';
import { TelegramSection } from './TelegramSection';
import { StockDataProviders } from './StockDataProviders';

interface SettingsViewProps {
  settings: UserSettings;
  connectors: ConnectorStatus[];
  presets: SavedFilterPreset[];
  onSaveSettings: (settings: Partial<UserSettings>) => Promise<void>;
  onRefreshHealth: () => Promise<void>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  connectors,
  presets,
  onSaveSettings,
  onRefreshHealth,
}) => {
  const [form, setForm] = useState<UserSettings>(settings);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [integrationStatus, setIntegrationStatus] = useState<IntegrationStatus>({
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSaveSettings(form);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const onChange = (patch: Partial<UserSettings>) => {
    setForm((prev) => ({ ...prev, ...patch }));
  };

  const toggleExchange = (ex: ExchangeId) => {
    const list = form.enabledExchanges.includes(ex)
      ? form.enabledExchanges.filter((e) => e !== ex)
      : [...form.enabledExchanges, ex];
    onChange({ enabledExchanges: list });
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-primary select-none text-xs">
      {/* Header */}
      <div className="flex-none">
        <PageHeader
          icon={<Settings size={20} />}
          iconClassName="p-2 rounded-lg bg-accent/15 border border-[#168FD6]/40 text-[#24C4E8]"
          title="Terminal & Engine Settings"
          subtitle="Configure exchange gateways, wall algorithms, audio triggers, and external integrations"
          actions={
            <button
              onClick={handleSubmit}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-[#168FD6] hover:bg-[#1C9AE5] text-white font-bold transition shadow-md shadow-[#168FD6]/20 cursor-pointer active:scale-95"
            >
              <Save size={14} className="text-white" />
              <span>{savedSuccess ? 'Settings Saved!' : 'Save Changes'}</span>
            </button>
          }
        />
      </div>

      <div className="flex-1 overflow-auto min-h-0 p-4 space-y-6">
        {/* OPTIONAL INTEGRATION STATUS MATRIX */}
        <IntegrationStatusCard status={integrationStatus} />

        {/* SECTION 1: EXCHANGE CONNECTORS MATRIX */}
        <ExchangeConnectorsTable
          connectors={connectors}
          enabledExchanges={form.enabledExchanges}
          onToggleExchange={toggleExchange}
          onRefreshHealth={onRefreshHealth}
        />

        {/* SECTION 2: WALL ENGINE DEFAULTS */}
        <WallEngineSettings form={form} onChange={onChange} />

        {/* SECTION 2.5: UI & DATA PREFERENCES */}
        <UIPreferencesSection form={form} onChange={onChange} presets={presets} />

        {/* SECTION 3: TELEGRAM & NOTIFICATION ADAPTERS */}
        <TelegramSection form={form} onChange={onChange} />

        {/* SECTION 4: STOCK MARKET DATA PROVIDERS */}
        <StockDataProviders form={form} onChange={onChange} />
      </div>
    </div>
  );
};