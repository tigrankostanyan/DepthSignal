'use client';

import React, { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { SymbolFocusView } from '@/components/Focus/SymbolFocusView';
import { useApp, useRealtimeData } from '@/providers/AppProviders';
import type { ExchangeId, MarketType } from '@/types/index';

function FocusContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const { isSymbolWatchlisted, handleToggleWatchlist, openSymbolFocus } = useApp();
  const { tickers, alertTriggers } = useRealtimeData();

  let symbol = searchParams.get('sym') || '';
  let exchange = (searchParams.get('ex') || 'BINANCE') as ExchangeId;
  let marketType = (searchParams.get('mt') || 'SPOT') as MarketType;

  if (!symbol && tickers.length > 0) {
    const defaultTicker = tickers.find((t) => t.symbol === 'BTCUSDT') || [...tickers].sort((a, b) => b.volumeUsd - a.volumeUsd)[0];
    if (defaultTicker) {
      symbol = defaultTicker.symbol;
      exchange = defaultTicker.exchange;
      marketType = defaultTicker.marketType;
    }
  }

  if (!symbol) {
    return (
      <div className="flex-1 flex items-center justify-center bg-primary">
        <div className="text-xs text-muted animate-pulse">Initializing market terminal...</div>
      </div>
    );
  }

  return (
    <SymbolFocusView
      symbol={symbol}
      exchange={exchange}
      marketType={marketType}
      onBack={() => router.push('/screener')}
      onSelectSymbol={openSymbolFocus}
      allTickers={tickers}
      alertTriggers={alertTriggers}
      onToggleWatchlist={(sym, ex, mt) => {
        handleToggleWatchlist(sym, ex as ExchangeId, mt as MarketType).catch(() => {});
      }}
      isWatchlisted={isSymbolWatchlisted(symbol, exchange, marketType)}
    />
  );
}

export default function FocusPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center bg-primary">
          <div className="text-xs text-muted">Loading focus terminal...</div>
        </div>
      }
    >
      <FocusContent />
    </Suspense>
  );
}
