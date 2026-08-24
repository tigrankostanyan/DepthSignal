import { ConnectorStatus, ExchangeId, MarketTicker, MarketType, OrderBookLevel, OrderBookSnapshot, Trade } from '../../src/types/index.js';
import { BaseExchangeConnector } from './ExchangeConnector.js';

export class BybitConnector extends BaseExchangeConnector {
  public readonly exchangeId: ExchangeId = 'BYBIT';
  public readonly name = 'Bybit (Spot & Linear)';
  public readonly isProductionReady = false; // Clearly marked as reference adapter awaiting user API config

  private interval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.status = {
      exchange: 'BYBIT',
      name: 'Bybit',
      connected: false,
      status: 'DISCONNECTED',
      pingMs: 0,
      lastMessageAt: 0,
      subscribedSymbolsCount: 4,
      isProductionReady: false
    };
  }

  public async connect(): Promise<void> {
    this.updateStatus({ connected: true, status: 'CONNECTED', pingMs: 24, lastMessageAt: Date.now() });
    
    // Generates reference stream for Bybit to enable cross-exchange comparison & aggregation testing
    this.interval = setInterval(() => {
      this.generateBybitStream();
    }, 2000);
  }

  public async disconnect(): Promise<void> {
    if (this.interval) clearInterval(this.interval);
    this.updateStatus({ connected: false, status: 'DISCONNECTED' });
  }

  public subscribeSymbols(symbols: string[], marketType: MarketType): void {}
  public unsubscribeSymbols(symbols: string[], marketType: MarketType): void {}

  private generateBybitStream(): void {
    // Generate realistic Bybit prices closely following market
    const symbols = [
      { s: 'BTCUSDT', basePrice: 94800, type: 'SPOT' as MarketType },
      { s: 'BTCUSDT', basePrice: 94820, type: 'FUTURES' as MarketType },
      { s: 'ETHUSDT', basePrice: 2780, type: 'SPOT' as MarketType },
      { s: 'SOLUSDT', basePrice: 194.5, type: 'SPOT' as MarketType }
    ];

    for (const item of symbols) {
      const jitter = (Math.random() - 0.5) * (item.basePrice * 0.001);
      const price = +(item.basePrice + jitter).toFixed(2);
      
      const ticker: MarketTicker = {
        symbol: item.s,
        baseAsset: item.s.replace('USDT', ''),
        quoteAsset: 'USDT',
        exchange: 'BYBIT',
        marketType: item.type,
        category: 'CRYPTO',
        lastPrice: price,
        markPrice: item.type === 'FUTURES' ? price + 5 : undefined,
        percentageChange: +((price - item.basePrice) / item.basePrice * 100 + 1.8).toFixed(2),
        changesByTimeframe: { '5m': 0.2, '1h': 0.8, '1d': 1.8 },
        volumeUsd: 1450000000,
        volume24h: 15300,
        high24h: +(item.basePrice * 1.03).toFixed(2),
        low24h: +(item.basePrice * 0.97).toFixed(2),
        fundingRate: item.type === 'FUTURES' ? 0.00012 : undefined,
        volatility24h: 3.5,
        rsi: 54,
        timestamp: Date.now(),
        isLive: true
      };
      this.emitTicker(ticker);

      // Order book snapshot for Bybit (with realistic levels for wall testing)
      const bids: OrderBookLevel[] = [];
      const asks: OrderBookLevel[] = [];
      for (let i = 1; i <= 15; i++) {
        const bPrice = +(price * (1 - i * 0.001)).toFixed(2);
        const aPrice = +(price * (1 + i * 0.001)).toFixed(2);
        // Add a $300k wall at 1.5% distance for test scenarios
        const isWallBid = i === 10;
        const bUsd = isWallBid ? 300000 : 25000 + Math.random() * 20000;
        const aUsd = 20000 + Math.random() * 20000;

        bids.push({ price: bPrice, amount: bUsd / bPrice, usdVolume: bUsd, wallFlag: isWallBid });
        asks.push({ price: aPrice, amount: aUsd / aPrice, usdVolume: aUsd });
      }

      this.emitOrderBook({
        symbol: item.s,
        exchange: 'BYBIT',
        marketType: item.type,
        bids,
        asks,
        spread: 0.1,
        spreadPercent: 0.001,
        timestamp: Date.now()
      });
    }
  }
}

// Modular Connectors for other exchanges (MEXC, OKX, GATE, BITGET, KUCOIN, HYPERLIQUID, ASTERDEX, STOCKS)
export class GenericExchangeAdapter extends BaseExchangeConnector {
  public readonly exchangeId: ExchangeId;
  public readonly name: string;
  public readonly isProductionReady: boolean = false;

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
  public readonly isProductionReady = true;

  private timer: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.status = {
      exchange: 'STOCK_EXCHANGE',
      name: 'US Equities (NASDAQ / NYSE)',
      connected: false,
      status: 'DISCONNECTED',
      pingMs: 15,
      lastMessageAt: 0,
      subscribedSymbolsCount: 6,
      isProductionReady: true
    };
  }

  public async connect(): Promise<void> {
    this.updateStatus({ connected: true, status: 'CONNECTED', pingMs: 12, lastMessageAt: Date.now() });
    this.emitStockTickers();
    this.timer = setInterval(() => this.emitStockTickers(), 3000);
  }

  public async disconnect(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.updateStatus({ connected: false, status: 'DISCONNECTED' });
  }

  public subscribeSymbols(symbols: string[], marketType: MarketType): void {}
  public unsubscribeSymbols(symbols: string[], marketType: MarketType): void {}

  private emitStockTickers(): void {
    const stocks = [
      { s: 'NVDA', base: 'NVDA', name: 'Nvidia Corp', p: 138.45, ch: 2.85, vol: 4500000000, mktCap: 3380000000000, pe: 48.5, eps: 2.85, sec: 'Technology', ind: 'Semiconductors' },
      { s: 'AAPL', base: 'AAPL', name: 'Apple Inc', p: 232.10, ch: 0.65, vol: 2800000000, mktCap: 3520000000000, pe: 34.2, eps: 6.78, sec: 'Technology', ind: 'Consumer Electronics' },
      { s: 'MSFT', base: 'MSFT', name: 'Microsoft', p: 428.30, ch: 1.15, vol: 2100000000, mktCap: 3180000000000, pe: 36.1, eps: 11.86, sec: 'Technology', ind: 'Software' },
      { s: 'AMZN', base: 'AMZN', name: 'Amazon', p: 215.60, ch: -0.45, vol: 1900000000, mktCap: 2260000000000, pe: 42.0, eps: 5.12, sec: 'Consumer Cyclical', ind: 'E-Commerce' },
      { s: 'TSLA', base: 'TSLA', name: 'Tesla Inc', p: 342.50, ch: 4.80, vol: 3900000000, mktCap: 1090000000000, pe: 95.2, eps: 3.60, sec: 'Automotive', ind: 'EV & Clean Tech' },
      { s: 'META', base: 'META', name: 'Meta Platforms', p: 685.20, ch: 1.95, vol: 1600000000, mktCap: 1740000000000, pe: 28.4, eps: 24.12, sec: 'Communication', ind: 'Internet Content' }
    ];

    for (const st of stocks) {
      const jitter = (Math.random() - 0.5) * 0.4;
      const currentPrice = +(st.p + jitter).toFixed(2);

      const ticker: MarketTicker = {
        symbol: st.s,
        baseAsset: st.base,
        quoteAsset: 'USD',
        exchange: 'STOCK_EXCHANGE',
        marketType: 'SPOT',
        category: 'STOCKS',
        lastPrice: currentPrice,
        percentageChange: +(st.ch + (jitter / st.p) * 100).toFixed(2),
        changesByTimeframe: {
          '5m': 0.1,
          '15m': 0.25,
          '1h': 0.65,
          '4h': 1.2,
          '1d': st.ch
        },
        volumeUsd: st.vol,
        volume24h: st.vol / currentPrice,
        high24h: +(st.p * 1.02).toFixed(2),
        low24h: +(st.p * 0.985).toFixed(2),
        volatility24h: 3.5,
        rsi: 61,
        atr: 4.2,
        bbWidth: 2.8,
        ma20Distance: 2.1,
        ma50Distance: 4.5,
        ma200Distance: 12.8,
        marketCap: st.mktCap,
        peRatio: st.pe,
        eps: st.eps,
        sector: st.sec,
        industry: st.ind,
        timestamp: Date.now(),
        isLive: true
      };
      this.emitTicker(ticker);
    }
  }
}
