'use client';

import React from 'react';
import type { ScreenerFilters } from '@/types/index';
import { FormField } from '@/components/ui/FormField';

/** ScreenerFilters-ի numeric range դաշտերի բանալիները */
export type NumericFilterKey =
  | 'priceMin'
  | 'priceMax'
  | 'changeMin'
  | 'changeMax'
  | 'volumeMinUsd'
  | 'volumeMaxUsd'
  | 'rsiMin'
  | 'rsiMax'
  | 'maDistanceMin'
  | 'maDistanceMax'
  | 'athDistanceMin'
  | 'athDistanceMax'
  | 'atlDistanceMin'
  | 'atlDistanceMax'
  | 'volatilityMin'
  | 'volatilityMax'
  | 'volumeSpikeMinPercent'
  | 'marketCapMin'
  | 'marketCapMax'
  | 'peRatioMin'
  | 'peRatioMax';

interface FilterRangeFieldProps {
  label: string;
  minKey: NumericFilterKey;
  maxKey: NumericFilterKey;
  placeholderMin?: string;
  placeholderMax?: string;
  filters: ScreenerFilters;
  setFilters: React.Dispatch<React.SetStateAction<ScreenerFilters>>;
}

const inputCls =
  'bg-primary border border-divider rounded px-2.5 py-1.5 text-main text-xs font-mono focus:border-[#168FD6] focus:outline-none';

export const FilterRangeField: React.FC<FilterRangeFieldProps> = ({
  label,
  minKey,
  maxKey,
  placeholderMin,
  placeholderMax,
  filters,
  setFilters,
}) => {
  const update = (key: NumericFilterKey, raw: string) => {
    const value = raw ? parseFloat(raw) : undefined;
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <FormField label={label}>
      <div className="grid grid-cols-2 gap-2">
        <input
          type="number"
          placeholder={placeholderMin}
          value={filters[minKey] ?? ''}
          onChange={(e) => update(minKey, e.target.value)}
          className={inputCls}
        />
        <input
          type="number"
          placeholder={placeholderMax}
          value={filters[maxKey] ?? ''}
          onChange={(e) => update(maxKey, e.target.value)}
          className={inputCls}
        />
      </div>
    </FormField>
  );
};
