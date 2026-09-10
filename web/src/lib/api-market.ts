// ==========================================
// MARKET & WALLS API
// ==========================================

import type {
  MarketTicker,
  ExchangeId,
  MarketType,
  DetectedWall,
  HistoricalWallRecord,
  DailyWallAggregate,
  ScreenerFilters,
  OrderBookSnapshot,
  Trade,
  Candle,
} from '@/types/index';
import { authFetch, safeFetch } from './api-core';

export async function fetchTickers(filters?: Partial<ScreenerFilters>, limit?: number): Promise<MarketTicker[]> {
  const params = new URLSearchParams();
  if (filters) {
    if (filters.searchQuery) params.set('searchQuery', filters.searchQuery);
    if (filters.category && filters.category !== 'ALL') params.set('category', filters.category);
    if (filters.marketType && filters.marketType !== 'ALL') params.set('marketType', filters.marketType);
    if (filters.exchanges && filters.exchanges.length > 0) params.set('exchanges', filters.exchanges.join(','));
    if (filters.symbols && filters.symbols.length > 0) params.set('symbols', filters.symbols.join(','));
    if (filters.timeframe) params.set('timeframe', filters.timeframe);
    if (filters.priceMin !== undefined) params.set('priceMin', String(filters.priceMin));
    if (filters.priceMax !== undefined) params.set('priceMax', String(filters.priceMax));
    if (filters.changeMin !== undefined) params.set('changeMin', String(filters.changeMin));
    if (filters.changeMax !== undefined) params.set('changeMax', String(filters.changeMax));
    if (filters.volumeMinUsd !== undefined) params.set('volumeMinUsd', String(filters.volumeMinUsd));
    if (filters.volumeMaxUsd !== undefined) params.set('volumeMaxUsd', String(filters.volumeMaxUsd));
    if (filters.rsiMin !== undefined) params.set('rsiMin', String(filters.rsiMin));
    if (filters.rsiMax !== undefined) params.set('rsiMax', String(filters.rsiMax));
    if (filters.athDistanceMin !== undefined) params.set('athDistanceMin', String(filters.athDistanceMin));
    if (filters.athDistanceMax !== undefined) params.set('athDistanceMax', String(filters.athDistanceMax));
    if (filters.atlDistanceMin !== undefined) params.set('atlDistanceMin', String(filters.atlDistanceMin));
    if (filters.atlDistanceMax !== undefined) params.set('atlDistanceMax', String(filters.atlDistanceMax));
    if (filters.volatilityMin !== undefined) params.set('volatilityMin', String(filters.volatilityMin));
    if (filters.volatilityMax !== undefined) params.set('volatilityMax', String(filters.volatilityMax));
    if (filters.volumeSpikeMinPercent !== undefined) params.set('volumeSpikeMinPercent', String(filters.volumeSpikeMinPercent));
    if (filters.marketCapMin !== undefined) params.set('marketCapMin', String(filters.marketCapMin));
    if (filters.marketCapMax !== undefined) params.set('marketCapMax', String(filters.marketCapMax));
    if (filters.peRatioMin !== undefined) params.set('peRatioMin', String(filters.peRatioMin));
    if (filters.peRatioMax !== undefined) params.set('peRatioMax', String(filters.peRatioMax));
    if (filters.onlyWithWalls) params.set('onlyWithWalls', 'true');
    if (filters.onlyWatchlist) params.set('onlyWatchlist', 'true');
    if (filters.hideBlacklisted !== undefined) params.set('hideBlacklisted', String(filters.hideBlacklisted));
    if (filters.sortBy) params.set('sortBy', String(filters.sortBy));
    if (filters.sortOrder) params.set('sortOrder', filters.sortOrder);
  }
  if (limit !== undefined && limit > 0) params.set('limit', String(limit));
  const json = await safeFetch<{ count: number; data: MarketTicker[] }>(`/api/market/tickers?${params.toString()}`, undefined, { count: 0, data: [] });
  return json?.data || [];
}

export interface SymbolDetail {
  ticker: MarketTicker;
  orderBook: OrderBookSnapshot;
  trades: Trade[];
  candles: Candle[];
  walls: DetectedWall[];
}

export async function fetchSymbolDetail(
  symbol: string,
  exchange: ExchangeId = 'BINANCE',
  marketType: MarketType = 'SPOT',
): Promise<SymbolDetail> {
  return authFetch<SymbolDetail>(
    `/api/market/symbol/${encodeURIComponent(symbol)}?exchange=${encodeURIComponent(exchange)}&marketType=${encodeURIComponent(marketType)}`,
  );
}

export async function fetchActiveWalls(symbol?: string, marketType?: MarketType): Promise<DetectedWall[]> {
  const params = new URLSearchParams();
  if (symbol) params.set('symbol', symbol);
  if (marketType) params.set('marketType', marketType);
  const json = await safeFetch<{ count: number; data: DetectedWall[] }>(`/api/walls/active?${params.toString()}`, undefined, { count: 0, data: [] });
  return json?.data || [];
}

export async function fetchWallHistory(
  symbol?: string,
  exchange?: string,
  limit = 100,
): Promise<HistoricalWallRecord[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (symbol) params.set('symbol', symbol);
  if (exchange) params.set('exchange', exchange);
  const json = await safeFetch<{ count: number; data: HistoricalWallRecord[] }>(`/api/walls/history?${params.toString()}`, undefined, { count: 0, data: [] });
  return json?.data || [];
}

export async function fetchDailyAggregates(days = 30): Promise<DailyWallAggregate[]> {
  const json = await safeFetch<{ count: number; data: DailyWallAggregate[] }>(`/api/walls/daily-aggregates?days=${days}`, undefined, { count: 0, data: [] });
  return json?.data || [];
}

export interface WallConfig {
  minVolumeUsd: number;
  maxDistancePercent: number;
  minDurationSeconds: number;
  crossExchangeAggregation: boolean;
}

export async function updateWallConfig(config: Partial<WallConfig>): Promise<WallConfig> {
  const res = await authFetch<{ status: string; config: WallConfig }>('/api/walls/config', {
    method: 'POST',
    body: JSON.stringify(config),
  });
  return res.config;
}
