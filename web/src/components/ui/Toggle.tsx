import React from 'react';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  size?: 'sm' | 'md';
  ariaLabel?: string;
}

export function Toggle({ checked, onChange, size = 'md', ariaLabel }: ToggleProps) {
  const md = size === 'md';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex items-center rounded-full transition-colors ${
        md ? 'h-6 w-11' : 'h-5 w-9'
      } ${checked ? 'bg-accent' : 'bg-panel'}`}
    >
      <span
        className={`inline-block transform rounded-full bg-white transition-transform ${
          md ? 'h-4 w-4' : 'h-3.5 w-3.5'
        } ${checked ? (md ? 'translate-x-6' : 'translate-x-4') : (md ? 'translate-x-1' : 'translate-x-1')}`}
      />
    </button>
  );
}