import React from 'react';
import { Shield } from 'lucide-react';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

export interface IntegrationStatus {
  billing: boolean;
  telegram: boolean;
  email: boolean;
  webhook: boolean;
}

interface IntegrationStatusCardProps {
  status: IntegrationStatus;
}

export const IntegrationStatusCard: React.FC<IntegrationStatusCardProps> = ({ status }) => {
  return (
    <Card className="p-4">
      <SectionHeader
        icon={<Shield size={14} className="text-accent" />}
        title="External Integrations Status (Optional in Development)"
        actions={
          <span className="text-[10px] bg-panel text-muted px-2 py-0.5 rounded font-mono">
            ZERO CONFIG REQUIRED FOR CORE ENGINE
          </span>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        {/* Stripe Billing */}
        <div className="p-3 bg-primary border border-divider rounded-lg">
          <div className="flex items-center justify-between mb-1">
            <span className="font-bold text-white">Stripe Billing</span>
            <Badge tone={status.billing ? 'green' : 'neutral'}>
              {status.billing ? 'ACTIVE' : 'OPTIONAL (UNSET)'}
            </Badge>
          </div>
          <p className="text-[11px] text-muted">
            {status.billing ? 'Checkout enabled' : 'Billing not configured'}
          </p>
        </div>

        {/* Telegram Bot */}
        <div className="p-3 bg-primary border border-divider rounded-lg">
          <div className="flex items-center justify-between mb-1">
            <span className="font-bold text-white">Telegram Bot</span>
            <Badge tone={status.telegram ? 'green' : 'neutral'}>
              {status.telegram ? 'ACTIVE' : 'OPTIONAL (UNSET)'}
            </Badge>
          </div>
          <p className="text-[11px] text-muted">
            {status.telegram ? 'Direct dispatch enabled' : 'Notifications disabled'}
          </p>
        </div>

        {/* SMTP Email */}
        <div className="p-3 bg-primary border border-divider rounded-lg">
          <div className="flex items-center justify-between mb-1">
            <span className="font-bold text-white">SMTP Email</span>
            <Badge tone={status.email ? 'green' : 'neutral'}>
              {status.email ? 'ACTIVE' : 'OPTIONAL (UNSET)'}
            </Badge>
          </div>
          <p className="text-[11px] text-muted">
            {status.email ? 'Email dispatch enabled' : 'Notifications disabled'}
          </p>
        </div>

        {/* Webhook Signing */}
        <div className="p-3 bg-primary border border-divider rounded-lg">
          <div className="flex items-center justify-between mb-1">
            <span className="font-bold text-white">Webhook Signing</span>
            <Badge tone={status.webhook ? 'green' : 'neutral'}>
              {status.webhook ? 'ACTIVE' : 'OPTIONAL (UNSET)'}
            </Badge>
          </div>
          <p className="text-[11px] text-muted">
            {status.webhook ? 'HMAC signing enabled' : 'Delivery disabled'}
          </p>
        </div>
      </div>
    </Card>
  );
};
