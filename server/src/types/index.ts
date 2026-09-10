export type MarketType = 'SPOT' | 'FUTURES';

export type ExchangeId = 
  | 'BINANCE'
  | 'BYBIT'
  | 'MEXC'
  | 'OKX'
  | 'GATE'
  | 'BITGET'
  | 'KUCOIN'
  | 'HYPERLIQUID'
  | 'ASTERDEX'
  | 'STOCK_EXCHANGE';

export type AssetCategory = 'CRYPTO' | 'STOCKS' | 'FOREX' | 'COMMODITIES';

export type Timeframe = '30s' | '1m' | '5m' | '15m' | '1h' | '4h' | '1d';

//  market ticker
export interface MarketTicker {
  symbol: string;               // e.g. "BTCUSDT" or "AAPL"
  baseAsset: string;            // e.g. "BTC"
  quoteAsset: string;           // e.g. "USDT"
  exchange: ExchangeId;
  marketType: MarketType;
  category: AssetCategory;
  lastPrice: number;
  markPrice?: number;           // For Futures (essential for wall calculations)
  indexPrice?: number;
  percentageChange: number;     // 24h %
  changesByTimeframe: {
    '30s'?: number;
    '1m'?: number;
    '5m'?: number;
    '15m'?: number;
    '1h'?: number;
    '4h'?: number;
    '1d'?: number;
  };
  volumeUsd: number;            // 24h Quote Volume in USD
  volume24h: number;            // 24h Base Volume
  high24h: number;
  low24h: number;
  fundingRate?: number;         // For Perpetuals, e.g. 0.0001 (0.01%)
  nextFundingTime?: number;     // timestamp in ms
  openInterest?: number;        // USD value of OI
  
  // Technical Indicators
  rsi?: number;                 // 14-period RSI
  macd?: {
    value: number;
    signal: number;
    histogram: number;
  };
  atr?: number;                 // 14-period Average True Range
  bbWidth?: number;             // Bollinger Bands Width %
  ma20Distance?: number;        // % distance from MA20
  ma50Distance?: number;        // % distance from MA50
  ma200Distance?: number;       // % distance from MA200
  athDistance?: number;         // % from All-Time High
  atlDistance?: number;         // % from All-Time Low
  volatility24h?: number;       // (High - Low) / Low * 100

  // Stock Fundamentals (if category === 'STOCKS')
  marketCap?: number;
  peRatio?: number;
  eps?: number;
  sector?: string;
  industry?: string;

  timestamp: number;
  isLive: boolean;
  dataFreshness?: 'LIVE' | 'STALE' | 'DISCONNECTED';
}

//  order book level
export interface OrderBookLevel {
  price: number;
  amount: number;
  usdVolume: number;
  totalUsd?: number;
  wallFlag?: boolean;
}

//  order book snapshot
export interface OrderBookSnapshot {
  symbol: string;
  exchange: ExchangeId;
  marketType: MarketType;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  spread: number;
  spreadPercent: number;
  timestamp: number;
  lastUpdateId?: number;
}

//  trade
export interface Trade {
  id: string;
  symbol: string;
  exchange: ExchangeId;
  marketType: MarketType;
  price: number;
  amount: number;
  usdVolume: number;
  side: 'BUY' | 'SELL';
  timestamp: number;
}

//  candle
export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type WallSide = 'BID' | 'ASK';
export type WallState = 'FORMING' | 'CONFIRMED' | 'REMOVED' | 'FILLED';

//  detected wall
export interface DetectedWall {
  id: string;
  symbol: string;
  exchange: ExchangeId;
  marketType: MarketType;
  side: WallSide;
  price: number;
  volumeAmount: number;
  volumeUsd: number;
  referencePrice: number;       // Spot lastPrice or Futures markPrice
  distancePercent: number;      // e.g. 1.25%
  firstSeenAt: number;          // timestamp in ms
  lastSeenAt: number;           // timestamp in ms
  durationSeconds: number;
  state: WallState;
  initialVolumeUsd: number;
  peakVolumeUsd: number;
  remainingVolumeUsd: number;
  isAggregated: boolean;
  contributingExchanges?: ExchangeId[];
  createdAt: number;
  updatedAt: number;
}

//  historical wall record
export interface HistoricalWallRecord extends DetectedWall {
  removedAt?: number;
  filledAt?: number;
  fillPercentage?: number;
}

//  daily wall aggregate
export interface DailyWallAggregate {
  id: string;
  date: string;                 // "YYYY-MM-DD"
  symbol: string;
  exchange: ExchangeId | 'AGGREGATED';
  marketType: MarketType;
  wallCount: number;
  bidWallCount: number;
  askWallCount: number;
  avgVolumeUsd: number;
  peakVolumeUsd: number;
  avgDurationSeconds: number;
  filledCount: number;
  removedCount: number;
}

// Alert System Types
export type AlertConditionType =
  | 'PRICE_ABOVE'
  | 'PRICE_BELOW'
  | 'PERCENTAGE_CHANGE'
  | 'VOLUME_SPIKE'
  | 'WALL_DETECTED'
  | 'RSI_OVERBOUGHT'
  | 'RSI_OVERSOLD'
  | 'MACD_CROSSOVER'
  | 'FUNDING_RATE_ANOMALY';

//  alert condition
export interface AlertCondition {
  id: string;
  type: AlertConditionType;
  params: {
    targetPrice?: number;
    timeframe?: Timeframe;
    percentageThreshold?: number;
    volumeMultiplier?: number;
    minWallVolumeUsd?: number;
    maxWallDistancePercent?: number;
    wallSide?: 'BID' | 'ASK' | 'ANY';
    rsiThreshold?: number;
    fundingRateThreshold?: number; // e.g. 0.0005 for 0.05%
  };
}

//  alert rule
export interface AlertRule {
  id: string;
  userId?: string;
  name: string;
  enabled: boolean;
  symbols: string[];            // ['BTCUSDT', 'ETHUSDT'] or ['ALL']
  exchanges: ExchangeId[];
  marketTypes: MarketType[];
  logic: 'AND' | 'OR';
  conditions: AlertCondition[];
  cooldownSeconds: number;
  lastTriggeredAt?: number;
  notifyChannels: ('IN_APP' | 'TELEGRAM' | 'EMAIL' | 'WEBHOOK')[];
  createdAt: number;
  updatedAt: number;
}

//  alert trigger
export interface AlertTrigger {
  id: string;
  userId?: string;
  ruleId: string;
  ruleName: string;
  symbol: string;
  exchange: ExchangeId;
  marketType: MarketType;
  message: string;
  conditionType: AlertConditionType;
  metricValue: number | string;
  triggerPrice: number;
  timestamp: number;
  channel: 'IN_APP' | 'TELEGRAM' | 'EMAIL' | 'WEBHOOK';
  read: boolean;
}

// Blacklist Entry
//  blacklist entry
export interface BlacklistEntry {
  id: string;
  symbol?: string;              // e.g. "LUNAUSDT"
  exchange?: ExchangeId;        // if set, excludes on specific exchange
  category?: AssetCategory;     // e.g. "COMMODITIES"
  reason: string;
  addedAt: number;
}

// Watchlist
//  watchlist item
export interface WatchlistItem {
  id: string;
  symbol: string;
  exchange: ExchangeId;
  marketType: MarketType;
  notes?: string;
  addedAt: number;
}

//  watchlist
export interface Watchlist {
  id: string;
  userId?: string;
  name: string;
  items: WatchlistItem[];
  createdAt: number;
}

// Screener Filters
//  action result
export interface ActionResult {
  ok: boolean;
  error?: string;
}

//  screener filters
export interface ScreenerFilters {
  searchQuery: string;
  category: AssetCategory | 'ALL';
  marketType: MarketType | 'ALL';
  exchanges: ExchangeId[];
  symbols?: string[];       // asset pair / coin filter (e.g. ["BTCUSDT","SOLUSDT"]), empty = all
  priceMin?: number;
  priceMax?: number;
  changeMin?: number;
  changeMax?: number;
  timeframe: Timeframe;
  volumeMinUsd?: number;
  volumeMaxUsd?: number;
  rsiMin?: number;
  rsiMax?: number;
  maDistanceType?: 'MA20' | 'MA50' | 'MA200';
  maDistanceMin?: number;
  maDistanceMax?: number;
  athDistanceMin?: number;
  athDistanceMax?: number;
  atlDistanceMin?: number;
  atlDistanceMax?: number;
  volatilityMin?: number;
  volatilityMax?: number;
  volumeSpikeMinPercent?: number;
  marketCapMin?: number;
  marketCapMax?: number;
  peRatioMin?: number;
  peRatioMax?: number;
  onlyWithWalls?: boolean;
  onlyWatchlist?: boolean;
  hideBlacklisted: boolean;
  sortBy: keyof MarketTicker;
  sortOrder: 'asc' | 'desc';
}

//  saved filter preset
export interface SavedFilterPreset {
  id: string;
  userId?: string;
  name: string;
  isDefault: boolean;
  filters: Partial<ScreenerFilters>;
  createdAt: number;
}

// Connector & System Settings
//  connector status
export interface ConnectorStatus {
  exchange: ExchangeId;
  name: string;
  connected: boolean;
  status: 'CONNECTED' | 'DISCONNECTED' | 'CONNECTING' | 'NOT_CONFIGURED' | 'RECONNECTING' | 'ERROR' | 'UNIMPLEMENTED';
  pingMs: number;
  lastMessageAt: number;
  subscribedSymbolsCount: number;
  error?: string;
  isProductionReady: boolean;
}

//  user settings
export interface UserSettings {
  theme: 'dark' | 'light';
  decimalPrecision: number;
  currency: 'USD' | 'USDT';
  refreshRateMs: number;
  defaultPresetId?: string;
  defaultCrossExchangeAggregation: boolean;
  wallMinVolumeDefaultUsd: number;
  wallMinDurationDefaultSec: number;
  wallDistanceDefaultPercent: number;
  enabledExchanges: ExchangeId[];
  soundEnabled: boolean;
  telegramBotToken?: string;
  telegramChatId?: string;
  telegramUserId?: string;
  telegramUsername?: string;
  telegramEnabled?: boolean;
  telegramLinkedAt?: number;
  emailRecipient?: string;
  webhookUrl?: string;
  finnhubApiKey?: string;
  polygonApiKey?: string;
}

//  user telegram link
export interface UserTelegramLink {
  userId: string;
  telegramChatId: string;
  telegramUserId: string;
  telegramUsername?: string;
  linkedAt: number;
  enabled: boolean;
}

//  telegram status response
export interface TelegramStatusResponse {
  connected: boolean;
  telegramChatId?: string;
  telegramUserId?: string;
  telegramUsername?: string;
  linkedAt?: number;
  enabled: boolean;
  botUsername: string;
}

//  telegram link token response
export interface TelegramLinkTokenResponse {
  token: string;
  botUsername: string;
  deepLink: string;
  expiresAt: number;
}

//  telegram test alert response
export interface TelegramTestAlertResponse {
  success: boolean;
  messageId?: number;
  error?: string;
  deliveredAt?: number;
}

// Candlestick for chart
//  candle data
export interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// User & Authentication Types
export type UserRole = 'ADMIN' | 'TRADER' | 'USER' | 'VIEWER';

//  user profile
export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: number;
  trialStartDate?: number;
  trialEndDate?: number;
}

//  trial info
export interface TrialInfo {
  status: 'active' | 'expired' | 'expired_with_subscription' | 'no_trial';
  remainingDays: number;
  trialEndDate?: number;
}

//  current user response
export interface CurrentUserResponse {
  user: UserProfile;
  trial: TrialInfo;
  subscription?: {
    plan: string;
    status: string;
    currentPeriodEnd: number;
  };
}

//  auth session
export interface AuthSession {
  token: string;
  user: UserProfile;
  expiresAt: number;
}

//  audit log entry
export interface AuditLogEntry {
  id: string;
  userId: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  createdAt: number;
}

//  api error response
export interface ApiErrorResponse {
  error: string;
  message: string;
  statusCode?: number;
  details?: any;
  requestId?: string;
}

export * from './subscription.js';
export * from './subscription.js';
