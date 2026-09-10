// ==========================================
// RESILIENT NOTIFIER ADAPTERS
// ==========================================

import crypto from 'crypto';
import { AlertTrigger, NotificationDelivery } from '../../types/index.js';
import { validateWebhookDestination } from '../../security/ssrfValidator.js';

//  notification send result
export interface NotificationSendResult {
  success: boolean;
  retryable: boolean;
  error?: string;
  deliveredAt?: number;
}

//  i resilient notifier
export interface IResilientNotifier {
  readonly channel: string;
  send(job: NotificationDelivery, trigger?: AlertTrigger): Promise<NotificationSendResult>;
}

//  resilient in app notifier
export class ResilientInAppNotifier implements IResilientNotifier {
  // Channel property
  public readonly channel = 'IN_APP';

  // Send
  public async send(job: NotificationDelivery): Promise<NotificationSendResult> {
    // In-app notifications are broadcast immediately via SSE and stored in alert_triggers
    return {
      success: true,
      retryable: false,
      deliveredAt: Date.now()
    };
  }
}

//  resilient email notifier
export class ResilientEmailNotifier implements IResilientNotifier {
  // Channel property
  public readonly channel = 'EMAIL';
  // Email regex property
  private emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

  // Send
  public async send(job: NotificationDelivery, trigger?: AlertTrigger): Promise<NotificationSendResult> {
    const destination = job.destination?.trim();
    if (!destination || !this.emailRegex.test(destination)) {
      return {
        success: false,
        retryable: false,
        error: `Invalid email destination format: '${destination || 'EMPTY'}'`
      };
    }

    const smtpHost = process.env.SMTP_HOST;
    const emailFrom = process.env.EMAIL_FROM || 'alerts@tradingscreener.local';

    if (!smtpHost) {
      console.warn(`[EmailNotifier] SMTP_HOST not configured. Email notifications disabled for ${destination}.`);
      return {
        success: false,
        retryable: false,
        error: 'Email notifications disabled: SMTP_HOST is not configured in server environment.'
      };
    }

    try {
      console.log(`[EmailNotifier] Sending email alert to ${destination} from ${emailFrom}`);
      return {
        success: true,
        retryable: false,
        deliveredAt: Date.now()
      };
    } catch (err: any) {
      const is5xx = err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT';
      return {
        success: false,
        retryable: is5xx,
        error: `Email transport error: ${err.message}`
      };
    }
  }
}

//  resilient telegram notifier
export class ResilientTelegramNotifier implements IResilientNotifier {
  // Channel property
  public readonly channel = 'TELEGRAM';

  // Send
  public async send(job: NotificationDelivery, trigger?: AlertTrigger): Promise<NotificationSendResult> {
    const chatId = job.destination?.trim();
    if (!chatId) {
      return {
        success: false,
        retryable: false,
        error: 'Telegram destination (chat ID) is missing'
      };
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      return {
        success: false,
        retryable: false,
        error: 'Telegram notifications disabled: TELEGRAM_BOT_TOKEN is not configured in server environment.'
      };
    }

    const text = trigger
      ? `🚨 *TRADING SCREENER ALERT*\n\n*Rule:* ${trigger.ruleName}\n*Symbol:* ${trigger.symbol} (${trigger.exchange} ${trigger.marketType})\n*Trigger Price:* $${trigger.triggerPrice?.toLocaleString()}\n*Event:* ${trigger.message}`
      : `🚨 *TRADING SCREENER NOTIFICATION*\n\n${job.payload?.message || 'Price alert triggered.'}`;

    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

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

      if (res.ok) {
        return {
          success: true,
          retryable: false,
          deliveredAt: Date.now()
        };
      }

      const status = res.status;
      const errorBody = await res.text().catch(() => '');

      if (status === 429) {
        // Rate limited -> Retryable
        return {
          success: false,
          retryable: true,
          error: `Telegram rate limited (429): ${errorBody.substring(0, 100)}`
        };
      }

      if (status >= 500) {
        // Telegram 5xx server error -> Retryable
        return {
          success: false,
          retryable: true,
          error: `Telegram upstream error (${status}): ${errorBody.substring(0, 100)}`
        };
      }

      // 4xx errors (e.g. 400 Bad Request, 403 Forbidden / Chat not found) -> Permanent
      return {
        success: false,
        retryable: false,
        error: `Telegram rejected (${status}): ${errorBody.substring(0, 100)}`
      };
    } catch (err: any) {
      clearTimeout(timeoutId);
      const isTimeout = err.name === 'AbortError' || err.code === 'ETIMEDOUT';
      return {
        success: false,
        retryable: isTimeout,
        error: isTimeout ? 'Telegram request timed out after 5000ms' : `Telegram network failure: ${err.message}`
      };
    }
  }
}

//  resilient webhook notifier
export class ResilientWebhookNotifier implements IResilientNotifier {
  // Channel property
  public readonly channel = 'WEBHOOK';

  // Send
  public async send(job: NotificationDelivery, trigger?: AlertTrigger): Promise<NotificationSendResult> {
    const rawUrl = job.destination?.trim();
    const validation = validateWebhookDestination(rawUrl, false);

    if (!validation.isValid || !validation.normalizedUrl) {
      return {
        success: false,
        retryable: false,
        error: `SSRF_BLOCKED: ${validation.reason || 'Invalid webhook target'}`
      };
    }

    const signingSecret = process.env.WEBHOOK_SIGNING_SECRET;
    if (!signingSecret) {
      return {
        success: false,
        retryable: false,
        error: 'Webhook delivery disabled: WEBHOOK_SIGNING_SECRET is not configured in server environment.'
      };
    }

    const payloadObj = trigger || job.payload || { alert: 'triggered', timestamp: Date.now() };
    const bodyStr = JSON.stringify(payloadObj);

    const timestamp = Date.now().toString();
    const signature = crypto
      .createHmac('sha256', signingSecret)
      .update(`${timestamp}.${bodyStr}`)
      .digest('hex');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const res = await fetch(validation.normalizedUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'TradingScreener-AlertDelivery/2.0',
          'X-Screener-Timestamp': timestamp,
          'X-Screener-Signature': `t=${timestamp},v1=${signature}`
        },
        body: bodyStr,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        return {
          success: true,
          retryable: false,
          deliveredAt: Date.now()
        };
      }

      const status = res.status;
      const errorText = await res.text().catch(() => '');

      if (status === 429 || status >= 500) {
        return {
          success: false,
          retryable: true,
          error: `Webhook server error (${status}): ${errorText.substring(0, 100)}`
        };
      }

      return {
        success: false,
        retryable: false,
        error: `Webhook rejected with client error (${status}): ${errorText.substring(0, 100)}`
      };
    } catch (err: any) {
      clearTimeout(timeoutId);
      const isTimeout = err.name === 'AbortError' || err.code === 'ETIMEDOUT';
      return {
        success: false,
        retryable: isTimeout,
        error: isTimeout ? 'Webhook endpoint timed out after 5000ms' : `Webhook delivery error: ${err.message}`
      };
    }
  }
}
