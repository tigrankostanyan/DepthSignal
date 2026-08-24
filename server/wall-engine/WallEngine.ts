import { 
  DetectedWall, 
  ExchangeId, 
  MarketTicker, 
  MarketType, 
  OrderBookLevel, 
  OrderBookSnapshot, 
  Trade, 
  WallSide, 
  WallState 
} from '../../src/types/index.js';
import { DatabaseService } from '../db/database.js';
import { MarketStateService } from '../market-data/MarketStateService.js';

export interface WallEngineConfig {
  minVolumeUsd: number;               // default $500,000
  minDurationSeconds: number;         // default 15s
  maxDistancePercent: number;         // default 2.5%
  crossExchangeAggregation: boolean;  // MANDATORY default: FALSE
  orderBookDepthLimit: number;        // default 20
}

export type WallEventListener = (wall: DetectedWall, event: 'FORMING' | 'CONFIRMED' | 'REMOVED' | 'FILLED') => void;

export class WallEngine {
  private static instance: WallEngine;
  private config: WallEngineConfig;
  private db: DatabaseService;
  private marketState: MarketStateService;

  // Active tracked walls: key = `${exchange}:${marketType}:${symbol}:${side}:${price.toFixed(4)}`
  // or `AGGREGATED:${marketType}:${symbol}:${side}:${price.toFixed(4)}`
  private activeWalls = new Map<string, DetectedWall>();
  private listeners: WallEventListener[] = [];
  private scanInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.db = DatabaseService.getInstance();
    this.marketState = MarketStateService.getInstance();
    
    // Load config from settings
    const settings = this.db.getUserSettings();
    this.config = {
      minVolumeUsd: settings.wallMinVolumeDefaultUsd || 500000,
      minDurationSeconds: settings.wallMinDurationDefaultSec || 15,
      maxDistancePercent: settings.wallDistanceDefaultPercent || 2.5,
      crossExchangeAggregation: settings.defaultCrossExchangeAggregation || false, // Mandatory default false
      orderBookDepthLimit: 20
    };

    this.startLifecycleScanner();
  }

  public static getInstance(): WallEngine {
    if (!WallEngine.instance) {
      WallEngine.instance = new WallEngine();
    }
    return WallEngine.instance;
  }

  public setConfig(config: Partial<WallEngineConfig>): void {
    this.config = { ...this.config, ...config };
    console.log(`[WallEngine] Updated config: minVol=$${this.config.minVolumeUsd}, crossExchange=${this.config.crossExchangeAggregation}`);
  }

  public getConfig(): WallEngineConfig {
    return { ...this.config };
  }

  public onWallEvent(listener: WallEventListener): void {
    this.listeners.push(listener);
  }

  /**
   * Process orderbook snapshot for an exchange/symbol
   */
  public processOrderBook(orderBook: OrderBookSnapshot): void {
    const ticker = this.marketState.getTicker(orderBook.exchange, orderBook.marketType, orderBook.symbol);
    if (!ticker) return;

    // MANDATORY CRITICAL RULE:
    // For SPOT: referencePrice = lastPrice
    // For FUTURES: referencePrice = markPrice
    const referencePrice = orderBook.marketType === 'FUTURES' 
      ? (ticker.markPrice || ticker.lastPrice) 
      : ticker.lastPrice;

    if (!referencePrice || referencePrice <= 0) return;

    // 1. Process Bids
    this.scanLevels(orderBook.symbol, orderBook.exchange, orderBook.marketType, 'BID', orderBook.bids, referencePrice);
    // 2. Process Asks
    this.scanLevels(orderBook.symbol, orderBook.exchange, orderBook.marketType, 'ASK', orderBook.asks, referencePrice);

    // 3. If cross-exchange aggregation is enabled, aggregate across exchanges
    if (this.config.crossExchangeAggregation) {
      this.scanCrossExchangeWalls(orderBook.symbol, orderBook.marketType);
    }
  }

  private scanLevels(
    symbol: string,
    exchange: ExchangeId,
    marketType: MarketType,
    side: WallSide,
    levels: OrderBookLevel[],
    referencePrice: number
  ): void {
    const now = Date.now();
    const seenWallKeys = new Set<string>();

    for (let i = 0; i < Math.min(levels.length, this.config.orderBookDepthLimit); i++) {
      const level = levels[i];
      const distancePercent = Math.abs(level.price - referencePrice) / referencePrice * 100;

      // Distance check
      if (distancePercent > this.config.maxDistancePercent) continue;

      // Volume threshold check
      if (level.usdVolume >= this.config.minVolumeUsd) {
        level.wallFlag = true;
        const key = this.getWallKey(exchange, marketType, symbol, side, level.price);
        seenWallKeys.add(key);

        const existing = this.activeWalls.get(key);
        if (existing) {
          // Update existing wall
          existing.lastSeenAt = now;
          existing.durationSeconds = Math.floor((now - existing.firstSeenAt) / 1000);
          existing.remainingVolumeUsd = level.usdVolume;
          existing.peakVolumeUsd = Math.max(existing.peakVolumeUsd, level.usdVolume);
          existing.referencePrice = referencePrice;
          existing.distancePercent = distancePercent;
          existing.updatedAt = now;

          // Check if it transitions from FORMING to CONFIRMED
          if (existing.state === 'FORMING' && existing.durationSeconds >= this.config.minDurationSeconds) {
            existing.state = 'CONFIRMED';
            this.emitWallEvent(existing, 'CONFIRMED');
            this.db.saveWallRecord(existing);
          }
        } else {
          // New Wall Detected
          const newWall: DetectedWall = {
            id: `wall_${exchange.toLowerCase()}_${symbol.toLowerCase()}_${side.toLowerCase()}_${level.price.toFixed(2)}_${now}`,
            symbol,
            exchange,
            marketType,
            side,
            price: level.price,
            volumeAmount: level.amount,
            volumeUsd: level.usdVolume,
            referencePrice,
            distancePercent: +distancePercent.toFixed(2),
            firstSeenAt: now,
            lastSeenAt: now,
            durationSeconds: 0,
            state: this.config.minDurationSeconds === 0 ? 'CONFIRMED' : 'FORMING',
            initialVolumeUsd: level.usdVolume,
            peakVolumeUsd: level.usdVolume,
            remainingVolumeUsd: level.usdVolume,
            isAggregated: false,
            createdAt: now,
            updatedAt: now
          };

          this.activeWalls.set(key, newWall);
          this.emitWallEvent(newWall, 'FORMING');
          this.db.saveWallRecord(newWall);
        }
      }
    }
  }

  /**
   * Cross-Exchange aggregation scanning
   * Combines volumes at nearby price clusters (within 0.05%) when enabled.
   */
  private scanCrossExchangeWalls(symbol: string, marketType: MarketType): void {
    const exchanges: ExchangeId[] = ['BINANCE', 'BYBIT', 'OKX'];
    const ticker = this.marketState.getTicker('BINANCE', marketType, symbol);
    if (!ticker) return;

    const referencePrice = marketType === 'FUTURES' ? (ticker.markPrice || ticker.lastPrice) : ticker.lastPrice;
    if (!referencePrice) return;

    // Collect all levels across all enabled connectors
    const allBids: { exchange: ExchangeId; level: OrderBookLevel }[] = [];
    const allAsks: { exchange: ExchangeId; level: OrderBookLevel }[] = [];

    for (const ex of exchanges) {
      const ob = this.marketState.getOrderBook(ex, marketType, symbol);
      if (ob) {
        ob.bids.forEach(b => allBids.push({ exchange: ex, level: b }));
        ob.asks.forEach(a => allAsks.push({ exchange: ex, level: a }));
      }
    }

    this.clusterAndEvaluateAggregatedLevels(symbol, marketType, 'BID', allBids, referencePrice);
    this.clusterAndEvaluateAggregatedLevels(symbol, marketType, 'ASK', allAsks, referencePrice);
  }

  private clusterAndEvaluateAggregatedLevels(
    symbol: string,
    marketType: MarketType,
    side: WallSide,
    items: { exchange: ExchangeId; level: OrderBookLevel }[],
    referencePrice: number
  ): void {
    const now = Date.now();
    // Group by rounded price cluster (0.05% tolerance)
    const clusterMap = new Map<number, { totalUsd: number; totalAmount: number; exchanges: Set<ExchangeId>; representativePrice: number }>();

    for (const item of items) {
      const distance = Math.abs(item.level.price - referencePrice) / referencePrice * 100;
      if (distance > this.config.maxDistancePercent) continue;

      const clusterKey = Math.round(item.level.price / (referencePrice * 0.0005)) * (referencePrice * 0.0005);
      const existing = clusterMap.get(clusterKey) || {
        totalUsd: 0,
        totalAmount: 0,
        exchanges: new Set<ExchangeId>(),
        representativePrice: item.level.price
      };

      existing.totalUsd += item.level.usdVolume;
      existing.totalAmount += item.level.amount;
      existing.exchanges.add(item.exchange);
      clusterMap.set(clusterKey, existing);
    }

    for (const cluster of clusterMap.values()) {
      // Must qualify combined volume AND come from multiple exchanges for an aggregated wall
      if (cluster.totalUsd >= this.config.minVolumeUsd && cluster.exchanges.size > 1) {
        const key = `AGGREGATED:${marketType}:${symbol}:${side}:${cluster.representativePrice.toFixed(2)}`;
        const dist = Math.abs(cluster.representativePrice - referencePrice) / referencePrice * 100;
        const existing = this.activeWalls.get(key);

        if (existing) {
          existing.lastSeenAt = now;
          existing.durationSeconds = Math.floor((now - existing.firstSeenAt) / 1000);
          existing.remainingVolumeUsd = cluster.totalUsd;
          existing.peakVolumeUsd = Math.max(existing.peakVolumeUsd, cluster.totalUsd);
          if (existing.state === 'FORMING' && existing.durationSeconds >= this.config.minDurationSeconds) {
            existing.state = 'CONFIRMED';
            this.emitWallEvent(existing, 'CONFIRMED');
          }
        } else {
          const newAggWall: DetectedWall = {
            id: `wall_agg_${symbol.toLowerCase()}_${side.toLowerCase()}_${cluster.representativePrice.toFixed(2)}_${now}`,
            symbol,
            exchange: 'BINANCE', // Primary anchor
            marketType,
            side,
            price: cluster.representativePrice,
            volumeAmount: cluster.totalAmount,
            volumeUsd: cluster.totalUsd,
            referencePrice,
            distancePercent: +dist.toFixed(2),
            firstSeenAt: now,
            lastSeenAt: now,
            durationSeconds: 0,
            state: 'FORMING',
            initialVolumeUsd: cluster.totalUsd,
            peakVolumeUsd: cluster.totalUsd,
            remainingVolumeUsd: cluster.totalUsd,
            isAggregated: true,
            contributingExchanges: Array.from(cluster.exchanges),
            createdAt: now,
            updatedAt: now
          };
          this.activeWalls.set(key, newAggWall);
          this.emitWallEvent(newAggWall, 'FORMING');
        }
      }
    }
  }

  public scanExpiredWalls(maxAgeMs = 4000): void {
    const now = Date.now();
    for (const [key, wall] of this.activeWalls.entries()) {
      if (now - wall.lastSeenAt >= maxAgeMs) {
        // Wall disappeared from orderbook. Determine if REMOVED or FILLED
        const trades = this.marketState.getTrades(wall.exchange, wall.marketType, wall.symbol);
        const wasTradedAtLevel = trades.some(t => {
          const priceDiff = Math.abs(t.price - wall.price) / wall.price;
          return priceDiff < 0.0005 && t.timestamp >= wall.firstSeenAt;
        });

        const finalState: 'REMOVED' | 'FILLED' = wasTradedAtLevel ? 'FILLED' : 'REMOVED';
        wall.state = finalState;
        wall.updatedAt = now;

        this.emitWallEvent(wall, finalState);
        // Persist outcome to history and daily aggregates
        this.db.recordWallHistoricalOutcome(wall, finalState, wasTradedAtLevel ? 85 : 0);
        this.activeWalls.delete(key);
      }
    }
  }

  private startLifecycleScanner(): void {
    if (this.scanInterval) clearInterval(this.scanInterval);
    // Periodically check for expired/removed walls (no update in last 4 seconds)
    this.scanInterval = setInterval(() => {
      this.scanExpiredWalls(4000);
    }, 2000);
    if (this.scanInterval && typeof this.scanInterval.unref === 'function') {
      this.scanInterval.unref();
    }
  }

  private getWallKey(exchange: ExchangeId, marketType: MarketType, symbol: string, side: WallSide, price: number): string {
    return `${exchange}:${marketType}:${symbol.toUpperCase()}:${side}:${price.toFixed(4)}`;
  }

  private emitWallEvent(wall: DetectedWall, event: 'FORMING' | 'CONFIRMED' | 'REMOVED' | 'FILLED'): void {
    this.listeners.forEach(l => l(wall, event));
  }

  public getActiveWalls(symbol?: string, marketType?: MarketType): DetectedWall[] {
    let list = Array.from(this.activeWalls.values());
    if (symbol) {
      const symUpper = symbol.toUpperCase();
      list = list.filter(w => w.symbol === symUpper);
    }
    if (marketType) {
      list = list.filter(w => w.marketType === marketType);
    }
    return list.sort((a, b) => b.volumeUsd - a.volumeUsd);
  }
}
