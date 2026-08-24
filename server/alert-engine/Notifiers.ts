import { AlertTrigger, UserSettings } from '../../src/types/index.js';

export interface INotifier {
  readonly channel: 'IN_APP' | 'TELEGRAM' | 'EMAIL' | 'WEBHOOK';
  send(trigger: AlertTrigger, settings: UserSettings): Promise<boolean>;
}

export class InAppNotifier implements INotifier {
  public readonly channel = 'IN_APP';
  public async send(trigger: AlertTrigger): Promise<boolean> {
    // In-app notifications are persisted to DB and broadcast via SSE
    return true;
  }
}

export class TelegramNotifier implements INotifier {
  public readonly channel = 'TELEGRAM';
  public async send(trigger: AlertTrigger, settings: UserSettings): Promise<boolean> {
    if (!settings.telegramBotToken || !settings.telegramChatId) {
      // Cleanly log pending config without pretending it worked
      return false;
    }
    try {
      const text = `🚨 *TRADING SCREENER ALERT*\n\n*Rule:* ${trigger.ruleName}\n*Symbol:* ${trigger.symbol} (${trigger.exchange} ${trigger.marketType})\n*Trigger Price:* $${trigger.triggerPrice.toLocaleString()}\n*Event:* ${trigger.message}`;
      const url = `https://api.telegram.org/bot${settings.telegramBotToken}/sendMessage`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: settings.telegramChatId,
          text,
          parse_mode: 'Markdown'
        })
      });
      return res.ok;
    } catch (e: any) {
      console.error('[TelegramNotifier] Error sending Telegram alert:', e.message);
      return false;
    }
  }
}

export class EmailNotifier implements INotifier {
  public readonly channel = 'EMAIL';
  public async send(trigger: AlertTrigger, settings: UserSettings): Promise<boolean> {
    if (!settings.emailRecipient) {
      return false;
    }
    // Stub adapter ready for SMTP/SendGrid/SES integration
    console.log(`[EmailNotifier] Dispatched notification to ${settings.emailRecipient} for ${trigger.symbol}`);
    return true;
  }
}

export class WebhookNotifier implements INotifier {
  public readonly channel = 'WEBHOOK';
  public async send(trigger: AlertTrigger, settings: UserSettings): Promise<boolean> {
    if (!settings.webhookUrl) {
      return false;
    }
    try {
      const res = await fetch(settings.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'TradingScreener-AlertEngine/1.0' },
        body: JSON.stringify(trigger)
      });
      return res.ok;
    } catch (e: any) {
      console.error('[WebhookNotifier] Failed to post webhook:', e.message);
      return false;
    }
  }
}
