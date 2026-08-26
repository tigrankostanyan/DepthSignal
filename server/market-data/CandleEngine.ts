import { CandleData, ExchangeId, MarketType } from '../../src/types/index.js';
import {
  calculateATR,
  calculateBollingerBands,
  calculateMACD,
  calculateRSI,
  calculateSMA
} from './TechnicalIndicators.js';

export interface CalculatedIndicators {
  rsi?: number;
  atr?: number;
  bbWidth?: number;
  ma20Distance?: number;
  ma50Distance?: number;
  ma200Distance?: number;
  macd?: {
    value: number;
    signal: number;
    histogram: number;
  };
}

export class CandleEngine {
  private static instance: CandleEngine;
  
  // Real candles keyed by `${exchange}:${marketType}:${symbol}`
  private candleStore = new Map<string, CandleData[]>();
  // Timestamped price points for ultra-accurate timeframe changes
  private priceHistoryStore = new Map<string, { time: number; price: number }[]>();
  // Track ongoing fetches to avoid duplicate network calls
  private fetchingKeys = new Set<string>();

  private constructor() {}

  public static getInstance(): CandleEngine {
    if (!CandleEngine.instance) {
      CandleEngine.instance = new CandleEngine();
    }
    return CandleEngine.instance;
  }

  private getKey(exchange: ExchangeId, marketType: MarketType, symbol: string): string {
    return `${exchange}:${marketType}:${symbol.toUpperCase()}`;
  }

  /**
   * Bootstraps historical candles for a symbol from official exchange public endpoints.
   */
  public async loadInitialCandles(exchange: ExchangeId, marketType: MarketType, symbol: string): Promise<void> {
    const key = this.getKey(exchange, marketType, symbol);
    if (this.fetchingKeys.has(key) || this.candleStore.has(key)) return;

    this.fetchingKeys.add(key);

    try {
      if (exchange === 'BINANCE') {
        const baseUrl = marketType === 'FUTURES' 
          ? 'https://fapi.binance.com/fapi/v1/klines' 
          : 'https://api.binance.com/api/v3/klines';
        
        const url = `${baseUrl}?symbol=${symbol.toUpperCase()}&interval=1h&limit=150`;
        const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
        if (res.ok) {
          const raw: any[] = await res.json();
          const parsed: CandleData[] = raw.map((k) => ({
            time: k[0],
            open: parseFloat(k[1]),
            high: parseFloat(k[2]),
            low: parseFloat(k[3]),
            close: parseFloat(k[4]),
            volume: parseFloat(k[5])
          }));
          this.candleStore.set(key, parsed);
        }
      } else if (exchange === 'BYBIT') {
        const category = marketType === 'FUTURES' ? 'linear' : 'spot';
        const url = `https://api.bybit.com/v5/market/kline?category=${category}&symbol=${symbol.toUpperCase()}&interval=60&limit=150`;
        const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
        if (res.ok) {
          const json = await res.json();
          if (json.retCode === 0 && json.result?.list) {
            // Bybit returns newest first, reverse for chronological order
            const list = [...json.result.list].reverse();
            const parsed: CandleData[] = list.map((k: any) => ({
              time: parseInt(k[0], 10),
              open: parseFloat(k[1]),
              high: parseFloat(k[2]),
              low: parseFloat(k[3]),
              close: parseFloat(k[4]),
              volume: parseFloat(k[5])
            }));
            this.candleStore.set(key, parsed);
          }
        }
      }
    } catch (err: any) {
      // In case of network timeout, continue without throwing
      console.warn(`[CandleEngine] Could not bootstrap candles for ${key}:`, err.message);
    } finally {
      this.fetchingKeys.delete(key);
    }
  }

  /**
   * Updates candles and price history from incoming live market data.
   */
  public recordPriceUpdate(exchange: ExchangeId, marketType: MarketType, symbol: string, price: number, volume = 0, timestamp = Date.now()): void {
    const key = this.getKey(exchange, marketType, symbol);

    // 1. Record in high-resolution timestamp buffer (pruned to 24h)
    let history = this.priceHistoryStore.get(key);
    if (!history) {
      history = [];
      this.priceHistoryStore.set(key, history);
    }
    history.push({ time: timestamp, price });

    const cutoff = timestamp - 24 * 60 * 60 * 1000;
    if (history.length > 5000 || (history.length > 0 && history[0].time < cutoff)) {
      history = history.filter(p => p.time >= cutoff);
      this.priceHistoryStore.set(key, history);
    }

    // 2. Update current active candle in store
    const candles = this.candleStore.get(key);
    if (!candles) {
      // Trigger background bootstrap if missing
      this.loadInitialCandles(exchange, marketType, symbol);
      return;
    }

    const intervalMs = 60 * 60 * 1000; // 1-hour candle interval
    const candleBucket = Math.floor(timestamp / intervalMs) * intervalMs;
    const lastCandle = candles[candles.length - 1];

    if (lastCandle && lastCandle.time === candleBucket) {
      lastCandle.high = Math.max(lastCandle.high, price);
      lastCandle.low = Math.min(lastCandle.low, price);
      lastCandle.close = price;
      lastCandle.volume = (lastCandle.volume || 0) + volume;
    } else if (!lastCandle || timestamp > lastCandle.time) {
      candles.push({
        time: candleBucket,
        open: lastCandle ? lastCandle.close : price,
        high: price,
        low: price,
        close: price,
        volume: volume
      });
      if (candles.length > 250) candles.shift();
    }
  }

  /**
   * Returns real historical candles or empty array if not loaded yet.
   */
  public getCandles(exchange: ExchangeId, marketType: MarketType, symbol: string, count = 60): CandleData[] {
    const key = this.getKey(exchange, marketType, symbol);
    const candles = this.candleStore.get(key);
    if (!candles || candles.length === 0) {
      this.loadInitialCandles(exchange, marketType, symbol);
      return [];
    }
    return candles.slice(-count);
  }

  /**
   * Computes genuine technical indicators from stored OHLCV candles.
   * Returns undefined for any indicator where candle history is insufficient.
   */
  public computeIndicators(exchange: ExchangeId, marketType: MarketType, symbol: string, currentPrice: number): CalculatedIndicators {
    const key = this.getKey(exchange, marketType, symbol);
    const candles = this.candleStore.get(key);

    if (!candles || candles.length === 0) {
      this.loadInitialCandles(exchange, marketType, symbol);
      return {};
    }

    const closes = candles.map(c => c.close);
    // Include current live price in close sequence
    if (closes.length > 0) {
      closes[closes.length - 1] = currentPrice;
    }

    const rsi = calculateRSI(closes, 14);
    const atr = calculateATR(candles, 14);
    const bb = calculateBollingerBands(closes, 20, 2);
    const macd = calculateMACD(closes, 12, 26, 9);

    const ma20 = calculateSMA(closes, 20);
    const ma50 = calculateSMA(closes, 50);
    const ma200 = calculateSMA(closes, 200);

    const ma20Distance = ma20 !== undefined && ma20 > 0 
      ? +(((currentPrice - ma20) / ma20) * 100).toFixed(2) 
      : undefined;

    const ma50Distance = ma50 !== undefined && ma50 > 0 
      ? +(((currentPrice - ma50) / ma50) * 100).toFixed(2) 
      : undefined;

    const ma200Distance = ma200 !== undefined && ma200 > 0 
      ? +(((currentPrice - ma200) / ma200) * 100).toFixed(2) 
      : undefined;

    return {
      rsi,
      atr,
      bbWidth: bb?.widthPercent,
      ma20Distance,
      ma50Distance,
      ma200Distance,
      macd
    };
  }

  /**
   * Computes exact timeframe percentage changes from actual historical timestamped prices.
   * Returns undefined if there is insufficient historical data for that timeframe window.
   */
  public computeTimeframeChanges(exchange: ExchangeId, marketType: MarketType, symbol: string, currentPrice: number, change24h: number): {
    '30s'?: number;
    '1m'?: number;
    '5m'?: number;
    '15m'?: number;
    '1h'?: number;
    '4h'?: number;
    '1d'?: number;
  } {
    const key = this.getKey(exchange, marketType, symbol);
    const history = this.priceHistoryStore.get(key);
    const now = Date.now();

    const getExactChange = (ms: number): number | undefined => {
      if (!history || history.length < 2) return undefined;
      const targetTime = now - ms;
      const oldest = history[0];
      // If we don't have history spanning at least 70% of the window, mark as undefined
      if (oldest.time > targetTime + (ms * 0.3)) return undefined;

      // Find the closest datapoint around targetTime
      let closest = history[0];
      let minDiff = Math.abs(closest.time - targetTime);

      for (let i = 1; i < history.length; i++) {
        const diff = Math.abs(history[i].time - targetTime);
        if (diff < minDiff) {
          minDiff = diff;
          closest = history[i];
        }
      }

      if (closest && closest.price > 0) {
        return +(((currentPrice - closest.price) / closest.price) * 100).toFixed(2);
      }
      return undefined;
    };

    return {
      '30s': getExactChange(30 * 1000),
      '1m': getExactChange(60 * 1000),
      '5m': getExactChange(5 * 60 * 1000),
      '15m': getExactChange(15 * 60 * 1000),
      '1h': getExactChange(60 * 60 * 1000),
      '4h': getExactChange(4 * 60 * 60 * 1000),
      '1d': +change24h.toFixed(2)
    };
  }
}
