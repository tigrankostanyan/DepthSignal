'use client';

import React from 'react';
import { WallMonitor } from '@/components/Walls/WallMonitor';
import { useApp, useRealtimeData } from '@/providers/AppProviders';

export default function WallsPage() {
  const {
    minVolumeUsd,
    maxDistancePercent,
    crossExchangeAggregation,
    handleUpdateMinVolume,
    handleUpdateMaxDistance,
    handleToggleAggregation,
    openSymbolFocus,
  } = useApp();
  const { activeWalls } = useRealtimeData();

  return (
    <WallMonitor
      walls={activeWalls}
      onSelectSymbol={openSymbolFocus}
      crossExchangeAggregation={crossExchangeAggregation}
      onToggleAggregation={() => handleToggleAggregation()}
      minVolumeUsd={minVolumeUsd}
      onUpdateMinVolume={handleUpdateMinVolume}
      maxDistancePercent={maxDistancePercent}
      onUpdateMaxDistance={handleUpdateMaxDistance}
    />
  );
}
