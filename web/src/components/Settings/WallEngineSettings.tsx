import React from 'react';
import { Shield } from 'lucide-react';
import type { UserSettings } from '@/types/index';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Card } from '@/components/ui/Card';
import { FormField } from '@/components/ui/FormField';
import { Toggle } from '@/components/ui/Toggle';

const inputCls =
  'w-full bg-primary border border-divider rounded px-3 py-2 text-white font-mono focus:border-[#168FD6] focus:outline-none';

interface WallEngineSettingsProps {
  form: UserSettings;
  onChange: (patch: Partial<UserSettings>) => void;
}

export const WallEngineSettings: React.FC<WallEngineSettingsProps> = ({ form, onChange }) => {
  return (
    <Card className="p-4">
      <SectionHeader
        icon={<Shield size={14} className="text-accent" />}
        title="Wall Engine Default Architectural Parameters"
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FormField label="Default Min Wall Liquidity ($)">
          <input
            type="number"
            value={form.wallMinVolumeDefaultUsd}
            onChange={(e) => onChange({ wallMinVolumeDefaultUsd: Number(e.target.value) })}
            className={inputCls}
          />
        </FormField>

        <FormField label="Cross-Exchange Aggregation Default">
          <div className="flex items-center justify-between p-2 rounded bg-primary border border-divider">
            <span className="text-main font-mono text-xs">
              {form.defaultCrossExchangeAggregation ? 'Enabled' : 'Disabled (Mandatory Default)'}
            </span>
            <Toggle
              size="sm"
              checked={form.defaultCrossExchangeAggregation}
              onChange={(checked) => onChange({ defaultCrossExchangeAggregation: checked })}
              ariaLabel="Cross-Exchange aggregation default"
            />
          </div>
        </FormField>

        <FormField label="Price Decimal Precision">
          <input
            type="number"
            min="0"
            max="8"
            value={form.decimalPrecision}
            onChange={(e) => onChange({ decimalPrecision: Number(e.target.value) })}
            className={inputCls}
          />
        </FormField>
      </div>
    </Card>
  );
};