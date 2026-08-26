import WebSocket from 'ws';
import { ExchangeId, MarketTicker, MarketType, OrderBookLevel, OrderBookSnapshot, Trade } from '../../src/types/index.js';
import { CandleEngine } from '../market-data/CandleEngine.js';
import { BaseExchangeConnector } from './ExchangeConnector.js';

export class BinanceConnector extends BaseExchangeConnector {
  public readonly exchangeId: ExchangeId = 'BINANCE';
  public readonly name = 'Binance';
  public readonly isProductionReady = true;

  private spotWs: WebSocket | null = null;
  private futuresWs: WebSocket | null = null;

  private spotSubscribedSymbols = new Set<string>(['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'DOGEUSDT', 'XRPUSDT', 'ADAUSDT', 'AVAXUSDT', 'LINKUSDT', 'SUIUSDT']);
  private futuresSubscribedSymbols = new Set<string>(['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'DOGEUSDT', 'XRPUSDT']);

  private reconnectAttempts = 0;
  private maxReconnectDelay = 30000;
  private isConnecting = false;
  private pingInterval: NodeJS.Timeout | null = null;
  private pollingInterval: NodeJS.Timeout | null = null;

  private candleEngine: CandleEngine;

  // Track latest mark prices and funding rates for futures
  private futuresMarkPrices = new Map<string, { markPrice: number; fundingRate: number; nextFundingTime: number }>();

  constructor() {
    super();
    this.candleEngine = CandleEngine.getInstance();
    this.status = {
      exchange: 'BINANCE',
      name: 'Binance (Spot & Futures)',
      connected: false,
      status: 'DISCONNECTED',
      pingMs: 0,
      lastMessageAt: 0,
      subscribedSymbolsCount: this.spotSubscribedSymbols.size + this.futuresSubscribedSymbols.size,
      isProductionReady: true
    };
  }

  public async connect(): Promise<void> {
    if (this.isConnecting || this.status.connected) return;
    this.isConnecting = true;
    this.updateStatus({ status: 'RECONNECTING' });

    try {
      // 1. Initial REST bootstrap for fast instant data
      await this.fetchInitialRestData();

      // 2. Connect WebSockets for Spot and Futures
      this.initSpotWebSocket();
      this.initFuturesWebSocket();

      // 3. Heartbeat ping monitor
      this.startHeartbeat();

      // 4. Background fallback poller for funding rates / 24h stats
      this.startRestPoller();

      this.isConnecting = false;
    } catch (err: any) {
      console.error('[BinanceConnector] Connection error:', err.message);
      this.isConnecting = false;
      this.updateStatus({ status: 'ERROR', error: err.message });
      this.scheduleReconnect();
    }
  }

  public async disconnect(): Promise<void> {
    if (this.pingInterval) clearInterval(this.pingInterval);
    if (this.pollingInterval) clearInterval(this.pollingInterval);

    if (this.spotWs) {
      this.spotWs.removeAllListeners();
      this.spotWs.close();
      this.spotWs = null;
    }

    if (this.futuresWs) {
      this.futuresWs.removeAllListeners();
      this.futuresWs.close();
      this.futuresWs = null;
    }

    this.updateStatus({ connected: false, status: 'DISCONNECTED' });
  }

  public subscribeSymbols(symbols: string[], marketType: MarketType): void {
    const targetSet = marketType === 'SPOT' ? this.spotSubscribedSymbols : this.futuresSubscribedSymbols;
    let changed = false;

    for (const sym of symbols) {
      const upper = sym.toUpperCase();
      if (!targetSet.has(upper)) {
        targetSet.add(upper);
        changed = true;
      }
    }

    if (changed) {
      this.updateStatus({
        subscribedSymbolsCount: this.spotSubscribedSymbols.size + this.futuresSubscribedSymbols.size
      });
      // Reconnect sockets with updated stream list
      if (this.status.connected) {
        if (marketType === 'SPOT') this.reconnectSpotWs();
        else this.reconnectFuturesWs();
      }
    }
  }

  public unsubscribeSymbols(symbols: string[], marketType: MarketType): void {
    const targetSet = marketType === 'SPOT' ? this.spotSubscribedSymbols : this.futuresSubscribedSymbols;
    for (const sym of symbols) {
      targetSet.delete(sym.toUpperCase());
    }
    this.updateStatus({
      subscribedSymbolsCount: this.spotSubscribedSymbols.size + this.futuresSubscribedSymbols.size
    });
  }

  private async fetchInitialRestData(): Promise<void> {
    try {
      const fetchWithTimeout = async (url: string, ms = 3500) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), ms);
        try {
          const res = await fetch(url, { signal: controller.signal });
          clearTimeout(timeoutId);
          return res;
        } catch (e) {
          clearTimeout(timeoutId);
          return null;
        }
      };

      // Spot 24hr tickers
      const spotRes = await fetchWithTimeout('https://api.binance.com/api/v3/ticker/24hr', 3000);
      if (spotRes && spotRes.ok) {
        const data: any[] = await spotRes.json();
        for (const item of data) {
          if (this.spotSubscribedSymbols.has(item.symbol)) {
            const ticker = this.normalizeBinance24hr(item, 'SPOT');
            this.emitTicker(ticker);
          }
        }
      }

      // Futures premiumIndex for markPrice & funding rates
      const fapiPremiumRes = await fetchWithTimeout('https://fapi.binance.com/fapi/v1/premiumIndex', 3000);
      if (fapiPremiumRes && fapiPremiumRes.ok) {
        const premiumData: any[] = await fapiPremiumRes.json();
        for (const p of premiumData) {
          if (this.futuresSubscribedSymbols.has(p.symbol)) {
            this.futuresMarkPrices.set(p.symbol, {
              markPrice: parseFloat(p.markPrice),
              fundingRate: parseFloat(p.lastFundingRate),
              nextFundingTime: p.nextFundingTime
            });
          }
        }
      }

      // Futures 24hr tickers
      const futuresRes = await fetchWithTimeout('https://fapi.binance.com/fapi/v1/ticker/24hr', 3000);
      if (futuresRes && futuresRes.ok) {
        const fData: any[] = await futuresRes.json();
        for (const item of fData) {
          if (this.futuresSubscribedSymbols.has(item.symbol)) {
            const ticker = this.normalizeBinance24hr(item, 'FUTURES');
            this.emitTicker(ticker);
          }
        }
      }
    } catch (err: any) {
      console.warn('[BinanceConnector] Initial REST fetch notice:', err.message);
    }
  }

  private initSpotWebSocket(): void {
    const streams: string[] = [];
    for (const symbol of this.spotSubscribedSymbols) {
      const s = symbol.toLowerCase();
      streams.push(`${s}@ticker`);
      streams.push(`${s}@depth20@100ms`);
      streams.push(`${s}@trade`);
    }

    if (streams.length === 0) return;

    const url = `wss://stream.binance.com:9443/stream?streams=${streams.join('/')}`;
    const startTime = Date.now();

    try {
      this.spotWs = new WebSocket(url);

      this.spotWs.on('open', () => {
        const latency = Date.now() - startTime;
        this.reconnectAttempts = 0;
        this.updateStatus({ connected: true, status: 'CONNECTED', pingMs: latency, lastMessageAt: Date.now() });
        console.log(`[BinanceConnector] Spot WebSocket connected (${streams.length} streams, ping: ${latency}ms)`);
      });

      this.spotWs.on('message', (rawData: Buffer | string) => {
        try {
          const msg = JSON.parse(rawData.toString());
          this.handleSpotMessage(msg);
          this.updateStatus({ lastMessageAt: Date.now() });
        } catch (err) {
          // ignore parsing glitch
        }
      });

      this.spotWs.on('error', (err) => {
        console.error('[BinanceConnector] Spot WS Error:', err.message);
        this.updateStatus({ status: 'ERROR', error: err.message });
      });

      this.spotWs.on('close', () => {
        console.warn('[BinanceConnector] Spot WS closed');
        this.updateStatus({ connected: false, status: 'DISCONNECTED' });
        this.scheduleReconnect();
      });
    } catch (e: any) {
      console.error('[BinanceConnector] Could not create Spot WebSocket:', e.message);
    }
  }

  private initFuturesWebSocket(): void {
    const streams: string[] = [];
    for (const symbol of this.futuresSubscribedSymbols) {
      const s = symbol.toLowerCase();
      streams.push(`${s}@ticker`);
      streams.push(`${s}@markPrice@1s`);
      streams.push(`${s}@depth20@100ms`);
    }

    if (streams.length === 0) return;

    const url = `wss://fstream.binance.com/stream?streams=${streams.join('/')}`;

    try {
      this.futuresWs = new WebSocket(url);

      this.futuresWs.on('open', () => {
        console.log(`[BinanceConnector] Futures WebSocket connected (${streams.length} streams)`);
      });

      this.futuresWs.on('message', (rawData: Buffer | string) => {
        try {
          const msg = JSON.parse(rawData.toString());
          this.handleFuturesMessage(msg);
          this.updateStatus({ lastMessageAt: Date.now() });
        } catch (err) {
          // ignore
        }
      });

      this.futuresWs.on('error', (err) => {
        console.error('[BinanceConnector] Futures WS Error:', err.message);
      });

      this.futuresWs.on('close', () => {
        console.warn('[BinanceConnector] Futures WS closed');
        setTimeout(() => this.reconnectFuturesWs(), 3000);
      });
    } catch (e: any) {
      console.error('[BinanceConnector] Could not create Futures WS:', e.message);
    }
  }

  private handleSpotMessage(msg: any): void {
    if (!msg || !msg.stream || !msg.data) return;
    const stream: string = msg.stream;
    const data: any = msg.data;

    if (stream.endsWith('@ticker')) {
      const ticker = this.normalizeWsTicker(data, 'SPOT');
      this.emitTicker(ticker);
    } else if (stream.endsWith('@depth20@100ms')) {
      const symbol = stream.split('@')[0].toUpperCase();
      const orderBook = this.normalizeWsDepth(symbol, data, 'SPOT');
      this.emitOrderBook(orderBook);
    } else if (stream.endsWith('@trade')) {
      const trade = this.normalizeWsTrade(data, 'SPOT');
      this.emitTrade(trade);
    }
  }

  private handleFuturesMessage(msg: any): void {
    if (!msg || !msg.stream || !msg.data) return;
    const stream: string = msg.stream;
    const data: any = msg.data;

    if (stream.endsWith('@markPrice@1s')) {
      this.futuresMarkPrices.set(data.s, {
        markPrice: parseFloat(data.p),
        fundingRate: parseFloat(data.r),
        nextFundingTime: data.T
      });
    } else if (stream.endsWith('@ticker')) {
      const ticker = this.normalizeWsTicker(data, 'FUTURES');
      this.emitTicker(ticker);
    } else if (stream.endsWith('@depth20@100ms')) {
      const symbol = stream.split('@')[0].toUpperCase();
      const orderBook = this.normalizeWsDepth(symbol, data, 'FUTURES');
      this.emitOrderBook(orderBook);
    }
  }

  // Normalization logic with genuine mathematical indicators
  private normalizeBinance24hr(raw: any, marketType: MarketType): MarketTicker {
    const symbol = raw.symbol;
    const baseAsset = symbol.replace(/USDT$|BUSD$|USDC$/, '') || symbol;
    const quoteAsset = symbol.endsWith('USDT') ? 'USDT' : symbol.endsWith('USDC') ? 'USDC' : 'USD';
    const lastPrice = parseFloat(raw.lastPrice || raw.c || '0');
    const priceChangePercent = parseFloat(raw.priceChangePercent || raw.P || '0');
    const volumeBase = parseFloat(raw.volume || raw.v || '0');
    const volumeQuote = parseFloat(raw.quoteVolume || raw.q || '0');
    const high24h = parseFloat(raw.highPrice || raw.h || '0');
    const low24h = parseFloat(raw.lowPrice || raw.l || '0');

    const markData = this.futuresMarkPrices.get(symbol);
    const markPrice = marketType === 'FUTURES' ? (markData ? markData.markPrice : lastPrice) : undefined;
    const fundingRate = marketType === 'FUTURES' ? (markData ? markData.fundingRate : 0.0001) : undefined;
    const nextFundingTime = marketType === 'FUTURES' ? (markData ? markData.nextFundingTime : Date.now() + 4 * 3600 * 1000) : undefined;

    const timestamp = Date.now();
    this.candleEngine.recordPriceUpdate('BINANCE', marketType, symbol, lastPrice, volumeBase, timestamp);

    const indicators = this.candleEngine.computeIndicators('BINANCE', marketType, symbol, lastPrice);
    const timeframeChanges = this.candleEngine.computeTimeframeChanges('BINANCE', marketType, symbol, lastPrice, priceChangePercent);

    return {
      symbol,
      baseAsset,
      quoteAsset,
      exchange: 'BINANCE',
      marketType,
      category: 'CRYPTO',
      lastPrice,
      markPrice,
      percentageChange: priceChangePercent,
      changesByTimeframe: timeframeChanges,
      volumeUsd: volumeQuote,
      volume24h: volumeBase,
      high24h,
      low24h,
      fundingRate,
      nextFundingTime,
      volatility24h: low24h > 0 ? +(((high24h - low24h) / low24h) * 100).toFixed(2) : undefined,
      rsi: indicators.rsi,
      atr: indicators.atr,
      bbWidth: indicators.bbWidth,
      ma20Distance: indicators.ma20Distance,
      ma50Distance: indicators.ma50Distance,
      ma200Distance: indicators.ma200Distance,
      macd: indicators.macd,
      timestamp,
      isLive: true
    };
  }

  private normalizeWsTicker(raw: any, marketType: MarketType): MarketTicker {
    const symbol = raw.s;
    const baseAsset = symbol.replace(/USDT$|BUSD$|USDC$/, '') || symbol;
    const quoteAsset = 'USDT';
    const lastPrice = parseFloat(raw.c);
    const priceChangePercent = parseFloat(raw.P);
    const volumeBase = parseFloat(raw.v);
    const volumeQuote = parseFloat(raw.q);
    const high24h = parseFloat(raw.h);
    const low24h = parseFloat(raw.l);

    const markData = this.futuresMarkPrices.get(symbol);
    const markPrice = marketType === 'FUTURES' ? (markData ? markData.markPrice : lastPrice) : undefined;
    const fundingRate = marketType === 'FUTURES' ? (markData ? markData.fundingRate : 0.0001) : undefined;
    const nextFundingTime = marketType === 'FUTURES' ? (markData ? markData.nextFundingTime : undefined) : undefined;

    const timestamp = raw.E || Date.now();
    this.candleEngine.recordPriceUpdate('BINANCE', marketType, symbol, lastPrice, volumeBase, timestamp);

    const indicators = this.candleEngine.computeIndicators('BINANCE', marketType, symbol, lastPrice);
    const timeframeChanges = this.candleEngine.computeTimeframeChanges('BINANCE', marketType, symbol, lastPrice, priceChangePercent);

    return {
      symbol,
      baseAsset,
      quoteAsset,
      exchange: 'BINANCE',
      marketType,
      category: 'CRYPTO',
      lastPrice,
      markPrice,
      percentageChange: priceChangePercent,
      changesByTimeframe: timeframeChanges,
      volumeUsd: volumeQuote,
      volume24h: volumeBase,
      high24h,
      low24h,
      fundingRate,
      nextFundingTime,
      volatility24h: low24h > 0 ? +(((high24h - low24h) / low24h) * 100).toFixed(2) : undefined,
      rsi: indicators.rsi,
      atr: indicators.atr,
      bbWidth: indicators.bbWidth,
      ma20Distance: indicators.ma20Distance,
      ma50Distance: indicators.ma50Distance,
      ma200Distance: indicators.ma200Distance,
      macd: indicators.macd,
      timestamp,
      isLive: true
    };
  }

  private normalizeWsDepth(symbol: string, raw: any, marketType: MarketType): OrderBookSnapshot {
    const bids: OrderBookLevel[] = (raw.bids || raw.b || []).map((b: string[]) => {
      const price = parseFloat(b[0]);
      const amount = parseFloat(b[1]);
      return { price, amount, usdVolume: price * amount };
    }).filter((l: OrderBookLevel) => l.amount > 0 && l.price > 0);

    const asks: OrderBookLevel[] = (raw.asks || raw.a || []).map((a: string[]) => {
      const price = parseFloat(a[0]);
      const amount = parseFloat(a[1]);
      return { price, amount, usdVolume: price * amount };
    }).filter((l: OrderBookLevel) => l.amount > 0 && l.price > 0);

    // Sort: bids descending, asks ascending
    bids.sort((a, b) => b.price - a.price);
    asks.sort((a, b) => a.price - b.price);

    const bestBid = bids[0]?.price || 0;
    const bestAsk = asks[0]?.price || 0;
    const spread = bestAsk > 0 && bestBid > 0 ? +(bestAsk - bestBid).toFixed(4) : 0;
    const spreadPercent = bestBid > 0 ? +((spread / bestBid) * 100).toFixed(4) : 0;

    return {
      symbol,
      exchange: 'BINANCE',
      marketType,
      bids,
      asks,
      spread,
      spreadPercent,
      timestamp: raw.E || Date.now(),
      lastUpdateId: raw.lastUpdateId || raw.u
    };
  }

  private normalizeWsTrade(raw: any, marketType: MarketType): Trade {
    const price = parseFloat(raw.p);
    const amount = parseFloat(raw.q);
    return {
      id: String(raw.t || raw.a || Date.now()),
      symbol: raw.s,
      exchange: 'BINANCE',
      marketType,
      price,
      amount,
      usdVolume: price * amount,
      side: raw.m ? 'SELL' : 'BUY',
      timestamp: raw.T || raw.E || Date.now()
    };
  }

  private reconnectSpotWs(): void {
    if (this.spotWs) {
      this.spotWs.removeAllListeners();
      this.spotWs.close();
      this.spotWs = null;
    }
    this.initSpotWebSocket();
  }

  private reconnectFuturesWs(): void {
    if (this.futuresWs) {
      this.futuresWs.removeAllListeners();
      this.futuresWs.close();
      this.futuresWs = null;
    }
    this.initFuturesWebSocket();
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= 10) return;
    this.reconnectAttempts++;
    const delay = Math.min(this.maxReconnectDelay, 1000 * Math.pow(1.5, this.reconnectAttempts)) + Math.random() * 1000;
    console.log(`[BinanceConnector] Reconnecting in ${(delay / 1000).toFixed(1)}s (attempt ${this.reconnectAttempts})...`);
    setTimeout(() => {
      this.connect();
    }, delay);
  }

  private startHeartbeat(): void {
    if (this.pingInterval) clearInterval(this.pingInterval);
    this.pingInterval = setInterval(() => {
      if (this.spotWs && this.spotWs.readyState === WebSocket.OPEN) {
        const start = Date.now();
        this.spotWs.ping(() => {
          const latency = Date.now() - start;
          this.updateStatus({ pingMs: latency });
        });
      }
    }, 15000);
  }

  private startRestPoller(): void {
    if (this.pollingInterval) clearInterval(this.pollingInterval);
    this.pollingInterval = setInterval(async () => {
      try {
        const premiumRes = await fetch('https://fapi.binance.com/fapi/v1/premiumIndex');
        if (premiumRes.ok) {
          const pData: any[] = await premiumRes.json();
          for (const p of pData) {
            if (this.futuresSubscribedSymbols.has(p.symbol)) {
              this.futuresMarkPrices.set(p.symbol, {
                markPrice: parseFloat(p.markPrice),
                fundingRate: parseFloat(p.lastFundingRate),
                nextFundingTime: p.nextFundingTime
              });
            }
          }
        }
      } catch (e) {
        // quiet fallback
      }
    }, 60000);
  }
}
