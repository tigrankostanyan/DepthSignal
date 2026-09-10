import { CandleData, ExchangeId, MarketTicker, MarketType, OrderBookSnapshot, ScreenerFilters, Trade } from '../../types/index.js';
import { DatabaseService } from '../../db/database.js';
import { CandleEngine } from './CandleEngine.js';
import { RedisService } from '../redis/RedisService.js';
import { config } from '../../config/index.js';

//  market state service
export class MarketStateService {
  // Instance property
  private static instance: MarketStateService;

  // Lightweight key index (only strings, not full objects)
  private tickerKeys = new Set<string>();
  private orderBookKeys = new Set<string>();
  private tradeKeys = new Set<string>();

  // Db property
  private db: DatabaseService;
  // Candle engine property
  private candleEngine: CandleEngine;
  // Redis property
  private redis: RedisService;

  private constructor() {
    this.db = DatabaseService.getInstance();
    this.candleEngine = CandleEngine.getInstance();
    this.redis = RedisService.getInstance();
  }

  // Get instance
  public static getInstance(): MarketStateService {
    if (!MarketStateService.instance) {
      MarketStateService.instance = new MarketStateService();
    }
    return MarketStateService.instance;
  }

  // Get key
  private getKey(exchange: ExchangeId, marketType: MarketType, symbol: string): string {
    return `${exchange}:${marketType}:${symbol.toUpperCase()}`;
  }

  // Update ticker
  public async updateTicker(ticker: MarketTicker): Promise<void> {
    if (await this.isBlacklisted(ticker.symbol, ticker.exchange, ticker.category)) {
      return;
    }

    const key = this.getKey(ticker.exchange, ticker.marketType, ticker.symbol);
    this.tickerKeys.add(key);
    await this.redis.set(`ticker:${key}`, JSON.stringify(ticker), config.redis.tickerTtlSeconds);

    // Update real candle engine with incoming live tick
    this.candleEngine.recordPriceUpdate(
      ticker.exchange,
      ticker.marketType,
      ticker.symbol,
      ticker.lastPrice,
      ticker.volume24h,
      ticker.timestamp
    );
  }

  // Update order book
  public async updateOrderBook(orderBook: OrderBookSnapshot): Promise<void> {
    if (await this.isBlacklisted(orderBook.symbol, orderBook.exchange)) {
      return;
    }
    const key = this.getKey(orderBook.exchange, orderBook.marketType, orderBook.symbol);
    this.orderBookKeys.add(key);
    await this.redis.set(`ob:${key}`, JSON.stringify(orderBook), config.redis.orderBookTtlSeconds);
  }

  // Add trade
  public async addTrade(trade: Trade): Promise<void> {
    if (await this.isBlacklisted(trade.symbol, trade.exchange)) {
      return;
    }
    const key = this.getKey(trade.exchange, trade.marketType, trade.symbol);
    this.tradeKeys.add(key);

    // Read existing trades, prepend new, cap at 50
    const raw = await this.redis.get(`trades:${key}`);
    let list: Trade[] = raw ? JSON.parse(raw) : [];
    list.unshift(trade);
    if (list.length > 50) list = list.slice(0, 50);
    await this.redis.set(`trades:${key}`, JSON.stringify(list), config.redis.tradeTtlSeconds);
  }

  // Is blacklisted
  public async isBlacklisted(symbol?: string, exchange?: ExchangeId, category?: string): Promise<boolean> {
    const blacklist = await this.db.getBlacklist();
    return this.matchesBlacklist(blacklist, symbol, exchange, category);
  }

  // Pure in-memory blacklist matcher (no I/O) — reused so bulk filtering
  // does not issue one DB query per instrument.
  private matchesBlacklist(
    blacklist: Array<{ symbol?: string | null; exchange?: string | null; category?: string | null }>,
    symbol?: string,
    exchange?: ExchangeId,
    category?: string,
  ): boolean {
    for (const b of blacklist) {
      // 1. Symbol-specific blacklist rule
      if (b.symbol && symbol) {
        if (b.symbol.toUpperCase() === symbol.toUpperCase() && (!b.exchange || b.exchange === exchange)) {
          return true;
        }
        continue;
      }

      // 2. Entire Exchange blacklist (if symbol not specified)
      if (b.exchange && !b.symbol && b.exchange === exchange) {
        return true;
      }

      // 3. Entire Category blacklist (if symbol not specified)
      if (b.category && !b.symbol && category && b.category === category) {
        return true;
      }
    }
    return false;
  }

  // Freshness thresholds
  private freshnessThresholds(category?: string): { staleMs: number; deadMs: number } {
    if (category === 'STOCKS') return { staleMs: 35000, deadMs: 90000 };
    return { staleMs: 6000, deadMs: 30000 };
  }

  // Enrich ticker with freshness
  private enrichFreshness(t: MarketTicker): MarketTicker {
    const age = Date.now() - t.timestamp;
    const { staleMs, deadMs } = this.freshnessThresholds(t.category);
    let dataFreshness: 'LIVE' | 'STALE' | 'DISCONNECTED' = 'LIVE';
    let isLive = true;

    if (age > deadMs) {
      dataFreshness = 'DISCONNECTED';
      isLive = false;
    } else if (age > staleMs) {
      dataFreshness = 'STALE';
      isLive = false;
    }

    return { ...t, dataFreshness, isLive };
  }

  // Get all tickers
  public async getAllTickers(): Promise<MarketTicker[]> {
    const keys = Array.from(this.tickerKeys);
    if (keys.length === 0) return [];

    const redisKeys = keys.map(k => `ticker:${k}`);
    const values = await this.redis.mget(redisKeys);

    const result: MarketTicker[] = [];
    for (let i = 0; i < keys.length; i++) {
      const raw = values[i];
      if (raw) {
        result.push(this.enrichFreshness(JSON.parse(raw)));
      } else {
        // Key expired in Redis — remove from index
        this.tickerKeys.delete(keys[i]);
      }
    }
    return result;
  }

  // Get ticker
  public async getTicker(exchange: ExchangeId, marketType: MarketType, symbol: string): Promise<MarketTicker | undefined> {
    const key = this.getKey(exchange, marketType, symbol);
    const raw = await this.redis.get(`ticker:${key}`);
    if (!raw) {
      this.tickerKeys.delete(key);
      return undefined;
    }
    return this.enrichFreshness(JSON.parse(raw));
  }

  // Get order book
  public async getOrderBook(exchange: ExchangeId, marketType: MarketType, symbol: string): Promise<OrderBookSnapshot | undefined> {
    const key = this.getKey(exchange, marketType, symbol);
    const raw = await this.redis.get(`ob:${key}`);
    if (!raw) {
      this.orderBookKeys.delete(key);
      return undefined;
    }
    return JSON.parse(raw);
  }

  // Get trades
  public async getTrades(exchange: ExchangeId, marketType: MarketType, symbol: string): Promise<Trade[]> {
    const key = this.getKey(exchange, marketType, symbol);
    const raw = await this.redis.get(`trades:${key}`);
    if (!raw) {
      this.tradeKeys.delete(key);
      return [];
    }
    return JSON.parse(raw);
  }

  // Get candles
  public getCandles(exchange: ExchangeId, marketType: MarketType, symbol: string, count = 60): CandleData[] {
    return this.candleEngine.getCandles(exchange, marketType, symbol, count);
  }

  // Filter tickers
  public async filterTickers(filters: ScreenerFilters): Promise<MarketTicker[]> {
    let list = await this.getAllTickers();

    if (filters.hideBlacklisted) {
      // Fetch the blacklist ONCE and match in memory. The previous per-ticker
      // isBlacklisted() call issued one DB query per instrument (thousands per request).
      const blacklist = await this.db.getBlacklist();
      if (blacklist.length > 0) {
        list = list.filter((t) => !this.matchesBlacklist(blacklist, t.symbol, t.exchange, t.category));
      }
    }

    if (filters.searchQuery) {
      const q = filters.searchQuery.toUpperCase().trim();
      list = list.filter(t => t.symbol.includes(q) || t.baseAsset.includes(q));
    }

    if (filters.category && filters.category !== 'ALL') {
      list = list.filter(t => t.category === filters.category);
    }

    if (filters.marketType && filters.marketType !== 'ALL') {
      list = list.filter(t => t.marketType === filters.marketType);
    }

    if (filters.exchanges && filters.exchanges.length > 0) {
      list = list.filter(t => filters.exchanges.includes(t.exchange));
    }

    if (filters.symbols && filters.symbols.length > 0) {
      const symbolSet = new Set(filters.symbols.map(s => s.toUpperCase()));
      list = list.filter(t => symbolSet.has(t.symbol.toUpperCase()));
    }

    if (filters.priceMin !== undefined) {
      list = list.filter(t => t.lastPrice >= filters.priceMin!);
    }
    if (filters.priceMax !== undefined) {
      list = list.filter(t => t.lastPrice <= filters.priceMax!);
    }

    if (filters.changeMin !== undefined) {
      const tf = filters.timeframe || '1d';
      list = list.filter(t => {
        const ch = (t.changesByTimeframe && t.changesByTimeframe[tf] !== undefined) ? t.changesByTimeframe[tf]! : t.percentageChange;
        return ch >= filters.changeMin!;
      });
    }
    if (filters.changeMax !== undefined) {
      const tf = filters.timeframe || '1d';
      list = list.filter(t => {
        const ch = (t.changesByTimeframe && t.changesByTimeframe[tf] !== undefined) ? t.changesByTimeframe[tf]! : t.percentageChange;
        return ch <= filters.changeMax!;
      });
    }

    if (filters.volumeMinUsd !== undefined) {
      list = list.filter(t => t.volumeUsd >= filters.volumeMinUsd!);
    }
    if (filters.volumeMaxUsd !== undefined) {
      list = list.filter(t => t.volumeUsd <= filters.volumeMaxUsd!);
    }

    if (filters.rsiMin !== undefined) {
      list = list.filter(t => t.rsi !== undefined && t.rsi >= filters.rsiMin!);
    }
    if (filters.rsiMax !== undefined) {
      list = list.filter(t => t.rsi !== undefined && t.rsi <= filters.rsiMax!);
    }

    // Sort
    const sortField = filters.sortBy || 'volumeUsd';
    const order = filters.sortOrder === 'asc' ? 1 : -1;

    list.sort((a, b) => {
      let vA: any = a[sortField];
      let vB: any = b[sortField];

      if (sortField === 'percentageChange' && filters.timeframe && a.changesByTimeframe && b.changesByTimeframe) {
        vA = a.changesByTimeframe[filters.timeframe] ?? a.percentageChange;
        vB = b.changesByTimeframe[filters.timeframe] ?? b.percentageChange;
      }

      if (vA === undefined || vA === null) return 1;
      if (vB === undefined || vB === null) return -1;
      if (typeof vA === 'string') return order * vA.localeCompare(vB);
      return order * (vA - vB);
    });

    return list;
  }
}
