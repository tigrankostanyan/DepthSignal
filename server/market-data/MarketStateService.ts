import { CandleData, ExchangeId, MarketTicker, MarketType, OrderBookSnapshot, ScreenerFilters, Trade } from '../../src/types/index.js';
import { DatabaseService } from '../db/database.js';
import { CandleEngine } from './CandleEngine.js';

export class MarketStateService {
  private static instance: MarketStateService;
  
  // Tickers keyed by `${exchange}:${marketType}:${symbol}`
  private tickers = new Map<string, MarketTicker>();
  // Order books keyed by `${exchange}:${marketType}:${symbol}`
  private orderBooks = new Map<string, OrderBookSnapshot>();
  // Recent trades keyed by `${exchange}:${marketType}:${symbol}`
  private recentTrades = new Map<string, Trade[]>();

  private db: DatabaseService;
  private candleEngine: CandleEngine;

  private constructor() {
    this.db = DatabaseService.getInstance();
    this.candleEngine = CandleEngine.getInstance();
  }

  public static getInstance(): MarketStateService {
    if (!MarketStateService.instance) {
      MarketStateService.instance = new MarketStateService();
    }
    return MarketStateService.instance;
  }

  private getKey(exchange: ExchangeId, marketType: MarketType, symbol: string): string {
    return `${exchange}:${marketType}:${symbol.toUpperCase()}`;
  }

  public updateTicker(ticker: MarketTicker): void {
    // Check global blacklist
    if (this.isBlacklisted(ticker.symbol, ticker.exchange, ticker.category)) {
      return;
    }

    const key = this.getKey(ticker.exchange, ticker.marketType, ticker.symbol);
    this.tickers.set(key, ticker);

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

  public updateOrderBook(orderBook: OrderBookSnapshot): void {
    if (this.isBlacklisted(orderBook.symbol, orderBook.exchange)) {
      return;
    }
    const key = this.getKey(orderBook.exchange, orderBook.marketType, orderBook.symbol);
    this.orderBooks.set(key, orderBook);
  }

  public addTrade(trade: Trade): void {
    if (this.isBlacklisted(trade.symbol, trade.exchange)) {
      return;
    }
    const key = this.getKey(trade.exchange, trade.marketType, trade.symbol);
    const list = this.recentTrades.get(key) || [];
    list.unshift(trade);
    if (list.length > 50) list.pop();
    this.recentTrades.set(key, list);
  }

  public isBlacklisted(symbol?: string, exchange?: ExchangeId, category?: string): boolean {
    const blacklist = this.db.getBlacklist();
    for (const b of blacklist) {
      // 1. Symbol-specific blacklist rule
      if (b.symbol && symbol) {
        if (b.symbol.toUpperCase() === symbol.toUpperCase()) {
          if (!b.exchange || b.exchange === exchange) {
            return true;
          }
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

  public getAllTickers(): MarketTicker[] {
    const now = Date.now();
    const list = Array.from(this.tickers.values());

    // Enrich with dynamic real-time data freshness state
    return list.map(t => {
      const age = now - t.timestamp;
      let dataFreshness: 'LIVE' | 'STALE' | 'DISCONNECTED' = 'LIVE';
      let isLive = true;

      if (age > 30000) {
        dataFreshness = 'DISCONNECTED';
        isLive = false;
      } else if (age > 6000) {
        dataFreshness = 'STALE';
        isLive = false;
      }

      return {
        ...t,
        dataFreshness,
        isLive
      };
    });
  }

  public getTicker(exchange: ExchangeId, marketType: MarketType, symbol: string): MarketTicker | undefined {
    const ticker = this.tickers.get(this.getKey(exchange, marketType, symbol));
    if (!ticker) return undefined;

    const age = Date.now() - ticker.timestamp;
    let dataFreshness: 'LIVE' | 'STALE' | 'DISCONNECTED' = 'LIVE';
    let isLive = true;

    if (age > 30000) {
      dataFreshness = 'DISCONNECTED';
      isLive = false;
    } else if (age > 6000) {
      dataFreshness = 'STALE';
      isLive = false;
    }

    return {
      ...ticker,
      dataFreshness,
      isLive
    };
  }

  public getOrderBook(exchange: ExchangeId, marketType: MarketType, symbol: string): OrderBookSnapshot | undefined {
    return this.orderBooks.get(this.getKey(exchange, marketType, symbol));
  }

  public getTrades(exchange: ExchangeId, marketType: MarketType, symbol: string): Trade[] {
    return this.recentTrades.get(this.getKey(exchange, marketType, symbol)) || [];
  }

  public getCandles(exchange: ExchangeId, marketType: MarketType, symbol: string, count = 60): CandleData[] {
    return this.candleEngine.getCandles(exchange, marketType, symbol, count);
  }

  public filterTickers(filters: ScreenerFilters): MarketTicker[] {
    let list = this.getAllTickers();

    if (filters.hideBlacklisted) {
      list = list.filter(t => !this.isBlacklisted(t.symbol, t.exchange, t.category));
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
