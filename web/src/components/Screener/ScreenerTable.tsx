'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ArrowUpDown, Star, ExternalLink } from 'lucide-react';
import type {
  MarketTicker,
  ScreenerFilters,
  DetectedWall,
  AlertTrigger,
  ExchangeId,
  MarketType,
} from '@/types/index';
import { formatPrice, formatSignedPercent, formatVolume, formatCompactPrice, formatAmount, formatPercent } from '@/lib/format';
import { Badge } from '@/components/ui/Badge';
import { IconButton } from '@/components/ui/IconButton';
import { EmptyState } from '@/components/ui/EmptyState';

export interface WallSummary {
  bidWalls: number;
  askWalls: number;
  walls: DetectedWall[];
}

interface ScreenerTableRowProps {
  ticker: MarketTicker;
  timeframe: string;
  isWatchlisted: boolean;
  wallData: WallSummary | undefined;
  signalColor: 'green' | 'red' | 'yellow' | null;
  onSelectSymbol: (symbol: string, exchange: ExchangeId, marketType: MarketType) => void;
  onToggleWatchlist: (symbol: string, exchange: ExchangeId, marketType: MarketType) => void;
}

const ScreenerTableRow = React.memo(({
  ticker,
  timeframe,
  isWatchlisted,
  wallData,
  signalColor,
  onSelectSymbol,
  onToggleWatchlist,
  style,
}: ScreenerTableRowProps & { style?: React.CSSProperties }) => {
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);
  const prevPrice = useRef(ticker.lastPrice);

  useEffect(() => {
    if (ticker.lastPrice > prevPrice.current) {
      setFlash('up');
      const timer = setTimeout(() => setFlash(null), 1000);
      prevPrice.current = ticker.lastPrice;
      return () => clearTimeout(timer);
    } else if (ticker.lastPrice < prevPrice.current) {
      setFlash('down');
      const timer = setTimeout(() => setFlash(null), 1000);
      prevPrice.current = ticker.lastPrice;
      return () => clearTimeout(timer);
    }
  }, [ticker.lastPrice]);
  const signalBg =
    signalColor === 'green'
      ? 'bg-[#0ECB81]/15'
      : signalColor === 'red'
        ? 'bg-[#F6465D]/15'
        : signalColor === 'yellow'
          ? 'bg-[#F0B90B]/15'
          : '';

  const tfChange =
    ticker.changesByTimeframe && ticker.changesByTimeframe[timeframe as keyof typeof ticker.changesByTimeframe] !== undefined
      ? ticker.changesByTimeframe[timeframe as keyof typeof ticker.changesByTimeframe]!
      : ticker.percentageChange;

  const isPositive = tfChange >= 0;
  const avatar = getSymbolAvatar(ticker.symbol);

  const rangeDiff = ticker.high24h - ticker.low24h;
  const rangePct =
    rangeDiff > 0 ? Math.min(100, Math.max(0, ((ticker.lastPrice - ticker.low24h) / rangeDiff) * 100)) : 50;

  const totalWalls = wallData ? wallData.bidWalls + wallData.askWalls : 0;
  const primaryWall = wallData?.walls[0];

  return (
    <tr
      style={style}
      onClick={() => onSelectSymbol(ticker.symbol, ticker.exchange, ticker.marketType)}
      className={`cursor-pointer group transition-colors duration-150 ${signalBg} hover:bg-surface/80 ${
        flash === 'up' ? 'flash-up' : flash === 'down' ? 'flash-down' : ''
      }`}
    >
      <td
        className="py-3 px-3 text-center"
        onClick={(e) => {
          e.stopPropagation();
          onToggleWatchlist(ticker.symbol, ticker.exchange, ticker.marketType);
        }}
      >
        <button
          className="text-muted hover:text-[#F0B90B] transition cursor-pointer"
          title={isWatchlisted ? 'Remove from watchlist' : 'Add to watchlist'}
        >
          <Star size={14} className={isWatchlisted ? 'fill-[#F0B90B] text-[#F0B90B]' : 'text-muted'} />
        </button>
      </td>

      <td className="py-3 px-4 font-sans">
        <div className="flex items-center space-x-3">
          <div className={`w-8 h-8 rounded-full ${avatar.bg} flex items-center justify-center text-xs shrink-0`}>
            <span className={avatar.text}>{avatar.icon}</span>
          </div>
          <div>
            <div className="text-sm font-bold text-main group-hover:text-[#24C4E8] transition flex items-center gap-1.5">
              <span className="font-extrabold tracking-tight text-main">{ticker.symbol}</span>
              <Badge tone={ticker.marketType === 'FUTURES' ? 'purple' : 'sky'} className="uppercase">
                {ticker.marketType === 'FUTURES' ? 'PERP' : 'SPOT'}
              </Badge>
            </div>
            <div className="text-[11px] text-muted font-medium font-sans mt-0.5">
              {ticker.exchange} {ticker.marketType === 'FUTURES' ? 'Futures' : 'Market'}
            </div>
          </div>
        </div>
      </td>

      <td className="py-3 px-3 text-right">
        <div className="font-bold text-sm text-main tabular-nums">{`$${formatPrice(ticker.lastPrice)}`}</div>
        {ticker.marketType === 'FUTURES' && ticker.markPrice && (
          <div className="text-[10px] text-muted font-medium tabular-nums">
            Mark: {`$${formatPrice(ticker.markPrice)}`}
          </div>
        )}
      </td>

      <td className="py-3 px-3 text-right">
        <Badge tone={isPositive ? 'green' : 'red'} size="md" className="tabular-nums">
          {formatSignedPercent(tfChange)}
        </Badge>
      </td>

      <td className="py-3 px-3 hidden md:table-cell">
        <div className="w-24 mx-auto">
          <div className="flex justify-between text-[9px] text-muted font-medium mb-0.5 tabular-nums">
            <span>{`$${formatCompactPrice(ticker.low24h)}`}</span>
            <span>{`$${formatCompactPrice(ticker.high24h)}`}</span>
          </div>
          <div className="w-full bg-primary h-1.5 rounded-full overflow-hidden border border-divider/50">
            <div className="bg-[#168FD6] h-full rounded-full" style={{ width: `${rangePct}%` }} />
          </div>
        </div>
      </td>

      <td className="py-3 px-4 text-right hidden sm:table-cell text-main font-bold text-sm">
        {`$${formatVolume(ticker.volumeUsd)}`}
      </td>

      <td className="py-3 px-3 text-right hidden lg:table-cell">
        <span
          className={`text-sm font-bold ${
            (ticker.rsi || 50) >= 70
              ? 'text-ask'
              : (ticker.rsi || 50) <= 30
                ? 'text-bid'
                : 'text-main'
          }`}
        >
          {formatAmount(ticker.rsi ?? 50, 1)}
        </span>
      </td>

      <td className="py-3 px-3 text-right hidden xl:table-cell text-muted font-medium text-sm">
        {formatPercent(ticker.volatility24h ?? 0.8, 1)}
      </td>

      <td className="py-3 px-4 text-center">
        {totalWalls > 0 ? (
          <Badge
            tone={primaryWall?.state === 'FORMING' ? 'yellow' : primaryWall?.side === 'BID' ? 'green' : 'red'}
            size="md"
            className="gap-1.5 uppercase tracking-wide"
          >
            <span
              className="w-2 h-2 rounded-full bg-current"
            />
            {primaryWall?.state === 'FORMING'
              ? 'Forming Wall'
              : primaryWall?.side === 'BID'
                ? 'Support Wall'
                : 'Resist. Wall'}
          </Badge>
        ) : (
          <Badge tone="neutral" size="md" className="uppercase font-sans">
            Stable
          </Badge>
        )}
      </td>

      <td className="py-3 px-3 text-center">
        <IconButton size="sm" title="Open symbol analysis" icon={<ExternalLink size={13} />} />
      </td>
    </tr>
  );
});

interface ScreenerTableProps {
  tickers: MarketTicker[];
  filters: ScreenerFilters;
  watchlistedKeys: Set<string>;
  wallsBySymbol: Map<string, WallSummary>;
  latestTriggerBySymbol: Map<string, AlertTrigger>;
  onSort: (field: keyof MarketTicker) => void;
  onSelectSymbol: (symbol: string, exchange: ExchangeId, marketType: MarketType) => void;
  onToggleWatchlist: (symbol: string, exchange: ExchangeId, marketType: MarketType) => void;
}

function getRowSignalColor(
  ticker: MarketTicker,
  wallData: WallSummary | undefined,
  trigger: AlertTrigger | undefined,
): 'green' | 'red' | 'yellow' | null {
  // 1. Live Alert trigger (only if triggered recently in real-time, within last 15 seconds)
  if (trigger && Date.now() - trigger.timestamp < 15000) {
    switch (trigger.conditionType) {
      case 'PRICE_ABOVE':
      case 'RSI_OVERSOLD':
      case 'MACD_CROSSOVER':
        return 'green';
      case 'PRICE_BELOW':
      case 'RSI_OVERBOUGHT':
        return 'red';
      case 'WALL_DETECTED':
        return 'yellow';
      default:
        break;
    }
  }

  // 2. Active order book walls — only when active walls are currently present
  if (wallData && wallData.walls && wallData.walls.length > 0) {
    if (wallData.walls.some((w) => w.state === 'FORMING')) return 'yellow';
    if (wallData.bidWalls > 0) return 'green';
    if (wallData.askWalls > 0) return 'red';
  }

  return null;
}

function getSymbolAvatar(symbol: string) {
  const s = symbol.toUpperCase();
  const bg = 'bg-panel border border-divider'; // Consistent dark theme token
  
  if (s.startsWith('BTC')) {
    return { icon: '₿', bg, text: 'text-[#F7931A] font-black' };
  }
  if (s.startsWith('ETH')) {
    return { icon: 'Ξ', bg, text: 'text-[#627EEA] font-bold' };
  }
  if (s.startsWith('SOL')) {
    return { icon: '◎', bg, text: 'text-[#14F195] font-bold' };
  }
  if (s.startsWith('BNB')) {
    return { icon: 'BNB', bg, text: 'text-[#F3BA2F] font-black text-[10px]' };
  }
  if (s.startsWith('ADA')) {
    return { icon: '₳', bg, text: 'text-[#3B82F6] font-bold' };
  }
  if (s.startsWith('XRP')) {
    return { icon: '✕', bg, text: 'text-[#00AAE4] font-black' };
  }
  if (s.startsWith('DOGE')) {
    return { icon: 'Ð', bg, text: 'text-[#C2A633] font-black' };
  }
  if (s.startsWith('LINK')) {
    return { icon: '⬡', bg, text: 'text-[#375BD2] font-bold' };
  }
  if (s.startsWith('AVAX')) {
    return { icon: '▲', bg, text: 'text-[#E84142] font-black' };
  }
  if (s.startsWith('SUI')) {
    return { icon: '💧', bg, text: 'text-[#38BDF8] font-bold text-[10px]' };
  }
  if (s.startsWith('DOT')) {
    return { icon: '●', bg, text: 'text-[#E6007A] font-black' };
  }
  if (s.startsWith('MATIC') || s.startsWith('POL')) {
    return { icon: 'M', bg, text: 'text-[#8247E5] font-black' };
  }
  if (s.startsWith('NVDA')) {
    return { icon: 'N', bg, text: 'text-[#76B900] font-black' };
  }
  if (s.startsWith('AAPL')) {
    return { icon: '', bg, text: 'text-[#94A3B8] font-bold' };
  }
  if (s.startsWith('TSLA')) {
    return { icon: 'T', bg, text: 'text-[#E82127] font-black' };
  }
  return { icon: s.slice(0, 1), bg, text: 'text-muted font-bold' };
}

import { useVirtualizer } from '@tanstack/react-virtual';

export const ScreenerTable: React.FC<ScreenerTableProps> = React.memo(({
  tickers,
  filters,
  watchlistedKeys,
  wallsBySymbol,
  latestTriggerBySymbol,
  onSort,
  onSelectSymbol,
  onToggleWatchlist,
}) => {
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: tickers.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 50, // Approx height of each tr
    overscan: 10,
  });

  // When a new symbol is starred, jump back to the top so the user immediately
  // sees their starred row pinned at the head of the list.
  const prevStarredCount = useRef(watchlistedKeys.size);
  React.useEffect(() => {
    if (watchlistedKeys.size > prevStarredCount.current) {
      rowVirtualizer.scrollToOffset(0);
    }
    prevStarredCount.current = watchlistedKeys.size;
  }, [watchlistedKeys, rowVirtualizer]);
  return (
    <div className="flex-1 overflow-auto" ref={parentRef}>
      <table className="w-full text-left border-collapse text-xs select-none relative">
        <thead className="sticky top-0 z-20 bg-card border-b border-divider text-[11px] font-bold text-muted uppercase tracking-wider">
          <tr>
            <th className="py-3 px-3 w-10 text-center">★</th>
            <th className="py-3 px-4 cursor-pointer hover:text-white transition-colors" onClick={() => onSort('symbol')}>
              <div className="flex items-center space-x-1">
                <span>Symbol / Exchange</span>
                <ArrowUpDown size={11} />
              </div>
            </th>
            <th className="py-3 px-3 text-right cursor-pointer hover:text-white transition-colors" onClick={() => onSort('lastPrice')}>
              <div className="flex items-center justify-end space-x-1">
                <span>Last Price</span>
                <ArrowUpDown size={11} />
              </div>
            </th>
            <th
              className="py-3 px-3 text-right cursor-pointer hover:text-white transition-colors"
              onClick={() => onSort('percentageChange')}
            >
              <div className="flex items-center justify-end space-x-1">
                <span>24h Chg ({filters.timeframe})</span>
                <ArrowUpDown size={11} />
              </div>
            </th>
            <th className="py-3 px-3 text-center hidden md:table-cell">24h Range</th>
            <th
              className="py-3 px-4 text-right cursor-pointer hover:text-white transition-colors hidden sm:table-cell"
              onClick={() => onSort('volumeUsd')}
            >
              <div className="flex items-center justify-end space-x-1">
                <span>24h Volume</span>
                <ArrowUpDown size={11} />
              </div>
            </th>
            <th className="py-3 px-3 text-right hidden lg:table-cell">RSI (14)</th>
            <th className="py-3 px-3 text-right hidden xl:table-cell">Volat.</th>
            <th className="py-3 px-4 text-center">Wall Status</th>
            <th className="py-3 px-3 text-center w-12">Action</th>
          </tr>
        </thead>
        <tbody
          className="divide-y divide-divider font-mono text-[11px]"
        >
          {tickers.length === 0 ? (
            <tr>
              <td colSpan={10}>
                <EmptyState message="No market instruments match the active filters or blacklist criteria." />
              </td>
            </tr>
          ) : (
            <>
              {rowVirtualizer.getVirtualItems().length > 0 && (
                <tr>
                  <td colSpan={10} style={{ height: `${rowVirtualizer.getVirtualItems()[0]?.start ?? 0}px`, padding: 0, border: 0 }} />
                </tr>
              )}
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const ticker = tickers[virtualRow.index];
                const rowKey = `${ticker.exchange}:${ticker.marketType}:${ticker.symbol}`;
                const isWatchlisted = watchlistedKeys.has(rowKey);
                const wallData = wallsBySymbol.get(rowKey);
                const signalColor = getRowSignalColor(ticker, wallData, latestTriggerBySymbol.get(rowKey));

                return (
                  <ScreenerTableRow
                    key={rowKey}
                    ticker={ticker}
                    timeframe={filters.timeframe}
                    isWatchlisted={isWatchlisted}
                    wallData={wallData}
                    signalColor={signalColor}
                    onSelectSymbol={onSelectSymbol}
                    onToggleWatchlist={onToggleWatchlist}
                  />
                );
              })}
              {rowVirtualizer.getVirtualItems().length > 0 && (
                <tr>
                  <td colSpan={10} style={{ height: `${rowVirtualizer.getTotalSize() - (rowVirtualizer.getVirtualItems()[rowVirtualizer.getVirtualItems().length - 1]?.end ?? 0)}px`, padding: 0, border: 0 }} />
                </tr>
              )}
            </>
          )}
        </tbody>
      </table>
    </div>
  );
});
