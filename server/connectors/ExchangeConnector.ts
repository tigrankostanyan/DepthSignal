import { ConnectorStatus, ExchangeId, MarketTicker, MarketType, OrderBookSnapshot, Trade } from '../../src/types/index.js';

export type TickerHandler = (ticker: MarketTicker) => void;
export type OrderBookHandler = (orderBook: OrderBookSnapshot) => void;
export type TradeHandler = (trade: Trade) => void;
export type StatusChangeHandler = (status: ConnectorStatus) => void;

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

export abstract class BaseExchangeConnector implements IExchangeConnector {
  public abstract readonly exchangeId: ExchangeId;
  public abstract readonly name: string;
  public abstract readonly isProductionReady: boolean;

  protected tickerHandlers: TickerHandler[] = [];
  protected orderBookHandlers: OrderBookHandler[] = [];
  protected tradeHandlers: TradeHandler[] = [];
  protected statusHandlers: StatusChangeHandler[] = [];

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

  public abstract connect(): Promise<void>;
  public abstract disconnect(): Promise<void>;
  public abstract subscribeSymbols(symbols: string[], marketType: MarketType): void;
  public abstract unsubscribeSymbols(symbols: string[], marketType: MarketType): void;

  public onTicker(handler: TickerHandler): void {
    this.tickerHandlers.push(handler);
  }

  public onOrderBook(handler: OrderBookHandler): void {
    this.orderBookHandlers.push(handler);
  }

  public onTrade(handler: TradeHandler): void {
    this.tradeHandlers.push(handler);
  }

  public onStatusChange(handler: StatusChangeHandler): void {
    this.statusHandlers.push(handler);
  }

  public getStatus(): ConnectorStatus {
    return { ...this.status };
  }

  protected updateStatus(partial: Partial<ConnectorStatus>): void {
    this.status = { ...this.status, ...partial };
    this.statusHandlers.forEach(h => h(this.getStatus()));
  }

  protected emitTicker(ticker: MarketTicker): void {
    this.tickerHandlers.forEach(h => h(ticker));
  }

  protected emitOrderBook(orderBook: OrderBookSnapshot): void {
    this.orderBookHandlers.forEach(h => h(orderBook));
  }

  protected emitTrade(trade: Trade): void {
    this.tradeHandlers.forEach(h => h(trade));
  }
}
