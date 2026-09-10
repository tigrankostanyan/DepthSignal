import React from 'react';
import { Settings, Volume2, Play } from 'lucide-react';
import type { SavedFilterPreset, UserSettings } from '@/types/index';
import { playAlertSound, unlockAudio } from '@/lib/audio';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Card } from '@/components/ui/Card';
import { FormField } from '@/components/ui/FormField';
import { Toggle } from '@/components/ui/Toggle';

const inputCls =
  'w-full bg-primary border border-divider rounded px-3 py-2 text-white font-mono focus:border-[#168FD6] focus:outline-none';

interface UIPreferencesSectionProps {
  form: UserSettings;
  onChange: (patch: Partial<UserSettings>) => void;
  presets: SavedFilterPreset[];
}

export const UIPreferencesSection: React.FC<UIPreferencesSectionProps> = ({ form, onChange, presets }) => {
  return (
    <Card className="p-4">
      <SectionHeader
        icon={<Settings size={14} className="text-accent" />}
        title="UI & Data Preferences"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Theme Selector (Locked to Institutional Dark) */}
        <div>
          <label className="block text-[10px] font-bold text-muted uppercase mb-1">Interface Theme</label>
          <div className="flex items-center justify-between px-3 py-2 rounded border border-[#168FD6]/40 bg-[#0B1E33] text-xs">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-[#24C4E8] shadow-[0_0_6px_#24C4E8]" />
              <span className="font-bold text-white tracking-wide">Institutional Dark</span>
            </div>
            <span className="text-[10px] font-mono font-bold text-[#24C4E8] bg-[#168FD6]/20 px-2 py-0.5 rounded border border-[#168FD6]/40">
              LOCKED
            </span>
          </div>
          <p className="text-[11px] text-muted mt-1">Institutional-grade dark mode calibrated for L2 depth feeds.</p>
        </div>

        {/* Currency Selector */}
        <div>
          <label className="block text-[10px] font-bold text-muted uppercase mb-1">Display Currency</label>
          <div className="grid grid-cols-2 gap-2">
            {(['USD', 'USDT'] as const).map((currency) => (
              <button
                key={currency}
                type="button"
                onClick={() => onChange({ currency })}
                className={`px-3 py-2 rounded border font-mono font-bold text-xs transition cursor-pointer ${
                  form.currency === currency
                    ? 'bg-accent/20 text-[#24C4E8] border-[#24C4E8]/50'
                    : 'bg-primary text-muted border-divider hover:text-white hover:border-[#168FD6]/40'
                }`}
              >
                {currency}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted mt-1">Used across volumes, walls and alert prices.</p>
        </div>

        {/* Refresh Rate Slider */}
        <FormField label={`Realtime Refresh Rate — ${form.refreshRateMs}ms`}>
          <input
            type="range"
            min="500"
            max="10000"
            step="500"
            value={form.refreshRateMs}
            onChange={(e) => onChange({ refreshRateMs: Number(e.target.value) })}
            className="w-full accent-[#168FD6]"
          />
          <div className="flex justify-between text-[10px] text-muted font-mono mt-0.5">
            <span>0.5s</span>
            <span>1s</span>
            <span>2s</span>
            <span>5s</span>
            <span>10s</span>
          </div>
        </FormField>

        {/* Default Preset Picker */}
        <FormField label="Default Screener Preset">
          <select
            value={form.defaultPresetId || ''}
            onChange={(e) => onChange({ defaultPresetId: e.target.value || undefined })}
            className={inputCls}
          >
            <option value="">— No Default Preset —</option>
            {presets.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <p className="text-[11px] text-muted mt-1">Applied automatically when opening the Screener.</p>
        </FormField>

        {/* Sound Enabled Toggle */}
        <div className="md:col-span-2">
          <div className="flex items-center justify-between p-3 rounded bg-primary border border-divider">
            <div className="flex items-center space-x-2">
              <Volume2 size={14} className="text-accent" />
              <div>
                <div className="text-xs font-bold text-white">Audio Alert Notifications</div>
                <div className="text-[11px] text-muted">
                  Play a sound when a wall or price alert triggers in the active tab.
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => {
                  unlockAudio();
                  playAlertSound();
                }}
                className="px-2.5 py-1.5 rounded text-[11px] font-medium bg-surface hover:bg-panel text-muted hover:text-accent border border-divider transition flex items-center space-x-1"
                title="Test alert sound"
              >
                <Play size={12} />
                <span>Test</span>
              </button>
              <Toggle
                size="sm"
                checked={form.soundEnabled}
                onChange={(checked) => onChange({ soundEnabled: checked })}
                ariaLabel="Audio alert notifications"
              />
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};