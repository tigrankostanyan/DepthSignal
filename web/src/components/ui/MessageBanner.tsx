import React from 'react';

interface MessageBannerProps {
  type: 'success' | 'error' | 'info';
  children: React.ReactNode;
  onDismiss?: () => void;
  className?: string;
}

const BANNER_TONES = {
  success: 'bg-bid/15 text-bid border-b border-[#0ECB81]/30',
  error: 'bg-ask/15 text-ask border-b border-[#F6465D]/30',
  info: 'bg-accent/15 text-[#24C4E8] border-b border-[#168FD6]/40',
} as const;

export function MessageBanner({ type, children, onDismiss, className = '' }: MessageBannerProps) {
  return (
    <div className={`p-2.5 text-xs flex justify-between items-center ${BANNER_TONES[type]} ${className}`}>
      <span>{children}</span>
      {onDismiss && <button onClick={onDismiss} className="font-bold">×</button>}
    </div>
  );
}