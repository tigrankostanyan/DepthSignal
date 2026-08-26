import { apiClient } from './client.js';
import { TickerData } from '../../types/market.js';

export async function getMarketTickers(): Promise<TickerData[]> {
  return apiClient<TickerData[]>('/api/screener/tickers');
}

export async function getSymbolTicker(symbol: string): Promise<TickerData> {
  return apiClient<TickerData>(`/api/screener/ticker/${symbol}`);
}
