import WebSocket from 'ws';
import { ConnectorStatus, ExchangeId, MarketTicker, MarketType, OrderBookLevel, OrderBookSnapshot, Trade } from '../../types/index.js';
import { CandleEngine } from '../market-data/CandleEngine.js';
import { BaseExchangeConnector } from './ExchangeConnector.js';

//  bybit connector
export class BybitConnector extends BaseExchangeConnector {
  // Exchange id property
  public readonly exchangeId: ExchangeId = 'BYBIT';
  // Name property
  public readonly name = 'Bybit (Spot & Linear)';
  // Is production ready property
  public readonly isProductionReady = true;

  // Spot ws property
  private spotWs: WebSocket | null = null;
  // Linear ws property
  private linearWs: WebSocket | null = null;
  // Ping interval property
  private pingInterval: NodeJS.Timeout | null = null;
  // Rest poll interval property
  private restPollInterval: NodeJS.Timeout | null = null;
  // Candle engine property
  private candleEngine: CandleEngine;

  // Active symbols property
  private activeSymbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT'];

  // Local per-symbol order book. Full snapshots replace the entry; Binance-style
  // depthUpdate events mutate it so emitted snapshots always contain both sides.
  // Order book cache property
  private orderBookCache = new Map<string, { bids: Map<number, number>; asks: Map<number, number> }>();
  // Reconnect attempts spot property
  private reconnectAttemptsSpot = 0;
  // Reconnect attempts linear property
  private reconnectAttemptsLinear = 0;
  // Max reconnect attempts property
  private maxReconnectAttempts = 10;
  // Reconnect timer spot property
  private reconnectTimerSpot: NodeJS.Timeout | null = null;
  // Reconnect timer linear property
  private reconnectTimerLinear: NodeJS.Timeout | null = null;

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

  // Connect
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

  // Disconnect
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

  // Subscribe symbols
  public subscribeSymbols(symbols: string[], marketType: MarketType): void {
    for (const s of symbols) {
      const upper = s.toUpperCase();
      if (!this.activeSymbols.includes(upper)) {
        this.activeSymbols.push(upper);
      }
    }
    this.updateStatus({ subscribedSymbolsCount: this.activeSymbols.length * 2 });
  }

  // Unsubscribe symbols
  public unsubscribeSymbols(symbols: string[], marketType: MarketType): void {}

  // Fetch rest snapshot
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

  // Fetch order book rest
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

  // Init spot ws
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

  // Init linear ws
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

  // Handle bybit ticker
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

  // Handle bybit order book
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

  // Start ping
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

  // Start rest sync
  private startRestSync(): void {
    if (this.restPollInterval) clearInterval(this.restPollInterval);
    this.restPollInterval = setInterval(() => {
      this.fetchRestSnapshot();
    }, 15000);
  }
}

//  o k x connector
export class OKXConnector extends BaseExchangeConnector {
  // Exchange id property
  public readonly exchangeId: ExchangeId = 'OKX';
  // Name property
  public readonly name = 'OKX (Spot & Futures)';
  // Is production ready property
  public readonly isProductionReady = true;

  // Ws property
  private ws: WebSocket | null = null;
  // Ping interval property
  private pingInterval: NodeJS.Timeout | null = null;
  // Rest poll interval property
  private restPollInterval: NodeJS.Timeout | null = null;
  // Candle engine property
  private candleEngine: CandleEngine;

  // Active symbols property
  private activeSymbols = ['BTC-USDT', 'ETH-USDT', 'SOL-USDT', 'XRP-USDT'];

  constructor() {
    super();
    this.candleEngine = CandleEngine.getInstance();
    this.status = {
      exchange: 'OKX',
      name: 'OKX (Spot & Futures)',
      connected: false,
      status: 'DISCONNECTED',
      pingMs: 0,
      lastMessageAt: 0,
      subscribedSymbolsCount: this.activeSymbols.length,
      isProductionReady: true
    };
  }

  // Connect
  public async connect(): Promise<void> {
    this.updateStatus({ status: 'CONNECTING' });

    try {
      // 1. Initial REST snapshot fetch
      await this.fetchRestSnapshot();

      // 2. Connect WebSocket
      this.initWs();

      // 3. Keepalive ping
      this.startPing();

      // 4. Background REST sync
      this.startRestSync();
    } catch (err: any) {
      console.warn('[OKXConnector] Connection issue:', err.message);
      this.updateStatus({ status: 'ERROR', error: err.message });
    }
  }

  // Disconnect
  public async disconnect(): Promise<void> {
    if (this.pingInterval) clearInterval(this.pingInterval);
    if (this.restPollInterval) clearInterval(this.restPollInterval);

    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws.close();
      this.ws = null;
    }

    this.updateStatus({ connected: false, status: 'DISCONNECTED' });
  }

  // Subscribe symbols
  public subscribeSymbols(symbols: string[], marketType: MarketType): void {
    for (const s of symbols) {
      // Convert to OKX format (replace underscores with dashes, ensure uppercase)
      const okxSym = s.toUpperCase().replace(/_/g, '-');
      if (!this.activeSymbols.includes(okxSym)) {
        this.activeSymbols.push(okxSym);
      }
    }
    this.updateStatus({ subscribedSymbolsCount: this.activeSymbols.length });
  }

  // Unsubscribe symbols
  public unsubscribeSymbols(symbols: string[], marketType: MarketType): void {
    const keep = new Set(symbols.map(s => s.toUpperCase().replace(/_/g, '-')));
    this.activeSymbols = this.activeSymbols.filter(s => !keep.has(s));
    this.updateStatus({ subscribedSymbolsCount: this.activeSymbols.length });
  }

  // Fetch rest snapshot
  private async fetchRestSnapshot(): Promise<void> {
    try {
      // Fetch all Spot tickers
      const res = await fetch('https://www.okx.com/api/v5/market/tickers?instType=SPOT', {
        signal: AbortSignal.timeout(3500)
      });
      if (res.ok) {
        const json = await res.json();
        if (json.code === '0' && Array.isArray(json.data)) {
          for (const item of json.data) {
            if (this.activeSymbols.includes(item.instId)) {
              this.handleOkxTicker(item, 'SPOT');
            }
          }
        }
      }

      // Fetch orderbooks for active symbols
      for (const sym of this.activeSymbols) {
        await this.fetchOrderBookRest(sym);
      }

      this.updateStatus({ connected: true, status: 'CONNECTED', lastMessageAt: Date.now() });
    } catch (e: any) {
      console.warn('[OKXConnector] REST fetch note:', e.message);
    }
  }

  // Fetch order book rest
  private async fetchOrderBookRest(symbol: string): Promise<void> {
    try {
      const res = await fetch(
        `https://www.okx.com/api/v5/market/books?instId=${symbol}&sz=5`,
        { signal: AbortSignal.timeout(3000) }
      );
      if (res.ok) {
        const json = await res.json();
        if (json.code === '0' && Array.isArray(json.data) && json.data.length > 0) {
          this.handleOkxOrderBook(json.data[0], symbol);
        }
      }
    } catch (e) {
      // quiet
    }
  }

  // Init ws
  private initWs(): void {
    try {
      this.ws = new WebSocket('wss://ws.okx.com:8443/ws/v5/public');

      this.ws.on('open', () => {
        this.updateStatus({ connected: true, status: 'CONNECTED', lastMessageAt: Date.now() });
        const args = [
          ...this.activeSymbols.map(s => ({ channel: 'tickers', instId: s })),
          ...this.activeSymbols.map(s => ({ channel: 'books5', instId: s }))
        ];
        this.ws?.send(JSON.stringify({ op: 'subscribe', args }));
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        try {
          const msg = JSON.parse(data.toString());

          // Handle pong
          if (msg.event === 'pong' || msg.op === 'pong') return;

          // Handle subscription response
          if (msg.event === 'subscribe') return;

          const arg = msg.arg;
          if (!arg) return;

          const channel = arg.channel;
          const rawData = msg.data;
          if (!Array.isArray(rawData) || rawData.length === 0) return;

          if (channel === 'tickers') {
            this.handleOkxTicker(rawData[0], 'SPOT');
          } else if (channel === 'books5') {
            this.handleOkxOrderBook(rawData[0], arg.instId);
          }
        } catch (e) {}
      });

      this.ws.on('error', (err) => {
        console.warn('[OKXConnector] WS Error:', err.message);
      });

      this.ws.on('close', () => {
        setTimeout(() => {
          if (this.status.status !== 'DISCONNECTED') this.initWs();
        }, 5000);
      });
    } catch (e: any) {
      console.warn('[OKXConnector] Failed to initialize WS:', e.message);
    }
  }

  // Handle okx ticker
  private handleOkxTicker(raw: any, marketType: MarketType): void {
    const symbol = raw.instId;
    if (!symbol) return;

    const lastPrice = parseFloat(raw.last || '0');
    if (!lastPrice || isNaN(lastPrice)) return;

    const open24h = parseFloat(raw.open24h || '0');
    const price24hPcnt = open24h > 0 ? +(((lastPrice - open24h) / open24h) * 100).toFixed(2) : 0;
    const volume24h = parseFloat(raw.vol24h || '0');
    const volCcy24h = parseFloat(raw.volCcy24h || '0');
    const high24h = parseFloat(raw.high24h || String(lastPrice));
    const low24h = parseFloat(raw.low24h || String(lastPrice));

    const timestamp = raw.ts ? parseInt(raw.ts, 10) : Date.now();
    this.candleEngine.recordPriceUpdate('OKX', marketType, symbol, lastPrice, volume24h, timestamp);

    const indicators = this.candleEngine.computeIndicators('OKX', marketType, symbol, lastPrice);
    const timeframeChanges = this.candleEngine.computeTimeframeChanges('OKX', marketType, symbol, lastPrice, price24hPcnt);

    const baseAsset = symbol.includes('-') ? symbol.split('-')[0] : symbol.replace(/USDT$|USDC$|PERP$/, '');

    const ticker: MarketTicker = {
      symbol,
      baseAsset,
      quoteAsset: 'USDT',
      exchange: 'OKX',
      marketType,
      category: 'CRYPTO',
      lastPrice,
      percentageChange: price24hPcnt,
      changesByTimeframe: timeframeChanges,
      volumeUsd: volCcy24h > 0 ? volCcy24h : volume24h * lastPrice,
      volume24h,
      high24h,
      low24h,
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

  // Handle okx order book
  private handleOkxOrderBook(raw: any, symbol: string): void {
    const bids: OrderBookLevel[] = (raw.bids || []).map((b: string[]) => {
      const price = parseFloat(b[0]);
      const amount = parseFloat(b[1]);
      return { price, amount, usdVolume: price * amount };
    }).filter((l: OrderBookLevel) => l.amount > 0);

    const asks: OrderBookLevel[] = (raw.asks || []).map((a: string[]) => {
      const price = parseFloat(a[0]);
      const amount = parseFloat(a[1]);
      return { price, amount, usdVolume: price * amount };
    }).filter((l: OrderBookLevel) => l.amount > 0);

    bids.sort((a, b) => b.price - a.price);
    asks.sort((a, b) => a.price - b.price);

    const bestBid = bids[0]?.price || 0;
    const bestAsk = asks[0]?.price || 0;
    const spread = bestAsk > 0 && bestBid > 0 ? +(bestAsk - bestBid).toFixed(8) : 0;
    const spreadPercent = bestBid > 0 ? +((spread / bestBid) * 100).toFixed(6) : 0;

    const snapshot: OrderBookSnapshot = {
      symbol,
      exchange: 'OKX',
      marketType: 'SPOT',
      bids,
      asks,
      spread,
      spreadPercent,
      timestamp: raw.ts ? parseInt(raw.ts, 10) : Date.now(),
      lastUpdateId: 0
    };

    this.emitOrderBook(snapshot);
  }

  // Start ping
  private startPing(): void {
    if (this.pingInterval) clearInterval(this.pingInterval);
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ op: 'ping' }));
      }
    }, 20000);
  }

  // Start rest sync
  private startRestSync(): void {
    if (this.restPollInterval) clearInterval(this.restPollInterval);
    this.restPollInterval = setInterval(() => {
      this.fetchRestSnapshot();
    }, 15000);
  }
}

//  m e x c connector
export class MEXCConnector extends BaseExchangeConnector {
  // Exchange id property
  public readonly exchangeId: ExchangeId = 'MEXC';
  // Name property
  public readonly name = 'MEXC Global';
  // Is production ready property
  public readonly isProductionReady = true;

  // Ws property
  private ws: WebSocket | null = null;
  // Ping interval property
  private pingInterval: NodeJS.Timeout | null = null;
  // Rest poll interval property
  private restPollInterval: NodeJS.Timeout | null = null;
  // Candle engine property
  private candleEngine: CandleEngine;

  // Active symbols property
  private activeSymbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT'];

  constructor() {
    super();
    this.candleEngine = CandleEngine.getInstance();
    this.status = {
      exchange: 'MEXC',
      name: 'MEXC Global',
      connected: false,
      status: 'DISCONNECTED',
      pingMs: 0,
      lastMessageAt: 0,
      subscribedSymbolsCount: this.activeSymbols.length,
      isProductionReady: true
    };
  }

  // Connect
  public async connect(): Promise<void> {
    this.updateStatus({ status: 'CONNECTING' });

    try {
      // 1. Initial REST snapshot fetch
      await this.fetchRestSnapshot();

      // 2. Connect WebSocket
      this.initWs();

      // 3. Keepalive ping
      this.startPing();

      // 4. Background REST sync
      this.startRestSync();
    } catch (err: any) {
      console.warn('[MEXCConnector] Connection issue:', err.message);
      this.updateStatus({ status: 'ERROR', error: err.message });
    }
  }

  // Disconnect
  public async disconnect(): Promise<void> {
    if (this.pingInterval) clearInterval(this.pingInterval);
    if (this.restPollInterval) clearInterval(this.restPollInterval);

    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws.close();
      this.ws = null;
    }

    this.updateStatus({ connected: false, status: 'DISCONNECTED' });
  }

  // Subscribe symbols
  public subscribeSymbols(symbols: string[], marketType: MarketType): void {
    for (const s of symbols) {
      const upper = s.toUpperCase().replace(/-/g, '');
      if (!this.activeSymbols.includes(upper)) {
        this.activeSymbols.push(upper);
      }
    }
    this.updateStatus({ subscribedSymbolsCount: this.activeSymbols.length });
  }

  // Unsubscribe symbols
  public unsubscribeSymbols(symbols: string[], marketType: MarketType): void {
    const keep = new Set(symbols.map(s => s.toUpperCase().replace(/-/g, '')));
    this.activeSymbols = this.activeSymbols.filter(s => !keep.has(s));
    this.updateStatus({ subscribedSymbolsCount: this.activeSymbols.length });
  }

  // Fetch rest snapshot
  private async fetchRestSnapshot(): Promise<void> {
    try {
      // Fetch all Spot 24hr tickers
      const res = await fetch('https://api.mexc.com/api/v3/ticker/24hr', {
        signal: AbortSignal.timeout(3500)
      });
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json)) {
          for (const item of json) {
            if (this.activeSymbols.includes(item.symbol)) {
              this.handleMexcTicker(item);
            }
          }
        }
      }

      // Fetch orderbooks for active symbols
      for (const sym of this.activeSymbols) {
        await this.fetchOrderBookRest(sym);
      }

      this.updateStatus({ connected: true, status: 'CONNECTED', lastMessageAt: Date.now() });
    } catch (e: any) {
      console.warn('[MEXCConnector] REST fetch note:', e.message);
    }
  }

  // Fetch order book rest
  private async fetchOrderBookRest(symbol: string): Promise<void> {
    try {
      const res = await fetch(
        `https://api.mexc.com/api/v3/depth?symbol=${symbol}&limit=5`,
        { signal: AbortSignal.timeout(3000) }
      );
      if (res.ok) {
        const json = await res.json();
        if (json && Array.isArray(json.bids) && Array.isArray(json.asks)) {
          this.handleMexcOrderBook(json, symbol);
        }
      }
    } catch (e) {
      // quiet
    }
  }

  // Init ws
  private initWs(): void {
    try {
      this.ws = new WebSocket('wss://wbs.mexc.com/ws');

      this.ws.on('open', () => {
        this.updateStatus({ connected: true, status: 'CONNECTED', lastMessageAt: Date.now() });
        const params = [
          ...this.activeSymbols.map(s => `spot@public.ticker.v3.api@${s}`),
          ...this.activeSymbols.map(s => `spot@public.limit.depth.v3.api@${s}@5`)
        ];
        this.ws?.send(JSON.stringify({ method: 'SUBSCRIPTION', params, id: 1 }));
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        try {
          const msg = JSON.parse(data.toString());

          // Server sends PING — respond with PONG to keep alive
          if (msg.method === 'PING') {
            this.ws?.send(JSON.stringify({ method: 'PONG' }));
            return;
          }

          // Subscription ack — ignore
          if (msg.id !== undefined && msg.code !== undefined && msg.msg !== undefined) return;

          const channel = msg.c;
          const d = msg.d;
          if (!channel || !d) return;

          if (channel.includes('ticker')) {
            this.handleMexcTicker(d);
          } else if (channel.includes('depth')) {
            const symbol = d.s;
            if (symbol) this.handleMexcOrderBook(d, symbol);
          }
        } catch (e) {}
      });

      this.ws.on('error', (err) => {
        console.warn('[MEXCConnector] WS Error:', err.message);
      });

      this.ws.on('close', () => {
        setTimeout(() => {
          if (this.status.status !== 'DISCONNECTED') this.initWs();
        }, 5000);
      });
    } catch (e: any) {
      console.warn('[MEXCConnector] Failed to initialize WS:', e.message);
    }
  }

  // Handle mexc ticker
  private handleMexcTicker(raw: any, marketType: MarketType = 'SPOT'): void {
    const symbol = raw.s || raw.symbol;
    if (!symbol) return;

    const lastPrice = parseFloat(raw.c || raw.lastPrice || '0');
    if (!lastPrice || isNaN(lastPrice)) return;

    const open24h = parseFloat(raw.o || raw.openPrice || '0');
    const price24hPcnt = open24h > 0 ? +(((lastPrice - open24h) / open24h) * 100).toFixed(2) : 0;
    const volume24h = parseFloat(raw.v || raw.volume || '0');
    const quoteVolume = parseFloat(raw.V || raw.quoteVolume || '0');
    const high24h = parseFloat(raw.h || raw.highPrice || String(lastPrice));
    const low24h = parseFloat(raw.l || raw.lowPrice || String(lastPrice));

    const timestamp = raw.t ? parseInt(raw.t, 10) : Date.now();
    this.candleEngine.recordPriceUpdate('MEXC', marketType, symbol, lastPrice, volume24h, timestamp);

    const indicators = this.candleEngine.computeIndicators('MEXC', marketType, symbol, lastPrice);
    const timeframeChanges = this.candleEngine.computeTimeframeChanges('MEXC', marketType, symbol, lastPrice, price24hPcnt);

    const baseAsset = symbol.replace(/USDT$|USDC$|PERP$/, '');

    const ticker: MarketTicker = {
      symbol,
      baseAsset,
      quoteAsset: 'USDT',
      exchange: 'MEXC',
      marketType,
      category: 'CRYPTO',
      lastPrice,
      percentageChange: price24hPcnt,
      changesByTimeframe: timeframeChanges,
      volumeUsd: quoteVolume > 0 ? quoteVolume : volume24h * lastPrice,
      volume24h,
      high24h,
      low24h,
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

  // Handle mexc order book
  private handleMexcOrderBook(raw: any, symbol: string): void {
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
    const spread = bestAsk > 0 && bestBid > 0 ? +(bestAsk - bestBid).toFixed(8) : 0;
    const spreadPercent = bestBid > 0 ? +((spread / bestBid) * 100).toFixed(6) : 0;

    const snapshot: OrderBookSnapshot = {
      symbol,
      exchange: 'MEXC',
      marketType: 'SPOT',
      bids,
      asks,
      spread,
      spreadPercent,
      timestamp: raw.t ? parseInt(raw.t, 10) : Date.now(),
      lastUpdateId: 0
    };

    this.emitOrderBook(snapshot);
  }

  // Start ping
  private startPing(): void {
    if (this.pingInterval) clearInterval(this.pingInterval);
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ method: 'PING' }));
      }
    }, 15000);
  }

  // Start rest sync
  private startRestSync(): void {
    if (this.restPollInterval) clearInterval(this.restPollInterval);
    this.restPollInterval = setInterval(() => {
      this.fetchRestSnapshot();
    }, 15000);
  }
}

// ====================================================================
// GATE.IO CONNECTOR (Spot) — WebSocket v4 + REST fallback
// WS: wss://api.gateio.ws/ws/v4/  | Symbol: BTC_USDT
// ====================================================================
//  gate connector
export class GateConnector extends BaseExchangeConnector {
  // Exchange id property
  public readonly exchangeId: ExchangeId = 'GATE';
  // Name property
  public readonly name = 'Gate.io';
  // Is production ready property
  public readonly isProductionReady = true;

  // Ws property
  private ws: WebSocket | null = null;
  // Ping interval property
  private pingInterval: NodeJS.Timeout | null = null;
  // Rest poll interval property
  private restPollInterval: NodeJS.Timeout | null = null;
  // Candle engine property
  private candleEngine: CandleEngine;

  // Active symbols property
  private activeSymbols = ['BTC_USDT', 'ETH_USDT', 'SOL_USDT', 'XRP_USDT'];

  constructor() {
    super();
    this.candleEngine = CandleEngine.getInstance();
    this.status = {
      exchange: 'GATE', name: 'Gate.io', connected: false, status: 'DISCONNECTED',
      pingMs: 0, lastMessageAt: 0, subscribedSymbolsCount: this.activeSymbols.length, isProductionReady: true
    };
  }

  // Connect
  public async connect(): Promise<void> {
    this.updateStatus({ status: 'CONNECTING' });
    try {
      await this.fetchRestSnapshot();
      this.initWs();
      this.startPing();
      this.startRestSync();
    } catch (err: any) {
      console.warn('[GateConnector] Connection issue:', err.message);
      this.updateStatus({ status: 'ERROR', error: err.message });
    }
  }

  // Disconnect
  public async disconnect(): Promise<void> {
    if (this.pingInterval) clearInterval(this.pingInterval);
    if (this.restPollInterval) clearInterval(this.restPollInterval);
    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws.close();
      this.ws = null;
    }
    this.updateStatus({ connected: false, status: 'DISCONNECTED' });
  }

  // Subscribe symbols
  public subscribeSymbols(symbols: string[], marketType: MarketType): void {
    for (const s of symbols) {
      const gated = s.toUpperCase().replace(/USDT$/, '_USDT');
      if (!this.activeSymbols.includes(gated)) this.activeSymbols.push(gated);
    }
    this.updateStatus({ subscribedSymbolsCount: this.activeSymbols.length });
  }

  // Unsubscribe symbols
  public unsubscribeSymbols(symbols: string[], marketType: MarketType): void {
    const keep = new Set(symbols.map(s => s.toUpperCase().replace(/USDT$/, '_USDT')));
    this.activeSymbols = this.activeSymbols.filter(s => !keep.has(s));
    this.updateStatus({ subscribedSymbolsCount: this.activeSymbols.length });
  }

  // Fetch rest snapshot
  private async fetchRestSnapshot(): Promise<void> {
    try {
      const res = await fetch('https://api.gateio.ws/api/v4/spot/tickers', { signal: AbortSignal.timeout(6000) });
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json)) {
          for (const item of json) {
            if (this.activeSymbols.includes(item.currency_pair)) this.handleGateTicker(item);
          }
        }
      }
      for (const sym of this.activeSymbols) {
        await this.fetchOrderBookRest(sym);
      }
      this.updateStatus({ connected: true, status: 'CONNECTED', lastMessageAt: Date.now() });
    } catch (e: any) {
      console.warn('[GateConnector] REST fetch note:', e.message);
    }
  }

  // Fetch order book rest
  private async fetchOrderBookRest(symbol: string): Promise<void> {
    try {
      const res = await fetch(
        `https://api.gateio.ws/api/v4/spot/order_book?currency_pair=${symbol}&limit=5`,
        { signal: AbortSignal.timeout(3000) }
      );
      if (res.ok) {
        const json = await res.json();
        if (json && Array.isArray(json.bids) && Array.isArray(json.asks)) {
          this.handleGateOrderBook({ ...json, s: symbol }, symbol);
        }
      }
    } catch (e) {}
  }

  // Init ws
  private initWs(): void {
    try {
      this.ws = new WebSocket('wss://api.gateio.ws/ws/v4/');
      this.ws.on('open', () => {
        this.updateStatus({ connected: true, status: 'CONNECTED', lastMessageAt: Date.now() });
        const time = Math.floor(Date.now() / 1000);
        this.ws?.send(JSON.stringify({ time, channel: 'spot.tickers', event: 'subscribe', payload: this.activeSymbols }));
        this.ws?.send(JSON.stringify({ time, channel: 'spot.order_book', event: 'subscribe', payload: this.activeSymbols.map(s => [s, '5', '100ms'].join(',')) }));
      });
      this.ws.on('message', (data: WebSocket.Data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.channel === 'spot.pong') return;
          if (msg.event !== 'update' || !msg.result) return;
          if (msg.channel === 'spot.tickers') {
            // Gate.io sends a single ticker object per update (not an array).
            this.handleGateTicker(msg.result);
          } else if (msg.channel === 'spot.order_book') {
            this.handleGateOrderBook(msg.result, msg.result.s || msg.result.currency_pair);
          }
        } catch (e) {}
      });
      this.ws.on('error', (err) => console.warn('[GateConnector] WS Error:', err.message));
      this.ws.on('close', () => {
        setTimeout(() => { if (this.status.status !== 'DISCONNECTED') this.initWs(); }, 5000);
      });
    } catch (e: any) {
      console.warn('[GateConnector] Failed to initialize WS:', e.message);
    }
  }

  // Handle gate ticker
  private handleGateTicker(raw: any): void {
    const symbol = raw.currency_pair;
    if (!symbol || !this.activeSymbols.includes(symbol)) return;
    const lastPrice = parseFloat(raw.last || '0');
    if (!lastPrice || isNaN(lastPrice)) return;
    const changePercent = parseFloat(raw.change_percentage || '0');
    const baseVolume = parseFloat(raw.base_volume || '0');
    const quoteVolume = parseFloat(raw.quote_volume || '0');
    const high24h = parseFloat(raw.high_24h || String(lastPrice));
    const low24h = parseFloat(raw.low_24h || String(lastPrice));
    const timestamp = Date.now();

    this.candleEngine.recordPriceUpdate('GATE', 'SPOT', symbol, lastPrice, baseVolume, timestamp);
    const indicators = this.candleEngine.computeIndicators('GATE', 'SPOT', symbol, lastPrice);
    const timeframeChanges = this.candleEngine.computeTimeframeChanges('GATE', 'SPOT', symbol, lastPrice, changePercent);

    const ticker: MarketTicker = {
      symbol,
      baseAsset: symbol.split('_')[0],
      quoteAsset: symbol.split('_')[1] || 'USDT',
      exchange: 'GATE',
      marketType: 'SPOT',
      category: 'CRYPTO',
      lastPrice,
      percentageChange: changePercent,
      changesByTimeframe: timeframeChanges,
      volumeUsd: quoteVolume > 0 ? quoteVolume : baseVolume * lastPrice,
      volume24h: baseVolume,
      high24h,
      low24h,
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

  // Handle gate order book
  private handleGateOrderBook(raw: any, symbol: string): void {
    if (!symbol || !this.activeSymbols.includes(symbol)) return;
    const mapLevels = (arr: any[]): OrderBookLevel[] =>
      (arr || []).map((b: string[]) => {
        const price = parseFloat(b[0]);
        const amount = parseFloat(b[1]);
        return { price, amount, usdVolume: price * amount };
      }).filter((l: OrderBookLevel) => l.amount > 0);

    const bids = mapLevels(raw.bids);
    const asks = mapLevels(raw.asks);
    bids.sort((a, b) => b.price - a.price);
    asks.sort((a, b) => a.price - b.price);

    const bestBid = bids[0]?.price || 0;
    const bestAsk = asks[0]?.price || 0;
    const spread = bestAsk > 0 && bestBid > 0 ? +(bestAsk - bestBid).toFixed(8) : 0;
    const spreadPercent = bestBid > 0 ? +((spread / bestBid) * 100).toFixed(6) : 0;

    const snapshot: OrderBookSnapshot = {
      symbol, exchange: 'GATE', marketType: 'SPOT', bids, asks, spread, spreadPercent,
      timestamp: raw.t || Date.now(), lastUpdateId: 0
    };
    this.emitOrderBook(snapshot);
  }

  // Start ping
  private startPing(): void {
    if (this.pingInterval) clearInterval(this.pingInterval);
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ time: Math.floor(Date.now() / 1000), channel: 'spot.ping' }));
      }
    }, 15000);
  }

  // Start rest sync
  private startRestSync(): void {
    if (this.restPollInterval) clearInterval(this.restPollInterval);
    this.restPollInterval = setInterval(() => { this.fetchRestSnapshot(); }, 15000);
  }
}

//  bitget connector
export class BitgetConnector extends BaseExchangeConnector {
  // Exchange id property
  public readonly exchangeId: ExchangeId = 'BITGET';
  // Name property
  public readonly name = 'Bitget';
  // Is production ready property
  public readonly isProductionReady = true;

  // Ws property
  private ws: WebSocket | null = null;
  // Ping interval property
  private pingInterval: NodeJS.Timeout | null = null;
  // Rest poll interval property
  private restPollInterval: NodeJS.Timeout | null = null;
  // Candle engine property
  private candleEngine: CandleEngine;

  // Active symbols property
  private activeSymbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT'];

  constructor() {
    super();
    this.candleEngine = CandleEngine.getInstance();
    this.status = {
      exchange: 'BITGET', name: 'Bitget', connected: false, status: 'DISCONNECTED',
      pingMs: 0, lastMessageAt: 0, subscribedSymbolsCount: this.activeSymbols.length, isProductionReady: true
    };
  }

  // Connect
  public async connect(): Promise<void> {
    this.updateStatus({ status: 'CONNECTING' });
    try {
      await this.fetchRestSnapshot();
      this.initWs();
      this.startPing();
      this.startRestSync();
    } catch (err: any) {
      console.warn('[BitgetConnector] Connection issue:', err.message);
      this.updateStatus({ status: 'ERROR', error: err.message });
    }
  }

  // Disconnect
  public async disconnect(): Promise<void> {
    if (this.pingInterval) clearInterval(this.pingInterval);
    if (this.restPollInterval) clearInterval(this.restPollInterval);
    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws.close();
      this.ws = null;
    }
    this.updateStatus({ connected: false, status: 'DISCONNECTED' });
  }

  // Subscribe symbols
  public subscribeSymbols(symbols: string[], marketType: MarketType): void {
    for (const s of symbols) {
      const upper = s.toUpperCase().replace(/-/g, '');
      if (!this.activeSymbols.includes(upper)) this.activeSymbols.push(upper);
    }
    this.updateStatus({ subscribedSymbolsCount: this.activeSymbols.length });
  }

  // Unsubscribe symbols
  public unsubscribeSymbols(symbols: string[], marketType: MarketType): void {
    const keep = new Set(symbols.map(s => s.toUpperCase().replace(/-/g, '')));
    this.activeSymbols = this.activeSymbols.filter(s => !keep.has(s));
    this.updateStatus({ subscribedSymbolsCount: this.activeSymbols.length });
  }

  // Fetch rest snapshot
  private async fetchRestSnapshot(): Promise<void> {
    try {
      const res = await fetch('https://api.bitget.com/api/v2/spot/market/tickers', { signal: AbortSignal.timeout(3500) });
      if (res.ok) {
        const json = await res.json();
        if (json && json.code === '00000' && Array.isArray(json.data)) {
          for (const item of json.data) {
            if (this.activeSymbols.includes(item.symbol)) this.handleBitgetTicker(item);
          }
        }
      }
      for (const sym of this.activeSymbols) {
        await this.fetchOrderBookRest(sym);
      }
      this.updateStatus({ connected: true, status: 'CONNECTED', lastMessageAt: Date.now() });
    } catch (e: any) {
      console.warn('[BitgetConnector] REST fetch note:', e.message);
    }
  }

  // Fetch order book rest
  private async fetchOrderBookRest(symbol: string): Promise<void> {
    try {
      const res = await fetch(
        `https://api.bitget.com/api/v2/spot/market/orderbook?symbol=${symbol}&limit=5`,
        { signal: AbortSignal.timeout(3000) }
      );
      if (res.ok) {
        const json = await res.json();
        if (json && json.code === '00000' && json.data && Array.isArray(json.data.bids) && Array.isArray(json.data.asks)) {
          this.handleBitgetOrderBook(json.data, symbol);
        }
      }
    } catch (e) {}
  }

  // Init ws
  private initWs(): void {
    try {
      this.ws = new WebSocket('wss://ws.bitget.com/v2/ws/public');
      this.ws.on('open', () => {
        this.updateStatus({ connected: true, status: 'CONNECTED', lastMessageAt: Date.now() });
        const args: any[] = [];
        for (const s of this.activeSymbols) {
          args.push({ instType: 'SPOT', channel: 'ticker', instId: s });
          args.push({ instType: 'SPOT', channel: 'books5', instId: s });
        }
        this.ws?.send(JSON.stringify({ op: 'subscribe', args }));
      });
      this.ws.on('message', (data: WebSocket.Data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.ping) {
            this.ws?.send(JSON.stringify({ pong: msg.ping }));
            return;
          }
          const channel = msg.arg && msg.arg.channel;
          if (!channel || !Array.isArray(msg.data)) return;
          if (channel === 'ticker') {
            for (const t of msg.data) this.handleBitgetTicker(t);
          } else if (channel === 'books5') {
            for (const d of msg.data) this.handleBitgetOrderBook(d, msg.arg.instId);
          }
        } catch (e) {}
      });
      this.ws.on('error', (err) => console.warn('[BitgetConnector] WS Error:', err.message));
      this.ws.on('close', () => {
        setTimeout(() => { if (this.status.status !== 'DISCONNECTED') this.initWs(); }, 5000);
      });
    } catch (e: any) {
      console.warn('[BitgetConnector] Failed to initialize WS:', e.message);
    }
  }

  // Handle bitget ticker
  private handleBitgetTicker(raw: any): void {
    const symbol = raw.symbol || raw.instId;
    if (!symbol || !this.activeSymbols.includes(symbol)) return;
    const lastPrice = parseFloat(raw.lastPr || '0');
    if (!lastPrice || isNaN(lastPrice)) return;
    const open24h = parseFloat(raw.open24h || '0');
    const changePercent = open24h > 0 ? +(((lastPrice - open24h) / open24h) * 100).toFixed(2) : 0;
    const baseVolume = parseFloat(raw.baseVolume || '0');
    const quoteVolume = parseFloat(raw.quoteVolume || raw.usdtVolume || '0');
    const high24h = parseFloat(raw.high24h || String(lastPrice));
    const low24h = parseFloat(raw.low24h || String(lastPrice));
    const timestamp = parseInt(raw.ts) || Date.now();

    this.candleEngine.recordPriceUpdate('BITGET', 'SPOT', symbol, lastPrice, baseVolume, timestamp);
    const indicators = this.candleEngine.computeIndicators('BITGET', 'SPOT', symbol, lastPrice);
    const timeframeChanges = this.candleEngine.computeTimeframeChanges('BITGET', 'SPOT', symbol, lastPrice, changePercent);

    const ticker: MarketTicker = {
      symbol,
      baseAsset: symbol.replace(/USDT$/, '') || symbol,
      quoteAsset: 'USDT',
      exchange: 'BITGET',
      marketType: 'SPOT',
      category: 'CRYPTO',
      lastPrice,
      percentageChange: changePercent,
      changesByTimeframe: timeframeChanges,
      volumeUsd: quoteVolume > 0 ? quoteVolume : baseVolume * lastPrice,
      volume24h: baseVolume,
      high24h,
      low24h,
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

  // Handle bitget order book
  private handleBitgetOrderBook(raw: any, symbol: string): void {
    if (!symbol || !this.activeSymbols.includes(symbol)) return;
    const mapLevels = (arr: any[]): OrderBookLevel[] =>
      (arr || []).map((b: string[]) => {
        const price = parseFloat(b[0]);
        const amount = parseFloat(b[1]);
        return { price, amount, usdVolume: price * amount };
      }).filter((l: OrderBookLevel) => l.amount > 0);

    const bids = mapLevels(raw.bids);
    const asks = mapLevels(raw.asks);
    bids.sort((a, b) => b.price - a.price);
    asks.sort((a, b) => a.price - b.price);

    const bestBid = bids[0]?.price || 0;
    const bestAsk = asks[0]?.price || 0;
    const spread = bestAsk > 0 && bestBid > 0 ? +(bestAsk - bestBid).toFixed(8) : 0;
    const spreadPercent = bestBid > 0 ? +((spread / bestBid) * 100).toFixed(6) : 0;

    const snapshot: OrderBookSnapshot = {
      symbol, exchange: 'BITGET', marketType: 'SPOT', bids, asks, spread, spreadPercent,
      timestamp: parseInt(raw.ts) || Date.now(), lastUpdateId: 0
    };
    this.emitOrderBook(snapshot);
  }

  // Start ping
  private startPing(): void {
    if (this.pingInterval) clearInterval(this.pingInterval);
    // Bitget v2 server pushes {"ping": ...}; client must reply {"pong": ...}.
    // A light periodic ping also keeps the connection alive.
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ ping: String(Date.now()) }));
      }
    }, 20000);
  }

  // Start rest sync
  private startRestSync(): void {
    if (this.restPollInterval) clearInterval(this.restPollInterval);
    this.restPollInterval = setInterval(() => { this.fetchRestSnapshot(); }, 15000);
  }
}

//  ku coin connector
export class KuCoinConnector extends BaseExchangeConnector {
  // Exchange id property
  public readonly exchangeId: ExchangeId = 'KUCOIN';
  // Name property
  public readonly name = 'KuCoin';
  // Is production ready property
  public readonly isProductionReady = true;

  // Ws property
  private ws: WebSocket | null = null;
  // Ws url property
  private wsUrl: string | null = null;
  // Ping interval property
  private pingInterval: NodeJS.Timeout | null = null;
  // Rest poll interval property
  private restPollInterval: NodeJS.Timeout | null = null;
  // Candle engine property
  private candleEngine: CandleEngine;

  // Active symbols property
  private activeSymbols = ['BTC-USDT', 'ETH-USDT', 'SOL-USDT', 'XRP-USDT'];

  constructor() {
    super();
    this.candleEngine = CandleEngine.getInstance();
    this.status = {
      exchange: 'KUCOIN', name: 'KuCoin', connected: false, status: 'DISCONNECTED',
      pingMs: 0, lastMessageAt: 0, subscribedSymbolsCount: this.activeSymbols.length, isProductionReady: true
    };
  }

  // Connect
  public async connect(): Promise<void> {
    this.updateStatus({ status: 'CONNECTING' });
    try {
      await this.fetchRestSnapshot();
      this.initWs();
      this.startPing();
      this.startRestSync();
    } catch (err: any) {
      console.warn('[KuCoinConnector] Connection issue:', err.message);
      this.updateStatus({ status: 'ERROR', error: err.message });
    }
  }

  // Disconnect
  public async disconnect(): Promise<void> {
    if (this.pingInterval) clearInterval(this.pingInterval);
    if (this.restPollInterval) clearInterval(this.restPollInterval);
    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws.close();
      this.ws = null;
    }
    this.updateStatus({ connected: false, status: 'DISCONNECTED' });
  }

  // Subscribe symbols
  public subscribeSymbols(symbols: string[], marketType: MarketType): void {
    for (const s of symbols) {
      const kc = s.toUpperCase().replace(/-/g, '-');
      if (kc.includes('USDT')) {
        const base = kc.replace(/USDT$/, '');
        const formatted = base + '-USDT';
        if (!this.activeSymbols.includes(formatted)) this.activeSymbols.push(formatted);
      } else if (!this.activeSymbols.includes(kc)) {
        this.activeSymbols.push(kc);
      }
    }
    this.updateStatus({ subscribedSymbolsCount: this.activeSymbols.length });
  }

  // Unsubscribe symbols
  public unsubscribeSymbols(symbols: string[], marketType: MarketType): void {
    const keep = new Set(symbols.map(s => s.toUpperCase().replace(/(USDT)$/, '-$1')));
    this.activeSymbols = this.activeSymbols.filter(s => !keep.has(s));
    this.updateStatus({ subscribedSymbolsCount: this.activeSymbols.length });
  }

  // Resolve ws endpoint
  private async resolveWsEndpoint(): Promise<string> {
    if (this.wsUrl) return this.wsUrl;
    const res = await fetch('https://api.kucoin.com/api/v1/bullet-public', { method: 'POST', signal: AbortSignal.timeout(6000) });
    const json = await res.json();
    if (json && json.code === '200000' && json.data && Array.isArray(json.data.instanceServers) && json.data.instanceServers.length > 0) {
      const endpoint = json.data.instanceServers[0].endpoint;
      const token = json.data.token || '';
      const connectId = `${Date.now()}${Math.random().toString(36).slice(2, 10)}`;
      const sep = endpoint.includes('?') ? '&' : '?';
      this.wsUrl = `${endpoint}${sep}token=${token}&connectId=${connectId}`;
      return this.wsUrl;
    }
    throw new Error('KuCoin bullet-public token resolution failed');
  }

  // Fetch rest snapshot
  private async fetchRestSnapshot(): Promise<void> {
    try {
      const res = await fetch('https://api.kucoin.com/api/v1/market/allTickers', { signal: AbortSignal.timeout(3500) });
      if (res.ok) {
        const json = await res.json();
        if (json && json.code === '200000' && json.data && Array.isArray(json.data.ticker)) {
          for (const item of json.data.ticker) {
            if (this.activeSymbols.includes(item.symbol)) this.handleKuCoinTicker(item);
          }
        }
      }
      for (const sym of this.activeSymbols) {
        await this.fetchOrderBookRest(sym);
      }
      this.updateStatus({ connected: true, status: 'CONNECTED', lastMessageAt: Date.now() });
    } catch (e: any) {
      console.warn('[KuCoinConnector] REST fetch note:', e.message);
    }
  }

  // Fetch order book rest
  private async fetchOrderBookRest(symbol: string): Promise<void> {
    try {
      const res = await fetch(
        `https://api.kucoin.com/api/v1/market/orderbook/level2_5?symbol=${symbol}`,
        { signal: AbortSignal.timeout(6000) }
      );
      if (res.ok) {
        const json = await res.json();
        if (json && json.code === '200000' && json.data && Array.isArray(json.data.bids) && Array.isArray(json.data.asks)) {
          this.handleKuCoinOrderBook({ ...json.data, s: symbol });
        }
      }
    } catch (e) {}
  }

  // Init ws
  private initWs(): void {
    this.resolveWsEndpoint().then((url) => {
      try {
        this.ws = new WebSocket(url);
        this.ws.on('open', () => {
          this.updateStatus({ connected: true, status: 'CONNECTED', lastMessageAt: Date.now() });
          let id = 1;
          for (const s of this.activeSymbols) {
            this.ws?.send(JSON.stringify({ id: id++, type: 'subscribe', topic: `/market/ticker:${s}`, privateChannel: false, response: true }));
            this.ws?.send(JSON.stringify({ id: id++, type: 'subscribe', topic: `/spotMarket/level2Depth5:${s}`, privateChannel: false, response: true }));
          }
        });
        this.ws.on('message', (data: WebSocket.Data) => {
          try {
            const msg = JSON.parse(data.toString());
            if (!msg.type || msg.type === 'welcome' || msg.type === 'ack' || msg.type === 'pong' || msg.type === 'error') return;
            if (msg.type !== 'message' || !msg.topic) return;
            if (msg.topic.startsWith('/market/ticker:')) {
              this.handleKuCoinTicker({ ...msg.data, symbol: msg.topic.split(':')[1] });
            } else if (msg.topic.startsWith('/spotMarket/level2Depth5:')) {
              this.handleKuCoinOrderBook({ ...msg.data, s: msg.topic.split(':')[1] });
            }
          } catch (e) {}
        });
        this.ws.on('error', (err) => console.warn('[KuCoinConnector] WS Error:', err.message));
        this.ws.on('close', () => {
          setTimeout(() => { if (this.status.status !== 'DISCONNECTED') this.initWs(); }, 5000);
        });
      } catch (e: any) {
        console.warn('[KuCoinConnector] Failed to initialize WS:', e.message);
      }
    }).catch((e) => console.warn('[KuCoinConnector] WS endpoint resolution failed:', e.message));
  }

  // Handle ku coin ticker
  private handleKuCoinTicker(raw: any): void {
    const symbol = raw.symbol;
    if (!symbol || !this.activeSymbols.includes(symbol)) return;
    const lastPrice = parseFloat(raw.price ?? raw.last ?? '0');
    if (!lastPrice || isNaN(lastPrice)) return;
    const changePercent = raw.changeRate ? +(parseFloat(raw.changeRate) * 100).toFixed(2) : 0;
    const baseVolume = parseFloat(raw.vol || '0');
    const quoteVolume = parseFloat(raw.volValue || '0');
    const high24h = parseFloat(raw.high || String(lastPrice));
    const low24h = parseFloat(raw.low || String(lastPrice));
    const timestamp = parseInt(raw.time) || Date.now();

    this.candleEngine.recordPriceUpdate('KUCOIN', 'SPOT', symbol, lastPrice, baseVolume, timestamp);
    const indicators = this.candleEngine.computeIndicators('KUCOIN', 'SPOT', symbol, lastPrice);
    const timeframeChanges = this.candleEngine.computeTimeframeChanges('KUCOIN', 'SPOT', symbol, lastPrice, changePercent);

    const ticker: MarketTicker = {
      symbol,
      baseAsset: symbol.split('-')[0],
      quoteAsset: symbol.split('-')[1] || 'USDT',
      exchange: 'KUCOIN',
      marketType: 'SPOT',
      category: 'CRYPTO',
      lastPrice,
      percentageChange: changePercent,
      changesByTimeframe: timeframeChanges,
      volumeUsd: quoteVolume > 0 ? quoteVolume : baseVolume * lastPrice,
      volume24h: baseVolume,
      high24h,
      low24h,
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

  // Handle ku coin order book
  private handleKuCoinOrderBook(raw: any): void {
    const symbol = raw.s;
    if (!symbol || !this.activeSymbols.includes(symbol)) return;
    const mapLevels = (arr: any[]): OrderBookLevel[] =>
      (arr || []).map((b: string[]) => {
        const price = parseFloat(b[0]);
        const amount = parseFloat(b[1]);
        return { price, amount, usdVolume: price * amount };
      }).filter((l: OrderBookLevel) => l.amount > 0);

    const bids = mapLevels(raw.bids);
    const asks = mapLevels(raw.asks);
    bids.sort((a, b) => b.price - a.price);
    asks.sort((a, b) => a.price - b.price);

    const bestBid = bids[0]?.price || 0;
    const bestAsk = asks[0]?.price || 0;
    const spread = bestAsk > 0 && bestBid > 0 ? +(bestAsk - bestBid).toFixed(8) : 0;
    const spreadPercent = bestBid > 0 ? +((spread / bestBid) * 100).toFixed(6) : 0;

    const snapshot: OrderBookSnapshot = {
      symbol, exchange: 'KUCOIN', marketType: 'SPOT', bids, asks, spread, spreadPercent,
      timestamp: parseInt(raw.time) || Date.now(), lastUpdateId: parseInt(raw.sequence) || 0
    };
    this.emitOrderBook(snapshot);
  }

  // Start ping
  private startPing(): void {
    if (this.pingInterval) clearInterval(this.pingInterval);
    // KuCoin requires a client ping every ~24s to keep the connection alive.
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ id: Date.now(), type: 'ping' }));
      }
    }, 18000);
  }

  // Start rest sync
  private startRestSync(): void {
    if (this.restPollInterval) clearInterval(this.restPollInterval);
    this.restPollInterval = setInterval(() => { this.fetchRestSnapshot(); }, 15000);
  }
}

//  hyperliquid connector
export class HyperliquidConnector extends BaseExchangeConnector {
  // Exchange id property
  public readonly exchangeId: ExchangeId = 'HYPERLIQUID';
  // Name property
  public readonly name = 'Hyperliquid';
  // Is production ready property
  public readonly isProductionReady = true;

  // Ws property
  private ws: WebSocket | null = null;
  // Ping interval property
  private pingInterval: NodeJS.Timeout | null = null;
  // Rest poll interval property
  private restPollInterval: NodeJS.Timeout | null = null;
  // Candle engine property
  private candleEngine: CandleEngine;

  // Active symbols property
  private activeSymbols = ['BTC', 'ETH', 'SOL', 'XRP'];

  constructor() {
    super();
    this.candleEngine = CandleEngine.getInstance();
    this.status = {
      exchange: 'HYPERLIQUID', name: 'Hyperliquid', connected: false, status: 'DISCONNECTED',
      pingMs: 0, lastMessageAt: 0, subscribedSymbolsCount: this.activeSymbols.length, isProductionReady: true
    };
  }

  // Connect
  public async connect(): Promise<void> {
    this.updateStatus({ status: 'CONNECTING' });
    try {
      await this.fetchRestSnapshot();
      this.initWs();
      this.startPing();
      this.startRestSync();
    } catch (err: any) {
      console.warn('[HyperliquidConnector] Connection issue:', err.message);
      this.updateStatus({ status: 'ERROR', error: err.message });
    }
  }

  // Disconnect
  public async disconnect(): Promise<void> {
    if (this.pingInterval) clearInterval(this.pingInterval);
    if (this.restPollInterval) clearInterval(this.restPollInterval);
    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws.close();
      this.ws = null;
    }
    this.updateStatus({ connected: false, status: 'DISCONNECTED' });
  }

  // Subscribe symbols
  public subscribeSymbols(symbols: string[], marketType: MarketType): void {
    for (const s of symbols) {
      const coin = s.toUpperCase().replace(/USDT$/, '').replace(/USD$/, '');
      if (!this.activeSymbols.includes(coin)) this.activeSymbols.push(coin);
    }
    this.updateStatus({ subscribedSymbolsCount: this.activeSymbols.length });
  }

  // Unsubscribe symbols
  public unsubscribeSymbols(symbols: string[], marketType: MarketType): void {
    const keep = new Set(symbols.map(s => s.toUpperCase().replace(/USDT$/, '').replace(/USD$/, '')));
    this.activeSymbols = this.activeSymbols.filter(s => !keep.has(s));
    this.updateStatus({ subscribedSymbolsCount: this.activeSymbols.length });
  }

  // Fetch rest snapshot
  private async fetchRestSnapshot(): Promise<void> {
    try {
      // Fetch all mid prices
      const res = await fetch('https://api.hyperliquid.xyz/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'allMids' }),
        signal: AbortSignal.timeout(3500)
      });
      if (res.ok) {
        const mids = await res.json();
        // mids is a map: { "BTC": "65000.0", "ETH": "2400.0", ... }
        if (mids && typeof mids === 'object') {
          for (const coin of this.activeSymbols) {
            const mid = parseFloat(mids[coin]);
            if (mid && mid > 0) {
              this.handleHyperliquidTicker({ coin, mid: String(mid) });
            }
          }
        }
      }
      // Fetch order books for each active coin
      for (const coin of this.activeSymbols) {
        await this.fetchOrderBookRest(coin);
      }
      this.updateStatus({ connected: true, status: 'CONNECTED', lastMessageAt: Date.now() });
    } catch (e: any) {
      console.warn('[HyperliquidConnector] REST fetch note:', e.message);
    }
  }

  // Fetch order book rest
  private async fetchOrderBookRest(coin: string): Promise<void> {
    try {
      const res = await fetch('https://api.hyperliquid.xyz/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'l2Book', coin }),
        signal: AbortSignal.timeout(3000)
      });
      if (res.ok) {
        const json = await res.json();
        if (json && json.levels && json.coin) {
          this.handleHyperliquidOrderBook(json);
        }
      }
    } catch (e) {}
  }

  // Init ws
  private initWs(): void {
    try {
      this.ws = new WebSocket('wss://api.hyperliquid.xyz/ws');
      this.ws.on('open', () => {
        this.updateStatus({ connected: true, status: 'CONNECTED', lastMessageAt: Date.now() });
        // Hyperliquid subscription format: { method: 'subscribe', subscription: { type, ... } }
        this.ws?.send(JSON.stringify({ method: 'subscribe', subscription: { type: 'allMids' } }));
        for (const coin of this.activeSymbols) {
          this.ws?.send(JSON.stringify({ method: 'subscribe', subscription: { type: 'l2Book', coin } }));
        }
      });
      this.ws.on('message', (data: WebSocket.Data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.channel === 'pong' || msg.channel === 'info') return;
          if (msg.channel === 'allMids' && msg.data && msg.data.mids) {
            for (const coin of this.activeSymbols) {
              const mid = msg.data.mids[coin];
              if (mid) {
                this.handleHyperliquidTicker({ coin, mid });
              }
            }
          } else if (msg.channel === 'l2Book' && msg.data && msg.data.coin && Array.isArray(msg.data.levels)) {
            this.handleHyperliquidOrderBook(msg.data);
          }
        } catch (e) {}
      });
      this.ws.on('error', (err) => console.warn('[HyperliquidConnector] WS Error:', err.message));
      this.ws.on('close', () => {
        setTimeout(() => { if (this.status.status !== 'DISCONNECTED') this.initWs(); }, 5000);
      });
    } catch (e: any) {
      console.warn('[HyperliquidConnector] Failed to initialize WS:', e.message);
    }
  }

  // Handle hyperliquid ticker
  private handleHyperliquidTicker(raw: any): void {
    const coin = raw.coin;
    if (!coin || !this.activeSymbols.includes(coin)) return;
    const lastPrice = parseFloat(raw.mid || raw.last || '0');
    if (!lastPrice || isNaN(lastPrice)) return;
    const timestamp = Date.now();

    this.candleEngine.recordPriceUpdate('HYPERLIQUID', 'FUTURES', coin, lastPrice, 0, timestamp);
    const indicators = this.candleEngine.computeIndicators('HYPERLIQUID', 'FUTURES', coin, lastPrice);
    const timeframeChanges = this.candleEngine.computeTimeframeChanges('HYPERLIQUID', 'FUTURES', coin, lastPrice, 0);

    const ticker: MarketTicker = {
      symbol: coin,
      baseAsset: coin,
      quoteAsset: 'USD',
      exchange: 'HYPERLIQUID',
      marketType: 'FUTURES',
      category: 'CRYPTO',
      lastPrice,
      percentageChange: 0,
      changesByTimeframe: timeframeChanges,
      volumeUsd: 0,
      volume24h: 0,
      high24h: lastPrice,
      low24h: lastPrice,
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

  // Handle hyperliquid order book
  private handleHyperliquidOrderBook(raw: any): void {
    const coin = raw.coin;
    if (!coin || !this.activeSymbols.includes(coin)) return;
    const mapLevels = (arr: any[]): OrderBookLevel[] =>
      (arr || []).map((b: any) => {
        const price = parseFloat(b.px || b[0]);
        const amount = parseFloat(b.sz || b[1]);
        return { price, amount, usdVolume: price * amount };
      }).filter((l: OrderBookLevel) => l.amount > 0);

    const levels = raw.levels;
    // Hyperliquid l2Book: levels is [bids, asks] (two arrays of { px, sz, n })
    const bids = mapLevels(Array.isArray(levels) ? levels[0] : []);
    const asks = mapLevels(Array.isArray(levels) ? levels[1] : []);
    bids.sort((a, b) => b.price - a.price);
    asks.sort((a, b) => a.price - b.price);

    const bestBid = bids[0]?.price || 0;
    const bestAsk = asks[0]?.price || 0;
    const spread = bestAsk > 0 && bestBid > 0 ? +(bestAsk - bestBid).toFixed(8) : 0;
    const spreadPercent = bestBid > 0 ? +((spread / bestBid) * 100).toFixed(6) : 0;

    const snapshot: OrderBookSnapshot = {
      symbol: coin, exchange: 'HYPERLIQUID', marketType: 'FUTURES', bids, asks, spread, spreadPercent,
      timestamp: raw.time || Date.now(), lastUpdateId: 0
    };
    this.emitOrderBook(snapshot);
  }

  // Start ping
  private startPing(): void {
    if (this.pingInterval) clearInterval(this.pingInterval);
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ method: 'ping' }));
      }
    }, 30000);
  }

  // Start rest sync
  private startRestSync(): void {
    if (this.restPollInterval) clearInterval(this.restPollInterval);
    this.restPollInterval = setInterval(() => { this.fetchRestSnapshot(); }, 15000);
  }
}

//  aster d e x connector
export class AsterDEXConnector extends BaseExchangeConnector {
  // Exchange id property
  public readonly exchangeId: ExchangeId = 'ASTERDEX';
  // Name property
  public readonly name = 'AsterDEX';
  // Is production ready property
  public readonly isProductionReady = true;

  // Ws property
  private ws: WebSocket | null = null;
  // Ping interval property
  private pingInterval: NodeJS.Timeout | null = null;
  // Rest poll interval property
  private restPollInterval: NodeJS.Timeout | null = null;
  // Candle engine property
  private candleEngine: CandleEngine;

  // Active symbols property
  private activeSymbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT'];
  // Order book cache property
  private orderBookCache = new Map<string, { bids: Map<number, number>; asks: Map<number, number> }>();
  // Reconnect attempts property
  private reconnectAttempts = 0;
  // Max reconnect attempts property
  private maxReconnectAttempts = 10;
  // Reconnect timer property
  private reconnectTimer: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.candleEngine = CandleEngine.getInstance();
    this.status = {
      exchange: 'ASTERDEX', name: 'AsterDEX', connected: false, status: 'DISCONNECTED',
      pingMs: 0, lastMessageAt: 0, subscribedSymbolsCount: this.activeSymbols.length, isProductionReady: true
    };
  }

  // Connect
  public async connect(): Promise<void> {
    this.updateStatus({ status: 'CONNECTING' });
    try {
      await this.fetchRestSnapshot();
      this.initWs();
      this.startPing();
      this.startRestSync();
    } catch (err: any) {
      console.warn('[AsterDEXConnector] Connection issue:', err.message);
      this.updateStatus({ status: 'ERROR', error: err.message });
    }
  }

  // Disconnect
  public async disconnect(): Promise<void> {
    if (this.pingInterval) clearInterval(this.pingInterval);
    if (this.restPollInterval) clearInterval(this.restPollInterval);
    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws.close();
      this.ws = null;
    }
    this.updateStatus({ connected: false, status: 'DISCONNECTED' });
  }

  // Subscribe symbols
  public subscribeSymbols(symbols: string[], marketType: MarketType): void {
    for (const s of symbols) {
      const upper = s.toUpperCase().replace(/-/g, '');
      if (!this.activeSymbols.includes(upper)) this.activeSymbols.push(upper);
    }
    this.updateStatus({ subscribedSymbolsCount: this.activeSymbols.length });
  }

  // Unsubscribe symbols
  public unsubscribeSymbols(symbols: string[], marketType: MarketType): void {
    const keep = new Set(symbols.map(s => s.toUpperCase().replace(/-/g, '')));
    this.activeSymbols = this.activeSymbols.filter(s => !keep.has(s));
    this.updateStatus({ subscribedSymbolsCount: this.activeSymbols.length });
  }

  // Fetch rest snapshot
  private async fetchRestSnapshot(): Promise<void> {
    try {
      const res = await fetch('https://sapi.asterdex.com/api/v3/ticker/24hr', { signal: AbortSignal.timeout(3500) });
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json)) {
          for (const item of json) {
            if (this.activeSymbols.includes(item.symbol)) this.handleAsterDEXTicker(item);
          }
        }
      }
      for (const sym of this.activeSymbols) {
        await this.fetchOrderBookRest(sym);
      }
      this.updateStatus({ connected: true, status: 'CONNECTED', lastMessageAt: Date.now() });
    } catch (e: any) {
      console.warn('[AsterDEXConnector] REST fetch note:', e.message);
    }
  }

  // Fetch order book rest
  private async fetchOrderBookRest(symbol: string): Promise<void> {
    try {
      const res = await fetch(
        `https://sapi.asterdex.com/api/v3/depth?symbol=${symbol}&limit=5`,
        { signal: AbortSignal.timeout(3000) }
      );
      if (res.ok) {
        const json = await res.json();
        if (json && Array.isArray(json.bids) && Array.isArray(json.asks)) {
          this.handleAsterDEXOrderBook({ ...json, s: symbol });
        }
      }
    } catch (e) {}
  }

  // Init ws
  private initWs(): void {
    try {
      // AsterDEX uses Binance-style combined stream endpoint
      this.ws = new WebSocket('wss://sstream.asterdex.com/stream');
      this.ws.on('open', () => {
        this.reconnectAttempts = 0;
        this.updateStatus({ connected: true, status: 'CONNECTED', lastMessageAt: Date.now() });
        const streams: string[] = [];
        for (const s of this.activeSymbols) {
          const lower = s.toLowerCase();
          streams.push(`${lower}@ticker`);
          streams.push(`${lower}@depth@100ms`);
        }
        this.ws?.send(JSON.stringify({ method: 'SUBSCRIBE', params: streams, id: 1 }));
        this.logError('WebSocket connected and subscribed');
      });
      this.ws.on('message', (data: WebSocket.Data) => {
        try {
          const msg = JSON.parse(data.toString());
          // Ignore subscription confirmations and ping/pong
          if (msg.result === null || msg.id || msg.pong) return;
          if (!msg.stream || !msg.data) return;

          if (msg.stream.endsWith('@ticker')) {
            this.handleAsterDEXTicker(msg.data);
          } else if (msg.stream.endsWith('@depth@100ms')) {
            this.handleAsterDEXOrderBook(msg.data);
          }
        } catch (e) {
          this.logError('Message parsing error', e);
        }
      });
      this.ws.on('error', (err) => {
        this.logError(`WebSocket error: ${err.message}`, err);
        this.updateStatus({ status: 'ERROR', error: err.message });
      });
      this.ws.on('close', () => {
        this.logError('WebSocket closed');
        if (this.status.status !== 'DISCONNECTED' && this.reconnectAttempts < this.maxReconnectAttempts) {
          const delay = Math.min(30000, 1000 * Math.pow(2, this.reconnectAttempts));
          this.reconnectAttempts++;
          this.logError(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
          this.reconnectTimer = setTimeout(() => {
            this.initWs();
          }, delay);
        } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          this.logError('Max reconnect attempts reached, giving up');
          this.updateStatus({ status: 'ERROR', error: 'Max reconnect attempts reached' });
        }
      });
    } catch (e: any) {
      this.logError(`Failed to initialize WebSocket: ${e.message}`, e);
      this.updateStatus({ status: 'ERROR', error: e.message });
    }
  }

  // Handle aster d e x ticker
  private handleAsterDEXTicker(raw: any): void {
    const symbol = raw.s || raw.symbol;
    if (!symbol || !this.activeSymbols.includes(symbol)) return;
    const lastPrice = parseFloat(raw.c || raw.lastPrice || '0');
    if (!lastPrice || isNaN(lastPrice)) return;
    const changePercent = parseFloat(raw.P || raw.priceChangePercent || '0');
    const baseVolume = parseFloat(raw.v || raw.volume || '0');
    const quoteVolume = parseFloat(raw.q || raw.quoteVolume || '0');
    const high24h = parseFloat(raw.h || raw.highPrice || String(lastPrice));
    const low24h = parseFloat(raw.l || raw.lowPrice || String(lastPrice));
    const timestamp = parseInt(raw.E || raw.closeTime) || Date.now();

    this.candleEngine.recordPriceUpdate('ASTERDEX', 'SPOT', symbol, lastPrice, baseVolume, timestamp);
    const indicators = this.candleEngine.computeIndicators('ASTERDEX', 'SPOT', symbol, lastPrice);
    const timeframeChanges = this.candleEngine.computeTimeframeChanges('ASTERDEX', 'SPOT', symbol, lastPrice, changePercent);

    const ticker: MarketTicker = {
      symbol,
      baseAsset: symbol.replace(/USDT$/, '') || symbol,
      quoteAsset: 'USDT',
      exchange: 'ASTERDEX',
      marketType: 'SPOT',
      category: 'CRYPTO',
      lastPrice,
      percentageChange: changePercent,
      changesByTimeframe: timeframeChanges,
      volumeUsd: quoteVolume > 0 ? quoteVolume : baseVolume * lastPrice,
      volume24h: baseVolume,
      high24h,
      low24h,
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

  // Handle aster d e x order book
  private handleAsterDEXOrderBook(raw: any): void {
    const symbol = raw.s;
    if (!symbol || !this.activeSymbols.includes(symbol)) return;

    let book = this.orderBookCache.get(symbol);
    if (!book) {
      book = { bids: new Map<number, number>(), asks: new Map<number, number>() };
      this.orderBookCache.set(symbol, book);
    }

    // Full snapshot: REST depth response or snapshot-style WS message with lastUpdateId + bids/asks.
    const isFullSnapshot = Array.isArray(raw.bids) && Array.isArray(raw.asks);
    if (isFullSnapshot) {
      book.bids.clear();
      book.asks.clear();
      for (const [price, qty] of raw.bids as string[][]) book.bids.set(parseFloat(price), parseFloat(qty));
      for (const [price, qty] of raw.asks as string[][]) book.asks.set(parseFloat(price), parseFloat(qty));
    } else {
      // Binance-style depthUpdate: b/a arrays of [price, qty]; qty <= 0 removes the level.
      const applyUpdate = (levels: string[][] | undefined, side: Map<number, number>) => {
        if (!Array.isArray(levels)) return;
        for (const [price, qty] of levels) {
          const p = parseFloat(price);
          const q = parseFloat(qty);
          if (q <= 0) side.delete(p);
          else side.set(p, q);
        }
      };
      applyUpdate(raw.b, book.bids);
      applyUpdate(raw.a, book.asks);
    }

    const bids: OrderBookLevel[] = [...book.bids.entries()]
      .filter(([p, q]) => p > 0 && q > 0)
      .map(([price, amount]) => ({ price, amount, usdVolume: price * amount }))
      .sort((a, b) => b.price - a.price);
    const asks: OrderBookLevel[] = [...book.asks.entries()]
      .filter(([p, q]) => p > 0 && q > 0)
      .map(([price, amount]) => ({ price, amount, usdVolume: price * amount }))
      .sort((a, b) => a.price - b.price);

    const bestBid = bids[0]?.price || 0;
    const bestAsk = asks[0]?.price || 0;
    const spread = bestAsk > 0 && bestBid > 0 ? +(bestAsk - bestBid).toFixed(8) : 0;
    const spreadPercent = bestBid > 0 ? +((spread / bestBid) * 100).toFixed(6) : 0;

    const snapshot: OrderBookSnapshot = {
      symbol, exchange: 'ASTERDEX', marketType: 'SPOT', bids, asks, spread, spreadPercent,
      timestamp: parseInt(raw.E || raw.lastUpdateId) || Date.now(), lastUpdateId: 0
    };
    this.emitOrderBook(snapshot);
  }

  // Start ping
  private startPing(): void {
    if (this.pingInterval) clearInterval(this.pingInterval);
    // Send a ping message every 3 minutes as keepalive (Binance-style)
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        // AsterDEX uses Binance-style ping/pong
        this.ws.send(JSON.stringify({ method: 'PING' }));
      }
    }, 60000);
  }

  // Start rest sync
  private startRestSync(): void {
    if (this.restPollInterval) clearInterval(this.restPollInterval);
    this.restPollInterval = setInterval(() => { this.fetchRestSnapshot(); }, 15000);
  }
}

//  generic exchange adapter
export class GenericExchangeAdapter extends BaseExchangeConnector {
  // Exchange id property
  public readonly exchangeId: ExchangeId;
  // Name property
  public readonly name: string;
  // Is production ready property
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

  // Connect
  public async connect(): Promise<void> {
    this.updateStatus({ status: 'UNIMPLEMENTED', error: 'Awaiting credentials' });
  }

  // Disconnect
  public async disconnect(): Promise<void> {
    this.updateStatus({ status: 'DISCONNECTED' });
  }

  // Subscribe symbols
  public subscribeSymbols(symbols: string[], marketType: MarketType): void {}
  // Unsubscribe symbols
  public unsubscribeSymbols(symbols: string[], marketType: MarketType): void {}
}

// ====================================================================
// US EQUITIES CONNECTOR (NASDAQ / NYSE) — REAL DATA ONLY
// Sources: Finnhub (primary) / Polygon.io (fallback).
// Synthetic data is strictly forbidden: without a valid provider key the
// connector stays NOT_CONFIGURED and emits NO ticks.
// ====================================================================

//  stock provider snapshot
interface StockProviderSnapshot {
  symbol: string;
  lastPrice: number;
  changePercent: number;   // 24h %
  open24h: number;
  high24h: number;
  low24h: number;
  prevClose: number;
  volume24h: number;       // base volume (shares)
  quoteVolumeUsd: number;  // estimated turnover in USD
}

const DEFAULT_STOCK_SYMBOLS = ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'TSLA', 'META'];

//  stock exchange connector
export class StockExchangeConnector extends BaseExchangeConnector {
  // Exchange id property
  public readonly exchangeId: ExchangeId = 'STOCK_EXCHANGE';
  // Name property
  public readonly name = 'Stock Markets (NASDAQ / NYSE)';
  // Is production ready property
  public readonly isProductionReady = true;

  // Active symbols property
  private activeSymbols: string[] = [...DEFAULT_STOCK_SYMBOLS];
  // Finnhub key property
  private finnhubKey?: string;
  // Polygon key property
  private polygonKey?: string;
  // Poll interval property
  private pollInterval: NodeJS.Timeout | null = null;
  // Poll ms property
  private readonly pollMs = 30000;

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
      error: 'Real stock data provider key (FINNHUB_API_KEY / POLYGON_API_KEY) required in environment. Synthetic stock data is strictly disabled.',
      isProductionReady: true
    };
  }

  // Connect
  public async connect(): Promise<void> {
    this.updateStatus({ status: 'CONNECTING' });

    this.finnhubKey = process.env.FINNHUB_API_KEY || undefined;
    this.polygonKey = process.env.POLYGON_API_KEY || undefined;

    if (!this.finnhubKey && !this.polygonKey) {
      this.updateStatus({
        connected: false,
        status: 'NOT_CONFIGURED',
        error: 'Stock Data Provider Key required in settings. Synthetic stock data is disabled.'
      });
      return;
    }

    // Immediate poll, then keepalive polling.
    await this.poll();
    if (this.pollInterval) clearInterval(this.pollInterval);
    this.pollInterval = setInterval(() => { this.poll().catch(() => undefined); }, this.pollMs);
  }

  // Disconnect
  public async disconnect(): Promise<void> {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.updateStatus({ connected: false, status: 'DISCONNECTED' });
  }

  // Subscribe symbols
  public subscribeSymbols(symbols: string[], marketType: MarketType): void {
    for (const s of symbols) {
      const upper = s.toUpperCase();
      if (!this.activeSymbols.includes(upper)) this.activeSymbols.push(upper);
    }
    this.updateStatus({ subscribedSymbolsCount: this.activeSymbols.length });
    // Wake up quickly so newly subscribed symbols get data soon.
    this.poll().catch(() => undefined);
  }

  // Unsubscribe symbols
  public unsubscribeSymbols(symbols: string[], marketType: MarketType): void {
    const keep = new Set(symbols.map(s => s.toUpperCase()));
    this.activeSymbols = this.activeSymbols.filter(s => !keep.has(s));
    this.updateStatus({ subscribedSymbolsCount: this.activeSymbols.length });
  }

  // Poll
  private async poll(): Promise<void> {
    if (!this.finnhubKey && !this.polygonKey) return;

    try {
      const snapshots = this.finnhubKey
        ? await this.fetchFinnhubQuotes(this.activeSymbols, this.finnhubKey)
        : await this.fetchPolygonSnapshots(this.activeSymbols, this.polygonKey!);

      if (snapshots.length > 0) {
        const now = Date.now();
        for (const s of snapshots) {
          this.emitStockTicker(s, now);
        }
        this.updateStatus({
          connected: true,
          status: 'CONNECTED',
          lastMessageAt: now,
          pingMs: 0,
          error: undefined,
          subscribedSymbolsCount: this.activeSymbols.length
        });
      } else {
        this.updateStatus({ status: 'ERROR', error: 'Stock provider returned no quotes for configured symbols.' });
      }
    } catch (e: any) {
      this.updateStatus({ connected: false, status: 'ERROR', error: `Stock provider error: ${e.message}` });
    }
  }

  // Emit stock ticker
  private emitStockTicker(s: StockProviderSnapshot, timestamp: number): void {
    const changePercent = s.changePercent;
    const ticker: MarketTicker = {
      symbol: s.symbol,
      baseAsset: s.symbol,
      quoteAsset: 'USD',
      exchange: 'STOCK_EXCHANGE',
      marketType: 'SPOT',
      category: 'STOCKS',
      lastPrice: s.lastPrice,
      percentageChange: changePercent,
      changesByTimeframe: { '1d': changePercent },
      volumeUsd: s.quoteVolumeUsd,
      volume24h: s.volume24h,
      high24h: s.high24h,
      low24h: s.low24h,
      volatility24h: s.low24h > 0 ? +(((s.high24h - s.low24h) / s.low24h) * 100).toFixed(2) : undefined,
      timestamp,
      isLive: true,
      dataFreshness: 'LIVE'
    };
    this.emitTicker(ticker);
  }

  // Fetch finnhub quotes
  private async fetchFinnhubQuotes(symbols: string[], key: string): Promise<StockProviderSnapshot[]> {
    const results: StockProviderSnapshot[] = [];
    await Promise.all(symbols.map(async (symbol) => {
      try {
        const quoteRes = await fetch(
          `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${key}`,
          { signal: AbortSignal.timeout(4000) }
        );
        if (!quoteRes.ok) return;
        const q = await quoteRes.json();
        if (!q || typeof q.c !== 'number' || q.c <= 0) return;

        const lastPrice = q.c;
        const prevClose = q.pc && q.pc > 0 ? q.pc : lastPrice;
        const changePercent = +(((lastPrice - prevClose) / prevClose) * 100).toFixed(2);

        // Best-effort 24h volume from hourly candles (free tier friendly).
        let volume24h = 0;
        try {
          const now = Math.floor(Date.now() / 1000);
          const candleRes = await fetch(
            `https://finnhub.io/api/v1/stock/candle?symbol=${encodeURIComponent(symbol)}&resolution=60&from=${now - 86400}&to=${now}&token=${key}`,
            { signal: AbortSignal.timeout(4000) }
          );
          if (candleRes.ok) {
            const c = await candleRes.json();
            if (c && Array.isArray(c.v)) {
              volume24h = c.v.reduce((a: number, b: number) => a + (b || 0), 0);
            }
          }
        } catch { /* volume is best-effort */ }

        results.push({
          symbol,
          lastPrice,
          changePercent,
          open24h: q.o || lastPrice,
          high24h: q.h || lastPrice,
          low24h: q.l || lastPrice,
          prevClose,
          volume24h,
          quoteVolumeUsd: lastPrice * volume24h
        });
      } catch { /* per-symbol quiet failure */ }
    }));
    return results;
  }

  // Fetch polygon snapshots
  private async fetchPolygonSnapshots(symbols: string[], key: string): Promise<StockProviderSnapshot[]> {
    const res = await fetch(
      `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers?tickers=${symbols.join(',')}&apiKey=${key}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return [];
    const json = await res.json();
    const list = json?.tickers;
    if (!Array.isArray(list)) return [];

    const results: StockProviderSnapshot[] = [];
    for (const t of list) {
      const symbol = t.ticker;
      const day = t.day || {};
      const prevClose = t.prevDay?.c;
      const lastPrice = day.c || prevClose;
      if (!lastPrice || lastPrice <= 0) continue;
      const volume24h = day.v || 0;
      results.push({
        symbol,
        lastPrice,
        changePercent: typeof t.todaysChangePerc === 'number' ? +t.todaysChangePerc.toFixed(2) : 0,
        open24h: day.o || lastPrice,
        high24h: day.h || lastPrice,
        low24h: day.l || lastPrice,
        prevClose: prevClose || lastPrice,
        volume24h,
        quoteVolumeUsd: lastPrice * volume24h
      });
    }
    return results;
  }
}
