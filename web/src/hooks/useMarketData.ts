import { useState, useEffect } from 'react';
import { getMarketTickers } from '../lib/api/market.js';
import { SSEClient } from '../lib/realtime/sse.js';
import { TickerData } from '../types/market.js';

export function useMarketData() {
  const [tickers, setTickers] = useState<TickerData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMarketTickers()
      .then(setTickers)
      .finally(() => setLoading(false));

    SSEClient.connect();
    const unsubscribe = SSEClient.subscribe('TICKERS_UPDATE', (updatedList: TickerData[]) => {
      setTickers(updatedList);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return { tickers, loading };
}
