'use client';

import React from 'react';
import { Lock, ArrowRight, Sparkles } from 'lucide-react';

interface SubscriptionPaywallProps {
  onUpgrade: () => void;
  title?: string;
  description?: string;
  buttonText?: string;
}


export const SubscriptionPaywall: React.FC<SubscriptionPaywallProps> = ({
  onUpgrade,
  title = 'Premium Subscription Required',
  description = 'Access to real-time institutional order book walls, advanced market screener feeds, and live notifications requires an active subscription.',
  buttonText = 'Upgrade Now',
}) => {
  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-primary/80 backdrop-blur-md p-4 select-none">
      <div className="w-full max-w-md rounded-2xl border border-divider bg-[#0B1E33]/95 p-8 text-center shadow-2xl shadow-black/80 flex flex-col items-center">
        {/* Large Lock Icon */}
        <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-2xl border border-[#168FD6]/40 bg-gradient-to-b from-[#168FD6]/25 to-[#071522] shadow-lg shadow-[#168FD6]/20">
          <Lock size={40} className="text-[#24C4E8] drop-shadow-[0_0_8px_rgba(36,196,232,0.5)]" />
        </div>

        {/* Title */}
        <h2 className="text-2xl font-extrabold tracking-tight text-main">
          {title}
        </h2>

        {/* Description */}
        <p className="mt-3 text-sm text-muted leading-relaxed max-w-sm">
          {description}
        </p>

        {/* Eye-catching Upgrade Now button */}
        <button
          onClick={onUpgrade}
          className="mt-7 inline-flex w-full items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-[#173D9A] via-[#168FD6] to-[#24C4E8] px-6 py-3.5 text-base font-bold text-white transition-all duration-200 hover:brightness-110 hover:shadow-lg hover:shadow-[#168FD6]/30 cursor-pointer active:scale-[0.98]"
        >
          <Sparkles size={18} className="text-accent animate-pulse" />
          <span>{buttonText}</span>
          <ArrowRight size={18} />
        </button>

        <p className="mt-3 text-[11px] text-[#5A6E85]">
          Immediate activation • Cancel anytime • 14-day risk-free
        </p>
      </div>
    </div>
  );
};
