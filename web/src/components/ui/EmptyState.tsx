import React from 'react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title?: string;
  message: string;
  className?: string;
}

export function EmptyState({ icon, title, message, className = '' }: EmptyStateProps) {
  return (
    <div className={`py-16 text-center text-muted font-sans text-xs flex flex-col items-center justify-center ${className}`}>
      {icon && <div className="mb-2 text-[#1A3654]">{icon}</div>}
      {title && <div className="font-bold text-sm text-main mb-1">{title}</div>}
      <p>{message}</p>
    </div>
  );
}