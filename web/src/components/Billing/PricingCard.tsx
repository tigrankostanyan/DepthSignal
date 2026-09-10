import React from 'react';
import { Check, X, QrCode } from 'lucide-react';
import type { SubscriptionPlanId } from '@/types/index';
import { Badge } from '@/components/ui/Badge';

export interface PricingFeature {
  label: React.ReactNode;
  included: boolean;
}

interface PricingCardProps {
  planId: SubscriptionPlanId;
  name: string;
  description: string;
  icon?: React.ReactNode;
  priceMonthly: number;
  priceYearly: number;
  freeForever?: boolean;
  features: PricingFeature[];
  isCurrent: boolean;
  isHighlighted: boolean;
  badgeLabel?: string;
  interval: 'monthly' | 'yearly';
  onPay: () => void;
  ctaLabel?: string;
  accentColor: string;
  buttonTextColor?: 'text-white';
}

export const PricingCard: React.FC<PricingCardProps> = ({
  name,
  description,
  icon,
  priceMonthly,
  priceYearly,
  freeForever,
  features,
  isCurrent,
  isHighlighted,
  badgeLabel,
  interval,
  onPay,
  ctaLabel,
  accentColor,
  buttonTextColor = 'text-white',
}) => {
  // Manual QR flow: every paid (non-current) plan is paid by scanning a QR code.
  const isPayable = !isCurrent && !freeForever;

  let buttonContent: React.ReactNode;
  if (isCurrent) {
    buttonContent = 'Active Plan';
  } else if (freeForever) {
    buttonContent = ctaLabel ?? 'Free Plan';
  } else {
    buttonContent = (
      <>
        <QrCode size={14} />
        <span>Pay by QR Code</span>
      </>
    );
  }

  return (
    <div
      className={`rounded-xl border p-6 flex flex-col justify-between relative transition ${
        isHighlighted
          ? 'bg-surface shadow-xl'
          : isCurrent
          ? 'bg-surface/90'
          : 'border-divider bg-surface/80 hover:border-divider'
      }`}
      style={isHighlighted || isCurrent ? { borderColor: accentColor } : undefined}
    >
      {badgeLabel && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-[#168FD6] text-white font-extrabold text-[10px] rounded-full uppercase tracking-wider shadow">
          {badgeLabel}
        </div>
      )}

      <div>
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-bold text-white text-base flex items-center gap-1.5">
            {icon}
            {name}
          </h3>
          {isCurrent && (
            <Badge tone="cyan" size="sm">CURRENT</Badge>
          )}
        </div>
        <p className="text-xs text-muted mb-4">{description}</p>

        <div className="mb-6">
          <span className="text-3xl font-black text-white font-mono">
            ${freeForever ? 0 : interval === 'yearly' ? priceYearly : priceMonthly}
          </span>
          <span className="text-xs text-muted"> / {freeForever ? 'forever' : 'month'}</span>
          {!freeForever && interval === 'yearly' && (
            <div className="text-[10px] text-bid font-mono mt-0.5">
              Billed annually (${priceYearly * 12}/yr)
            </div>
          )}
        </div>

        <div className="space-y-2.5 text-xs text-main">
          {features.map((f, i) => (
            <div key={i} className="flex items-center space-x-2">
              {f.included ? (
                <Check size={14} className="text-bid shrink-0" />
              ) : (
                <X size={14} className="text-ask shrink-0" />
              )}
              <span className={f.included ? '' : 'text-muted'}>{f.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8">
        <button
          onClick={onPay}
          disabled={!isPayable}
          className={`w-full py-2.5 rounded-lg text-xs font-bold transition flex items-center justify-center space-x-1.5 ${
            isPayable
              ? `${buttonTextColor} shadow-md hover:brightness-90`
              : 'bg-panel text-muted cursor-not-allowed'
          }`}
          style={isPayable ? { backgroundColor: accentColor } : undefined}
        >
          {buttonContent}
        </button>
      </div>
    </div>
  );
};
