export interface TickerData {
  symbol: string;
  exchange: string;
  price: number;
  change24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  rsi?: number;
  fundingRate?: number;
  bidDepthUsd?: number;
  askDepthUsd?: number;
  wallRatio?: number;
  lastUpdated: number;
}

export interface WallCluster {
  id: string;
  symbol: string;
  exchange: string;
  side: 'BUY' | 'SELL';
  priceLevel: number;
  volumeUsd: number;
  distancePct: number;
  ordersCount: number;
  timestamp: number;
}
