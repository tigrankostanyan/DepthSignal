// ==========================================
// TELEGRAM ACCOUNT LINKING AUTOMATED TEST SUITE
// Validates cryptographic tokens, single-use, expiry, conflict handling, webhooks & notifications
// ==========================================

import crypto from 'crypto';
import { DatabaseService } from '../db/database.js';
import { TelegramLinkingService, TELEGRAM_BOT_USERNAME } from '../notifications/TelegramLinkingService.js';

export interface TestResult {
  name: string;
  category: 'TELEGRAM_LINKING' | 'TELEGRAM_SECURITY' | 'TELEGRAM_NOTIFICATIONS';
  passed: boolean;
  error?: string;
  durationMs: number;
}

export async function runTelegramLinkingTests(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  const db = DatabaseService.getInstance();
  await db.initialize();
  const telegramService = TelegramLinkingService.getInstance();

  async function runTest(
    name: string,
    category: TestResult['category'],
    fn: () => Promise<void> | void
  ) {
    const start = Date.now();
    try {
      await fn();
      results.push({
        name,
        category,
        passed: true,
        durationMs: Date.now() - start
      });
    } catch (err: any) {
      results.push({
        name,
        category,
        passed: false,
        error: err.message || String(err),
        durationMs: Date.now() - start
      });
    }
  }

  // -------------------------------------------------------------
  // TEST 1: Cryptographic Linking Token Generation & Format
  // -------------------------------------------------------------
  await runTest(
    '1. Cryptographically secure token generation & deep link validation',
    'TELEGRAM_LINKING',
    async () => {
      const testUserId = `usr_tg_test_${Math.random().toString(36).substring(2, 7)}`;
      const tokenResp = telegramService.createLinkingToken(testUserId, 600000);

      if (!tokenResp.token || tokenResp.token.length < 32) {
        throw new Error(`Token is too short or empty: ${tokenResp.token}`);
      }

      if (tokenResp.botUsername !== TELEGRAM_BOT_USERNAME) {
        throw new Error(`Bot username mismatch: expected ${TELEGRAM_BOT_USERNAME}, got ${tokenResp.botUsername}`);
      }

      const expectedPrefix = `https://t.me/${TELEGRAM_BOT_USERNAME}?start=`;
      if (!tokenResp.deepLink.startsWith(expectedPrefix)) {
        throw new Error(`Deep link does not start with ${expectedPrefix}: got ${tokenResp.deepLink}`);
      }

      // Verify that token in DB is hashed, not plain text
      const tokenHash = telegramService.hashToken(tokenResp.token);
      const tokenRecord = db.getTelegramLinkTokenByHash(tokenHash);

      if (!tokenRecord) {
        throw new Error('Token hash was not found in database');
      }

      if (tokenRecord.tokenHash === tokenResp.token) {
        throw new Error('Security Violation: Raw token was stored in plain text instead of SHA-256 hash!');
      }

      if (tokenRecord.userId !== testUserId) {
        throw new Error(`Token userId mismatch: expected ${testUserId}, got ${tokenRecord.userId}`);
      }

      if (tokenRecord.usedAt !== null) {
        throw new Error('Newly created token must have used_at === null');
      }
    }
  );

  // -------------------------------------------------------------
  // TEST 2: Successful Linking Flow via /start <token>
  // -------------------------------------------------------------
  await runTest(
    '2. End-to-end account linking via /start token and immediate invalidation',
    'TELEGRAM_LINKING',
    async () => {
      const testUserId = `usr_tg_link_${Math.random().toString(36).substring(2, 7)}`;
      const tokenResp = telegramService.createLinkingToken(testUserId, 600000);

      const fakeTgId = 987654321;
      const fakeChatId = 987654321;
      const fakeUsername = 'trader_bob';

      const linkResult = await telegramService.handleStartCommand(tokenResp.token, {
        id: fakeTgId,
        username: fakeUsername,
        chat_id: fakeChatId
      });

      if (!linkResult.success) {
        throw new Error(`Linking failed: ${linkResult.message}`);
      }

      // Verify token is marked as used
      const tokenHash = telegramService.hashToken(tokenResp.token);
      const tokenRecord = db.getTelegramLinkTokenByHash(tokenHash);
      if (!tokenRecord || tokenRecord.usedAt === null) {
        throw new Error('Token was not marked as used in DB!');
      }

      // Verify link in database
      const userLink = db.getUserTelegramLink(testUserId);
      if (!userLink || !userLink.enabled) {
        throw new Error('User telegram link record was not found or not enabled');
      }

      if (userLink.telegramChatId !== String(fakeChatId)) {
        throw new Error(`ChatId mismatch: expected ${fakeChatId}, got ${userLink.telegramChatId}`);
      }

      if (userLink.telegramUserId !== String(fakeTgId)) {
        throw new Error(`Telegram UserId mismatch: expected ${fakeTgId}, got ${userLink.telegramUserId}`);
      }

      // Verify user_settings is synced
      const settings = db.getUserSettings(testUserId);
      if (settings.telegramChatId !== String(fakeChatId)) {
        throw new Error(`user_settings.telegramChatId was not synced: got ${settings.telegramChatId}`);
      }

      // Verify status endpoint
      const status = telegramService.getStatus(testUserId);
      if (!status.connected || status.telegramChatId !== String(fakeChatId)) {
        throw new Error('getStatus did not return connected === true with matching chat ID');
      }
    }
  );

  // -------------------------------------------------------------
  // TEST 3: Single-Use Token Enforcement (Replay Attack Prevention)
  // -------------------------------------------------------------
  await runTest(
    '3. Replay attack rejection: reused token must fail immediately',
    'TELEGRAM_SECURITY',
    async () => {
      const testUserId = `usr_tg_reuse_${Math.random().toString(36).substring(2, 7)}`;
      const tokenResp = telegramService.createLinkingToken(testUserId, 600000);

      // First use: must succeed
      const res1 = await telegramService.handleStartCommand(tokenResp.token, {
        id: 11223344,
        chat_id: 11223344,
        username: 'first_link'
      });
      if (!res1.success) {
        throw new Error('First use of token failed unexpectedly');
      }

      // Second use of the EXACT same token: MUST fail
      const res2 = await telegramService.handleStartCommand(tokenResp.token, {
        id: 55667788,
        chat_id: 55667788,
        username: 'attacker'
      });

      if (res2.success) {
        throw new Error('Security Breach: Reused linking token was accepted!');
      }

      if (res2.code !== 'TOKEN_ALREADY_USED') {
        throw new Error(`Expected TOKEN_ALREADY_USED error code, got ${res2.code}`);
      }
    }
  );

  // -------------------------------------------------------------
  // TEST 4: Expired Token Rejection
  // -------------------------------------------------------------
  await runTest(
    '4. Expired token rejection: expired linking token must fail',
    'TELEGRAM_SECURITY',
    async () => {
      const testUserId = `usr_tg_exp_${Math.random().toString(36).substring(2, 7)}`;
      // Create with negative TTL -> immediately expired
      const tokenResp = telegramService.createLinkingToken(testUserId, -10000);

      const res = await telegramService.handleStartCommand(tokenResp.token, {
        id: 99887766,
        chat_id: 99887766,
        username: 'expired_user'
      });

      if (res.success) {
        throw new Error('Expired token was accepted when it should have been rejected');
      }

      if (res.code !== 'TOKEN_EXPIRED') {
        throw new Error(`Expected TOKEN_EXPIRED code, got ${res.code}`);
      }
    }
  );

  // -------------------------------------------------------------
  // TEST 5: Invalid & Corrupted Token Rejection
  // -------------------------------------------------------------
  await runTest(
    '5. Invalid or corrupted token rejection',
    'TELEGRAM_SECURITY',
    async () => {
      const invalidTokens = [
        'invalid_random_string_123',
        '34897234892374982374982374982374',
        '',
        'undefined'
      ];

      for (const tok of invalidTokens) {
        const res = await telegramService.handleStartCommand(tok, {
          id: 12345,
          chat_id: 12345
        });

        if (res.success) {
          throw new Error(`Invalid token '${tok}' was accepted unexpectedly!`);
        }
        if (res.code !== 'INVALID_TOKEN') {
          throw new Error(`Expected INVALID_TOKEN, got ${res.code}`);
        }
      }
    }
  );

  // -------------------------------------------------------------
  // TEST 6: Account Conflict Prevention (Multi-Account Collision)
  // -------------------------------------------------------------
  await runTest(
    '6. Account conflict prevention: cannot link already-claimed Telegram account to another user',
    'TELEGRAM_SECURITY',
    async () => {
      const userA = `usr_tg_conflict_A_${Math.random().toString(36).substring(2, 7)}`;
      const userB = `usr_tg_conflict_B_${Math.random().toString(36).substring(2, 7)}`;

      const tokenA = telegramService.createLinkingToken(userA, 600000);
      const tokenB = telegramService.createLinkingToken(userB, 600000);

      const sharedTgId = 777888999;
      const sharedChatId = 777888999;

      // Link User A to Telegram ID 777888999
      const resA = await telegramService.handleStartCommand(tokenA.token, {
        id: sharedTgId,
        chat_id: sharedChatId,
        username: 'crypto_whale'
      });
      if (!resA.success) throw new Error(`User A linking failed: ${resA.message}`);

      // Now User B tries to link the SAME Telegram ID 777888999 -> Must be rejected
      const resB = await telegramService.handleStartCommand(tokenB.token, {
        id: sharedTgId,
        chat_id: sharedChatId,
        username: 'crypto_whale'
      });

      if (resB.success) {
        throw new Error('Security Breach: Same Telegram ID was linked to two different QuantScreen users without disconnection!');
      }

      if (resB.code !== 'ALREADY_LINKED_TO_OTHER_USER') {
        throw new Error(`Expected ALREADY_LINKED_TO_OTHER_USER, got ${resB.code}`);
      }
    }
  );

  // -------------------------------------------------------------
  // TEST 7: Telegram Disconnect Flow
  // -------------------------------------------------------------
  await runTest(
    '7. Disconnect flow: clears user links and updates settings safely',
    'TELEGRAM_LINKING',
    async () => {
      const testUserId = `usr_tg_disc_${Math.random().toString(36).substring(2, 7)}`;
      const tokenResp = telegramService.createLinkingToken(testUserId, 600000);

      await telegramService.handleStartCommand(tokenResp.token, {
        id: 33445566,
        chat_id: 33445566,
        username: 'disconnect_me'
      });

      // Verify connected
      let status = telegramService.getStatus(testUserId);
      if (!status.connected) throw new Error('Failed to establish initial connection');

      // Disconnect
      telegramService.disconnect(testUserId);

      // Verify status is now disconnected
      status = telegramService.getStatus(testUserId);
      if (status.connected) {
        throw new Error('Status still reports connected after disconnect()');
      }

      const settings = db.getUserSettings(testUserId);
      if (settings.telegramChatId) {
        throw new Error(`user_settings.telegramChatId was not cleared: ${settings.telegramChatId}`);
      }
    }
  );

  // -------------------------------------------------------------
  // TEST 8: Webhook Secret Token Header Verification
  // -------------------------------------------------------------
  await runTest(
    '8. Telegram webhook secret token header verification',
    'TELEGRAM_SECURITY',
    async () => {
      const originalSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
      try {
        process.env.TELEGRAM_WEBHOOK_SECRET = 'my_super_secret_webhook_token_123';

        // 1. Webhook with missing header -> Rejected
        const resMissing = await telegramService.processWebhookUpdate({
          update_id: 1001,
          message: { text: '/start' }
        }, undefined);

        if (!resMissing.unauthorized) {
          throw new Error('Webhook update with missing secret token was not flagged as unauthorized');
        }

        // 2. Webhook with wrong header -> Rejected
        const resWrong = await telegramService.processWebhookUpdate({
          update_id: 1002,
          message: { text: '/start' }
        }, 'wrong_token');

        if (!resWrong.unauthorized) {
          throw new Error('Webhook update with invalid secret token was not flagged as unauthorized');
        }

        // 3. Webhook with correct header -> Processed
        const resCorrect = await telegramService.processWebhookUpdate({
          update_id: 1003,
          message: {
            text: '/help',
            from: { id: 123456 },
            chat: { id: 123456 }
          }
        }, 'my_super_secret_webhook_token_123');

        if (resCorrect.unauthorized) {
          throw new Error('Webhook with matching secret token was rejected as unauthorized');
        }
      } finally {
        process.env.TELEGRAM_WEBHOOK_SECRET = originalSecret;
      }
    }
  );

  // -------------------------------------------------------------
  // TEST 9: Test Alert Validation & Delivery Logging
  // -------------------------------------------------------------
  await runTest(
    '9. Test alert validation and delivery persistence for unlinked vs linked users',
    'TELEGRAM_NOTIFICATIONS',
    async () => {
      // 1. Unlinked user attempting test alert -> Returns clean validation error
      const unlinkedUser = `usr_tg_unlinked_${Math.random().toString(36).substring(2, 7)}`;
      const resUnlinked = await telegramService.sendTestAlert(unlinkedUser);

      if (resUnlinked.success) {
        throw new Error('Test alert succeeded for an unlinked user!');
      }

      if (!resUnlinked.error || !resUnlinked.error.includes('not connected')) {
        throw new Error(`Expected 'not connected' error, got: ${resUnlinked.error}`);
      }

      // 2. Linked user without TELEGRAM_BOT_TOKEN -> Logs delivery record with failure status
      const linkedUser = `usr_tg_linked_nobot_${Math.random().toString(36).substring(2, 7)}`;
      const tokenResp = telegramService.createLinkingToken(linkedUser, 600000);
      await telegramService.handleStartCommand(tokenResp.token, {
        id: 44556677,
        chat_id: 44556677,
        username: 'test_alert_user'
      });

      const origToken = process.env.TELEGRAM_BOT_TOKEN;
      try {
        delete process.env.TELEGRAM_BOT_TOKEN;
        const resNoToken = await telegramService.sendTestAlert(linkedUser);

        if (resNoToken.success) {
          throw new Error('Test alert succeeded when TELEGRAM_BOT_TOKEN was absent!');
        }

        // Verify a delivery failure was recorded in notification_deliveries table
        const deliveries = db.getNotificationDeliveries('failed', 10);
        const recorded = deliveries.find(d => d.userId === linkedUser && d.channel === 'TELEGRAM');
        if (!recorded) {
          throw new Error('Failed notification delivery was not recorded in notification_deliveries table');
        }
      } finally {
        process.env.TELEGRAM_BOT_TOKEN = origToken;
      }
    }
  );

  return results;
}
