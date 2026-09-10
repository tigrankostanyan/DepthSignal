import React from 'react';

interface CardProps {
  variant?: 'panel' | 'sub' | 'interactive';
  borderClassName?: string;
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
}

const CARD_VARIANTS = {
  panel: 'bg-card border border-divider rounded-xl shadow-lg',
  sub: 'bg-primary border border-divider rounded-lg',
  interactive: 'bg-card border border-divider rounded-xl hover:border-[#168FD6]/50 hover:bg-surface transition',
} as const;

export function Card({ variant = 'panel', borderClassName, className = '', children, onClick }: CardProps) {
  const variantCls = CARD_VARIANTS[variant];
  const resolvedCls = borderClassName
    ? variantCls.replace('border-divider', borderClassName)
    : variantCls;
  return (
    <div className={`${resolvedCls} ${onClick ? 'cursor-pointer' : ''} ${className}`} onClick={onClick}>
      {children}
    </div>
  );
}