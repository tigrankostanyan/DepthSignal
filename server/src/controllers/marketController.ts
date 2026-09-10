import { Request, Response, NextFunction } from 'express';
import { DatabaseService } from '../db/database.js';
import { MarketStateService } from '../services/market-data/MarketStateService.js';
import { WallEngine } from '../services/wall-engine/WallEngine.js';
import {
  ExchangeId,
  MarketTicker,
  MarketType,
  ScreenerFilters
} from '../types/index.js';
import { getPlanDefinition } from '../services/billing/planConfig.js';


//  market controller
export class MarketController {
  constructor(
    private readonly marketState: MarketStateService,
    private readonly wallEngine: WallEngine,
    private readonly db: DatabaseService
  ) {}

  // Build filters
  private buildFilters(req: Request): ScreenerFilters {
    return {
      searchQuery: (req.query.searchQuery as string) || '',
      category: (req.query.category as any) || 'ALL',
      marketType: (req.query.marketType as any) || 'ALL',
      exchanges: req.query.exchanges ? (req.query.exchanges as string).split(',') as any : [],
      symbols: req.query.symbols ? (req.query.symbols as string).split(',').filter(Boolean).map(s => s.toUpperCase()) : [],
      priceMin: req.query.priceMin ? parseFloat(req.query.priceMin as string) : undefined,
      priceMax: req.query.priceMax ? parseFloat(req.query.priceMax as string) : undefined,
      changeMin: req.query.changeMin ? parseFloat(req.query.changeMin as string) : undefined,
      changeMax: req.query.changeMax ? parseFloat(req.query.changeMax as string) : undefined,
      timeframe: (req.query.timeframe as any) || '1d',
      volumeMinUsd: req.query.volumeMinUsd ? parseFloat(req.query.volumeMinUsd as string) : undefined,
      volumeMaxUsd: req.query.volumeMaxUsd ? parseFloat(req.query.volumeMaxUsd as string) : undefined,
      rsiMin: req.query.rsiMin ? parseFloat(req.query.rsiMin as string) : undefined,
      rsiMax: req.query.rsiMax ? parseFloat(req.query.rsiMax as string) : undefined,
      onlyWithWalls: req.query.onlyWithWalls === 'true',
      onlyWatchlist: req.query.onlyWatchlist === 'true',
      hideBlacklisted: req.query.hideBlacklisted !== 'false',
      sortBy: (req.query.sortBy as any) || 'volumeUsd',
      sortOrder: (req.query.sortOrder as any) || 'desc'
    };
  }

  // Tickers endpoint
  tickers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const filters = this.buildFilters(req);
      let tickers = await this.marketState.filterTickers(filters);

      if (filters.onlyWithWalls) {
        const activeWalls = this.wallEngine.getActiveWalls();
        const wallSymbols = new Set(activeWalls.map((w) => w.symbol));
        tickers = tickers.filter((t) => wallSymbols.has(t.symbol));
      }

      if (filters.onlyWatchlist) {
        const userId = req.user?.id;
        // A watchlist filter only makes sense for an authenticated user.
        if (!userId) {
          res.json({ count: 0, data: [] });
          return;
        }
        const watchlists = await this.db.getWatchlists(userId);
        const wlSymbols = new Set(watchlists.flatMap((w) => w.items.map((i) => `${i.exchange}:${i.symbol}`)));
        tickers = tickers.filter((t) => wlSymbols.has(`${t.exchange}:${t.symbol}`));
      }

      // Enforce plan exchange entitlements for authenticated non-admin users, so the
      // REST snapshot matches what their realtime stream is allowed to deliver.
      const viewer = req.user;
      if (viewer && (viewer.role || '').toUpperCase() !== 'ADMIN') {
        const subscription = await this.db.getUserSubscription(viewer.id);
        const allowedSet = new Set<string>(getPlanDefinition(subscription.plan).limits.allowedExchanges);
        tickers = tickers.filter((t) => allowedSet.has(t.exchange));
      }

      // Optional hard cap so clients can request a bounded (lighter) universe.
      const limit = Number(req.query.limit);
      if (Number.isFinite(limit) && limit > 0) {
        tickers = tickers.slice(0, limit);
      }

      res.json({ count: tickers.length, data: tickers });
    } catch (err) {
      next(err);
    }
  };

  // Symbol detail endpoint
  symbolDetail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const symbol = req.params.symbol.toUpperCase().trim();
      const exchange = (req.query.exchange as ExchangeId) || 'BINANCE';
      const marketType = (req.query.marketType as MarketType) || 'SPOT';

      const ticker = await this.marketState.getTicker(exchange, marketType, symbol);
      if (!ticker) {
        res.status(404).json({
          error: 'SYMBOL_NOT_FOUND',
          message: `No market data available for ${symbol} on ${exchange} ${marketType}`
        });
        return;
      }

      const orderBook = await this.marketState.getOrderBook(exchange, marketType, symbol);
      const trades = await this.marketState.getTrades(exchange, marketType, symbol);
      const candles = this.marketState.getCandles(exchange, marketType, symbol, 80);
      const walls = this.wallEngine.getActiveWalls(symbol, marketType);

      res.json({
        ticker,
        orderBook,
        trades,
        candles,
        walls
      });
    } catch (e: any) {
      next(e);
    }
  };
}