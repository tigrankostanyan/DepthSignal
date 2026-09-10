import React from 'react';

interface StatCardProps {
  label: React.ReactNode;
  value: React.ReactNode;
  sub?: React.ReactNode;
  accent?: string;
  size?: 'lg' | 'xl';
  borderClassName?: string;
  className?: string;
}

export function StatCard({ label, value, sub, accent = 'text-white', size = 'lg', borderClassName, className = '' }: StatCardProps) {
  return (
    <div className={`bg-surface p-3 rounded-lg border ${borderClassName || 'border-divider'} ${className}`}>
      <div className="text-[11px] text-muted font-semibold uppercase">{label}</div>
      <div className={`${size === 'xl' ? 'text-xl' : 'text-lg'} font-bold font-mono mt-1 ${accent}`}>{value}</div>
      {sub && <div className="text-[10px] text-muted mt-0.5">{sub}</div>}
    </div>
  );
}