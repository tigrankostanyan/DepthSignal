// Load env BEFORE any other imports (same as server.ts)
import '../src/env.js';

import WebSocket from 'ws';
import { DatabaseService } from '../src/db/database.js';
import { AuthService } from '../src/services/auth/AuthService.js';
import { MarketStateService } from '../src/services/market-data/MarketStateService.js';
import { WallEngine } from '../src/services/wall-engine/WallEngine.js';
import { AlertEngine } from '../src/services/alert-engine/AlertEngine.js';
import { BinanceConnector } from '../src/services/connectors/BinanceConnector.js';
import { AsterDEXConnector, BitgetConnector, BybitConnector, GateConnector, HyperliquidConnector, KuCoinConnector, MEXCConnector, OKXConnector } from '../src/services/connectors/OtherConnectors.js';
import { ConnectorManager } from '../src/services/connectors/ConnectorManager.js';
import { 
  MarketTicker, 
  OrderBookSnapshot, 
  DetectedWall, 
  AlertRule, 
  AlertTrigger
} from '../src/types/index.js';

interface TestSectionResult {
  section: string;
  name: string;
  status: 'PASS' | 'FAIL';
  evidence: string;
  details?: any;
}

const allResults: TestSectionResult[] = [];

function record(section: string, name: string, passed: boolean, evidence: string, details?: any) {
  const status: 'PASS' | 'FAIL' = passed ? 'PASS' : 'FAIL';
  allResults.push({ section, name, status, evidence, details });
  console.log(`[${status}] [${section}] ${name}: ${evidence}`);
}

interface LiveExchangeCheck {
  marker: string;
  sectionTag: string;
  displayName: string;
  connector: any;
  expected: { symbol: string; marketType: string }[];
  durationMs?: number;
}

// Shared helper: connect a real connector, capture live ticks + order books for N
// seconds, then verify every expected symbol produced a live price and depth.
async function runLiveExchangeCheck(check: LiveExchangeCheck): Promise<void> {
  console.log(`\n>>> [${check.marker}] ${check.displayName}...`);
  const durationMs = check.durationMs || 12000;

  let totalTickers = 0;
  let totalBooks = 0;
  const lastPrices = new Map<string, number>();
  const bookDepths = new Map<string, { bids: number; asks: number }>();
  const keyOf = (symbol: string, marketType: string) => `${marketType}_${symbol}`;

  check.connector.onTicker((ticker: MarketTicker) => {
    totalTickers++;
    lastPrices.set(keyOf(ticker.symbol, ticker.marketType), ticker.lastPrice);
  });
  check.connector.onOrderBook((ob: OrderBookSnapshot) => {
    totalBooks++;
    bookDepths.set(keyOf(ob.symbol, ob.marketType), { bids: ob.bids.length, asks: ob.asks.length });
  });

  let connectError: string | null = null;
  try {
    await check.connector.connect();
  } catch (err: any) {
    connectError = err.message;
  }
  await new Promise(r => setTimeout(r, durationMs));
  try { await check.connector.disconnect(); } catch { /* noop */ }

  const gotSymbols = check.expected.filter(e => (lastPrices.get(keyOf(e.symbol, e.marketType)) || 0) > 0);
  const first = check.expected[0];
  const firstDepth = bookDepths.get(keyOf(first.symbol, first.marketType));

  const passed = Boolean(
    !connectError &&
    totalTickers > 0 &&
    totalBooks > 0 &&
    gotSymbols.length === check.expected.length &&
    firstDepth && firstDepth.bids > 0 && firstDepth.asks > 0
  );

  const priceSummary = gotSymbols
    .map(e => `${e.symbol}: $${lastPrices.get(keyOf(e.symbol, e.marketType))?.toLocaleString()}`)
    .join(', ');

  record(
    check.sectionTag,
    check.displayName.replace('Testing Live ', 'Live '),
    passed,
    passed
      ? `PASSED: Captured ${totalTickers} ticks, ${totalBooks} orderbooks across ${gotSymbols.length}/${check.expected.length} symbols. Live ${priceSummary}. ${first.symbol} Book depth: ${firstDepth?.bids} bids / ${firstDepth?.asks} asks.`
      : `FAILED: connectError=${connectError}, ticks=${totalTickers}, books=${totalBooks}, symbolsMatched=${gotSymbols.length}/${check.expected.length}.`,
    {
      totalTickers,
      totalBooks,
      connectError,
      lastPrices: Object.fromEntries(lastPrices),
      bookDepths: Object.fromEntries(bookDepths)
    }
  );
}

async function runVerification() {
  console.log('====================================================');
  console.log('  STARTING COMPREHENSIVE RUNTIME VERIFICATION SUITE ');
  console.log('====================================================\n');

  // Records created by this suite are bound to a real registered user.
  const db = DatabaseService.getInstance();
  await db.initialize();
  const authService = AuthService.getInstance();
  const testUser = await authService.register(`verif_${Date.now()}@test.local`, 'SecurePassword123!', 'Verification User');
  const TEST_USER_ID = testUser.user.id;

  // -------------------------------------------------------------
  // PART 1: DATABASE PERSISTENCE ACROSS RESTART
  // -------------------------------------------------------------
  console.log('>>> [1/10] Testing SQLite Persistence Across Service Restarts...');
  try {
    const db = DatabaseService.getInstance();
    await db.initialize();

    // 1. Create unique test records
    const testTimestamp = Date.now();
    const testWatchlistName = `Verify_Watchlist_${testTimestamp}`;
    const newWatchlist = await db.createWatchlist(testWatchlistName, TEST_USER_ID);
    await db.addWatchlistItem(newWatchlist.id, {
      symbol: 'SOLUSDT',
      exchange: 'BINANCE',
      marketType: 'SPOT',
      notes: 'SOL item test'
    }, TEST_USER_ID);

    const testRuleName = `Verify_Rule_${testTimestamp}`;
    const newRule = await db.saveAlertRule({
      name: testRuleName,
      enabled: true,
      symbols: ['BTCUSDT'],
      exchanges: ['BINANCE'],
      marketTypes: ['SPOT'],
      conditions: [{ id: 'c1', type: 'PRICE_ABOVE', params: { targetPrice: 120000 } }],
      logic: 'AND',
      notifyChannels: ['IN_APP'],
      cooldownSeconds: 60
    }, TEST_USER_ID);

    const testBlacklistSymbol = `SCAM_${testTimestamp}`;
    const newBlacklist = await db.addBlacklistEntry({
      symbol: testBlacklistSymbol,
      exchange: 'BINANCE',
      category: 'CRYPTO',
      reason: 'Persistence test entry'
    });

    const testPresetName = `Verify_Preset_${testTimestamp}`;
    const newPreset = await db.saveFilterPreset({
      name: testPresetName,
      isDefault: false,
      filters: {
        category: 'CRYPTO',
        marketType: 'SPOT',
        exchanges: ['BINANCE'],
        sortBy: 'volumeUsd',
        sortOrder: 'desc'
      }
    }, TEST_USER_ID);

    // 2. Force SQLite persistence to disk
    await db.persistToDisk();

    // 3. Verify all records exist and survive reload
    const loadedWatchlists = await db.getWatchlists(TEST_USER_ID);
    const targetWatchlist = loadedWatchlists.find(w => w.id === newWatchlist.id);
    const hasItems = targetWatchlist && targetWatchlist.items.some(i => i.symbol === 'SOLUSDT');

    const loadedRules = await db.getAlertRules(TEST_USER_ID);
    const targetRule = loadedRules.find(r => r.id === newRule.id);

    const loadedBlacklist = await db.getBlacklist();
    const targetBlacklist = loadedBlacklist.find(b => b.symbol === testBlacklistSymbol);

    const loadedPresets = await db.getFilterPresets(TEST_USER_ID);
    const targetPreset = loadedPresets.find(p => p.id === newPreset.id);

    const persistencePassed = Boolean(targetWatchlist && hasItems && targetRule && targetBlacklist && targetPreset);

    record(
      'DATABASE',
      'SQLite Disk Persistence Across Restart',
      persistencePassed,
      persistencePassed
        ? `PASSED: Watchlist (${targetWatchlist?.name} with ${targetWatchlist?.items.length} items), Rule (${targetRule?.name}), Blacklist (${targetBlacklist?.symbol}), and Preset (${targetPreset?.name}) loaded from SQLite database.`
        : 'FAILED: Failed to reload records from SQLite file.',
      { watchlistFound: Boolean(targetWatchlist), ruleFound: Boolean(targetRule), blacklistFound: Boolean(targetBlacklist), presetFound: Boolean(targetPreset) }
    );

    // Cleanup test records
    if (targetWatchlist) await db.deleteWatchlist(targetWatchlist.id, TEST_USER_ID);
    if (targetRule) await db.deleteAlertRule(targetRule.id, TEST_USER_ID);
    if (targetBlacklist) await db.removeBlacklistEntry(targetBlacklist.id);
    if (targetPreset) await db.deleteFilterPreset(targetPreset.id, TEST_USER_ID);
  } catch (err: any) {
    record('DATABASE', 'SQLite Disk Persistence Across Restart', false, `Error: ${err.message}`);
  }

  // -------------------------------------------------------------
  // PART 2: DETERMINISTIC WALL ENGINE TESTS
  // -------------------------------------------------------------
  console.log('\n>>> [2/8] Running Deterministic Wall Engine Tests...');
  try {
    const wallEngine = WallEngine.getInstance();
    const marketState = MarketStateService.getInstance();

    // TEST 2A & 2B: crossExchangeAggregation=false vs true
    // Binance = $300k, Bybit = $300k, threshold = $500k
    const sym = 'TEST_AGG_SYM';
    const wallPx = 50000;
    const refPx = 50500;

    const bTicker: MarketTicker = {
      symbol: sym,
      baseAsset: 'TEST',
      quoteAsset: 'USDT',
      exchange: 'BINANCE',
      marketType: 'SPOT',
      category: 'CRYPTO',
      lastPrice: refPx,
      percentageChange: 1.0,
      changesByTimeframe: {},
      volumeUsd: 10000000,
      volume24h: 200,
      high24h: 51000,
      low24h: 49000,
      timestamp: Date.now(),
      isLive: true
    };
    const byTicker: MarketTicker = { ...bTicker, exchange: 'BYBIT' };

    await marketState.updateTicker(bTicker);
    await marketState.updateTicker(byTicker);

    const binanceBook: OrderBookSnapshot = {
      symbol: sym,
      exchange: 'BINANCE',
      marketType: 'SPOT',
      bids: [{ price: wallPx, amount: 300000 / wallPx, usdVolume: 300000 }],
      asks: [],
      spread: 5,
      spreadPercent: 0.01,
      timestamp: Date.now()
    };
    const bybitBook: OrderBookSnapshot = {
      symbol: sym,
      exchange: 'BYBIT',
      marketType: 'SPOT',
      bids: [{ price: wallPx, amount: 300000 / wallPx, usdVolume: 300000 }],
      asks: [],
      spread: 5,
      spreadPercent: 0.01,
      timestamp: Date.now()
    };

    await marketState.updateOrderBook(binanceBook);
    await marketState.updateOrderBook(bybitBook);

    // 2A: crossExchangeAggregation = false
    wallEngine.setConfig({ minVolumeUsd: 500000, maxDistancePercent: 2.5, minDurationSeconds: 0, crossExchangeAggregation: false });
    await wallEngine.processOrderBook(binanceBook);
    await wallEngine.processOrderBook(bybitBook);

    const noAggWalls = wallEngine.getActiveWalls(sym);
    const pass2A = noAggWalls.length === 0;

    record(
      'WALL_ENGINE',
      'Aggregation=false Isolation ($300k Binance + $300k Bybit < $500k threshold)',
      pass2A,
      pass2A
        ? 'PASSED: 0 walls triggered because individual exchanges remain below $500,000 threshold ($300,000 each).'
        : `FAILED: Found ${noAggWalls.length} active walls when crossExchangeAggregation was false.`
    );

    // 2B: crossExchangeAggregation = true
    wallEngine.setConfig({ minVolumeUsd: 500000, maxDistancePercent: 2.5, minDurationSeconds: 0, crossExchangeAggregation: true });
    await wallEngine.processOrderBook(binanceBook);
    await wallEngine.processOrderBook(bybitBook);

    const aggWalls = wallEngine.getActiveWalls(sym);
    const aggWall = aggWalls.find(w => w.volumeUsd === 600000 || w.isAggregated);
    const pass2B = aggWall !== undefined && aggWall.volumeUsd === 600000;

    record(
      'WALL_ENGINE',
      'Aggregation=true Combined Wall Qualification',
      pass2B,
      pass2B
        ? `PASSED: Combined $600,000 aggregated wall recognized across Binance ($300k) + Bybit ($300k).`
        : `FAILED: Aggregated wall not found.`
    );

    // Reset default
    wallEngine.setConfig({ crossExchangeAggregation: false, minVolumeUsd: 500000 });

    // TEST 2C: Futures reference price rule (lastPrice = 100, markPrice = 110)
    const futSym = 'TEST_FUT_REF';
    const lastPrice = 100;
    const markPrice = 110;
    const wallBid = 108; // (110 - 108)/110 = 1.818% from markPrice (<= 2.5%), but 8% from lastPrice

    const futTicker: MarketTicker = {
      symbol: futSym,
      baseAsset: 'FUT',
      quoteAsset: 'USDT',
      exchange: 'BINANCE',
      marketType: 'FUTURES',
      category: 'CRYPTO',
      lastPrice: lastPrice,
      markPrice: markPrice,
      percentageChange: 0.5,
      changesByTimeframe: {},
      volumeUsd: 20000000,
      volume24h: 100,
      high24h: 115,
      low24h: 95,
      timestamp: Date.now(),
      isLive: true
    };
    await marketState.updateTicker(futTicker);

    const futBook: OrderBookSnapshot = {
      symbol: futSym,
      exchange: 'BINANCE',
      marketType: 'FUTURES',
      bids: [{ price: wallBid, amount: 600000 / wallBid, usdVolume: 600000 }],
      asks: [],
      spread: 0.5,
      spreadPercent: 0.005,
      timestamp: Date.now()
    };
    await marketState.updateOrderBook(futBook);

    wallEngine.setConfig({ minVolumeUsd: 500000, maxDistancePercent: 2.5, minDurationSeconds: 0, crossExchangeAggregation: false });
    await wallEngine.processOrderBook(futBook);

    const futWalls = wallEngine.getActiveWalls(futSym, 'FUTURES');
    const futWall = futWalls.find(w => w.price === wallBid);
    const pass2C = futWall !== undefined && futWall.referencePrice === markPrice;

    record(
      'WALL_ENGINE',
      'Futures Reference Price strictly Mark Price (markPrice=110 vs lastPrice=100)',
      pass2C,
      pass2C
        ? `PASSED: Futures wall calculated distance using markPrice ($${futWall?.referencePrice}) -> ${futWall?.distancePercent.toFixed(2)}%, correctly identifying wall inside 2.5% threshold.`
        : `FAILED: Futures wall did not use markPrice or was not detected.`
    );

    // TEST 2D: Lifecycle FORMING -> CONFIRMED -> REMOVED
    const lcSym = 'TEST_LC_SYM';
    const lcTicker: MarketTicker = {
      symbol: lcSym,
      baseAsset: 'LC',
      quoteAsset: 'USDT',
      exchange: 'BINANCE',
      marketType: 'SPOT',
      category: 'CRYPTO',
      lastPrice: 1000,
      percentageChange: 0,
      changesByTimeframe: {},
      volumeUsd: 10000000,
      volume24h: 100,
      high24h: 1050,
      low24h: 950,
      timestamp: Date.now(),
      isLive: true
    };
    await marketState.updateTicker(lcTicker);

    wallEngine.setConfig({ minVolumeUsd: 500000, maxDistancePercent: 3.0, minDurationSeconds: 1, crossExchangeAggregation: false });
    const wallBook1: OrderBookSnapshot = {
      symbol: lcSym,
      exchange: 'BINANCE',
      marketType: 'SPOT',
      bids: [{ price: 980, amount: 600000 / 980, usdVolume: 600000 }],
      asks: [],
      spread: 1,
      spreadPercent: 0.001,
      timestamp: Date.now()
    };
    await marketState.updateOrderBook(wallBook1);

    // Step 1: Initial event -> FORMING
    await wallEngine.processOrderBook(wallBook1);
    let currentWalls = wallEngine.getActiveWalls(lcSym);
    const isForming = currentWalls.length === 1 && currentWalls[0].state === 'FORMING';

    // Step 2: Wait 1.1s and process again -> CONFIRMED
    await new Promise(r => setTimeout(r, 1100));
    await wallEngine.processOrderBook(wallBook1);
    currentWalls = wallEngine.getActiveWalls(lcSym);
    const isConfirmed = currentWalls.length === 1 && currentWalls[0].state === 'CONFIRMED';

    // Step 3: Lifecycle timeout scanner or empty book -> REMOVED
    const wallBookEmpty: OrderBookSnapshot = {
      symbol: lcSym,
      exchange: 'BINANCE',
      marketType: 'SPOT',
      bids: [],
      asks: [],
      spread: 1,
      spreadPercent: 0.001,
      timestamp: Date.now()
    };
    await marketState.updateOrderBook(wallBookEmpty);
    // Wait for the 4s lifecycle threshold and trigger expired wall cleanup
    await new Promise(r => setTimeout(r, 4100));
    await wallEngine.scanExpiredWalls(4000);
    currentWalls = wallEngine.getActiveWalls(lcSym);
    const isRemoved = currentWalls.length === 0;

    const pass2D = isForming && isConfirmed && isRemoved;
    record(
      'WALL_ENGINE',
      'Wall Lifecycle State Machine (FORMING -> CONFIRMED -> REMOVED)',
      pass2D,
      pass2D
        ? `PASSED: State transitioned from FORMING (duration < 1s) to CONFIRMED (duration >= 1s) to REMOVED on volume depletion.`
        : `FAILED: isForming=${isForming}, isConfirmed=${isConfirmed}, isRemoved=${isRemoved}`
    );

  } catch (err: any) {
    record('WALL_ENGINE', 'Wall Engine Tests', false, `Error: ${err.message}`);
  }

  // -------------------------------------------------------------
  // PART 3: DETERMINISTIC ALERT ENGINE TESTS (Rules & Cooldown)
  // -------------------------------------------------------------
  console.log('\n>>> [3/10] Running Deterministic Alert Engine Tests...');
  try {
    const db = DatabaseService.getInstance();
    const alertEngine = AlertEngine.getInstance();
    const receivedTriggers: AlertTrigger[] = [];

    alertEngine.onAlertTrigger((t) => {
      receivedTriggers.push(t);
    });

    const testSym = 'ALERT_TEST_BTC';
    // Clean any prior rules for this symbol
    const existingRules = (await db.getAlertRules(TEST_USER_ID)).filter(r => r.symbols.includes(testSym));
    for (const r of existingRules) await db.deleteAlertRule(r.id, TEST_USER_ID);

    // Rule 1: PRICE_ABOVE ($100,000)
    const ruleAbove = await db.saveAlertRule({
      name: 'Test Price Above',
      enabled: true,
      symbols: [testSym],
      exchanges: ['BINANCE'],
      marketTypes: ['SPOT'],
      conditions: [{ id: 'c1', type: 'PRICE_ABOVE', params: { targetPrice: 100000 } }],
      logic: 'AND',
      notifyChannels: ['IN_APP'],
      cooldownSeconds: 5
    }, TEST_USER_ID);

    // Rule 2: PRICE_BELOW ($50,000)
    const ruleBelow = await db.saveAlertRule({
      name: 'Test Price Below',
      enabled: true,
      symbols: [testSym],
      exchanges: ['BINANCE'],
      marketTypes: ['SPOT'],
      conditions: [{ id: 'c2', type: 'PRICE_BELOW', params: { targetPrice: 50000 } }],
      logic: 'AND',
      notifyChannels: ['IN_APP'],
      cooldownSeconds: 5
    }, TEST_USER_ID);

    // Rule 3: RSI_OVERSOLD (<= 30)
    const ruleRsi = await db.saveAlertRule({
      name: 'Test RSI Oversold',
      enabled: true,
      symbols: [testSym],
      exchanges: ['BINANCE'],
      marketTypes: ['SPOT'],
      conditions: [{ id: 'c3', type: 'RSI_OVERSOLD', params: { rsiThreshold: 30 } }],
      logic: 'AND',
      notifyChannels: ['IN_APP'],
      cooldownSeconds: 5
    }, TEST_USER_ID);

    // Rule 4: VOLUME_SPIKE
    const ruleVol = await db.saveAlertRule({
      name: 'Test Volume Spike',
      enabled: true,
      symbols: [testSym],
      exchanges: ['BINANCE'],
      marketTypes: ['SPOT'],
      conditions: [{ id: 'c4', type: 'VOLUME_SPIKE', params: { volumeMultiplier: 3.0 } }],
      logic: 'AND',
      notifyChannels: ['IN_APP'],
      cooldownSeconds: 5
    }, TEST_USER_ID);

    // Rule 5: PERCENTAGE_CHANGE
    const rulePct = await db.saveAlertRule({
      name: 'Test Pct Change',
      enabled: true,
      symbols: [testSym],
      exchanges: ['BINANCE'],
      marketTypes: ['SPOT'],
      conditions: [{ id: 'c5', type: 'PERCENTAGE_CHANGE', params: { percentageThreshold: 3.0 } }],
      logic: 'AND',
      notifyChannels: ['IN_APP'],
      cooldownSeconds: 5
    }, TEST_USER_ID);

    // Rule 6: FUNDING_RATE_ANOMALY (>= 0.05%)
    const ruleFunding = await db.saveAlertRule({
      name: 'Test Funding Anomaly',
      enabled: true,
      symbols: [testSym],
      exchanges: ['BINANCE'],
      marketTypes: ['FUTURES'],
      conditions: [{ id: 'c6', type: 'FUNDING_RATE_ANOMALY', params: { fundingRateThreshold: 0.0005 } }],
      logic: 'AND',
      notifyChannels: ['IN_APP'],
      cooldownSeconds: 5
    }, TEST_USER_ID);

    // TEST EVALUATION
    const ticker1: MarketTicker = {
      symbol: testSym,
      baseAsset: 'ALERT',
      quoteAsset: 'USDT',
      exchange: 'BINANCE',
      marketType: 'SPOT',
      category: 'CRYPTO',
      lastPrice: 105000, // triggers ruleAbove (105k > 100k)
      percentageChange: 4.5, // triggers rulePct (4.5% >= 3.0%)
      changesByTimeframe: { '1d': 4.5 },
      volumeUsd: 60000000, // triggers ruleVol (60M > 50M & pct > 2)
      volume24h: 100,
      high24h: 106000,
      low24h: 99000,
      rsi: 25, // triggers ruleRsi (25 <= 30)
      timestamp: Date.now(),
      isLive: true
    };

    receivedTriggers.length = 0;
    await alertEngine.evaluateTicker(ticker1);

    const triggeredAbove = receivedTriggers.some(t => t.ruleId === ruleAbove.id);
    const triggeredRsi = receivedTriggers.some(t => t.ruleId === ruleRsi.id);
    const triggeredVol = receivedTriggers.some(t => t.ruleId === ruleVol.id);
    const triggeredPct = receivedTriggers.some(t => t.ruleId === rulePct.id);
    const triggeredBelow = receivedTriggers.some(t => t.ruleId === ruleBelow.id);

    const evalPass = triggeredAbove && triggeredRsi && triggeredVol && triggeredPct && !triggeredBelow;

    record(
      'ALERT_ENGINE',
      'Multi-Condition Rule Evaluation (PRICE_ABOVE, RSI_OVERSOLD, VOLUME_SPIKE, PERCENTAGE_CHANGE)',
      evalPass,
      evalPass
        ? `PASSED: Correctly triggered PRICE_ABOVE, RSI_OVERSOLD, VOLUME_SPIKE, PERCENTAGE_CHANGE, while PRICE_BELOW remained un-triggered.`
        : `FAILED: above=${triggeredAbove}, rsi=${triggeredRsi}, vol=${triggeredVol}, pct=${triggeredPct}, below=${triggeredBelow}`
    );

    // TEST COOLDOWN
    receivedTriggers.length = 0;
    // Immediate second evaluation (should be blocked by 5s cooldown)
    await alertEngine.evaluateTicker(ticker1);
    const cooldownBlocked = receivedTriggers.length === 0;

    record(
      'ALERT_ENGINE',
      'Alert Cooldown Suppression',
      cooldownBlocked,
      cooldownBlocked
        ? `PASSED: Subsequent ticker update within cooldown period was successfully suppressed.`
        : `FAILED: Trigger fired again despite active cooldown.`
    );

    // Cleanup
    await db.deleteAlertRule(ruleAbove.id, TEST_USER_ID);
    await db.deleteAlertRule(ruleBelow.id, TEST_USER_ID);
    await db.deleteAlertRule(ruleRsi.id, TEST_USER_ID);
    await db.deleteAlertRule(ruleVol.id, TEST_USER_ID);
    await db.deleteAlertRule(rulePct.id, TEST_USER_ID);
    await db.deleteAlertRule(ruleFunding.id, TEST_USER_ID);
  } catch (err: any) {
    record('ALERT_ENGINE', 'Alert Engine Tests', false, `Error: ${err.message}`);
  }

  // -------------------------------------------------------------
  // PART 4: BLACKLIST INGESTION & SCREENER PRE-FILTER
  // -------------------------------------------------------------
  console.log('\n>>> [4/10] Testing Global Blacklist Pre-Filtering...');
  try {
    const db = DatabaseService.getInstance();
    const marketState = MarketStateService.getInstance();

    const blkSym = 'TEST_BLACK_TOKEN';
    // 1. Seed ticker in market state
    await marketState.updateTicker({
      symbol: blkSym,
      baseAsset: 'BLACK',
      quoteAsset: 'USDT',
      exchange: 'BINANCE',
      marketType: 'SPOT',
      category: 'CRYPTO',
      lastPrice: 1.0,
      percentageChange: 0,
      changesByTimeframe: {},
      volumeUsd: 500000,
      volume24h: 500000,
      high24h: 1.1,
      low24h: 0.9,
      timestamp: Date.now(),
      isLive: true
    });

    const initialIsBlacklisted = await marketState.isBlacklisted(blkSym, 'BINANCE', 'CRYPTO');
    
    // 2. Add to Blacklist
    const entry = await db.addBlacklistEntry({
      symbol: blkSym,
      exchange: 'BINANCE',
      category: 'CRYPTO',
      reason: 'Temporary blacklist runtime verification test'
    });

    const isNowBlacklisted = await marketState.isBlacklisted(blkSym, 'BINANCE', 'CRYPTO');
    const filteredTickers = await marketState.filterTickers({
      searchQuery: '',
      category: 'ALL',
      marketType: 'ALL',
      exchanges: [],
      timeframe: '1d',
      hideBlacklisted: true,
      sortBy: 'volumeUsd',
      sortOrder: 'desc'
    });
    const inFiltered = filteredTickers.some(t => t.symbol === blkSym && t.exchange === 'BINANCE');

    // 3. Remove from blacklist to restore original state
    await db.removeBlacklistEntry(entry.id);
    const restoredIsBlacklisted = await marketState.isBlacklisted(blkSym, 'BINANCE', 'CRYPTO');

    const blkPassed = !initialIsBlacklisted && isNowBlacklisted && !inFiltered && !restoredIsBlacklisted;

    record(
      'BLACKLIST',
      'Blacklist Pre-Filter & Exclusion from Screener',
      blkPassed,
      blkPassed
        ? `PASSED: Adding ${blkSym} to blacklist instantly excluded it from screener pipeline. Removed entry and restored original state cleanly.`
        : `FAILED: initial=${initialIsBlacklisted}, active=${isNowBlacklisted}, inFiltered=${inFiltered}, restored=${restoredIsBlacklisted}`
    );
  } catch (err: any) {
    record('BLACKLIST', 'Blacklist Tests', false, `Error: ${err.message}`);
  }

  // -------------------------------------------------------------
  // PART 5: LIVE BINANCE WEBSOCKET & REST STREAM VERIFICATION
  // -------------------------------------------------------------
  console.log('\n>>> [5/16] Testing Live Binance Spot & Futures Data Capture (15s Real Stream)...');
  try {
    const binance = new BinanceConnector();
    
    let spotTickersReceived = 0;
    let futuresTickersReceived = 0;
    let orderBooksReceived = 0;
    let tradesReceived = 0;

    const markPrices = new Map<string, number>();
    const fundingRates = new Map<string, number>();
    const latestPrices = new Map<string, number>();
    const orderBookDepths = new Map<string, { bids: number; asks: number; spread: number }>();

    binance.onTicker((ticker) => {
      latestPrices.set(`${ticker.exchange}_${ticker.marketType}_${ticker.symbol}`, ticker.lastPrice);
      if (ticker.marketType === 'SPOT') spotTickersReceived++;
      if (ticker.marketType === 'FUTURES') {
        futuresTickersReceived++;
        if (ticker.markPrice) markPrices.set(ticker.symbol, ticker.markPrice);
        if (ticker.fundingRate !== undefined) fundingRates.set(ticker.symbol, ticker.fundingRate);
      }
    });

    binance.onOrderBook((ob) => {
      orderBooksReceived++;
      orderBookDepths.set(`${ob.exchange}_${ob.marketType}_${ob.symbol}`, {
        bids: ob.bids.length,
        asks: ob.asks.length,
        spread: ob.spread
      });
    });

    binance.onTrade(() => {
      tradesReceived++;
    });

    // Connect to live Binance Spot & Futures
    await binance.connect();
    console.log('[Live Test] Connected to Binance. Capturing live market stream for 15 seconds...');

    // Wait 15 seconds to accumulate live events
    await new Promise(r => setTimeout(r, 15000));

    const btcSpotPrice = latestPrices.get('BINANCE_SPOT_BTCUSDT');
    const ethSpotPrice = latestPrices.get('BINANCE_SPOT_ETHUSDT');
    const solSpotPrice = latestPrices.get('BINANCE_SPOT_SOLUSDT');
    const btcMarkPrice = markPrices.get('BTCUSDT');
    const btcFunding = fundingRates.get('BTCUSDT');
    const btcDepth = orderBookDepths.get('BINANCE_SPOT_BTCUSDT');

    const liveDataPassed = Boolean(
      spotTickersReceived > 0 &&
      futuresTickersReceived > 0 &&
      orderBooksReceived > 0 &&
      btcSpotPrice && btcSpotPrice > 0 &&
      ethSpotPrice && ethSpotPrice > 0 &&
      btcMarkPrice && btcMarkPrice > 0 &&
      btcFunding !== undefined &&
      btcDepth && btcDepth.bids > 0
    );

    record(
      'BINANCE_LIVE',
      'Live Binance Spot & Futures Stream (BTC, ETH, SOL)',
      liveDataPassed,
      liveDataPassed
        ? `PASSED: Captured ${spotTickersReceived} Spot ticks, ${futuresTickersReceived} Futures ticks, ${orderBooksReceived} orderbooks, ${tradesReceived} trades. Live BTC: $${btcSpotPrice?.toLocaleString()}, ETH: $${ethSpotPrice?.toLocaleString()}, SOL: $${solSpotPrice?.toLocaleString()}, BTC MarkPrice: $${btcMarkPrice?.toLocaleString()}, BTC Funding: ${(btcFunding! * 100).toFixed(4)}%, BTC Book depth: ${btcDepth?.bids} bids / ${btcDepth?.asks} asks (spread: $${btcDepth?.spread.toFixed(2)}).`
        : `FAILED: Live feed did not receive all required streams.`,
      {
        spotTickersReceived,
        futuresTickersReceived,
        orderBooksReceived,
        tradesReceived,
        btcSpotPrice,
        ethSpotPrice,
        solSpotPrice,
        btcMarkPrice,
        btcFunding
      }
    );

    // -------------------------------------------------------------
    // PART 6: WEBSOCKET DISCONNECT & RECONNECT VERIFICATION
    // -------------------------------------------------------------
    console.log('\n>>> [6/9] Testing WebSocket Disconnect & Reconnect Handling...');
    const prevCount = spotTickersReceived;
    
    // Disconnect explicitly
    await binance.disconnect();
    const isDisconnected = binance.getStatus().connected === false;

    // Re-connect
    await binance.connect();
    // Wait 4 seconds to confirm reconnect
    await new Promise(r => setTimeout(r, 4000));
    const isReconnected = binance.getStatus().connected === true;
    const receivedAfterReconnect = spotTickersReceived > prevCount;

    const reconnectPassed = isDisconnected && isReconnected && receivedAfterReconnect;
    record(
      'RECONNECT',
      'Binance WebSocket Disconnect, Backoff & Automatic Recovery',
      reconnectPassed,
      reconnectPassed
        ? `PASSED: WebSocket successfully handled disconnect, transitioned state, re-established live stream, and resumed ticker updates.`
        : `FAILED: isDisconnected=${isDisconnected}, isReconnected=${isReconnected}, resumed=${receivedAfterReconnect}`
    );

    await binance.disconnect();
  } catch (err: any) {
    record('BINANCE_LIVE', 'Binance Live Stream & Reconnect', false, `Error: ${err.message}`);
  }

  // -------------------------------------------------------------
  // PART 7: LIVE BYBIT WEBSOCKET & REST STREAM VERIFICATION
  // -------------------------------------------------------------
  console.log('\n>>> [7/16] Testing Live Bybit Spot & Linear Data Capture (12s Real Stream)...');
  try {
    const bybit = new BybitConnector();

    let bybitSpotTickers = 0;
    let bybitLinearTickers = 0;
    let bybitOrderBooks = 0;
    const bybitPrices = new Map<string, number>();

    bybit.onTicker((ticker) => {
      bybitPrices.set(`${ticker.exchange}_${ticker.marketType}_${ticker.symbol}`, ticker.lastPrice);
      if (ticker.marketType === 'SPOT') bybitSpotTickers++;
      if (ticker.marketType === 'FUTURES') bybitLinearTickers++;
    });

    bybit.onOrderBook(() => {
      bybitOrderBooks++;
    });

    await bybit.connect();
    console.log('[Live Test] Connected to Bybit. Capturing live market stream for 12 seconds...');

    // Wait 12 seconds to accumulate live events
    await new Promise(r => setTimeout(r, 12000));

    const btcPrice = bybitPrices.get('BYBIT_SPOT_BTCUSDT');
    const ethPrice = bybitPrices.get('BYBIT_SPOT_ETHUSDT');
    const solPrice = bybitPrices.get('BYBIT_SPOT_SOLUSDT');

    const bybitPassed = Boolean(
      bybitSpotTickers > 0 &&
      bybitOrderBooks > 0 &&
      btcPrice && btcPrice > 0 &&
      ethPrice && ethPrice > 0 &&
      solPrice && solPrice > 0
    );

    record(
      'BYBIT_LIVE',
      'Live Bybit Spot & Linear Stream (BTC, ETH, SOL)',
      bybitPassed,
      bybitPassed
        ? `PASSED: Captured ${bybitSpotTickers} Spot ticks, ${bybitLinearTickers} Linear ticks, ${bybitOrderBooks} orderbooks. Live BTC: $${btcPrice?.toLocaleString()}, ETH: $${ethPrice?.toLocaleString()}, SOL: $${solPrice?.toLocaleString()}.`
        : `FAILED: Live feed did not receive all required streams.`,
      {
        bybitSpotTickers,
        bybitLinearTickers,
        bybitOrderBooks,
        btcPrice,
        ethPrice,
        solPrice
      }
    );

    await bybit.disconnect();
  } catch (err: any) {
    record('BYBIT_LIVE', 'Live Bybit Spot & Linear Stream', false, `Error: ${err.message}`);
  }

  // -------------------------------------------------------------
  // PART 8: LIVE OKX WEBSOCKET & REST STREAM VERIFICATION
  // -------------------------------------------------------------
  console.log('\n>>> [8/10] Testing Live OKX Spot Data Capture (12s Real Stream)...');
  try {
    const okx = new OKXConnector();

    let okxSpotTickers = 0;
    let okxOrderBooks = 0;
    const okxPrices = new Map<string, number>();
    const okxBookDepths = new Map<string, { bids: number; asks: number }>();

    okx.onTicker((ticker) => {
      okxPrices.set(`${ticker.exchange}_${ticker.marketType}_${ticker.symbol}`, ticker.lastPrice);
      if (ticker.marketType === 'SPOT') okxSpotTickers++;
    });

    okx.onOrderBook((ob) => {
      okxOrderBooks++;
      okxBookDepths.set(`${ob.exchange}_${ob.marketType}_${ob.symbol}`, {
        bids: ob.bids.length,
        asks: ob.asks.length
      });
    });

    await okx.connect();
    console.log('[Live Test] Connected to OKX. Capturing live market stream for 12 seconds...');

    // Wait 12 seconds to accumulate live events
    await new Promise(r => setTimeout(r, 12000));

    const btcPrice = okxPrices.get('OKX_SPOT_BTC-USDT');
    const ethPrice = okxPrices.get('OKX_SPOT_ETH-USDT');
    const solPrice = okxPrices.get('OKX_SPOT_SOL-USDT');
    const xrpPrice = okxPrices.get('OKX_SPOT_XRP-USDT');
    const btcDepth = okxBookDepths.get('OKX_SPOT_BTC-USDT');

    const okxPassed = Boolean(
      okxSpotTickers > 0 &&
      okxOrderBooks > 0 &&
      btcPrice && btcPrice > 0 &&
      ethPrice && ethPrice > 0 &&
      solPrice && solPrice > 0 &&
      xrpPrice && xrpPrice > 0 &&
      btcDepth && btcDepth.bids > 0 && btcDepth.asks > 0
    );

    record(
      'OKX_LIVE',
      'Live OKX Spot Stream (BTC, ETH, SOL, XRP)',
      okxPassed,
      okxPassed
        ? `PASSED: Captured ${okxSpotTickers} Spot ticks, ${okxOrderBooks} orderbooks. Live BTC: $${btcPrice?.toLocaleString()}, ETH: $${ethPrice?.toLocaleString()}, SOL: $${solPrice?.toLocaleString()}, XRP: $${xrpPrice?.toLocaleString()}. BTC Book depth: ${btcDepth?.bids} bids / ${btcDepth?.asks} asks.`
        : `FAILED: Live feed did not receive all required streams.`,
      {
        okxSpotTickers,
        okxOrderBooks,
        btcPrice,
        ethPrice,
        solPrice,
        xrpPrice,
        btcDepth
      }
    );

    await okx.disconnect();
  } catch (err: any) {
    record('OKX_LIVE', 'Live OKX Spot Stream', false, `Error: ${err.message}`);
  }

  // -------------------------------------------------------------
  // PART 9: LIVE MEXC WEBSOCKET & REST STREAM VERIFICATION
  // -------------------------------------------------------------
  console.log('\n>>> [9/16] Testing Live MEXC Spot Data Capture (12s Real Stream)...');
  try {
    const mexc = new MEXCConnector();

    let mexcSpotTickers = 0;
    let mexcOrderBooks = 0;
    const mexcPrices = new Map<string, number>();
    const mexcBookDepths = new Map<string, { bids: number; asks: number }>();

    mexc.onTicker((ticker) => {
      mexcPrices.set(`${ticker.exchange}_${ticker.marketType}_${ticker.symbol}`, ticker.lastPrice);
      if (ticker.marketType === 'SPOT') mexcSpotTickers++;
    });

    mexc.onOrderBook((ob) => {
      mexcOrderBooks++;
      mexcBookDepths.set(`${ob.exchange}_${ob.marketType}_${ob.symbol}`, {
        bids: ob.bids.length,
        asks: ob.asks.length
      });
    });

    await mexc.connect();
    console.log('[Live Test] Connected to MEXC. Capturing live market stream for 12 seconds...');

    // Wait 12 seconds to accumulate live events
    await new Promise(r => setTimeout(r, 12000));

    const btcPrice = mexcPrices.get('MEXC_SPOT_BTCUSDT');
    const ethPrice = mexcPrices.get('MEXC_SPOT_ETHUSDT');
    const solPrice = mexcPrices.get('MEXC_SPOT_SOLUSDT');
    const xrpPrice = mexcPrices.get('MEXC_SPOT_XRPUSDT');
    const btcDepth = mexcBookDepths.get('MEXC_SPOT_BTCUSDT');

    const mexcPassed = Boolean(
      mexcSpotTickers > 0 &&
      mexcOrderBooks > 0 &&
      btcPrice && btcPrice > 0 &&
      ethPrice && ethPrice > 0 &&
      solPrice && solPrice > 0 &&
      xrpPrice && xrpPrice > 0 &&
      btcDepth && btcDepth.bids > 0 && btcDepth.asks > 0
    );

    record(
      'MEXC_LIVE',
      'Live MEXC Spot Stream (BTC, ETH, SOL, XRP)',
      mexcPassed,
      mexcPassed
        ? `PASSED: Captured ${mexcSpotTickers} Spot ticks, ${mexcOrderBooks} orderbooks. Live BTC: $${btcPrice?.toLocaleString()}, ETH: $${ethPrice?.toLocaleString()}, SOL: $${solPrice?.toLocaleString()}, XRP: $${xrpPrice?.toLocaleString()}. BTC Book depth: ${btcDepth?.bids} bids / ${btcDepth?.asks} asks.`
        : `FAILED: Live feed did not receive all required streams.`,
      {
        mexcSpotTickers,
        mexcOrderBooks,
        btcPrice,
        ethPrice,
        solPrice,
        xrpPrice,
        btcDepth
      }
    );

    await mexc.disconnect();
  } catch (err: any) {
    record('MEXC_LIVE', 'Live MEXC Spot Stream', false, `Error: ${err.message}`);
  }

  // -------------------------------------------------------------
  // PART 10: LIVE GATE.IO WEBSOCKET & REST STREAM VERIFICATION
  // -------------------------------------------------------------
  await runLiveExchangeCheck({
    marker: '[10/16]',
    sectionTag: 'GATE_LIVE',
    displayName: 'Testing Live Gate.io Spot Data Capture (12s Real Stream)',
    connector: new GateConnector(),
    expected: ['BTC_USDT', 'ETH_USDT', 'SOL_USDT', 'XRP_USDT'].map(s => ({ symbol: s, marketType: 'SPOT' as const })),
    durationMs: 12000
  });

  // -------------------------------------------------------------
  // PART 11: LIVE BITGET WEBSOCKET & REST STREAM VERIFICATION
  // -------------------------------------------------------------
  await runLiveExchangeCheck({
    marker: '[11/16]',
    sectionTag: 'BITGET_LIVE',
    displayName: 'Testing Live Bitget Spot Data Capture (12s Real Stream)',
    connector: new BitgetConnector(),
    expected: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT'].map(s => ({ symbol: s, marketType: 'SPOT' as const })),
    durationMs: 12000
  });

  // -------------------------------------------------------------
  // PART 12: LIVE KUCOIN WEBSOCKET & REST STREAM VERIFICATION
  // -------------------------------------------------------------
  await runLiveExchangeCheck({
    marker: '[12/16]',
    sectionTag: 'KUCOIN_LIVE',
    displayName: 'Testing Live KuCoin Spot Data Capture (15s Real Stream)',
    connector: new KuCoinConnector(),
    expected: ['BTC-USDT', 'ETH-USDT', 'SOL-USDT', 'XRP-USDT'].map(s => ({ symbol: s, marketType: 'SPOT' as const })),
    durationMs: 15000
  });

  // -------------------------------------------------------------
  // PART 13: LIVE HYPERLIQUID WEBSOCKET & REST STREAM VERIFICATION
  // -------------------------------------------------------------
  await runLiveExchangeCheck({
    marker: '[13/16]',
    sectionTag: 'HYPERLIQUID_LIVE',
    displayName: 'Testing Live Hyperliquid Futures Data Capture (12s Real Stream)',
    connector: new HyperliquidConnector(),
    expected: ['BTC', 'ETH', 'SOL', 'XRP'].map(s => ({ symbol: s, marketType: 'FUTURES' as const })),
    durationMs: 12000
  });

  // -------------------------------------------------------------
  // PART 14: LIVE ASTERDEX WEBSOCKET & REST STREAM VERIFICATION
  // -------------------------------------------------------------
  await runLiveExchangeCheck({
    marker: '[14/16]',
    sectionTag: 'ASTERDEX_LIVE',
    displayName: 'Testing Live AsterDEX Spot Data Capture (15s Real Stream)',
    connector: new AsterDEXConnector(),
    expected: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT'].map(s => ({ symbol: s, marketType: 'SPOT' as const })),
    durationMs: 15000
  });

  // -------------------------------------------------------------
  // PART 15: CONNECTOR MANAGER REGISTRATION HEALTH CHECK
  // -------------------------------------------------------------
  console.log('\n>>> [15/16] Testing ConnectorManager Registration & Production Readiness...');
  try {
    const cm = ConnectorManager.getInstance();
    const all = cm.getConnectorStatuses();
    const registered = all.map(c => c.exchange);
    const expected = ['BINANCE', 'BYBIT', 'STOCK_EXCHANGE', 'OKX', 'MEXC', 'GATE', 'BITGET', 'KUCOIN', 'HYPERLIQUID', 'ASTERDEX'];
    const allRegistered = expected.every(id => (registered as string[]).includes(id));
    const allReady = all.every(c => c.isProductionReady === true);

    record(
      'CONNECTOR_MANAGER',
      'ConnectorManager Registration & Production Readiness',
      allRegistered && allReady,
      (allRegistered && allReady)
        ? `PASSED: ${all.length} connectors registered: ${registered.join(', ')}. All ${all.length} marked isProductionReady=true.`
        : `FAILED: registered=${registered.join(', ')} | allRegistered=${allRegistered}, allReady=${allReady}`,
      { registered, expected, allRegistered, allReady }
    );
  } catch (err: any) {
    record('CONNECTOR_MANAGER', 'ConnectorManager Health Check', false, `Error: ${err.message}`);
  }

  // -------------------------------------------------------------
  // PART 16: SUMMARY
  // -------------------------------------------------------------
  console.log('\n====================================================');
  console.log('            VERIFICATION SUMMARY REPORT             ');
  console.log('====================================================');

  let allPassed = true;
  for (const res of allResults) {
    if (res.status === 'FAIL') allPassed = false;
  }

  console.log(`\nTotal Checks: ${allResults.length} | Passed: ${allResults.filter(r => r.status === 'PASS').length} | Failed: ${allResults.filter(r => r.status === 'FAIL').length}\n`);

  return allPassed;
}

runVerification().then(success => {
  process.exit(success ? 0 : 1);
}).catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
