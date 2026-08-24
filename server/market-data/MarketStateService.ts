import { CandleData, ExchangeId, MarketTicker, MarketType, OrderBookSnapshot, ScreenerFilters, Trade } from '../../src/types/index.js';
import { DatabaseService } from '../db/database.js';

export class MarketStateService {
  private static instance: MarketStateService;
  
  // Tickers keyed by `${exchange}:${marketType}:${symbol}`
  private tickers = new Map<string, MarketTicker>();
  // Order books keyed by `${exchange}:${marketType}:${symbol}`
  private orderBooks = new Map<string, OrderBookSnapshot>();
  // Recent trades keyed by `${exchange}:${marketType}:${symbol}`
  private recentTrades = new Map<string, Trade[]>();
  // Synthetic / historical candles keyed by `${exchange}:${marketType}:${symbol}`
  private candleSeries = new Map<string, CandleData[]>();

  private db: DatabaseService;

  private constructor() {
    this.db = DatabaseService.getInstance();
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

    // Update candle stream in memory
    this.updateCandle(ticker);
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
    return Array.from(this.tickers.values());
  }

  public getTicker(exchange: ExchangeId, marketType: MarketType, symbol: string): MarketTicker | undefined {
    return this.tickers.get(this.getKey(exchange, marketType, symbol));
  }

  public getOrderBook(exchange: ExchangeId, marketType: MarketType, symbol: string): OrderBookSnapshot | undefined {
    return this.orderBooks.get(this.getKey(exchange, marketType, symbol));
  }

  public getTrades(exchange: ExchangeId, marketType: MarketType, symbol: string): Trade[] {
    return this.recentTrades.get(this.getKey(exchange, marketType, symbol)) || [];
  }

  public getCandles(exchange: ExchangeId, marketType: MarketType, symbol: string, count = 60): CandleData[] {
    const key = this.getKey(exchange, marketType, symbol);
    let candles = this.candleSeries.get(key);
    if (!candles || candles.length === 0) {
      // Generate initial smooth base candles around current ticker price
      const ticker = this.getTicker(exchange, marketType, symbol);
      const basePrice = ticker?.lastPrice || 100;
      candles = this.generateInitialCandles(basePrice, count);
      this.candleSeries.set(key, candles);
    }
    return candles.slice(-count);
  }

  private updateCandle(ticker: MarketTicker): void {
    const key = this.getKey(ticker.exchange, ticker.marketType, ticker.symbol);
    const candles = this.candleSeries.get(key) || this.generateInitialCandles(ticker.lastPrice, 60);
    const now = Date.now();
    const intervalMs = 60 * 1000; // 1m candle interval

    const currentCandle = candles[candles.length - 1];
    if (currentCandle && now - currentCandle.time < intervalMs) {
      currentCandle.high = Math.max(currentCandle.high, ticker.lastPrice);
      currentCandle.low = Math.min(currentCandle.low, ticker.lastPrice);
      currentCandle.close = ticker.lastPrice;
      currentCandle.volume += Math.random() * 2;
    } else {
      candles.push({
        time: Math.floor(now / intervalMs) * intervalMs,
        open: currentCandle ? currentCandle.close : ticker.lastPrice,
        high: ticker.lastPrice,
        low: ticker.lastPrice,
        close: ticker.lastPrice,
        volume: 1
      });
      if (candles.length > 200) candles.shift();
    }
    this.candleSeries.set(key, candles);
  }

  private generateInitialCandles(basePrice: number, count: number): CandleData[] {
    const list: CandleData[] = [];
    const now = Date.now();
    const intervalMs = 60 * 1000;
    let curr = basePrice * 0.98;

    for (let i = count; i >= 0; i--) {
      const time = now - i * intervalMs;
      const change = (Math.random() - 0.49) * (basePrice * 0.003);
      const open = curr;
      const close = +(curr + change).toFixed(2);
      const high = +(Math.max(open, close) + Math.random() * (basePrice * 0.0015)).toFixed(2);
      const low = +(Math.min(open, close) - Math.random() * (basePrice * 0.0015)).toFixed(2);
      const volume = +(10 + Math.random() * 40).toFixed(2);

      list.push({ time, open, high, low, close, volume });
      curr = close;
    }

    // Ensure the last candle matches basePrice
    if (list.length > 0) {
      list[list.length - 1].close = basePrice;
    }
    return list;
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
