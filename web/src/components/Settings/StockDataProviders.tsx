import React from 'react';
import { Database, AlertCircle } from 'lucide-react';
import type { UserSettings } from '@/types/index';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Card } from '@/components/ui/Card';
import { FormField } from '@/components/ui/FormField';

const inputCls =
  'w-full bg-primary border border-divider rounded px-3 py-2 text-white font-mono focus:border-[#168FD6] focus:outline-none';

interface StockDataProvidersProps {
  form: UserSettings;
  onChange: (patch: Partial<UserSettings>) => void;
}

export const StockDataProviders: React.FC<StockDataProvidersProps> = ({ form, onChange }) => {
  return (
    <Card className="p-4">
      <SectionHeader
        icon={<Database size={14} className="text-accent" />}
        title="Stock Market Data Providers (NASDAQ / NYSE)"
      />

      <div className="mb-4 p-4 rounded-lg bg-primary border border-divider">
        <div className="flex items-start space-x-2">
          <AlertCircle size={14} className="text-accent mt-0.5 shrink-0" />
          <p className="text-[11px] text-muted leading-relaxed">
            Synthetic or fake stock data is <strong className="text-ask">strictly disabled</strong>.
            Real NASDAQ / NYSE quotes, candles &amp; market data are fetched exclusively via
            <strong className="text-white"> Finnhub</strong> or <strong className="text-white"> Polygon.io</strong>.
            <br /><br />
            Configure at least one API key below. Without a key the Stock exchange remains
            <strong className="text-accent"> NOT_CONFIGURED</strong> and no data will be shown.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField label="Finnhub API Key">
          <input
            type="password"
            placeholder="finnhub_abc123..."
            value={form.finnhubApiKey || ''}
            onChange={(e) => onChange({ finnhubApiKey: e.target.value })}
            className={inputCls}
          />
          <p className="text-[10px] text-muted mt-1">
            Free tier: 60 req/min. Get your key at{' '}
            <a
              href="https://finnhub.io/register"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent underline"
            >
              finnhub.io/register
            </a>
          </p>
        </FormField>

        <FormField label="Polygon.io API Key">
          <input
            type="password"
            placeholder="polygon_xyz789..."
            value={form.polygonApiKey || ''}
            onChange={(e) => onChange({ polygonApiKey: e.target.value })}
            className={inputCls}
          />
          <p className="text-[10px] text-muted mt-1">
            Free tier: 5 req/min. Get your key at{' '}
            <a
              href="https://polygon.io/dashboard/signup"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent underline"
            >
              polygon.io
            </a>
          </p>
        </FormField>
      </div>
    </Card>
  );
};