import { ConnectorStatus, ExchangeId, MarketTicker, MarketType, OrderBookSnapshot, Trade } from '../../src/types/index.js';
import { BinanceConnector } from './BinanceConnector.js';
import { IExchangeConnector } from './ExchangeConnector.js';
import { BybitConnector, GenericExchangeAdapter, StockExchangeConnector } from './OtherConnectors.js';

export type TickerListener = (ticker: MarketTicker) => void;
export type OrderBookListener = (orderBook: OrderBookSnapshot) => void;
export type TradeListener = (trade: Trade) => void;

export class ConnectorManager {
  private static instance: ConnectorManager;
  private connectors = new Map<ExchangeId, IExchangeConnector>();

  private tickerListeners: TickerListener[] = [];
  private orderBookListeners: OrderBookListener[] = [];
  private tradeListeners: TradeListener[] = [];

  private constructor() {
    this.registerConnectors();
  }

  public static getInstance(): ConnectorManager {
    if (!ConnectorManager.instance) {
      ConnectorManager.instance = new ConnectorManager();
    }
    return ConnectorManager.instance;
  }

  private registerConnectors(): void {
    // 1. Primary reference connector: Binance
    const binance = new BinanceConnector();
    this.connectors.set('BINANCE', binance);

    // 2. Bybit reference adapter
    const bybit = new BybitConnector();
    this.connectors.set('BYBIT', bybit);

    // 3. US Equities connector
    const stocks = new StockExchangeConnector();
    this.connectors.set('STOCK_EXCHANGE', stocks);

    // 4. Placeholders with explicit UNIMPLEMENTED / API KEY NEEDED flags
    const otherList: { id: ExchangeId; name: string }[] = [
      { id: 'MEXC', name: 'MEXC Global' },
      { id: 'OKX', name: 'OKX' },
      { id: 'GATE', name: 'Gate.io' },
      { id: 'BITGET', name: 'Bitget' },
      { id: 'KUCOIN', name: 'KuCoin' },
      { id: 'HYPERLIQUID', name: 'Hyperliquid DEX' },
      { id: 'ASTERDEX', name: 'AsterDEX' }
    ];

    for (const item of otherList) {
      this.connectors.set(item.id, new GenericExchangeAdapter(item.id, item.name));
    }

    // Attach listeners across all connectors
    for (const connector of this.connectors.values()) {
      connector.onTicker((ticker) => {
        this.tickerListeners.forEach(l => l(ticker));
      });

      connector.onOrderBook((ob) => {
        this.orderBookListeners.forEach(l => l(ob));
      });

      connector.onTrade((tr) => {
        this.tradeListeners.forEach(l => l(tr));
      });
    }
  }

  public async startAll(enabledExchanges: ExchangeId[]): Promise<void> {
    console.log(`[ConnectorManager] Starting connectors for: ${enabledExchanges.join(', ')}`);
    for (const [id, connector] of this.connectors.entries()) {
      if (enabledExchanges.includes(id) || id === 'BINANCE' || id === 'STOCK_EXCHANGE') {
        try {
          await connector.connect();
        } catch (e: any) {
          console.error(`[ConnectorManager] Failed starting ${id}:`, e.message);
        }
      }
    }
  }

  public async stopAll(): Promise<void> {
    for (const connector of this.connectors.values()) {
      await connector.disconnect();
    }
  }

  public getConnectorStatuses(): ConnectorStatus[] {
    const list: ConnectorStatus[] = [];
    for (const connector of this.connectors.values()) {
      list.push(connector.getStatus());
    }
    return list;
  }

  public subscribeSymbols(exchange: ExchangeId, symbols: string[], marketType: MarketType): void {
    const connector = this.connectors.get(exchange);
    if (connector) {
      connector.subscribeSymbols(symbols, marketType);
    }
  }

  public onTicker(listener: TickerListener): void {
    this.tickerListeners.push(listener);
  }

  public onOrderBook(listener: OrderBookListener): void {
    this.orderBookListeners.push(listener);
  }

  public onTrade(listener: TradeListener): void {
    this.tradeListeners.push(listener);
  }
}
