import WebSocket from 'ws';
import { ConnectorStatus, ExchangeId, MarketTicker, MarketType, OrderBookLevel, OrderBookSnapshot, Trade } from '../../src/types/index.js';
import { CandleEngine } from '../market-data/CandleEngine.js';
import { BaseExchangeConnector } from './ExchangeConnector.js';

export class BybitConnector extends BaseExchangeConnector {
  public readonly exchangeId: ExchangeId = 'BYBIT';
  public readonly name = 'Bybit (Spot & Linear)';
  public readonly isProductionReady = true;

  private spotWs: WebSocket | null = null;
  private linearWs: WebSocket | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private restPollInterval: NodeJS.Timeout | null = null;
  private candleEngine: CandleEngine;

  private activeSymbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT'];

  constructor() {
    super();
    this.candleEngine = CandleEngine.getInstance();
    this.status = {
      exchange: 'BYBIT',
      name: 'Bybit (Spot & Linear)',
      connected: false,
      status: 'DISCONNECTED',
      pingMs: 0,
      lastMessageAt: 0,
      subscribedSymbolsCount: this.activeSymbols.length * 2,
      isProductionReady: true
    };
  }

  public async connect(): Promise<void> {
    this.updateStatus({ status: 'CONNECTING' });

    try {
      // 1. Initial REST snapshot fetch
      await this.fetchRestSnapshot();

      // 2. Connect WebSockets
      this.initSpotWs();
      this.initLinearWs();

      // 3. Keepalive ping
      this.startPing();

      // 4. Background REST sync
      this.startRestSync();
    } catch (err: any) {
      console.warn('[BybitConnector] Connection issue:', err.message);
      this.updateStatus({ status: 'ERROR', error: err.message });
    }
  }

  public async disconnect(): Promise<void> {
    if (this.pingInterval) clearInterval(this.pingInterval);
    if (this.restPollInterval) clearInterval(this.restPollInterval);

    if (this.spotWs) {
      this.spotWs.removeAllListeners();
      this.spotWs.close();
      this.spotWs = null;
    }

    if (this.linearWs) {
      this.linearWs.removeAllListeners();
      this.linearWs.close();
      this.linearWs = null;
    }

    this.updateStatus({ connected: false, status: 'DISCONNECTED' });
  }

  public subscribeSymbols(symbols: string[], marketType: MarketType): void {
    for (const s of symbols) {
      const upper = s.toUpperCase();
      if (!this.activeSymbols.includes(upper)) {
        this.activeSymbols.push(upper);
      }
    }
    this.updateStatus({ subscribedSymbolsCount: this.activeSymbols.length * 2 });
  }

  public unsubscribeSymbols(symbols: string[], marketType: MarketType): void {}

  private async fetchRestSnapshot(): Promise<void> {
    try {
      // Fetch Spot Tickers
      const spotRes = await fetch('https://api.bybit.com/v5/market/tickers?category=spot', {
        signal: AbortSignal.timeout(3500)
      });
      if (spotRes.ok) {
        const spotJson = await spotRes.json();
        if (spotJson.retCode === 0 && spotJson.result?.list) {
          for (const item of spotJson.result.list) {
            if (this.activeSymbols.includes(item.symbol)) {
              this.handleBybitTicker(item, 'SPOT');
            }
          }
        }
      }

      // Fetch Linear Tickers
      const linearRes = await fetch('https://api.bybit.com/v5/market/tickers?category=linear', {
        signal: AbortSignal.timeout(3500)
      });
      if (linearRes.ok) {
        const linearJson = await linearRes.json();
        if (linearJson.retCode === 0 && linearJson.result?.list) {
          for (const item of linearJson.result.list) {
            if (this.activeSymbols.includes(item.symbol)) {
              this.handleBybitTicker(item, 'FUTURES');
            }
          }
        }
      }

      // Fetch Real Orderbooks for active symbols
      for (const sym of this.activeSymbols) {
        this.fetchOrderBookRest(sym, 'SPOT');
        this.fetchOrderBookRest(sym, 'FUTURES');
      }

      this.updateStatus({ connected: true, status: 'CONNECTED', lastMessageAt: Date.now() });
    } catch (e: any) {
      console.warn('[BybitConnector] REST fetch note:', e.message);
    }
  }

  private async fetchOrderBookRest(symbol: string, marketType: MarketType): Promise<void> {
    try {
      const category = marketType === 'FUTURES' ? 'linear' : 'spot';
      const res = await fetch(`https://api.bybit.com/v5/market/orderbook?category=${category}&symbol=${symbol}&limit=25`, {
        signal: AbortSignal.timeout(3000)
      });
      if (res.ok) {
        const json = await res.json();
        if (json.retCode === 0 && json.result) {
          this.handleBybitOrderBook(json.result, marketType);
        }
      }
    } catch (e) {
      // quiet
    }
  }

  private initSpotWs(): void {
    try {
      this.spotWs = new WebSocket('wss://stream.bybit.com/v5/public/spot');

      this.spotWs.on('open', () => {
        this.updateStatus({ connected: true, status: 'CONNECTED', lastMessageAt: Date.now() });
        const args = [
          ...this.activeSymbols.map(s => `tickers.${s}`),
          ...this.activeSymbols.map(s => `orderbook.25.${s}`)
        ];
        this.spotWs?.send(JSON.stringify({ op: 'subscribe', args }));
      });

      this.spotWs.on('message', (data: WebSocket.Data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.topic?.startsWith('tickers.')) {
            this.handleBybitTicker(msg.data, 'SPOT');
          } else if (msg.topic?.startsWith('orderbook.')) {
            this.handleBybitOrderBook(msg.data, 'SPOT');
          }
        } catch (e) {}
      });

      this.spotWs.on('error', (err) => {
        console.warn('[BybitConnector] Spot WS Error:', err.message);
      });

      this.spotWs.on('close', () => {
        setTimeout(() => {
          if (this.status.status !== 'DISCONNECTED') this.initSpotWs();
        }, 5000);
      });
    } catch (e: any) {
      console.warn('[BybitConnector] Failed to initialize Spot WS:', e.message);
    }
  }

  private initLinearWs(): void {
    try {
      this.linearWs = new WebSocket('wss://stream.bybit.com/v5/public/linear');

      this.linearWs.on('open', () => {
        this.updateStatus({ connected: true, status: 'CONNECTED', lastMessageAt: Date.now() });
        const args = [
          ...this.activeSymbols.map(s => `tickers.${s}`),
          ...this.activeSymbols.map(s => `orderbook.25.${s}`)
        ];
        this.linearWs?.send(JSON.stringify({ op: 'subscribe', args }));
      });

      this.linearWs.on('message', (data: WebSocket.Data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.topic?.startsWith('tickers.')) {
            this.handleBybitTicker(msg.data, 'FUTURES');
          } else if (msg.topic?.startsWith('orderbook.')) {
            this.handleBybitOrderBook(msg.data, 'FUTURES');
          }
        } catch (e) {}
      });

      this.linearWs.on('error', (err) => {
        console.warn('[BybitConnector] Linear WS Error:', err.message);
      });

      this.linearWs.on('close', () => {
        setTimeout(() => {
          if (this.status.status !== 'DISCONNECTED') this.initLinearWs();
        }, 5000);
      });
    } catch (e: any) {
      console.warn('[BybitConnector] Failed to initialize Linear WS:', e.message);
    }
  }

  private handleBybitTicker(raw: any, marketType: MarketType): void {
    const symbol = raw.symbol || raw.s;
    if (!symbol) return;

    const lastPrice = parseFloat(raw.lastPrice || raw.lp || '0');
    if (!lastPrice || isNaN(lastPrice)) return;

    const price24hPcnt = parseFloat(raw.price24hPcnt || '0') * 100;
    const volume24h = parseFloat(raw.volume24h || raw.v || '0');
    const turnover24h = parseFloat(raw.turnover24h || '0');
    const high24h = parseFloat(raw.highPrice24h || raw.h || String(lastPrice));
    const low24h = parseFloat(raw.lowPrice24h || raw.l || String(lastPrice));

    const markPrice = raw.markPrice ? parseFloat(raw.markPrice) : undefined;
    const indexPrice = raw.indexPrice ? parseFloat(raw.indexPrice) : undefined;
    const fundingRate = raw.fundingRate ? parseFloat(raw.fundingRate) : undefined;
    const nextFundingTime = raw.nextFundingTime ? parseInt(raw.nextFundingTime, 10) : undefined;
    const openInterest = raw.openInterestValue ? parseFloat(raw.openInterestValue) : undefined;

    const timestamp = Date.now();
    this.candleEngine.recordPriceUpdate('BYBIT', marketType, symbol, lastPrice, volume24h, timestamp);

    const indicators = this.candleEngine.computeIndicators('BYBIT', marketType, symbol, lastPrice);
    const timeframeChanges = this.candleEngine.computeTimeframeChanges('BYBIT', marketType, symbol, lastPrice, price24hPcnt);

    const ticker: MarketTicker = {
      symbol,
      baseAsset: symbol.replace(/USDT$|USDC$|PERP$/, ''),
      quoteAsset: 'USDT',
      exchange: 'BYBIT',
      marketType,
      category: 'CRYPTO',
      lastPrice,
      markPrice,
      indexPrice,
      percentageChange: +price24hPcnt.toFixed(2),
      changesByTimeframe: timeframeChanges,
      volumeUsd: turnover24h > 0 ? turnover24h : volume24h * lastPrice,
      volume24h,
      high24h,
      low24h,
      fundingRate,
      nextFundingTime,
      openInterest,
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

    this.updateStatus({ lastMessageAt: timestamp });
    this.emitTicker(ticker);
  }

  private handleBybitOrderBook(raw: any, marketType: MarketType): void {
    const symbol = raw.s || raw.symbol;
    if (!symbol) return;

    const bids: OrderBookLevel[] = (raw.b || raw.bids || []).map((b: string[]) => {
      const price = parseFloat(b[0]);
      const amount = parseFloat(b[1]);
      return { price, amount, usdVolume: price * amount };
    }).filter((l: OrderBookLevel) => l.amount > 0);

    const asks: OrderBookLevel[] = (raw.a || raw.asks || []).map((a: string[]) => {
      const price = parseFloat(a[0]);
      const amount = parseFloat(a[1]);
      return { price, amount, usdVolume: price * amount };
    }).filter((l: OrderBookLevel) => l.amount > 0);

    bids.sort((a, b) => b.price - a.price);
    asks.sort((a, b) => a.price - b.price);

    const bestBid = bids[0]?.price || 0;
    const bestAsk = asks[0]?.price || 0;
    const spread = bestAsk > 0 && bestBid > 0 ? +(bestAsk - bestBid).toFixed(4) : 0;
    const spreadPercent = bestBid > 0 ? +((spread / bestBid) * 100).toFixed(4) : 0;

    const snapshot: OrderBookSnapshot = {
      symbol,
      exchange: 'BYBIT',
      marketType,
      bids,
      asks,
      spread,
      spreadPercent,
      timestamp: raw.ts || Date.now(),
      lastUpdateId: raw.u || raw.seq
    };

    this.emitOrderBook(snapshot);
  }

  private startPing(): void {
    if (this.pingInterval) clearInterval(this.pingInterval);
    this.pingInterval = setInterval(() => {
      if (this.spotWs && this.spotWs.readyState === WebSocket.OPEN) {
        this.spotWs.send(JSON.stringify({ op: 'ping' }));
      }
      if (this.linearWs && this.linearWs.readyState === WebSocket.OPEN) {
        this.linearWs.send(JSON.stringify({ op: 'ping' }));
      }
    }, 20000);
  }

  private startRestSync(): void {
    if (this.restPollInterval) clearInterval(this.restPollInterval);
    this.restPollInterval = setInterval(() => {
      this.fetchRestSnapshot();
    }, 15000);
  }
}

export class GenericExchangeAdapter extends BaseExchangeConnector {
  public readonly exchangeId: ExchangeId;
  public readonly name: string;
  public readonly isProductionReady = false;

  constructor(exchangeId: ExchangeId, name: string) {
    super();
    this.exchangeId = exchangeId;
    this.name = name;
    this.status = {
      exchange: exchangeId,
      name,
      connected: false,
      status: 'UNIMPLEMENTED',
      pingMs: 0,
      lastMessageAt: 0,
      subscribedSymbolsCount: 0,
      error: 'Connector adapter template ready. Requires exchange API credentials in Settings.',
      isProductionReady: false
    };
  }

  public async connect(): Promise<void> {
    this.updateStatus({ status: 'UNIMPLEMENTED', error: 'Awaiting credentials' });
  }

  public async disconnect(): Promise<void> {
    this.updateStatus({ status: 'DISCONNECTED' });
  }

  public subscribeSymbols(symbols: string[], marketType: MarketType): void {}
  public unsubscribeSymbols(symbols: string[], marketType: MarketType): void {}
}

export class StockExchangeConnector extends BaseExchangeConnector {
  public readonly exchangeId: ExchangeId = 'STOCK_EXCHANGE';
  public readonly name = 'Stock Markets (NASDAQ / NYSE)';
  public readonly isProductionReady = false;

  constructor() {
    super();
    this.status = {
      exchange: 'STOCK_EXCHANGE',
      name: 'US Equities (NASDAQ / NYSE)',
      connected: false,
      status: 'NOT_CONFIGURED',
      pingMs: 0,
      lastMessageAt: 0,
      subscribedSymbolsCount: 0,
      error: 'Real stock market data API key (e.g. Finnhub / Polygon) required in environment. Synthetic stock data is strictly disabled.',
      isProductionReady: false
    };
  }

  public async connect(): Promise<void> {
    // If a live stock API key is available in environment, we would connect here.
    // Otherwise, we strictly keep the status as NOT_CONFIGURED and emit NO fake data.
    const hasFinnhubKey = !!process.env.FINNHUB_API_KEY;
    const hasPolygonKey = !!process.env.POLYGON_API_KEY;

    if (!hasFinnhubKey && !hasPolygonKey) {
      this.updateStatus({
        connected: false,
        status: 'NOT_CONFIGURED',
        error: 'Stock Data Provider Key required in settings. Synthetic stock data is disabled.'
      });
      return;
    }
  }

  public async disconnect(): Promise<void> {
    this.updateStatus({ connected: false, status: 'DISCONNECTED' });
  }

  public subscribeSymbols(symbols: string[], marketType: MarketType): void {}
  public unsubscribeSymbols(symbols: string[], marketType: MarketType): void {}
}
