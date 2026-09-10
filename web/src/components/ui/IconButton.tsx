import React from 'react';

interface IconButtonProps {
  icon: React.ReactNode;
  onClick?: () => void;
  title?: string;
  disabled?: boolean;
  className?: string;
  size?: 'sm' | 'md';
}

export function IconButton({ icon, onClick, title, disabled, className = '', size = 'md' }: IconButtonProps) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={`flex items-center justify-center rounded bg-panel hover:bg-panel text-muted hover:text-white transition cursor-pointer ${
        size === 'sm' ? 'w-7 h-7' : 'w-8 h-8'
      } ${disabled ? 'opacity-40 cursor-not-allowed' : ''} ${className}`}
    >
      {icon}
    </button>
  );
}