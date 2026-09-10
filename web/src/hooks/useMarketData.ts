'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  fetchActiveWalls,
  fetchConnectorHealth,
  fetchTickers,
  fetchUserSettings,
  updateUserSettings,
  updateWallConfig,
} from '@/lib/api';
import { WALL_ENGINE_DEFAULTS } from '@/lib/constants';
import type { ActionResult, ConnectorStatus, DetectedWall, MarketTicker, UserSettings } from '@/types/index';

export interface UseMarketDataResult {
  tickers: MarketTicker[];
  setTickers: React.Dispatch<React.SetStateAction<MarketTicker[]>>;
  activeWalls: DetectedWall[];
  setActiveWalls: React.Dispatch<React.SetStateAction<DetectedWall[]>>;
  settings: UserSettings | null;
  connectors: ConnectorStatus[];
  handleSaveSettings: (patch: Partial<UserSettings>) => Promise<ActionResult>;
  handleRefreshHealth: () => Promise<ActionResult>;
  minVolumeUsd: number;
  maxDistancePercent: number;
  crossExchangeAggregation: boolean;
  handleUpdateMinVolume: (value: number) => Promise<void>;
  handleUpdateMaxDistance: (value: number) => Promise<void>;
  handleToggleAggregation: () => Promise<void>;
}

/** Market data, user settings, connector health & wall engine config. Self-loads when enabled. */
export function useMarketData(enabled: boolean): UseMarketDataResult {
  const [tickers, setTickers] = useState<MarketTicker[]>([]);
  const [activeWalls, setActiveWalls] = useState<DetectedWall[]>([]);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [connectors, setConnectors] = useState<ConnectorStatus[]>([]);
  const [minVolumeUsd, setMinVolumeUsd] = useState<number>(WALL_ENGINE_DEFAULTS.minVolumeUsd);
  const [maxDistancePercent, setMaxDistancePercent] = useState<number>(WALL_ENGINE_DEFAULTS.maxDistancePercent);
  const [crossExchangeAggregation, setCrossExchangeAggregation] = useState<boolean>(
    WALL_ENGINE_DEFAULTS.crossExchangeAggregation,
  );

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    Promise.allSettled([
      // Bounded universe: ask the server for a capped set (top-volume first) instead
      // of pulling every instrument from every exchange.
      fetchTickers(undefined, 5000).then((d) => !cancelled && setTickers(d)),
      fetchActiveWalls().then((d) => !cancelled && setActiveWalls(d)),
      fetchUserSettings().then((d) => {
        if (cancelled) return;
        setSettings(d);
        setMinVolumeUsd(d.wallMinVolumeDefaultUsd);
        setMaxDistancePercent(d.wallDistanceDefaultPercent);
        setCrossExchangeAggregation(d.defaultCrossExchangeAggregation);
      }),
      fetchConnectorHealth().then((d) => !cancelled && setConnectors(d)),
    ]);

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const handleSaveSettings = useCallback(async (patch: Partial<UserSettings>): Promise<ActionResult> => {
    try {
      const updated = await updateUserSettings(patch);
      setSettings(updated);
      if (typeof patch.wallMinVolumeDefaultUsd === 'number') setMinVolumeUsd(patch.wallMinVolumeDefaultUsd);
      if (typeof patch.wallDistanceDefaultPercent === 'number') setMaxDistancePercent(patch.wallDistanceDefaultPercent);
      if (typeof patch.defaultCrossExchangeAggregation === 'boolean')
        setCrossExchangeAggregation(patch.defaultCrossExchangeAggregation);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Failed to save settings' };
    }
  }, []);

  const handleRefreshHealth = useCallback(async (): Promise<ActionResult> => {
    try {
      setConnectors(await fetchConnectorHealth());
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Failed to refresh health' };
    }
  }, []);

  const handleUpdateMinVolume = useCallback(async (value: number): Promise<void> => {
    setMinVolumeUsd(value);
    try {
      await updateWallConfig({ minVolumeUsd: value });
    } catch (err) {
      console.error('Wall config update failed:', err);
    }
  }, []);

  const handleUpdateMaxDistance = useCallback(async (value: number): Promise<void> => {
    setMaxDistancePercent(value);
    try {
      await updateWallConfig({ maxDistancePercent: value });
    } catch (err) {
      console.error('Wall config update failed:', err);
    }
  }, []);

  const handleToggleAggregation = useCallback(async (): Promise<void> => {
    setCrossExchangeAggregation((prev) => {
      const next = !prev;
      updateWallConfig({ crossExchangeAggregation: next }).catch(() => {});
      return next;
    });
  }, []);

  return {
    tickers,
    setTickers,
    activeWalls,
    setActiveWalls,
    settings,
    connectors,
    handleSaveSettings,
    handleRefreshHealth,
    minVolumeUsd,
    maxDistancePercent,
    crossExchangeAggregation,
    handleUpdateMinVolume,
    handleUpdateMaxDistance,
    handleToggleAggregation,
  };
}