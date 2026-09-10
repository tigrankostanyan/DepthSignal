import React from 'react';

interface PageHeaderProps {
  icon?: React.ReactNode;
  iconClassName?: string;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  icon,
  iconClassName = 'p-2 rounded-lg bg-accent/15 border border-[#168FD6]/40 text-[#24C4E8]',
  title,
  subtitle,
  actions,
  className = '',
}: PageHeaderProps) {
  return (
    <div className={`p-4 border-b border-divider bg-card flex flex-wrap items-center justify-between gap-3 flex-none ${className}`}>
      <div className="flex items-center space-x-3">
        {icon && <div className={`${iconClassName} flex items-center justify-center`}>{icon}</div>}
        <div>
          <h1 className="text-base font-bold text-white tracking-wide">{title}</h1>
          {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center space-x-2">{actions}</div>}
    </div>
  );
}