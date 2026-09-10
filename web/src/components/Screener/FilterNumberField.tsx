'use client';

import React from 'react';
import type { ScreenerFilters } from '@/types/index';
import { FormField } from '@/components/ui/FormField';
import type { NumericFilterKey } from './FilterRangeField';

interface FilterNumberFieldProps {
  label: string;
  fieldKey: NumericFilterKey;
  placeholder?: string;
  filters: ScreenerFilters;
  setFilters: React.Dispatch<React.SetStateAction<ScreenerFilters>>;
}

const inputCls =
  'bg-primary border border-divider rounded px-2.5 py-1.5 text-main text-xs font-mono focus:border-[#168FD6] focus:outline-none';

export const FilterNumberField: React.FC<FilterNumberFieldProps> = ({
  label,
  fieldKey,
  placeholder,
  filters,
  setFilters,
}) => {
  const value = filters[fieldKey] ?? '';
  const onChange = (raw: string) => {
    const parsed = raw ? parseFloat(raw) : undefined;
    setFilters((prev) => ({ ...prev, [fieldKey]: parsed }));
  };

  return (
    <FormField label={label}>
      <input
        type="number"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full ${inputCls}`}
      />
    </FormField>
  );
};
