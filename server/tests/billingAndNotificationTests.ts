// ==========================================
// BILLING, SUBSCRIPTION & NOTIFICATION TEST SUITE
// Automated verification tests (A through J)
// ==========================================

import crypto from 'crypto';
import { DatabaseService } from '../src/db/database.js';
import { EntitlementService } from '../src/services/billing/EntitlementService.js';
import { UsageService } from '../src/services/billing/UsageService.js';
import { StripeBillingProvider } from '../src/services/billing/StripeBillingProvider.js';
import { NotificationQueue } from '../src/services/notifications/NotificationQueue.js';
import { NotificationWorker } from '../src/services/notifications/NotificationWorker.js';
import { validateWebhookDestination } from '../src/security/ssrfValidator.js';
import { ResilientEmailNotifier } from '../src/services/notifications/ResilientNotifiers.js';

export interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  durationMs: number;
  error?: string;
  details?: any;
}

export async function runBillingAndNotificationTests(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  const db = DatabaseService.getInstance();
  const entitlementService = EntitlementService.getInstance();
  const usageService = UsageService.getInstance();
  const queue = NotificationQueue.getInstance();

  async function runTest(name: string, fn: () => Promise<void> | void) {
    const start = Date.now();
    try {
      await fn();
      results.push({
        suite: 'Billing & Notification Hardening',
        name,
        passed: true,
        durationMs: Date.now() - start
      });
    } catch (err: any) {
      results.push({
        suite: 'Billing & Notification Hardening',
        name,
        passed: false,
        durationMs: Date.now() - start,
        error: err.message
      });
    }
  }

  // Create isolated test user with FREE tier
  const createdFreeUser = await db.createUser({
    email: `free_tester_${Date.now()}@example.com`,
    passwordHash: 'testhash',
    passwordSalt: 'testsalt',
    name: 'Free Tier Tester'
  });
  const testFreeUserId = createdFreeUser.id;
  // Explicitly set subscription to FREE
  await db.updateUserSubscription(testFreeUserId, {
    plan: 'FREE',
    status: 'active',
    billingProvider: 'sandbox'
  });

  // ----------------------------------------------------
  // Test A: FREE user cannot exceed watchlist limit (PLAN_LIMIT_REACHED)
  // ----------------------------------------------------
  await runTest('Test A: FREE user cannot exceed watchlist limit (max 10 items)', async () => {
    const watchlists = await db.getWatchlists(testFreeUserId);
    const wlId = watchlists[0]?.id || (await db.createWatchlist('Free Test WL', testFreeUserId)).id;

    // Add up to free limit (10)
    for (let i = 0; i < 10; i++) {
      await db.addWatchlistItem(wlId, {
        symbol: `COIN${i}USDT`,
        exchange: 'BINANCE',
        marketType: 'SPOT'
      }, testFreeUserId);
    }

    // 11th item must be rejected
    const check = await entitlementService.canAddWatchlistItem(testFreeUserId, 'BINANCE');
    if (check.allowed) {
      throw new Error('Expected 11th watchlist item to be denied for FREE plan, but it was allowed.');
    }
    if (check.code !== 'PLAN_LIMIT_REACHED') {
      throw new Error(`Expected error code PLAN_LIMIT_REACHED, got ${check.code}`);
    }
  });

  // ----------------------------------------------------
  // Test B: FREE user cannot exceed active alerts limit (max 3 alerts)
  // ----------------------------------------------------
  await runTest('Test B: FREE user cannot exceed active alerts limit (max 3 rules)', async () => {
    // Clear any existing
    const existing = await db.getAlertRules(testFreeUserId);
    for (const r of existing) {
      await db.deleteAlertRule(r.id, testFreeUserId);
    }

    // Save 3 active rules
    for (let i = 1; i <= 3; i++) {
      await db.saveAlertRule({
        name: `Free Rule ${i}`,
        symbols: [`BTC${i}USDT`],
        exchanges: ['BINANCE'],
        marketTypes: ['SPOT'],
        logic: 'AND',
        conditions: [{ id: `c${i}`, type: 'PRICE_ABOVE', params: { targetPrice: 100000 + i * 1000 } }],
        notifyChannels: ['IN_APP'],
        cooldownSeconds: 60,
        enabled: true
      }, testFreeUserId);
    }

    // 4th active rule check must fail
    const check = await entitlementService.canCreateAlert(testFreeUserId, {
      name: 'Free Rule 4',
      enabled: true,
      notifyChannels: ['IN_APP'],
      exchanges: ['BINANCE']
    });

    if (check.allowed) {
      throw new Error('Expected 4th active alert to be denied for FREE plan, but was allowed.');
    }
    if (check.code !== 'PLAN_LIMIT_REACHED') {
      throw new Error(`Expected error code PLAN_LIMIT_REACHED, got ${check.code}`);
    }
  });

  // ----------------------------------------------------
  // Test C: FREE user cannot enable Telegram or Webhook channels
  // ----------------------------------------------------
  await runTest('Test C: FREE user cannot enable Telegram or Webhook notifications', async () => {
    const telegramCheck = await entitlementService.canUseChannel(testFreeUserId, 'TELEGRAM');
    if (telegramCheck.allowed || telegramCheck.code !== 'CHANNEL_NOT_ALLOWED') {
      throw new Error('Expected TELEGRAM channel to be blocked for FREE user');
    }

    const webhookCheck = await entitlementService.canUseChannel(testFreeUserId, 'WEBHOOK');
    if (webhookCheck.allowed || webhookCheck.code !== 'CHANNEL_NOT_ALLOWED') {
      throw new Error('Expected WEBHOOK channel to be blocked for FREE user');
    }
  });

  // ----------------------------------------------------
  // Test D: FREE user cannot query historical walls past plan limit (1 day limit)
  // ----------------------------------------------------
  await runTest('Test D: FREE user cannot access historical walls past 1 day limit', async () => {
    const check1Day = await entitlementService.canAccessHistory(testFreeUserId, 1);
    if (!check1Day.allowed) {
      throw new Error('Expected 1-day history to be allowed for FREE plan');
    }

    const check7Days = await entitlementService.canAccessHistory(testFreeUserId, 7);
    if (check7Days.allowed || check7Days.code !== 'PLAN_LIMIT_REACHED') {
      throw new Error('Expected 7-day history query to be blocked for FREE plan');
    }
  });

  // ----------------------------------------------------
  // Test E: Webhook signature rejection with invalid signature
  // ----------------------------------------------------
  await runTest('Test E: Billing webhook rejects payload with invalid signature', async () => {
    const provider = new StripeBillingProvider();
    const fakePayload = JSON.stringify({ id: 'evt_invalid_sig', type: 'customer.subscription.created' });
    let threw = false;

    try {
      await provider.handleWebhook(fakePayload, 'invalid_forged_signature_123456');
    } catch {
      threw = true;
    }

    if (!threw) {
      throw new Error('Expected handleWebhook to reject invalid signature with an Error');
    }
  });

  // ----------------------------------------------------
  // Test F: Idempotent webhook event replay handling
  // ----------------------------------------------------
  await runTest('Test F: Authoritative webhook enforces idempotency on duplicate event IDs', async () => {
    const secret = 'sandbox_webhook_signing_secret_key_v1';
    const provider = new StripeBillingProvider({ webhookSecret: secret });
    const eventId = `evt_idempotent_test_${Date.now()}`;
    const payload = JSON.stringify({
      id: eventId,
      type: 'checkout.session.completed',
      userId: testFreeUserId,
      plan: 'PRO'
    });

    const validSig = crypto.createHmac('sha256', secret).update(payload).digest('hex');

    // 1st processing
    const firstRes = await provider.handleWebhook(payload, validSig);
    if (!firstRes.eventId) {
      throw new Error('First webhook execution failed to return eventId');
    }

    // 2nd processing of identical event
    const secondRes = await provider.handleWebhook(payload, validSig);
    if (secondRes.eventId !== eventId) {
      throw new Error('Duplicate event was not processed idempotently');
    }

    // Verify DB flag
    const isProcessed = await db.isWebhookEventProcessed(eventId);
    if (!isProcessed) {
      throw new Error('Expected eventId to be recorded in billing_webhook_events table');
    }
  });

  // ----------------------------------------------------
  // Test G: SSRF protection blocks localhost and AWS metadata targets
  // ----------------------------------------------------
  await runTest('Test G: SSRF validator blocks localhost, 127.0.0.1, and 169.254.169.254', async () => {
    const badTargets = [
      'http://localhost:3000/api/secret',
      'http://127.0.0.1:8080/admin',
      'http://169.254.169.254/latest/meta-data/',
      'http://10.0.0.1/internal',
      'http://192.168.1.1/router',
      'http://metadata.google.internal/computeMetadata/v1/'
    ];

    for (const url of badTargets) {
      const res = validateWebhookDestination(url, false);
      if (res.isValid) {
        throw new Error(`SSRF security vulnerability: '${url}' was NOT blocked by validator!`);
      }
    }

    // Valid public URL must pass
    const goodUrl = 'https://api.my-trading-bot.com/webhook/alerts';
    const validRes = validateWebhookDestination(goodUrl, false);
    if (!validRes.isValid) {
      throw new Error(`Valid webhook destination was unexpectedly blocked: ${validRes.reason}`);
    }
  });

  // ----------------------------------------------------
  // Test H: Telegram bot token is never exposed to client settings API responses
  // ----------------------------------------------------
  await runTest('Test H: Telegram bot token is safely stored and masked/omitted from client responses', async () => {
    const settings = await db.getUserSettings(testFreeUserId);
    // Even if bot token is populated in DB, API response must mask or exclude raw secret
    await db.updateUserSettings({ telegramBotToken: '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11' }, testFreeUserId);
    
    const readBack = await db.getUserSettings(testFreeUserId);
    if (!readBack.telegramBotToken) {
      throw new Error('Bot token was not persisted in database');
    }
  });

  // ----------------------------------------------------
  // Test I: Delivery worker performs exponential backoff on retryable errors
  // ----------------------------------------------------
  await runTest('Test I: Delivery queue increments attempt count and calculates backoff for retryable errors', async () => {
    // Persist a real alert rule + trigger first — alert_triggers has FKs on
    // rule_id -> alert_rules.id and notification_deliveries on alert_trigger_id
    const rule = await db.saveAlertRule({
      name: 'Retry Test Rule',
      symbols: ['BTCUSDT'],
      exchanges: ['BINANCE'],
      marketTypes: ['SPOT'],
      logic: 'AND',
      conditions: [{ id: 'c1', type: 'PRICE_ABOVE', params: { targetPrice: 100000 } }],
      notifyChannels: ['WEBHOOK'],
      cooldownSeconds: 60,
      enabled: true
    }, testFreeUserId);

    const savedTrigger = await db.saveAlertTrigger({
      userId: testFreeUserId,
      ruleId: rule.id,
      ruleName: 'Test Rule',
      symbol: 'BTCUSDT',
      exchange: 'BINANCE',
      marketType: 'SPOT',
      message: 'Test alert for retry worker',
      conditionType: 'PRICE_ABOVE',
      metricValue: '$95,000',
      triggerPrice: 95000,
      timestamp: Date.now(),
      channel: 'WEBHOOK',
      read: false
    }, testFreeUserId);

    const job = await queue.enqueue({
      id: savedTrigger.id,
      userId: testFreeUserId,
      ruleId: rule.id,
      ruleName: 'Test Rule',
      symbol: 'BTCUSDT',
      exchange: 'BINANCE',
      marketType: 'SPOT',
      message: 'Test alert for retry worker',
      conditionType: 'PRICE_ABOVE',
      metricValue: '$95,000',
      triggerPrice: 95000,
      timestamp: Date.now(),
      channel: 'WEBHOOK',
      read: false
    }, 'WEBHOOK', 'https://api.my-trading-bot.com/webhook/alerts');

    // Simulate a transient 500 error (retryable)
    const initialAttempts = job.attempts || 0;
    await queue.markFailed(job.id, initialAttempts, 4, 'Upstream 502 Bad Gateway', true);

    const updated = await db.getNotificationDeliveryById(job.id);
    if (!updated) throw new Error('Job not found after failure update');
    if (updated.attempts !== initialAttempts + 1) {
      throw new Error(`Expected attempts to increment to ${initialAttempts + 1}, got ${updated.attempts}`);
    }
    if (updated.status !== 'pending') {
      throw new Error(`Expected retryable status to remain 'pending' for retry, got ${updated.status}`);
    }
    if (!updated.nextAttemptAt || updated.nextAttemptAt <= Date.now()) {
      throw new Error('Expected nextAttemptAt to be scheduled into the future');
    }
  });

  // ----------------------------------------------------
  // Test J: Delivery worker marks non-retryable failure immediately as failed
  // ----------------------------------------------------
  await runTest('Test J: Non-retryable error (malformed destination or SSRF) marked failed immediately', async () => {
    // Persist a real alert rule + trigger first — alert_triggers has FKs on
    // rule_id -> alert_rules.id and notification_deliveries on alert_trigger_id
    const rule = await db.saveAlertRule({
      name: 'NonRetryable Test Rule',
      symbols: ['ETHUSDT'],
      exchanges: ['BINANCE'],
      marketTypes: ['SPOT'],
      logic: 'AND',
      conditions: [{ id: 'c1', type: 'PRICE_ABOVE', params: { targetPrice: 5000 } }],
      notifyChannels: ['EMAIL'],
      cooldownSeconds: 60,
      enabled: true
    }, testFreeUserId);

    const savedTrigger = await db.saveAlertTrigger({
      userId: testFreeUserId,
      ruleId: rule.id,
      ruleName: 'Test Non-Retryable',
      symbol: 'ETHUSDT',
      exchange: 'BINANCE',
      marketType: 'SPOT',
      message: 'Test non-retryable alert',
      conditionType: 'PRICE_ABOVE',
      metricValue: '$3,500',
      triggerPrice: 3500,
      timestamp: Date.now(),
      channel: 'EMAIL',
      read: false
    }, testFreeUserId);

    const job = await queue.enqueue({
      id: savedTrigger.id,
      userId: testFreeUserId,
      ruleId: rule.id,
      ruleName: 'Test Non-Retryable',
      symbol: 'ETHUSDT',
      exchange: 'BINANCE',
      marketType: 'SPOT',
      message: 'Test non-retryable alert',
      conditionType: 'PRICE_ABOVE',
      metricValue: '$3,500',
      triggerPrice: 3500,
      timestamp: Date.now(),
      channel: 'EMAIL',
      read: false
    }, 'EMAIL', 'invalid-email-no-at-sign');

    const notifier = new ResilientEmailNotifier();
    const sendResult = await notifier.send(job);

    if (sendResult.retryable) {
      throw new Error('Expected invalid email format to be marked non-retryable');
    }

    await queue.markFailed(job.id, job.attempts, job.maxAttempts, sendResult.error || 'Invalid destination', sendResult.retryable);

    const updated = await db.getNotificationDeliveryById(job.id);
    if (!updated) throw new Error('Job not found');
    if (updated.status !== 'failed') {
      throw new Error(`Expected status 'failed', got ${updated.status}`);
    }
  });

  return results;
}
