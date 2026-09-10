import { ConnectorStatus, ExchangeId, MarketTicker, MarketType, OrderBookSnapshot, Trade } from '../../types/index.js';

export type TickerHandler = (ticker: MarketTicker) => void;
export type OrderBookHandler = (orderBook: OrderBookSnapshot) => void;
export type TradeHandler = (trade: Trade) => void;
export type StatusChangeHandler = (status: ConnectorStatus) => void;

//  i exchange connector
export interface IExchangeConnector {
  readonly exchangeId: ExchangeId;
  readonly name: string;
  readonly isProductionReady: boolean;
  
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  
  subscribeSymbols(symbols: string[], marketType: MarketType): void;
  unsubscribeSymbols(symbols: string[], marketType: MarketType): void;
  
  onTicker(handler: TickerHandler): void;
  onOrderBook(handler: OrderBookHandler): void;
  onTrade(handler: TradeHandler): void;
  onStatusChange(handler: StatusChangeHandler): void;
  
  getStatus(): ConnectorStatus;
}

//  base exchange connector
export abstract class BaseExchangeConnector implements IExchangeConnector {
  // Exchange id property
  public abstract readonly exchangeId: ExchangeId;
  // Name property
  public abstract readonly name: string;
  // Is production ready property
  public abstract readonly isProductionReady: boolean;

  // Ticker handlers property
  protected tickerHandlers: TickerHandler[] = [];
  // Order book handlers property
  protected orderBookHandlers: OrderBookHandler[] = [];
  // Trade handlers property
  protected tradeHandlers: TradeHandler[] = [];
  // Status handlers property
  protected statusHandlers: StatusChangeHandler[] = [];

  // Status property
  protected status: ConnectorStatus = {
    exchange: 'BINANCE',
    name: '',
    connected: false,
    status: 'DISCONNECTED',
    pingMs: 0,
    lastMessageAt: 0,
    subscribedSymbolsCount: 0,
    isProductionReady: false
  };

  // Connect
  public abstract connect(): Promise<void>;
  // Disconnect
  public abstract disconnect(): Promise<void>;
  // Subscribe symbols
  public abstract subscribeSymbols(symbols: string[], marketType: MarketType): void;
  // Unsubscribe symbols
  public abstract unsubscribeSymbols(symbols: string[], marketType: MarketType): void;

  // On ticker
  public onTicker(handler: TickerHandler): void {
    this.tickerHandlers.push(handler);
  }

  // On order book
  public onOrderBook(handler: OrderBookHandler): void {
    this.orderBookHandlers.push(handler);
  }

  // On trade
  public onTrade(handler: TradeHandler): void {
    this.tradeHandlers.push(handler);
  }

  // On status change
  public onStatusChange(handler: StatusChangeHandler): void {
    this.statusHandlers.push(handler);
  }

  // Get status
  public getStatus(): ConnectorStatus {
    return { ...this.status };
  }

  // Update status
  protected updateStatus(partial: Partial<ConnectorStatus>): void {
    this.status = { ...this.status, ...partial };
    this.statusHandlers.forEach(h => h(this.getStatus()));
  }

  // Log error
  protected logError(message: string, error?: any): void {
    console.error(`[${this.exchangeId}] ${message}`, error || '');
  }

  // Emit ticker
  protected emitTicker(ticker: MarketTicker): void {
    this.tickerHandlers.forEach(h => h(ticker));
  }

  // Emit order book
  protected emitOrderBook(orderBook: OrderBookSnapshot): void {
    this.orderBookHandlers.forEach(h => h(orderBook));
  }

  // Emit trade
  protected emitTrade(trade: Trade): void {
    this.tradeHandlers.forEach(h => h(trade));
  }
}
