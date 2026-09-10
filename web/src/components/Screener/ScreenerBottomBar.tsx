'use client';

import React from 'react';
import type { ScreenerFilters } from '@/types/index';
import { Badge } from '@/components/ui/Badge';

interface ScreenerBottomBarProps {
  shownCount: number;
  totalCount: number;
  filters: ScreenerFilters;
}

export const ScreenerBottomBar: React.FC<ScreenerBottomBarProps> = ({ shownCount, totalCount, filters }) => {
  return (
    <div className="h-10 bg-surface border-t border-divider px-4 flex items-center justify-between text-xs text-muted flex-none">
      <div className="flex items-center space-x-2">
        <span>
          Showing <strong className="text-main font-mono">{shownCount}</strong> of{' '}
          <strong className="text-main font-mono">{totalCount}</strong> market instruments
        </span>
        {filters.category !== 'ALL' && <Badge tone="yellow">{filters.category}</Badge>}
        {filters.marketType !== 'ALL' && <Badge tone="purple">{filters.marketType}</Badge>}
        {filters.searchQuery && (
          <Badge tone="neutral" className="font-mono text-main">
            &quot;{filters.searchQuery}&quot;
          </Badge>
        )}
      </div>
      <div className="flex gap-2">
        <button className="px-2.5 py-0.5 bg-panel rounded text-main hover:bg-panel transition text-[11px]">
          Prev
        </button>
        <button className="px-2.5 py-0.5 bg-panel rounded text-main hover:bg-panel transition text-[11px]">
          Next
        </button>
      </div>
    </div>
  );
};
