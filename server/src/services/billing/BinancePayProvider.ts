// BINANCE PAY BILLING PROVIDER ADAPTER
// One-time crypto checkout per billing period (Binance Pay Merchant API v3)

import crypto from 'crypto';
import { SubscriptionPlanId } from '../../types/index.js';
import { DatabaseService } from '../../db/database.js';
import { BillingProvider, CheckoutSessionResult, CustomerPortalResult, WebhookProcessingResult } from './BillingProvider.js';
import { SUBSCRIPTION_PLANS } from './planConfig.js';

export type BillingInterval = 'monthly' | 'yearly';

//  webhook headers sent by Binance Pay
export interface BinancePayWebhookHeaders {
  timestamp: string;
  nonce: string;
  signature: string;
}

interface BinancePayApiResponse<T> {
  status: 'SUCCESS' | 'FAIL';
  code: string;
  errorMessage?: string;
  data?: T;
}

interface BinancePayOrderData {
  prepayId: string;
  terminalType: string;
  expireTime: number;
  qrcodeLink: string;
  qrContent: string;
  checkoutUrl: string;
  deeplink?: string;
  universalUrl?: string;
}

interface BinancePayWebhookEvent {
  bizType?: string;
  bizId?: number | string;
  bizIdStr?: string;
  bizStatus?: string;
  data?: string | Record<string, any>;
}

interface PassThroughInfo {
  userId: string;
  plan: SubscriptionPlanId;
  interval: BillingInterval;
}

const DEFAULT_BASE_URL = 'https://bpay.binanceapi.com';
const MAX_TIMESTAMP_DRIFT_MS = 5 * 60 * 1000;
const NONCE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

//  binance pay provider
export class BinancePayProvider implements BillingProvider {
  public readonly providerName = 'binance_pay';
  private readonly apiKey: string | undefined;
  private readonly apiSecret: string | undefined;
  private readonly baseUrl: string;
  private readonly webhookUrl: string | undefined;
  private readonly webhookPublicKey: string | undefined;
  private readonly db: DatabaseService;

  constructor(options?: { apiKey?: string; apiSecret?: string; baseUrl?: string; webhookUrl?: string; webhookPublicKey?: string }) {
    this.apiKey = options?.apiKey || process.env.BINANCE_PAY_API_KEY;
    this.apiSecret = options?.apiSecret || process.env.BINANCE_PAY_API_SECRET;
    this.baseUrl = (options?.baseUrl || process.env.BINANCE_PAY_API_BASE || DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.webhookUrl = options?.webhookUrl || process.env.BINANCE_PAY_WEBHOOK_URL;
    this.webhookPublicKey = options?.webhookPublicKey || process.env.BINANCE_PAY_WEBHOOK_PUBLIC_KEY;
    this.db = DatabaseService.getInstance();
  }

  public get isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiSecret);
  }

  // Create checkout session (Binance Pay order with checkout URL + QR code)
  public async createCheckoutSession(
    userId: string,
    plan: SubscriptionPlanId,
    interval: BillingInterval = 'monthly',
    successUrl: string,
    cancelUrl: string
  ): Promise<CheckoutSessionResult> {
    if (plan === 'FREE') {
      throw new Error('Cannot create checkout session for FREE tier.');
    }

    const planDef = SUBSCRIPTION_PLANS[plan];
    if (!planDef) {
      throw new Error(`Invalid plan: ${plan}`);
    }

    const user = await this.db.getUserById(userId);
    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    if (!this.isConfigured) {
      throw new Error('Billing not configured: Binance Pay credentials (BINANCE_PAY_API_KEY / BINANCE_PAY_API_SECRET) are missing in environment.');
    }

    const amount = interval === 'yearly' ? planDef.priceYearlyUsd : planDef.priceMonthlyUsd;
    const merchantTradeNo = this.generateTradeNo();
    const passThroughInfo: PassThroughInfo = { userId, plan, interval };
    const separator = successUrl.includes('?') ? '&' : '?';

    const body = {
      env: { terminalType: 'WEB' },
      merchantTradeNo,
      orderAmount: amount,
      currency: 'USDT',
      description: `DepthSignal ${planDef.name} (${interval})`,
      goodsDetails: [
        {
          goodsType: '02',
          goodsCategory: 'Z000',
          referenceGoodsId: `${plan}_${interval}`.toLowerCase(),
          goodsName: `DepthSignal ${planDef.name}`,
          goodsDetail: planDef.description
        }
      ],
      returnUrl: `${successUrl}${separator}provider=binance_pay&plan=${plan}&order=${merchantTradeNo}`,
      cancelUrl,
      ...(this.webhookUrl ? { webhookUrl: this.webhookUrl } : {}),
      passThroughInfo: JSON.stringify(passThroughInfo)
    };

    const res = await this.request<BinancePayOrderData>('/binancepay/openapi/v3/order', body);
    if (res.status !== 'SUCCESS' || !res.data) {
      throw new Error(`Binance Pay order creation failed: ${res.code} ${res.errorMessage || ''}`.trim());
    }

    await this.db.recordBillingEvent({
      userId,
      eventType: 'checkout_started',
      plan,
      provider: this.providerName,
      details: { merchantTradeNo, prepayId: res.data.prepayId, interval, amount, currency: 'USDT', expireTime: res.data.expireTime }
    });

    return {
      url: res.data.checkoutUrl,
      sessionId: res.data.prepayId,
      mode: 'live',
      provider: this.providerName,
      merchantTradeNo,
      qrCodeUrl: res.data.qrcodeLink,
      qrContent: res.data.qrContent,
      deeplink: res.data.universalUrl || res.data.deeplink,
      expiresAt: res.data.expireTime
    };
  }

  // Binance Pay has no self-service portal; return to app
  public async createCustomerPortalSession(_userId: string, returnUrl: string): Promise<CustomerPortalResult> {
    return { url: returnUrl };
  }

  // Query order by merchantTradeNo
  public async getSubscription(externalSubscriptionId: string): Promise<any> {
    if (!this.isConfigured) return null;
    const res = await this.request<Record<string, any>>('/binancepay/openapi/v2/order/query', { merchantTradeNo: externalSubscriptionId });
    return res.status === 'SUCCESS' ? res.data ?? null : null;
  }

  // Generic BillingProvider entrypoint; signature is "timestamp:nonce:signature"
  public async handleWebhook(rawBody: string | Buffer, signature: string): Promise<WebhookProcessingResult> {
    const [timestamp = '', nonce = '', ...rest] = (signature || '').split(':');
    return this.handleBinanceWebhook(rawBody, { timestamp, nonce, signature: rest.join(':') });
  }

  // Verify signature, enforce idempotency and map PAY_SUCCESS to a subscription update
  public async handleBinanceWebhook(rawBody: string | Buffer, headers: BinancePayWebhookHeaders): Promise<WebhookProcessingResult> {
    const body = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf-8');
    this.verifyWebhookSignature(body, headers);

    let event: BinancePayWebhookEvent;
    try {
      event = JSON.parse(body);
    } catch {
      throw new Error('Invalid Binance Pay webhook payload');
    }

    const transactionId = event.bizIdStr || (event.bizId !== undefined ? String(event.bizId) : '');
    if (!transactionId) {
      throw new Error('Binance Pay webhook missing transaction id (bizId)');
    }

    const eventId = `binance_${transactionId}`;
    const type = event.bizStatus || 'UNKNOWN';
    const base: WebhookProcessingResult = { eventId, type, provider: this.providerName, transactionId };

    if (await this.db.isWebhookEventProcessed(eventId)) {
      console.log(`[BinancePayProvider] Transaction ${transactionId} already processed. Skipping idempotently.`);
      return base;
    }

    const payloadHash = crypto.createHash('sha256').update(body).digest('hex');
    const data: Record<string, any> = typeof event.data === 'string' ? this.safeJson(event.data) : (event.data ?? {});

    if (event.bizType !== 'PAY' || type !== 'PAY_SUCCESS') {
      await this.db.recordWebhookEvent(eventId, this.providerName, type, payloadHash, 'PROCESSED');
      return { ...base, externalSubscriptionId: data.merchantTradeNo };
    }

    const info = this.parsePassThrough(data.passThroughInfo);
    const planDef = info ? SUBSCRIPTION_PLANS[info.plan] : undefined;
    if (!info || !planDef || info.plan === 'FREE') {
      console.error(`[BinancePayProvider] Cannot resolve user/plan for transaction ${transactionId}`);
      await this.db.recordWebhookEvent(eventId, this.providerName, type, payloadHash, 'REJECTED');
      return { ...base, externalSubscriptionId: data.merchantTradeNo };
    }

    const expectedAmount = info.interval === 'yearly' ? planDef.priceYearlyUsd : planDef.priceMonthlyUsd;
    const paidAmount = Number(data.totalFee);
    if (!Number.isFinite(paidAmount) || paidAmount + 1e-6 < expectedAmount) {
      console.error(`[BinancePayProvider] Underpaid transaction ${transactionId}: ${paidAmount} < ${expectedAmount}`);
      await this.db.recordWebhookEvent(eventId, this.providerName, type, payloadHash, 'REJECTED');
      return { ...base, userId: info.userId, externalSubscriptionId: data.merchantTradeNo };
    }

    const existing = await this.db.getUserSubscription(info.userId);
    const now = Date.now();
    const extend = existing.plan === info.plan && existing.status === 'active' && existing.currentPeriodEnd > now;
    const periodStart = extend ? existing.currentPeriodEnd : now;
    const periodEnd = BinancePayProvider.addInterval(periodStart, info.interval);

    await this.db.recordWebhookEvent(eventId, this.providerName, type, payloadHash, 'PROCESSED');

    return {
      ...base,
      userId: info.userId,
      plan: info.plan,
      status: 'active',
      externalCustomerId: data.openUserId ? String(data.openUserId) : undefined,
      externalSubscriptionId: data.merchantTradeNo,
      currentPeriodStart: extend ? existing.currentPeriodStart : now,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: true,
      interval: info.interval,
      amount: paidAmount,
      currency: data.currency
    };
  }

  // Add one billing interval to a timestamp
  public static addInterval(from: number, interval: BillingInterval): number {
    const d = new Date(from);
    if (interval === 'yearly') d.setUTCFullYear(d.getUTCFullYear() + 1);
    else d.setUTCMonth(d.getUTCMonth() + 1);
    return d.getTime();
  }

  // Validate timestamp window + signature (RSA if public key configured, else HMAC-SHA512 with API secret)
  private verifyWebhookSignature(body: string, headers: BinancePayWebhookHeaders): void {
    if (!headers.timestamp || !headers.nonce || !headers.signature) {
      throw new Error('Missing Binance Pay signature headers');
    }

    const ts = Number(headers.timestamp);
    if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > MAX_TIMESTAMP_DRIFT_MS) {
      throw new Error('Binance Pay webhook timestamp outside allowed window');
    }

    const payload = `${headers.timestamp}\n${headers.nonce}\n${body}\n`;

    if (this.webhookPublicKey) {
      const verifier = crypto.createVerify('RSA-SHA256');
      verifier.update(payload);
      verifier.end();
      if (!verifier.verify(this.normalizePem(this.webhookPublicKey), Buffer.from(headers.signature, 'base64'))) {
        throw new Error('Invalid Binance Pay webhook signature');
      }
      return;
    }

    if (!this.apiSecret) {
      throw new Error('Billing not configured: BINANCE_PAY_API_SECRET is not configured.');
    }

    const expected = crypto.createHmac('sha512', this.apiSecret).update(payload).digest();
    let received: Buffer;
    try {
      received = /^[0-9a-fA-F]+$/.test(headers.signature)
        ? Buffer.from(headers.signature, 'hex')
        : Buffer.from(headers.signature, 'base64');
    } catch {
      throw new Error('Invalid Binance Pay webhook signature');
    }

    if (received.length !== expected.length || !crypto.timingSafeEqual(expected, received)) {
      throw new Error('Invalid Binance Pay webhook signature');
    }
  }

  private async request<T>(path: string, body: unknown): Promise<BinancePayApiResponse<T>> {
    const timestamp = Date.now().toString();
    const nonce = this.generateNonce();
    const payload = JSON.stringify(body);
    const signature = crypto
      .createHmac('sha512', this.apiSecret!)
      .update(`${timestamp}\n${nonce}\n${payload}\n`)
      .digest('hex')
      .toUpperCase();

    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'BinancePay-Timestamp': timestamp,
        'BinancePay-Nonce': nonce,
        'BinancePay-Certificate-SN': this.apiKey!,
        'BinancePay-Signature': signature
      },
      body: payload
    });

    if (!res.ok) {
      throw new Error(`Binance Pay API error: HTTP ${res.status}`);
    }
    return (await res.json()) as BinancePayApiResponse<T>;
  }

  private generateNonce(): string {
    const bytes = crypto.randomBytes(32);
    return Array.from(bytes, (b) => NONCE_ALPHABET[b % NONCE_ALPHABET.length]).join('');
  }

  private generateTradeNo(): string {
    return `DS${Date.now().toString(36)}${crypto.randomBytes(6).toString('hex')}`.toUpperCase();
  }

  private parsePassThrough(raw: unknown): PassThroughInfo | null {
    const parsed = typeof raw === 'string' ? this.safeJson(raw) : (raw as Record<string, any> | undefined);
    if (!parsed || typeof parsed.userId !== 'string' || typeof parsed.plan !== 'string') return null;
    const interval: BillingInterval = parsed.interval === 'yearly' ? 'yearly' : 'monthly';
    return { userId: parsed.userId, plan: parsed.plan as SubscriptionPlanId, interval };
  }

  private safeJson(raw: string): Record<string, any> {
    try {
      const v = JSON.parse(raw);
      return v && typeof v === 'object' ? v : {};
    } catch {
      return {};
    }
  }

  private normalizePem(key: string): string {
    const k = key.replace(/\\n/g, '\n').trim();
    return k.includes('BEGIN') ? k : `-----BEGIN PUBLIC KEY-----\n${k}\n-----END PUBLIC KEY-----`;
  }
}
