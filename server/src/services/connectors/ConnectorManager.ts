import { ConnectorStatus, ExchangeId, MarketTicker, MarketType, OrderBookSnapshot, Trade } from '../../types/index.js';
import { BinanceConnector } from './BinanceConnector.js';
import { IExchangeConnector } from './ExchangeConnector.js';
import { AsterDEXConnector, BitgetConnector, BybitConnector, GateConnector, HyperliquidConnector, KuCoinConnector, MEXCConnector, OKXConnector, StockExchangeConnector } from './OtherConnectors.js';

export type TickerListener = (ticker: MarketTicker) => void;
export type OrderBookListener = (orderBook: OrderBookSnapshot) => void;
export type TradeListener = (trade: Trade) => void;

//  connector manager
export class ConnectorManager {
  // Instance property
  private static instance: ConnectorManager;
  // Connectors property
  private connectors = new Map<ExchangeId, IExchangeConnector>();

  // Ticker listeners property
  private tickerListeners: TickerListener[] = [];
  // Order book listeners property
  private orderBookListeners: OrderBookListener[] = [];
  // Trade listeners property
  private tradeListeners: TradeListener[] = [];

  private constructor() {
    this.registerConnectors();
  }

  // Get instance
  public static getInstance(): ConnectorManager {
    if (!ConnectorManager.instance) {
      ConnectorManager.instance = new ConnectorManager();
    }
    return ConnectorManager.instance;
  }

  // Register connectors
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

    // 4. OKX real connector
    const okx = new OKXConnector();
    this.connectors.set('OKX', okx);

    // 5. MEXC real connector
    const mexc = new MEXCConnector();
    this.connectors.set('MEXC', mexc);

    // 6. Gate.io real connector
    const gate = new GateConnector();
    this.connectors.set('GATE', gate);

    // 7. Bitget real connector
    const bitget = new BitgetConnector();
    this.connectors.set('BITGET', bitget);

    // 8. KuCoin real connector
    const kucoin = new KuCoinConnector();
    this.connectors.set('KUCOIN', kucoin);

    // 9. Hyperliquid real connector
    const hyperliquid = new HyperliquidConnector();
    this.connectors.set('HYPERLIQUID', hyperliquid);

    // 10. AsterDEX real connector
    const asterdex = new AsterDEXConnector();
    this.connectors.set('ASTERDEX', asterdex);

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

  // Start all
  public async startAll(enabledExchanges: ExchangeId[]): Promise<void> {
    console.log(`[ConnectorManager] Starting connectors for: ${enabledExchanges.join(', ')}`);
    for (const [id, connector] of this.connectors.entries()) {
      if (enabledExchanges.includes(id)) {
        try {
          await connector.connect();
        } catch (e: any) {
          console.error(`[ConnectorManager] Failed starting ${id}:`, e.message);
        }
      }
    }
  }

  // Stop all
  public async stopAll(): Promise<void> {
    for (const connector of this.connectors.values()) {
      await connector.disconnect();
    }
  }

  // Get connector statuses
  public getConnectorStatuses(): ConnectorStatus[] {
    const list: ConnectorStatus[] = [];
    for (const connector of this.connectors.values()) {
      list.push(connector.getStatus());
    }
    return list;
  }

  // Subscribe symbols
  public subscribeSymbols(exchange: ExchangeId, symbols: string[], marketType: MarketType): void {
    const connector = this.connectors.get(exchange);
    if (connector) {
      connector.subscribeSymbols(symbols, marketType);
    }
  }

  // On ticker
  public onTicker(listener: TickerListener): void {
    this.tickerListeners.push(listener);
  }

  // On order book
  public onOrderBook(listener: OrderBookListener): void {
    this.orderBookListeners.push(listener);
  }

  // On trade
  public onTrade(listener: TradeListener): void {
    this.tradeListeners.push(listener);
  }
}
