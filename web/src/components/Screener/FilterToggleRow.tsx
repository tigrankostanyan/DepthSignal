'use client';

import React from 'react';

interface FilterToggleRowProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export const FilterToggleRow: React.FC<FilterToggleRowProps> = ({ label, checked, onChange }) => {
  return (
    <label className="flex items-center space-x-2.5 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="rounded bg-primary border-divider text-accent focus:ring-0 w-4 h-4"
      />
      <span className="text-main font-medium">{label}</span>
    </label>
  );
};
