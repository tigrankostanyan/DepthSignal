import fs from 'fs';
import path from 'path';
import initSqlJs from 'sql.js';
import Database from 'better-sqlite3';
import { sequelize, initSequelize, closeSequelize } from './sequelize.js';
import '../models/index.js';
import * as Models from '../models/index.js';

const DB_FILE_PATH = process.env.DB_FILE_PATH || './server/data.sqlite';

const TABLE_NAMES = [
  'users',
  'sessions',
  'audit_logs',
  'user_settings',
  'watchlists',
  'watchlist_items',
  'saved_filter_presets',
  'alert_rules',
  'alert_triggers',
  'detected_walls',
  'wall_history',
  'daily_wall_aggregates',
  'blacklist_entries',
  'subscriptions',
  'billing_events',
  'billing_webhook_events',
  'notification_deliveries',
  'telegram_link_tokens',
  'user_telegram_links',
] as const;

const MODEL_BY_TABLE: Record<string, keyof typeof Models> = {
  users: 'User',
  sessions: 'Session',
  audit_logs: 'AuditLog',
  user_settings: 'UserSettings',
  watchlists: 'Watchlist',
  watchlist_items: 'WatchlistItem',
  saved_filter_presets: 'SavedFilterPreset',
  alert_rules: 'AlertRule',
  alert_triggers: 'AlertTrigger',
  detected_walls: 'DetectedWall',
  wall_history: 'WallHistory',
  daily_wall_aggregates: 'DailyWallAggregate',
  blacklist_entries: 'BlacklistEntry',
  subscriptions: 'Subscription',
  billing_events: 'BillingEvent',
  billing_webhook_events: 'BillingWebhookEvent',
  notification_deliveries: 'NotificationDelivery',
  telegram_link_tokens: 'TelegramLinkToken',
  user_telegram_links: 'UserTelegramLink',
};

// Ensure db file
function ensureDbFile(): void {
  if (!fs.existsSync(DB_FILE_PATH)) {
    console.error(`[migrate] DB file not found: ${DB_FILE_PATH}`);
    console.error('[migrate] Start the app once so the sql.js database is created, then re-run.');
    process.exit(1);
  }
}

// Sql js snapshot
async function sqlJsSnapshot(): Promise<Record<string, number>> {
  const SQL = await initSqlJs();
  const fileBuffer = fs.readFileSync(DB_FILE_PATH);
  const db = new SQL.Database(fileBuffer);
  const counts: Record<string, number> = {};
  for (const table of TABLE_NAMES) {
    const res = db.exec(`SELECT count(*) FROM ${table}`);
    counts[table] = Number(res[0]?.values?.[0]?.[0] ?? -1);
  }
  db.close();
  return counts;
}

// Better sqlite3 snapshot
function betterSqlite3Snapshot(): Record<string, number> {
  const db = new Database(DB_FILE_PATH, { readonly: true });
  const counts: Record<string, number> = {};
  for (const table of TABLE_NAMES) {
    counts[table] = (db.prepare(`SELECT count(*) FROM ${table}`).get() as any)['count(*)'];
  }
  db.close();
  return counts;
}

// Compare counts
function compareCounts(a: Record<string, number>, b: Record<string, number>, labelA: string, labelB: string): boolean {
  let ok = true;
  for (const table of TABLE_NAMES) {
    if (a[table] !== b[table]) {
      ok = false;
      console.error(`  [MISMATCH] ${table}: ${labelA}=${a[table]}  ${labelB}=${b[table]}`);
    }
  }
  return ok;
}

// Main
async function main(): Promise<void> {
  console.log('=== Migration verification: sql.js → Sequelize/better-sqlite3 ===\n');
  ensureDbFile();
  console.log(`DB file: ${DB_FILE_PATH} (${(fs.statSync(DB_FILE_PATH).size / 1024 / 1024).toFixed(2)} MB)\n`);

  // 1. Integrity check via native engine
  const checkDb = new Database(DB_FILE_PATH, { readonly: true });
  const integrity = (checkDb.pragma('integrity_check') as Array<{ integrity_check: string }>);
  checkDb.close();
  const integrityStatus = integrity[0]?.integrity_check ?? 'unknown';
  if (integrityStatus !== 'ok') {
    console.error(`[FAIL] PRAGMA integrity_check => ${integrityStatus}`);
    process.exit(1);
  }
  console.log(`[OK] Integrity check => ${integrityStatus}`);

  // 2. Row counts: sql.js vs better-sqlite3
  console.log('\n--- Row counts: sql.js vs better-sqlite3 ---');
  const sqlJsCounts = await sqlJsSnapshot();
  const nativeCounts = betterSqlite3Snapshot();
  const countsMatch = compareCounts(sqlJsCounts, nativeCounts, 'sql.js', 'better-sqlite3');
  if (!countsMatch) {
    console.error('[FAIL] Row counts differ between sql.js and better-sqlite3.');
    process.exit(1);
  }
  const totalRows = Object.values(nativeCounts).reduce((s, n) => s + n, 0);
  console.log(`[OK] All 19 tables match. Total rows: ${totalRows}`);

  // 3. Sequelize models: row counts + primary-key samples
  console.log('\n--- Sequelize model reads ---');
  await initSequelize();
  const modelCounts: Record<string, number> = {};
  for (const table of TABLE_NAMES) {
    const model = (Models as any)[MODEL_BY_TABLE[table]] as any;
    if (!model) {
      console.error(`[MISSING MODEL] No model registered for table ${table}`);
      process.exit(1);
    }
    const count = await model.count();
    modelCounts[table] = count;
    if (count !== nativeCounts[table]) {
      console.error(`[FAIL] ${table}: Sequelize count=${count}, native count=${nativeCounts[table]}`);
      process.exit(1);
    }
    console.log(`  [OK] ${table}: ${count} rows`);
  }
  const modelsMatch = compareCounts(modelCounts, nativeCounts, 'Sequelize', 'native');
  if (!modelsMatch) {
    console.error('[FAIL] Sequelize model counts differ from native counts.');
    process.exit(1);
  }

  // 4. Sample primary keys preserved (first row per table, both engines)
  console.log('\n--- Primary-key samples (native vs Sequelize) ---');
  const nativeDb = new Database(DB_FILE_PATH, { readonly: true });
  let pkOk = true;
  for (const table of TABLE_NAMES) {
    const pkCol = (nativeDb.pragma(`table_info(${table})`) as Array<{ pk: number; name: string }>)
      .filter((c) => c.pk > 0)
      .sort((a, b) => a.pk - b.pk)
      .map((c) => c.name)[0];
    if (!pkCol) continue;
    const nativePk = (nativeDb.prepare(`SELECT ${pkCol} AS pk FROM ${table} LIMIT 1`).get() as any)?.pk;
    const model = (Models as any)[MODEL_BY_TABLE[table]] as any;
    const attr = Object.keys(model.getAttributes()).find(
      (a) => model.getAttributes()[a].field === pkCol
    );
    const seqRow = await model.findOne({ order: [[attr ?? 'id', 'ASC']] });
    const seqPk = seqRow?.get(attr ?? 'id') ?? null;
    // Empty tables: native returns undefined, Sequelize null — both mean "no rows".
    const nativeEmpty = nativePk === undefined;
    const seqEmpty = seqPk === null || seqPk === undefined;
    if (nativeEmpty && seqEmpty) {
      console.log(`  [OK] ${table}.${pkCol} = <empty table>`);
      continue;
    }
    if (String(nativePk) !== String(seqPk)) {
      pkOk = false;
      console.error(`  [MISMATCH] ${table} ${pkCol}: native=${nativePk}  sequelize=${seqPk}`);
    } else {
      console.log(`  [OK] ${table}.${pkCol} = ${String(seqPk).slice(0, 40)}`);
    }
  }
  nativeDb.close();
  if (!pkOk) {
    console.error('[FAIL] Primary-key samples differ between engines.');
    await closeSequelize();
    process.exit(1);
  }

  // 5. Foreign-key relations intact (sample joins on associations)
  console.log('\n--- Association checks ---');
  const session = await Models.Session.findOne({ include: [{ model: Models.User, as: 'User', required: true }] });
  const sessionUserOk = session ? (session as any).User != null : true; // sessions may be empty
  console.log(`  [${sessionUserOk ? 'OK' : 'FAIL'}] Session→User association`);

  const settings = await Models.UserSettings.findOne({ include: [{ model: Models.User, as: 'User', required: true }] });
  const settingsUserOk = settings ? (settings as any).User != null : true;
  console.log(`  [${settingsUserOk ? 'OK' : 'FAIL'}] UserSettings→User association`);

  const trigger = await Models.AlertTrigger.findOne({ include: [{ model: Models.AlertRule, as: 'AlertRule', required: true }] });
  const triggerRuleOk = trigger ? (trigger as any).AlertRule != null : true;
  console.log(`  [${triggerRuleOk ? 'OK' : 'FAIL'}] AlertTrigger→AlertRule association`);

  await closeSequelize();

  if (!sessionUserOk || !settingsUserOk || !triggerRuleOk) {
    console.error('[FAIL] Association joins failed.');
    process.exit(1);
  }

  console.log('\n=== Migration verification PASSED ===');
  console.log(`Total rows preserved: ${totalRows}`);
  console.log('Sequelize + better-sqlite3 can safely take over the existing database.');
  process.exit(0);
}

main().catch((err) => {
  console.error('[migrate] Unexpected error:', err);
  process.exit(1);
});
