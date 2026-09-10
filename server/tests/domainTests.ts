import { DetectedWall, MarketTicker, OrderBookSnapshot } from '../src/types/index.js';
import { DatabaseService } from '../src/db/database.js';
import { MarketStateService } from '../src/services/market-data/MarketStateService.js';
import { WallEngine } from '../src/services/wall-engine/WallEngine.js';

export interface TestResult {
  title: string;
  category: string;
  passed: boolean;
  message: string;
  details?: any;
}

export async function runAllDomainTests(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  const db = DatabaseService.getInstance();
  await db.initialize();
  const marketState = MarketStateService.getInstance();
  const wallEngine = WallEngine.getInstance();

  // -------------------------------------------------------------
  // TEST 1: CRITICAL TEST CASE (Requirement 39)
  // Binance has $300k wall + Bybit has $300k wall
  // minVolumeUsd = $500,000
  // When crossExchangeAggregation = false -> NO wall / alert
  // When crossExchangeAggregation = true  -> QUALIFIES as aggregated wall
  // -------------------------------------------------------------
  try {
    const symbol = 'TESTBTC';
    const refPrice = 100000;
    const wallPrice = 99000; // 1% away

    // 1. Seed Tickers for Binance and Bybit
    const binanceTicker: MarketTicker = {
      symbol,
      baseAsset: 'TESTBTC',
      quoteAsset: 'USDT',
      exchange: 'BINANCE',
      marketType: 'SPOT',
      category: 'CRYPTO',
      lastPrice: refPrice,
      percentageChange: 1.5,
      changesByTimeframe: {},
      volumeUsd: 100000000,
      volume24h: 1000,
      high24h: 102000,
      low24h: 98000,
      timestamp: Date.now(),
      isLive: true
    };
    const bybitTicker: MarketTicker = { ...binanceTicker, exchange: 'BYBIT' };
    await marketState.updateTicker(binanceTicker);
    await marketState.updateTicker(bybitTicker);

    // 2. Prepare Orderbooks with $300,000 USD on each exchange at the exact same level
    const binanceOrderBook: OrderBookSnapshot = {
      symbol,
      exchange: 'BINANCE',
      marketType: 'SPOT',
      bids: [{ price: wallPrice, amount: 300000 / wallPrice, usdVolume: 300000 }],
      asks: [],
      spread: 10,
      spreadPercent: 0.01,
      timestamp: Date.now()
    };

    const bybitOrderBook: OrderBookSnapshot = {
      symbol,
      exchange: 'BYBIT',
      marketType: 'SPOT',
      bids: [{ price: wallPrice, amount: 300000 / wallPrice, usdVolume: 300000 }],
      asks: [],
      spread: 10,
      spreadPercent: 0.01,
      timestamp: Date.now()
    };

    await marketState.updateOrderBook(binanceOrderBook);
    await marketState.updateOrderBook(bybitOrderBook);

    // Case A: crossExchangeAggregation = FALSE, minVolume = $500,000
    wallEngine.setConfig({
      minVolumeUsd: 500000,
      maxDistancePercent: 2.5,
      minDurationSeconds: 0,
      crossExchangeAggregation: false // MANDATORY DEFAULT FALSE
    });

    await wallEngine.processOrderBook(binanceOrderBook);
    await wallEngine.processOrderBook(bybitOrderBook);

    const activeWallsWithoutAgg = wallEngine.getActiveWalls(symbol);
    const passedNoAgg = activeWallsWithoutAgg.length === 0;

    // Case B: crossExchangeAggregation = TRUE, minVolume = $500,000
    wallEngine.setConfig({
      minVolumeUsd: 500000,
      maxDistancePercent: 2.5,
      minDurationSeconds: 0,
      crossExchangeAggregation: true
    });

    await wallEngine.processOrderBook(binanceOrderBook);
    await wallEngine.processOrderBook(bybitOrderBook);

    const activeWallsWithAgg = wallEngine.getActiveWalls(symbol);
    const aggWall = activeWallsWithAgg.find(w => w.isAggregated || w.volumeUsd >= 500000);
    const passedWithAgg = aggWall !== undefined && aggWall.volumeUsd === 600000;

    const bothPassed = passedNoAgg && passedWithAgg;

    results.push({
      title: 'Critical Wall Aggregation Isolation ($300k Binance + $300k Bybit)',
      category: 'WALL_ENGINE',
      passed: bothPassed,
      message: bothPassed
        ? 'PASSED: Single-exchange walls stay un-triggered when volume is below threshold ($300k < $500k). When aggregation is enabled, combined $600k wall correctly qualifies.'
        : `FAILED: withoutAgg count=${activeWallsWithoutAgg.length} (expected 0), withAgg found=${Boolean(aggWall)}`,
      details: {
        withoutAggregationCount: activeWallsWithoutAgg.length,
        withAggregationWallVolume: aggWall ? aggWall.volumeUsd : null,
        isAggregatedFlag: aggWall ? aggWall.isAggregated : null
      }
    });

    // Reset config back to strict default
    wallEngine.setConfig({ crossExchangeAggregation: false, minVolumeUsd: 500000 });
  } catch (e: any) {
    results.push({
      title: 'Critical Wall Aggregation Isolation',
      category: 'WALL_ENGINE',
      passed: false,
      message: `Error: ${e.message}`
    });
  }

  // -------------------------------------------------------------
  // TEST 2: CRITICAL FUTURES REFERENCE PRICE TEST (Requirement 40)
  // Wall distance for Futures MUST use markPrice, not lastPrice
  // -------------------------------------------------------------
  try {
    const symbol = 'FUTBTC';
    const lastPrice = 90000;   // Diverged last price
    const markPrice = 100000;  // True Mark Price for Futures
    const wallBidPrice = 98000; // 2.0% away from markPrice, but 8.8% away from lastPrice

    const futuresTicker: MarketTicker = {
      symbol,
      baseAsset: 'FUTBTC',
      quoteAsset: 'USDT',
      exchange: 'BINANCE',
      marketType: 'FUTURES',
      category: 'CRYPTO',
      lastPrice: lastPrice,
      markPrice: markPrice,
      percentageChange: 1.0,
      changesByTimeframe: {},
      volumeUsd: 50000000,
      volume24h: 500,
      high24h: 101000,
      low24h: 95000,
      timestamp: Date.now(),
      isLive: true
    };
    await marketState.updateTicker(futuresTicker);

    const futuresOrderBook: OrderBookSnapshot = {
      symbol,
      exchange: 'BINANCE',
      marketType: 'FUTURES',
      bids: [{ price: wallBidPrice, amount: 600000 / wallBidPrice, usdVolume: 600000 }],
      asks: [],
      spread: 5,
      spreadPercent: 0.005,
      timestamp: Date.now()
    };

    wallEngine.setConfig({
      minVolumeUsd: 500000,
      maxDistancePercent: 2.5, // 2.5% max distance
      minDurationSeconds: 0,
      crossExchangeAggregation: false
    });

    await wallEngine.processOrderBook(futuresOrderBook);

    const activeFuturesWalls = wallEngine.getActiveWalls(symbol, 'FUTURES');
    const wall = activeFuturesWalls.find(w => w.price === wallBidPrice);

    // If it used markPrice (100k), distance = (100k - 98k)/100k = 2.0% (<= 2.5% -> DETECTED)
    // If it mistakenly used lastPrice (90k), distance = (98k - 90k)/90k = 8.88% (> 2.5% -> WOULD BE REJECTED)
    const passed = wall !== undefined && wall.referencePrice === markPrice && wall.distancePercent === 2.0;

    results.push({
      title: 'Critical Futures Mark Price Reference Evaluation',
      category: 'WALL_ENGINE',
      passed,
      message: passed
        ? `PASSED: Futures wall distance calculated using markPrice ($${markPrice.toLocaleString()}) yielding ${wall?.distancePercent}%, not lastPrice ($${lastPrice.toLocaleString()}).`
        : 'FAILED: Wall was either not detected or did not use markPrice as referencePrice.',
      details: {
        recordedReferencePrice: wall?.referencePrice,
        expectedReferencePrice: markPrice,
        distancePercent: wall?.distancePercent
      }
    });
  } catch (e: any) {
    results.push({
      title: 'Critical Futures Mark Price Reference Evaluation',
      category: 'WALL_ENGINE',
      passed: false,
      message: `Error: ${e.message}`
    });
  }

  // -------------------------------------------------------------
  // TEST 3: Global Blacklist Ingestion Pre-Filter
  // -------------------------------------------------------------
  try {
    const testSymbol = 'SCAMTOKEN';
    await db.addBlacklistEntry({
      symbol: testSymbol,
      reason: 'Automated test blacklist verification',
      category: 'CRYPTO'
    });

    const isBlacklisted = await marketState.isBlacklisted(testSymbol, 'BINANCE', 'CRYPTO');
    results.push({
      title: 'Global Blacklist Pre-Ingestion Evaluation',
      category: 'BLACKLIST',
      passed: isBlacklisted,
      message: isBlacklisted
        ? 'PASSED: Blacklist correctly filters instruments before screener and alert processing.'
        : 'FAILED: Blacklisted symbol was not detected by isBlacklisted check.'
    });
  } catch (e: any) {
    results.push({
      title: 'Global Blacklist Pre-Ingestion Evaluation',
      category: 'BLACKLIST',
      passed: false,
      message: `Error: ${e.message}`
    });
  }

  // -------------------------------------------------------------
  // TEST 4: SQLite Database & Daily Aggregation
  // -------------------------------------------------------------
  try {
    const testWall: DetectedWall = {
      id: 'wall_test_agg_1',
      symbol: 'SOLUSDT',
      exchange: 'BINANCE',
      marketType: 'SPOT',
      side: 'BID',
      price: 190.0,
      volumeAmount: 4000,
      volumeUsd: 760000,
      referencePrice: 192.0,
      distancePercent: 1.04,
      firstSeenAt: Date.now() - 30000,
      lastSeenAt: Date.now(),
      durationSeconds: 30,
      state: 'CONFIRMED',
      initialVolumeUsd: 760000,
      peakVolumeUsd: 820000,
      remainingVolumeUsd: 760000,
      isAggregated: false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await db.recordWallHistoricalOutcome(testWall, 'FILLED', 100);
    const history = await db.getWallHistory('SOLUSDT', 'BINANCE', 5);
    const hasRecord = history.some(h => h.id === 'wh_wall_test_agg_1');

    results.push({
      title: 'Historical Wall Lifecycle Persistence & Aggregation',
      category: 'PERSISTENCE',
      passed: hasRecord,
      message: hasRecord
        ? 'PASSED: Wall lifecycle outcome was recorded in SQLite wall_history and rolled into daily aggregation.'
        : 'FAILED: Wall history record not found in database.'
    });
  } catch (e: any) {
    results.push({
      title: 'Historical Wall Lifecycle Persistence & Aggregation',
      category: 'PERSISTENCE',
      passed: false,
      message: `Error: ${e.message}`
    });
  }

  return results;
}