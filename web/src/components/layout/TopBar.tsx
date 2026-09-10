'use client';

import React from 'react';
import { SearchBar } from './SearchBar';
import { ExchangeHealthBadges } from './ExchangeHealthBadges';
import { RightControls } from './RightControls';

export const TopBar: React.FC = () => {
  return (
    <header className="h-14 border-b border-divider bg-primary px-4 flex items-center justify-between text-xs select-none relative z-[80] flex-none transition-colors">
      {/* Left: Global Search Palette */}
      <SearchBar />

      {/* Middle: Active Exchanges & Health */}
      <ExchangeHealthBadges />

      {/* Right: Subscription Pill, Simulate, Alerts, Theme */}
      <RightControls />
    </header>
  );
};