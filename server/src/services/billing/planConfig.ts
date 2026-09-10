// CENTRALIZED PLAN DEFINITIONS & LIMITS

import { ExchangeId, PlanDefinition, SubscriptionPlanId } from '../../types/index.js';

//  a l l_ s u p p o r t e d_ e x c h a n g e s
export const ALL_SUPPORTED_EXCHANGES: ExchangeId[] = [
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
];

//  s u b s c r i p t i o n_ p l a n s
export const SUBSCRIPTION_PLANS: Record<SubscriptionPlanId, PlanDefinition> = {
  FREE: {
    id: 'FREE',
    name: 'Free Tier',
    priceMonthlyUsd: 0,
    priceYearlyUsd: 0,
    description: 'Essential real-time screener for retail traders getting started.',
    badge: 'STARTER',
    limits: {
      maxWatchlistItems: 10,
      maxActiveAlerts: 3,
      maxActiveWallRules: 2,
      allowedExchanges: ['BINANCE'],
      alertHistoryRetentionDays: 3,
      wallHistoryAccessDays: 3,
      realtimeFeatureAccess: true,
      allowedNotificationChannels: ['IN_APP'],
      advancedFilters: false,
      crossExchangeAggregation: false,
      maxConnectionsPerUser: 2
    },
    features: [
      'Binance Spot & Futures Real-time Screener',
      'Up to 3 Active Trigger Alert Rules',
      'Up to 10 Watchlist Items',
      'Standard Order Book Depth & Wall Detection',
      'In-App Audio & Visual Alerts',
      '3-Day Historical Wall Activity Access'
    ]
  },
  PRO: {
    id: 'PRO',
    name: 'Pro Trader',
    priceMonthlyUsd: 29,
    priceYearlyUsd: 290, // $24.16/mo (approx 17% savings)
    description: 'Designed for active crypto traders who require multi-exchange monitoring and Telegram alerts.',
    badge: 'POPULAR',
    popular: true,
    limits: {
      maxWatchlistItems: 50,
      maxActiveAlerts: 20,
      maxActiveWallRules: 10,
      allowedExchanges: ALL_SUPPORTED_EXCHANGES,
      alertHistoryRetentionDays: 30,
      wallHistoryAccessDays: 30,
      realtimeFeatureAccess: true,
      allowedNotificationChannels: ['IN_APP', 'EMAIL', 'TELEGRAM'],
      advancedFilters: true,
      crossExchangeAggregation: false,
      maxConnectionsPerUser: 5
    },
    features: [
      'All 10 Global Exchanges & Stock Feeds',
      'Up to 20 Active Trigger Alert Rules',
      'Up to 50 Watchlist Items',
      'Telegram & Email Push Notifications',
      'RSI, ATR, MACD & Funding Rate Anomaly Filters',
      '30-Day Historical Wall Analytics & Export',
      'Sub-50ms Low-latency WebSocket Ingestion'
    ]
  },
  ADVANCED: {
    id: 'ADVANCED',
    name: 'Advanced Institutional',
    priceMonthlyUsd: 79,
    priceYearlyUsd: 790, // $65.83/mo (approx 17% savings)
    description: 'For prop funds, algorithmic desks, and power traders demanding cross-exchange wall aggregation and custom webhooks.',
    badge: 'ENTERPRISE',
    limits: {
      maxWatchlistItems: 250,
      maxActiveAlerts: 100,
      maxActiveWallRules: 50,
      allowedExchanges: ALL_SUPPORTED_EXCHANGES,
      alertHistoryRetentionDays: 90,
      wallHistoryAccessDays: 90,
      realtimeFeatureAccess: true,
      allowedNotificationChannels: ['IN_APP', 'EMAIL', 'TELEGRAM', 'WEBHOOK'],
      advancedFilters: true,
      crossExchangeAggregation: true,
      maxConnectionsPerUser: 15
    },
    features: [
      'Cross-Exchange Order Book Wall Aggregation (Multi-Venue Clustering)',
      'Custom Webhook Endpoints with HMAC Signature Verification',
      'Up to 100 Active Trigger Alert Rules',
      'Up to 250 Watchlist Items & Multiple Tabs',
      '90-Day Full Historical Depth & Wall Lifecycle Timeline',
      '15 Concurrent Realtime SSE / Multi-Device Feeds',
      'Dedicated High-Priority Alert Notification Worker Queue'
    ]
  }
};

// Get plan definition
export function getPlanDefinition(planId: SubscriptionPlanId = 'FREE'): PlanDefinition {
  return SUBSCRIPTION_PLANS[planId] || SUBSCRIPTION_PLANS.FREE;
}
