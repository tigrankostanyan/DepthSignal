import React from 'react';

interface SectionHeaderProps {
  icon?: React.ReactNode;
  title: string;
  actions?: React.ReactNode;
  variant?: 'plain' | 'panel';
  className?: string;
}

export function SectionHeader({ icon, title, actions, variant = 'plain', className = '' }: SectionHeaderProps) {
  if (variant === 'panel') {
    return (
      <div className={`p-3 border-b border-divider bg-surface flex items-center justify-between ${className}`}>
        <div className="flex items-center space-x-2">
          {icon}
          <span className="font-bold text-main text-xs">{title}</span>
        </div>
        {actions}
      </div>
    );
  }
  return (
    <div className={`flex items-center justify-between mb-3 ${className}`}>
      <div className="flex items-center space-x-2">
        {icon}
        <span className="font-bold text-white text-xs uppercase tracking-wider">{title}</span>
      </div>
      {actions}
    </div>
  );
}