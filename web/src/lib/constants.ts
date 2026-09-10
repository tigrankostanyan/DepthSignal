// ============================================================
// DOMAIN CONSTANTS
// Single source of truth for timeframes, exchange labels,
// asset categories, and default filter presets.
// ============================================================

import type { ScreenerFilters, Timeframe, ExchangeId, AssetCategory, MarketType } from '@/types/index';

// ---- App-wide limits ----
export const UNREAD_ALERT_LIMIT = 200;

// ---- Wall Engine defaults & thresholds ----
export const WALL_ENGINE_DEFAULTS = {
  minVolumeUsd: 100_000,
  maxDistancePercent: 5,
  crossExchangeAggregation: false,
} as const;

export const WALL_VOLUME_THRESHOLDS = [100_000, 250_000, 500_000, 1_000_000, 2_000_000] as const;
export const WALL_DISTANCE_THRESHOLDS = [1.0, 2.5, 5.0, 10.0] as const;

// ---- Timeframes ----
export const TIMEFRAMES: Timeframe[] = ['30s', '1m', '5m', '15m', '1h', '4h', '1d'];

// ---- Exchanges ----
export const ALL_EXCHANGES: ExchangeId[] = [
  'BINANCE',
  'BYBIT',
  'MEXC',
  'OKX',
  'GATE',
  'BITGET',
  'KUCOIN',
  'HYPERLIQUID',
  'ASTERDEX',
  'STOCK_EXCHANGE',
];

export const EXCHANGE_LABELS: Record<ExchangeId, string> = {
  BINANCE: 'Binance',
  BYBIT: 'Bybit',
  MEXC: 'MEXC',
  OKX: 'OKX',
  GATE: 'Gate.io',
  BITGET: 'Bitget',
  KUCOIN: 'KuCoin',
  HYPERLIQUID: 'Hyperliquid',
  ASTERDEX: 'AsterDEX',
  STOCK_EXCHANGE: 'Stock Exchange',
};

// ---- Categories & Market Types ----
export const ASSET_CATEGORIES: AssetCategory[] = ['CRYPTO', 'STOCKS', 'FOREX', 'COMMODITIES'];
export const MARKET_TYPES: MarketType[] = ['SPOT', 'FUTURES'];

// ---- Default Screener Filters ----
export const DEFAULT_SCREENER_FILTERS: ScreenerFilters = {
  searchQuery: '',
  category: 'ALL',
  marketType: 'ALL',
  exchanges: [],
  symbols: [],
  priceMin: undefined,
  priceMax: undefined,
  changeMin: undefined,
  changeMax: undefined,
  timeframe: '1d',
  volumeMinUsd: undefined,
  volumeMaxUsd: undefined,
  rsiMin: undefined,
  rsiMax: undefined,
  maDistanceType: undefined,
  maDistanceMin: undefined,
  maDistanceMax: undefined,
  athDistanceMin: undefined,
  athDistanceMax: undefined,
  atlDistanceMin: undefined,
  atlDistanceMax: undefined,
  volatilityMin: undefined,
  volatilityMax: undefined,
  volumeSpikeMinPercent: undefined,
  marketCapMin: undefined,
  marketCapMax: undefined,
  peRatioMin: undefined,
  peRatioMax: undefined,
  onlyWithWalls: false,
  onlyWatchlist: false,
  hideBlacklisted: true,
  sortBy: 'volumeUsd',
  sortOrder: 'desc',
};