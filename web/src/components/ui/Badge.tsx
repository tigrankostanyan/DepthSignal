import React from 'react';

export type BadgeTone = 'green' | 'red' | 'yellow' | 'blue' | 'neutral' | 'purple' | 'sky' | 'cyan';

export const BADGE_TONES: Record<BadgeTone, { bg: string; text: string; border: string }> = {
  green: { bg: 'bg-bid/15', text: 'text-bid', border: 'border-bid/30' },
  red: { bg: 'bg-ask/15', text: 'text-ask', border: 'border-ask/30' },
  yellow: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' },
  blue: { bg: 'bg-[#168FD6]/20', text: 'text-[#24C4E8]', border: 'border-[#168FD6]/40' },
  cyan: { bg: 'bg-[#24C4E8]/15', text: 'text-[#24C4E8]', border: 'border-[#24C4E8]/40' },
  purple: { bg: 'bg-purple-500/15', text: 'text-purple-400', border: 'border-purple-500/30' },
  sky: { bg: 'bg-sky-500/15', text: 'text-sky-400', border: 'border-sky-500/30' },
  neutral: { bg: 'bg-panel', text: 'text-muted', border: 'border-divider' },
};

interface BadgeProps {
  tone?: BadgeTone;
  mono?: boolean;
  bordered?: boolean;
  size?: 'sm' | 'md';
  className?: string;
  children: React.ReactNode;
}

/** Small colored label chip (status / side / outcome). */
export function Badge({
  tone = 'neutral',
  mono = true,
  bordered = false,
  size = 'sm',
  className = '',
  children,
}: BadgeProps) {
  const t = BADGE_TONES[tone];
  const padding = size === 'md' ? 'px-2.5 py-0.5 text-xs' : 'px-1.5 py-0.5 text-[10px]';
  return (
    <span
      className={`inline-flex items-center rounded ${padding} ${mono ? 'font-mono' : ''} font-bold ${t.bg} ${t.text} ${
        bordered ? `border ${t.border}` : ''
      } ${className}`}
    >
      {children}
    </span>
  );
}
