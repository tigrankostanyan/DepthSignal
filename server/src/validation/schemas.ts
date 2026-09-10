import { z } from 'zod';

// Allowed Enums
//  exchange id enum
export const ExchangeIdEnum = z.enum([
  'BINANCE',
  'BYBIT',
  'MEXC',
  'OKX',
  'GATE',
  'BITGET',
  'KUCOIN',
  'HYPERLIQUID',
  'ASTERDEX',
  'STOCK_EXCHANGE'
]);

//  market type enum
export const MarketTypeEnum = z.enum(['SPOT', 'FUTURES']);
//  asset category enum
export const AssetCategoryEnum = z.enum(['CRYPTO', 'STOCKS', 'FOREX', 'COMMODITIES']);
//  timeframe enum
export const TimeframeEnum = z.enum(['30s', '1m', '5m', '15m', '1h', '4h', '1d']);
//  alert condition type enum
export const AlertConditionTypeEnum = z.enum([
  'PRICE_ABOVE',
  'PRICE_BELOW',
  'PERCENTAGE_CHANGE',
  'VOLUME_SPIKE',
  'WALL_DETECTED',
  'RSI_OVERBOUGHT',
  'RSI_OVERSOLD',
  'MACD_CROSSOVER',
  'FUNDING_RATE_ANOMALY'
]);
//  notify channel enum
export const NotifyChannelEnum = z.enum(['IN_APP', 'TELEGRAM', 'EMAIL', 'WEBHOOK']);

// Auth Schemas
//  register schema
export const RegisterSchema = z.object({
  email: z.string().email('Invalid email address').max(100).toLowerCase().trim(),
  password: z.string()
    .min(12, 'Password must be at least 12 characters')
    .max(100)
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^a-zA-Z0-9]/, 'Password must contain at least one special character'),
  name: z.string().min(1, 'Name is required').max(100).trim()
});

//  login schema
export const LoginSchema = z.object({
  email: z.string().email('Invalid email address').max(100).toLowerCase().trim(),
  password: z.string().min(1, 'Password is required')
});

// Watchlist Schemas
//  watchlist create schema
export const WatchlistCreateSchema = z.object({
  name: z.string().min(1, 'Watchlist name is required').max(100).trim()
});

//  watchlist item schema
export const WatchlistItemSchema = z.object({
  symbol: z.string().min(1).max(30).trim().toUpperCase(),
  exchange: ExchangeIdEnum,
  marketType: MarketTypeEnum,
  notes: z.string().max(500).optional()
});

//  watchlist item delete schema
export const WatchlistItemDeleteSchema = z.object({
  symbol: z.string().min(1).max(30).trim().toUpperCase(),
  exchange: ExchangeIdEnum,
  marketType: MarketTypeEnum
});

// Alert Condition & Rule Schemas
//  alert condition schema
export const AlertConditionSchema = z.object({
  id: z.string().default(() => `c_${Math.random().toString(36).substring(2, 9)}`),
  type: AlertConditionTypeEnum,
  params: z.object({
    targetPrice: z.number().positive('Target price must be greater than 0').optional(),
    timeframe: TimeframeEnum.optional(),
    percentageThreshold: z.number().positive('Percentage threshold must be greater than 0').optional(),
    volumeMultiplier: z.number().positive('Volume multiplier must be greater than 0').optional(),
    minWallVolumeUsd: z.number().positive('Wall volume must be greater than 0').optional(),
    maxWallDistancePercent: z.number().positive('Wall distance must be greater than 0').max(100).optional(),
    wallSide: z.enum(['BID', 'ASK', 'ANY']).optional(),
    rsiThreshold: z.number().min(0).max(100, 'RSI threshold must be between 0 and 100').optional(),
    fundingRateThreshold: z.number().optional()
  }).superRefine((params, ctx) => {
    // Custom refinement per condition type if needed
  })
});

//  alert rule schema
export const AlertRuleSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Rule name is required').max(100).trim(),
  enabled: z.boolean().default(true),
  symbols: z.array(z.string().min(1).max(30).trim().toUpperCase()).min(1, 'At least one symbol is required'),
  exchanges: z.array(ExchangeIdEnum).min(1, 'At least one exchange is required'),
  marketTypes: z.array(MarketTypeEnum).min(1, 'At least one market type is required'),
  logic: z.enum(['AND', 'OR']).default('AND'),
  conditions: z.array(AlertConditionSchema).min(1, 'At least one condition is required'),
  cooldownSeconds: z.number().int().min(1).max(86400, 'Cooldown must be between 1 and 86400 seconds').default(300),
  notifyChannels: z.array(NotifyChannelEnum).min(1, 'At least one notification channel is required').default(['IN_APP'])
});

// Filter Preset Schema
//  filter preset schema
export const FilterPresetSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Preset name is required').max(100).trim(),
  isDefault: z.boolean().default(false),
  filters: z.record(z.string(), z.any()).default({})
});

// User Settings Schema
//  user settings schema
export const UserSettingsSchema = z.object({
  theme: z.enum(['dark', 'light']).optional(),
  decimalPrecision: z.number().int().min(0).max(8).optional(),
  currency: z.enum(['USD', 'USDT']).optional(),
  refreshRateMs: z.number().int().min(100).max(60000).optional(),
  defaultPresetId: z.string().nullable().optional(),
  defaultCrossExchangeAggregation: z.boolean().optional(),
  wallMinVolumeDefaultUsd: z.number().positive().min(1000).optional(),
  wallMinDurationDefaultSec: z.number().int().min(0).max(86400).optional(),
  wallDistanceDefaultPercent: z.number().positive().max(50).optional(),
  enabledExchanges: z.array(ExchangeIdEnum).min(1).optional(),
  soundEnabled: z.boolean().optional(),
  telegramBotToken: z.string().max(200).optional(),
  telegramChatId: z.string().max(100).optional(),
  emailRecipient: z.string().email().max(100).or(z.literal('')).optional(),
  webhookUrl: z.string().url().max(500).or(z.literal('')).optional(),
  finnhubApiKey: z.string().max(200).optional(),
  polygonApiKey: z.string().max(200).optional()
});

// Blacklist Schema
//  blacklist entry schema
export const BlacklistEntrySchema = z.object({
  id: z.string().optional(),
  symbol: z.string().max(30).trim().toUpperCase().optional(),
  exchange: ExchangeIdEnum.optional(),
  category: AssetCategoryEnum.optional(),
  reason: z.string().min(1, 'Reason is required').max(500).trim()
}).refine(data => Boolean(data.symbol || data.exchange || data.category), {
  message: 'At least one of symbol, exchange, or category must be specified for blacklist entry'
});

// Wall Config Schema
//  wall config schema
export const WallConfigSchema = z.object({
  minVolumeUsd: z.number().positive().min(1000).optional(),
  maxDistancePercent: z.number().positive().max(50).optional(),
  minDurationSeconds: z.number().int().min(0).max(86400).optional(),
  crossExchangeAggregation: z.boolean().optional()
});
