// ==========================================
// TELEGRAM LINKING & NOTIFICATION SERVICE
// Handles per-user Telegram account linking, tokens, webhooks, and test alerts
// ==========================================

import crypto from 'crypto';
import { DatabaseService } from '../../db/database.js';
import { 
  NotificationChannelType, 
  NotificationDelivery, 
  TelegramLinkTokenResponse, 
  TelegramStatusResponse, 
  TelegramTestAlertResponse, 
  UserTelegramLink 
} from '../../types/index.js';

//  t e l e g r a m_ b o t_ u s e r n a m e
export const TELEGRAM_BOT_USERNAME = 'QuantScreenAlertsBot';

//  telegram linking service
export class TelegramLinkingService {
  // Instance property
  private static instance: TelegramLinkingService;
  // Db property
  private db: DatabaseService;

  private constructor() {
    this.db = DatabaseService.getInstance();
  }

  // Get instance
  public static getInstance(): TelegramLinkingService {
    if (!TelegramLinkingService.instance) {
      TelegramLinkingService.instance = new TelegramLinkingService();
    }
    return TelegramLinkingService.instance;
  }

  // Hash token
  public hashToken(rawToken: string): string {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }

  // Create linking token
  public async createLinkingToken(userId: string, ttlMs = 10 * 60 * 1000): Promise<TelegramLinkTokenResponse> {
    const rawToken = crypto.randomBytes(24).toString('hex');
    const tokenHash = this.hashToken(rawToken);

    const record = await this.db.createTelegramLinkToken(userId, tokenHash, ttlMs);
    const deepLink = `https://t.me/${TELEGRAM_BOT_USERNAME}?start=${rawToken}`;

    return {
      token: rawToken,
      botUsername: TELEGRAM_BOT_USERNAME,
      deepLink,
      expiresAt: record.expiresAt
    };
  }

  // Handle start command
  public async handleStartCommand(
    rawToken: string,
    tgUser: {
      id: string | number;
      username?: string;
      first_name?: string;
      last_name?: string;
      chat_id: string | number;
    }
  ): Promise<{
    success: boolean;
    code?: 'INVALID_TOKEN' | 'TOKEN_EXPIRED' | 'TOKEN_ALREADY_USED' | 'ALREADY_LINKED_TO_OTHER_USER' | 'ERROR';
    message: string;
    userId?: string;
    link?: UserTelegramLink;
  }> {
    if (!rawToken || typeof rawToken !== 'string') {
      return {
        success: false,
        code: 'INVALID_TOKEN',
        message: 'No linking token was provided with /start command.'
      };
    }

    const tokenHash = this.hashToken(rawToken.trim());
    const tokenRecord = await this.db.getTelegramLinkTokenByHash(tokenHash);

    if (!tokenRecord) {
      return {
        success: false,
        code: 'INVALID_TOKEN',
        message: 'Invalid or unrecognized linking token.'
      };
    }

    if (tokenRecord.usedAt !== null) {
      return {
        success: false,
        code: 'TOKEN_ALREADY_USED',
        message: 'This linking token has already been used. Please generate a new link in QuantScreen settings.'
      };
    }

    if (tokenRecord.expiresAt < Date.now()) {
      return {
        success: false,
        code: 'TOKEN_EXPIRED',
        message: 'This linking token has expired. Please generate a new link in QuantScreen settings.'
      };
    }

    const tgUserId = String(tgUser.id);
    const tgChatId = String(tgUser.chat_id);

    // Conflict check: Ensure this Telegram ID is not already actively linked to a different QuantScreen user
    const existingLink = await this.db.getTelegramLinkByTelegramUserId(tgUserId);
    if (existingLink && existingLink.userId !== tokenRecord.userId && existingLink.enabled) {
      return {
        success: false,
        code: 'ALREADY_LINKED_TO_OTHER_USER',
        message: 'This Telegram account is already linked to another QuantScreen user account. Please disconnect it first.'
      };
    }

    // Invalidate token immediately
    await this.db.markTelegramLinkTokenUsed(tokenRecord.id);

    // Format username
    const cleanUsername = tgUser.username 
      ? `@${tgUser.username.replace(/^@/, '')}` 
      : [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ') || 'Telegram User';

    // Save link
    const link = await this.db.saveUserTelegramLink({
      userId: tokenRecord.userId,
      telegramChatId: tgChatId,
      telegramUserId: tgUserId,
      telegramUsername: cleanUsername,
      enabled: true
    });

    // Record audit log
    await this.db.addAuditLog({
      userId: tokenRecord.userId,
      action: 'TELEGRAM_ACCOUNT_LINKED',
      resource: 'TELEGRAM',
      details: {
        telegramUserId: tgUserId,
        telegramChatId: tgChatId,
        telegramUsername: cleanUsername
      }
    });

    // Send real confirmation message via Bot API
    await this.sendTelegramMessage(
      tgChatId,
      `✅ *QuantScreen alerts are connected successfully.*\n\nYou will receive real-time market breakout alerts, order book wall notifications, and indicator triggers directly in this chat.`
    ).catch(err => {
      console.warn('[TelegramLinkingService] Failed to send linking confirmation message:', err.message);
    });

    return {
      success: true,
      message: 'QuantScreen alerts are connected successfully.',
      userId: tokenRecord.userId,
      link
    };
  }

  // Get status
  public async getStatus(userId: string): Promise<TelegramStatusResponse> {
    const link = await this.db.getUserTelegramLink(userId);
    const settings = await this.db.getUserSettings(userId);

    const chatId = link?.telegramChatId || settings.telegramChatId;
    const isConnected = Boolean(link?.enabled && chatId);

    return {
      connected: isConnected,
      telegramChatId: chatId,
      telegramUserId: link?.telegramUserId,
      telegramUsername: link?.telegramUsername,
      linkedAt: link?.linkedAt,
      enabled: isConnected,
      botUsername: TELEGRAM_BOT_USERNAME
    };
  }

  // Disconnect
  public async disconnect(userId: string, ip?: string): Promise<void> {
    const existing = await this.db.getUserTelegramLink(userId);
    await this.db.disconnectUserTelegram(userId);

    await this.db.addAuditLog({
      userId,
      action: 'TELEGRAM_ACCOUNT_DISCONNECTED',
      resource: 'TELEGRAM',
      details: {
        previousChatId: existing?.telegramChatId,
        previousTelegramUser: existing?.telegramUsername
      },
      ipAddress: ip
    });
  }

  // Send test alert
  public async sendTestAlert(userId: string): Promise<TelegramTestAlertResponse> {
    const status = await this.getStatus(userId);

    if (!status.connected || !status.telegramChatId) {
      return {
        success: false,
        error: 'Telegram is not connected. Please connect your Telegram account first.'
      };
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      const deliveryId = `ntd_test_${Math.random().toString(36).substring(2, 9)}`;
      await this.db.recordNotificationDelivery({
        id: deliveryId,
        userId,
        channel: 'TELEGRAM',
        destination: status.telegramChatId,
        status: 'failed',
        attempts: 1,
        maxAttempts: 1,
        lastAttemptAt: Date.now(),
        lastError: 'TELEGRAM_BOT_TOKEN is not configured on server.',
        payload: { test: true, time: Date.now() },
        createdAt: Date.now()
      });

      return {
        success: false,
        error: 'Telegram notifications disabled: TELEGRAM_BOT_TOKEN is not configured in server environment.'
      };
    }

    const text = `🔔 *QuantScreen Test Alert*\n\n✅ Your Telegram notification channel is active and operational.\n• Recipient: ${status.telegramUsername || status.telegramChatId}\n• Server Time: ${new Date().toUTCString()}\n• Status: Operational`;

    const deliveryId = `ntd_test_${Math.random().toString(36).substring(2, 9)}`;
    const now = Date.now();

    try {
      const result = await this.sendTelegramMessage(status.telegramChatId, text);

      if (result.ok) {
        await this.db.recordNotificationDelivery({
          id: deliveryId,
          userId,
          channel: 'TELEGRAM',
          destination: status.telegramChatId,
          status: 'delivered',
          attempts: 1,
          maxAttempts: 1,
          lastAttemptAt: now,
          deliveredAt: now,
          payload: { test: true, messageId: result.result?.message_id, time: now },
          createdAt: now
        });

        return {
          success: true,
          messageId: result.result?.message_id,
          deliveredAt: now
        };
      } else {
        const errorMsg = result.description || `HTTP ${result.error_code || 400}`;
        await this.db.recordNotificationDelivery({
          id: deliveryId,
          userId,
          channel: 'TELEGRAM',
          destination: status.telegramChatId,
          status: 'failed',
          attempts: 1,
          maxAttempts: 1,
          lastAttemptAt: now,
          lastError: errorMsg,
          payload: { test: true, time: now },
          createdAt: now
        });

        return {
          success: false,
          error: `Telegram API error: ${errorMsg}`
        };
      }
    } catch (err: any) {
      await this.db.recordNotificationDelivery({
        id: deliveryId,
        userId,
        channel: 'TELEGRAM',
        destination: status.telegramChatId,
        status: 'failed',
        attempts: 1,
        maxAttempts: 1,
        lastAttemptAt: now,
        lastError: err.message,
        payload: { test: true, time: now },
        createdAt: now
      });

      return {
        success: false,
        error: `Failed to deliver test alert: ${err.message}`
      };
    }
  }

  // Send telegram message
  public async sendTelegramMessage(chatId: string | number, text: string): Promise<any> {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      throw new Error('TELEGRAM_BOT_TOKEN is not configured');
    }

    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'Markdown'
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const json = await res.json();
      return json;
    } catch (err: any) {
      clearTimeout(timeoutId);
      throw err;
    }
  }

  // Process webhook update
  public async processWebhookUpdate(
    update: any,
    secretTokenHeader?: string
  ): Promise<{ ok: boolean; action?: string; error?: string; unauthorized?: boolean }> {
    // Validate secret token if configured in environment
    const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (webhookSecret && secretTokenHeader !== webhookSecret) {
      return { ok: false, unauthorized: true, error: 'Invalid or missing Telegram webhook secret token.' };
    }

    const message = update?.message || update?.edited_message;
    if (!message || !message.text) {
      return { ok: true, action: 'ignored_non_text' };
    }

    const text = message.text.trim();
    const from = message.from;
    const chat = message.chat;

    if (!from || !chat) {
      return { ok: true, action: 'ignored_no_sender' };
    }

    if (text.startsWith('/start')) {
      const rawToken = text.replace(/^\/start\s*/, '').trim();

      if (rawToken) {
        const result = await this.handleStartCommand(rawToken, {
          id: from.id,
          username: from.username,
          first_name: from.first_name,
          last_name: from.last_name,
          chat_id: chat.id
        });

        if (!result.success) {
          // Send error reply to user in Telegram
          await this.sendTelegramMessage(
            chat.id,
            `⚠️ *QuantScreen Connection Error*\n\n${result.message}`
          ).catch(() => {});
          return { ok: true, action: 'link_failed', error: result.message };
        }

        return { ok: true, action: 'link_success' };
      } else {
        // Just /start with no token
        await this.sendTelegramMessage(
          chat.id,
          `👋 *Welcome to QuantScreen Alerts Bot!*\n\nTo link this Telegram chat to your QuantScreen terminal:\n1. Open QuantScreen Web Terminal\n2. Navigate to *Settings → Notifications*\n3. Click *Connect Telegram*\n4. Follow the link to connect your account.`
        ).catch(() => {});

        return { ok: true, action: 'start_help_sent' };
      }
    }

    if (text === '/status' || text === '/help') {
      const link = await this.db.getTelegramLinkByTelegramUserId(String(from.id));
      if (link && link.enabled) {
        await this.sendTelegramMessage(
          chat.id,
          `📊 *QuantScreen Alerts Status*\n\n• Connection: *Active*\n• Linked User: \`${link.userId}\`\n• Linked Date: ${new Date(link.linkedAt).toLocaleDateString()}\n\nYou will receive active market alerts as they trigger.`
        ).catch(() => {});
      } else {
        await this.sendTelegramMessage(
          chat.id,
          `ℹ️ *QuantScreen Alerts Status*\n\n• Connection: *Not Connected*\n\nTo connect, open your QuantScreen settings and click *Connect Telegram*.`
        ).catch(() => {});
      }
      return { ok: true, action: 'status_sent' };
    }

    return { ok: true, action: 'unhandled_message' };
  }
}
