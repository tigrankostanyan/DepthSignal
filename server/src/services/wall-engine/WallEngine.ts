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
} from '../../types/index.js';
import { DatabaseService } from '../../db/database.js';
import { MarketStateService } from '../market-data/MarketStateService.js';
import { RedisService } from '../redis/RedisService.js';
import { SpoofingDetector } from './SpoofingDetector.js';
import { config } from '../../config/index.js';

//  wall engine config
export interface WallEngineConfig {
  minVolumeUsd: number;               // default $500,000
  minDurationSeconds: number;         // default 15s
  maxDistancePercent: number;         // default 2.5%
  crossExchangeAggregation: boolean;  // MANDATORY default: FALSE
  orderBookDepthLimit: number;        // default 20
}

export type WallEventListener = (wall: DetectedWall, event: 'FORMING' | 'CONFIRMED' | 'REMOVED' | 'FILLED') => void;

//  wall engine
export class WallEngine {
  // Instance property
  private static instance: WallEngine;
  // Config property
  private config: WallEngineConfig;
  // Db property
  private db: DatabaseService;
  // Market state property
  private marketState: MarketStateService;
  // Redis property
  private redis: RedisService;
  // Spoofing detector property
  private spoofingDetector: SpoofingDetector;

  //  w a l l_ s t a t e_ k e y property
  private readonly WALL_STATE_KEY = 'wall-engine:active-walls';

  // Active tracked walls: key = `${exchange}:${marketType}:${symbol}:${side}:${price.toFixed(4)}`
  // or `AGGREGATED:${marketType}:${symbol}:${side}:${price.toFixed(4)}`
  // Active walls property
  private activeWalls = new Map<string, DetectedWall>();
  // Listeners property
  private listeners: WallEventListener[] = [];
  // Scan interval property
  private scanInterval: NodeJS.Timeout | null = null;
  // Sync interval property
  private syncInterval: NodeJS.Timeout | null = null;

  // Throttle marker for wall snapshots (see emitWallEvent)
  private lastPersistAt = 0;
  // Is scanning property
  private isScanning = false;

  private constructor() {
    this.db = DatabaseService.getInstance();
    this.marketState = MarketStateService.getInstance();
    this.redis = RedisService.getInstance();
    this.spoofingDetector = SpoofingDetector.getInstance();

    // Default config until async DB settings load completes
    this.config = {
      minVolumeUsd: 500000,
      minDurationSeconds: 15,
      maxDistancePercent: 2.5,
      crossExchangeAggregation: false,
      orderBookDepthLimit: 20
    };
  }

  // Get instance
  public static getInstance(): WallEngine {
    if (!WallEngine.instance) {
      WallEngine.instance = new WallEngine();
      WallEngine.instance.initialize().catch(err => {
        console.error('[WallEngine] Config initialization error:', err.message);
      });
    }
    return WallEngine.instance;
  }

  // Initialize
  private async initialize(): Promise<void> {
    // Wall detection uses platform-wide default thresholds (not user-scoped).
    this.config = {
      minVolumeUsd: 500000,
      minDurationSeconds: 15,
      maxDistancePercent: 2.5,
      crossExchangeAggregation: false, // Mandatory default false
      orderBookDepthLimit: 20
    };

    await this.restoreActiveWallsFromRedis();
    this.startLifecycleScanner();
    this.startRedisSync();
  }

  // Persist active walls
  private persistActiveWalls(): void {
    this.redis
      .set(this.WALL_STATE_KEY, JSON.stringify(Object.fromEntries(this.activeWalls)), config.redis.wallStateTtlSeconds)
      .catch(() => undefined);
  }

  // Restore active walls from redis
  private async restoreActiveWallsFromRedis(): Promise<void> {
    try {
      const raw = await this.redis.get(this.WALL_STATE_KEY);
      if (!raw) return;
      const state = JSON.parse(raw) as Record<string, DetectedWall>;
      if (!state || typeof state !== 'object') return;
      const now = Date.now();
      const maxRestoreAgeMs = 5 * 60 * 1000;
      for (const [key, wall] of Object.entries(state)) {
        if (wall && typeof wall === 'object' && now - wall.lastSeenAt <= maxRestoreAgeMs) {
          this.activeWalls.set(key, wall);
        }
      }
      if (this.activeWalls.size > 0) {
        console.log(`[WallEngine] Restored ${this.activeWalls.size} active wall(s) from Redis snapshot`);
      }
    } catch (e: any) {
      console.error('[WallEngine] Redis restore failed (continuing fresh):', e.message);
    }
  }

  // Set config
  public setConfig(config: Partial<WallEngineConfig>): void {
    this.config = { ...this.config, ...config };
    console.log(`[WallEngine] Updated config: minVol=$${this.config.minVolumeUsd}, crossExchange=${this.config.crossExchangeAggregation}`);
  }

  // Get config
  public getConfig(): WallEngineConfig {
    return { ...this.config };
  }

  // On wall event
  public onWallEvent(listener: WallEventListener): void {
    this.listeners.push(listener);
  }

  // Process order book
  public async processOrderBook(orderBook: OrderBookSnapshot): Promise<void> {
    const ticker = await this.marketState.getTicker(orderBook.exchange, orderBook.marketType, orderBook.symbol);
    if (!ticker) return;

    // MANDATORY CRITICAL RULE:
    // For SPOT: referencePrice = lastPrice
    // For FUTURES: referencePrice = markPrice
    const referencePrice = orderBook.marketType === 'FUTURES' 
      ? (ticker.markPrice || ticker.lastPrice) 
      : ticker.lastPrice;

    if (!referencePrice || referencePrice <= 0) return;

    // 1. Process Bids
    await this.scanLevels(orderBook.symbol, orderBook.exchange, orderBook.marketType, 'BID', orderBook.bids, referencePrice);
    // 2. Process Asks
    await this.scanLevels(orderBook.symbol, orderBook.exchange, orderBook.marketType, 'ASK', orderBook.asks, referencePrice);

    // 3. If cross-exchange aggregation is enabled, aggregate across exchanges
    if (this.config.crossExchangeAggregation) {
      await this.scanCrossExchangeWalls(orderBook.symbol, orderBook.marketType);
    }
  }

  // Scan levels
  private async scanLevels(
    symbol: string,
    exchange: ExchangeId,
    marketType: MarketType,
    side: WallSide,
    levels: OrderBookLevel[],
    referencePrice: number
  ): Promise<void> {
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
            await this.db.saveWallRecord(existing);
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
          await this.db.saveWallRecord(newWall);
        }
      }
    }
  }

  // Scan cross exchange walls
  private async scanCrossExchangeWalls(symbol: string, marketType: MarketType): Promise<void> {
    const exchanges: ExchangeId[] = ['BINANCE', 'BYBIT', 'OKX'];
    const ticker = await this.marketState.getTicker('BINANCE', marketType, symbol);
    if (!ticker) return;

    const referencePrice = marketType === 'FUTURES' ? (ticker.markPrice || ticker.lastPrice) : ticker.lastPrice;
    if (!referencePrice) return;

    // Collect all levels across all enabled connectors
    const allBids: { exchange: ExchangeId; level: OrderBookLevel }[] = [];
    const allAsks: { exchange: ExchangeId; level: OrderBookLevel }[] = [];

    for (const ex of exchanges) {
      const ob = await this.marketState.getOrderBook(ex, marketType, symbol);
      if (ob) {
        ob.bids.forEach(b => allBids.push({ exchange: ex, level: b }));
        ob.asks.forEach(a => allAsks.push({ exchange: ex, level: a }));
      }
    }

    this.clusterAndEvaluateAggregatedLevels(symbol, marketType, 'BID', allBids, referencePrice);
    this.clusterAndEvaluateAggregatedLevels(symbol, marketType, 'ASK', allAsks, referencePrice);
  }

  // Cluster and evaluate aggregated levels
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
            state: this.config.minDurationSeconds === 0 ? 'CONFIRMED' : 'FORMING',
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

  // Scan expired walls
  public async scanExpiredWalls(maxAgeMs = 4000): Promise<void> {
    if (this.isScanning) return;
    this.isScanning = true;
    try {
      const now = Date.now();
      for (const [key, wall] of this.activeWalls.entries()) {
        if (now - wall.lastSeenAt >= maxAgeMs) {
          // Wall disappeared from orderbook. Determine if REMOVED or FILLED
          const trades = await this.marketState.getTrades(wall.exchange, wall.marketType, wall.symbol);
          const wasTradedAtLevel = trades.some(t => {
            const priceDiff = Math.abs(t.price - wall.price) / wall.price;
            return priceDiff < 0.0005 && t.timestamp >= wall.firstSeenAt;
          });

          const finalState: 'REMOVED' | 'FILLED' = wasTradedAtLevel ? 'FILLED' : 'REMOVED';
          wall.state = finalState;
          wall.updatedAt = now;

          this.emitWallEvent(wall, finalState);
          // Persist outcome to history and daily aggregates
          await this.db.recordWallHistoricalOutcome(wall, finalState, wasTradedAtLevel ? 85 : 0);
          this.activeWalls.delete(key);
        }
      }
    } finally {
      this.isScanning = false;
    }
  }

  // Start lifecycle scanner
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

  // Start redis sync
  private startRedisSync(): void {
    if (this.syncInterval) clearInterval(this.syncInterval);
    this.syncInterval = setInterval(() => {
      this.persistActiveWalls();
    }, 10_000);
    if (this.syncInterval && typeof this.syncInterval.unref === 'function') {
      this.syncInterval.unref();
    }
  }

  // Get wall key
  private getWallKey(exchange: ExchangeId, marketType: MarketType, symbol: string, side: WallSide, price: number): string {
    return `${exchange}:${marketType}:${symbol.toUpperCase()}:${side}:${price.toFixed(4)}`;
  }

  // Emit wall event
  private emitWallEvent(wall: DetectedWall, event: 'FORMING' | 'CONFIRMED' | 'REMOVED' | 'FILLED'): void {
    this.listeners.forEach(l => l(wall, event));
    // Every structural transition changes the active-walls state; snapshot it so a
    // crash/restart never loses the most recent wall state. Throttled because high
    // market activity emitted many events per second and hammered the DB/Redis.
    const now = Date.now();
    if (now - this.lastPersistAt > 5000) {
      this.lastPersistAt = now;
      this.persistActiveWalls();
    }
  }

  // Get active walls
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

  // Get spoof alerts
  public getSpoofAlerts(limit = 100): any[] {
    return this.spoofingDetector.getSpoofAlerts(limit);
  }

  // Scan layer stacking
  public scanLayerStacking(): void {
    // Group walls by exchange + symbol + marketType
    const groups = new Map<string, DetectedWall[]>();
    for (const wall of this.activeWalls.values()) {
      if (wall.isAggregated) continue;
      const key = `${wall.exchange}:${wall.marketType}:${wall.symbol}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(wall);
    }

    for (const [key, walls] of groups.entries()) {
      const [exchange, marketType, symbol] = key.split(':');
      this.spoofingDetector.checkLayerStacking(
        walls,
        exchange as ExchangeId,
        marketType as MarketType,
        symbol
      );
    }
  }
}
