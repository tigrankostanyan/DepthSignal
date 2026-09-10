'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ShieldCheck,
  Sparkles,
  Zap,
  Copy,
  Check,
  UploadCloud,
  Loader2,
  FileImage,
  RefreshCw,
  QrCode,
  CreditCard,
} from 'lucide-react';
import type { SubscriptionPlanId, UserSubscription, PlanDefinition } from '@/types/index';
import {
  fetchPlans,
  fetchSubscription,
  fetchManualPaymentConfig,
  fetchMyPaymentReceipts,
  submitPaymentReceipt,
} from '@/lib/api';
import type { ManualPaymentConfig, PaymentReceiptRow } from '@/lib/api';
import { Badge } from '@/components/ui/Badge';
import { MessageBanner } from '@/components/ui/MessageBanner';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { PricingCard } from '@/components/Billing/PricingCard';

const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

const PLAN_CARDS: Record<
  SubscriptionPlanId,
  {
    name: string;
    description: string;
    icon?: React.ReactNode;
    features: { label: React.ReactNode; included: boolean }[];
    badgeLabel?: string;
    accentColor: string;
    buttonTextColor?: 'text-white';
  }
> = {
  FREE: {
    name: 'FREE Starter',
    description: 'Essential screening for retail traders.',
    features: [
      { label: <>Up to <strong>10 Watchlist Items</strong></>, included: true },
      { label: <>Up to <strong>3 Active Alert Rules</strong></>, included: true },
      { label: 'In-App alert notifications', included: true },
      { label: 'Binance Spot & Futures feeds', included: true },
      { label: 'Telegram & Webhook alerts', included: false },
      { label: 'Cross-exchange wall aggregation', included: false },
    ],
    accentColor: '#24C4E8',
  },
  PRO: {
    name: 'PRO Trader',
    description: 'For active breakout & momentum traders.',
    icon: <Zap size={16} className="text-[#24C4E8]" />,
    features: [
      { label: <>Up to <strong>50 Watchlist Items</strong></>, included: true },
      { label: <>Up to <strong>20 Active Alert Rules</strong></>, included: true },
      { label: <><strong>Telegram & Email</strong> direct dispatch</>, included: true },
      { label: <><strong>30-Day</strong> Historical wall lookbacks</>, included: true },
      { label: 'All 10 global exchanges & stock feeds', included: true },
      { label: 'Custom Trading Bot Webhooks', included: false },
    ],
    badgeLabel: 'MOST POPULAR',
    accentColor: '#168FD6',
    buttonTextColor: 'text-white',
  },
  ADVANCED: {
    name: 'ADVANCED Quant',
    description: 'For algorithmic funds, quants, and power users.',
    icon: <Sparkles size={16} className="text-[#3B82F6]" />,
    features: [
      { label: <><strong>250</strong> Watchlist Items</>, included: true },
      { label: <><strong>100</strong> Active Alert Rules</>, included: true },
      { label: <><strong>Custom Webhooks</strong> (HMAC signed)</>, included: true },
      { label: <><strong>Cross-Exchange</strong> Wall Aggregation</>, included: true },
      { label: <><strong>90-Day</strong> Depth History & Lifecycle Timeline</>, included: true },
      { label: '15 concurrent realtime SSE / multi-device feeds', included: true },
    ],
    accentColor: '#3B82F6',
  },
};

const PLAN_ORDER: SubscriptionPlanId[] = ['FREE', 'PRO', 'ADVANCED'];

function formatAmount(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function formatDate(ts?: number): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const STATUS_TONE: Record<string, 'yellow' | 'green' | 'red' | 'neutral'> = {
  pending: 'yellow',
  approved: 'green',
  rejected: 'red',
};

export default function PricingPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<PlanDefinition[]>([]);
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [manualConfig, setManualConfig] = useState<ManualPaymentConfig | null>(null);
  const [receipts, setReceipts] = useState<PaymentReceiptRow[]>([]);

  const [interval, setInterval] = useState<'monthly' | 'yearly'>('monthly');
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlanId | null>(null);
  const [reasonMessage, setReasonMessage] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Upload state
  const [file, setFile] = useState<{ name: string; mime: string; dataUrl: string } | null>(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [ackReceiptId, setAckReceiptId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const paySectionRef = useRef<HTMLDivElement>(null);

  const loadData = async (reloadReceipts = true) => {
    try {
      setError(null);
      const [p, sub, cfg] = await Promise.all([
        fetchPlans(),
        fetchSubscription(),
        fetchManualPaymentConfig(),
      ]);
      setPlans(p);
      setSubscription(sub);
      setManualConfig(cfg);
      if (reloadReceipts) {
        try {
          setReceipts(await fetchMyPaymentReceipts());
        } catch {
          setReceipts([]);
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load subscription data');
    } finally {
      setLoading(false);
    }
  };

  // Initial load + read URL query (plan / reason) once.
  useEffect(() => {
    loadData();
    const params = new URLSearchParams(window.location.search);
    const plan = params.get('plan');
    if (plan === 'PRO' || plan === 'ADVANCED') {
      setSelectedPlan(plan);
    }
    const billingInterval = params.get('interval');
    if (billingInterval === 'monthly' || billingInterval === 'yearly') {
      setInterval(billingInterval);
    }
    const reason = params.get('reason');
    if (reason) setReasonMessage(reason);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const priceFor = useMemo(() => {
    const byId: Record<string, PlanDefinition> = {};
    plans.forEach((p) => (byId[p.id] = p));
    return {
      monthly: (id: SubscriptionPlanId) => byId[id]?.priceMonthlyUsd ?? 0,
      yearly: (id: SubscriptionPlanId) => byId[id]?.priceYearlyUsd ?? 0,
    };
  }, [plans]);

  const currentPlan: SubscriptionPlanId = subscription?.plan || 'FREE';
  const currentStatus = subscription?.status || 'free';
  const isActivePaid = (currentPlan === 'PRO' || currentPlan === 'ADVANCED') && currentStatus === 'active';

  const activeReceipt = receipts.find((r) => r.status === 'pending');
  const lastApproved = receipts.find((r) => r.status === 'approved');

  const handlePay = (planId: SubscriptionPlanId) => {
    setSelectedPlan(planId);
    setFile(null);
    setNote('');
    setSuccess(null);
    setError(null);
    setTimeout(() => paySectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  };

  const qrImageSrc = (() => {
    if (!manualConfig?.enabled) return null;
    if (manualConfig.method === 'static_image' && manualConfig.qrImageUrl) return manualConfig.qrImageUrl;
    if (manualConfig.qrValue) {
      const data = encodeURIComponent(manualConfig.qrValue);
      return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=12&data=${data}`;
    }
    return null;
  })();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!/^image\/(png|jpeg|jpg|webp|gif)$/i.test(f.type)) {
      setError('Please attach an image file (PNG, JPEG, WebP or GIF).');
      return;
    }
    if (f.size > MAX_IMAGE_BYTES) {
      setError('Receipt image must be under 6MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setFile({ name: f.name, mime: f.type || 'image/png', dataUrl });
      setError(null);
    };
    reader.onerror = () => setError('Failed to read the selected file.');
    reader.readAsDataURL(f);
  };

  const handleCopyQrValue = async () => {
    if (!manualConfig?.qrValue) return;
    try {
      await navigator.clipboard.writeText(manualConfig.qrValue);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // clipboard unavailable — ignore
    }
  };

  const handleSubmit = async () => {
    if (!selectedPlan || !file || !manualConfig?.enabled) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      await submitPaymentReceipt({
        plan: selectedPlan,
        interval,
        imageData: file.dataUrl,
        mimeType: file.mime,
        note: note.trim() || undefined,
      });
      setSuccess('Receipt submitted! Our team will verify the transfer and activate your plan shortly.');
      setFile(null);
      setNote('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      const rows = await fetchMyPaymentReceipts();
      setReceipts(rows);
    } catch (err: any) {
      setError(err?.message || 'Failed to submit receipt. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const panelPlan = selectedPlan && PLAN_CARDS[selectedPlan];
  const panelPrice = selectedPlan
    ? interval === 'yearly'
      ? priceFor.yearly(selectedPlan)
      : priceFor.monthly(selectedPlan)
    : 0;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="mx-auto max-w-6xl px-6 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-brand/15 border border-[#24C4E8]/30 flex items-center justify-center p-1.5 shadow-md">
              <BrandLogo lockup="symbol" theme="dark" size={28} responsive />
            </div>
            <div>
              <h1 className="text-lg font-bold text-main tracking-wide">
                MyScreener Plans &amp; Payment
              </h1>
              <p className="text-xs text-muted">
                Pick a plan, scan the QR with your phone and pay — we activate your account after verification.
              </p>
            </div>
          </div>
          <button
            onClick={() => router.push('/screener')}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-panel hover:bg-panel text-white text-xs font-semibold transition cursor-pointer"
          >
            <ArrowLeft size={13} />
            <span>Back to Terminal</span>
          </button>
        </div>

        {error && <MessageBanner type="error" onDismiss={() => setError(null)}>{error}</MessageBanner>}
        {success && <MessageBanner type="success" onDismiss={() => setSuccess(null)}>{success}</MessageBanner>}
        {reasonMessage && (
          <MessageBanner type="info" onDismiss={() => setReasonMessage(null)}>{reasonMessage}</MessageBanner>
        )}

        {loading && plans.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-3 text-muted">
            <Loader2 size={22} className="animate-spin text-brand" />
            <span className="text-xs">Loading plans…</span>
          </div>
        ) : (
          <>
            {/* Current plan / subscription status */}
            <div className="bg-card border border-divider rounded-xl p-4 flex flex-wrap items-center gap-3 text-xs">
              <div className="flex items-center space-x-2">
                <ShieldCheck size={15} className="text-bid" />
                <span className="font-bold text-white">
                  Current plan: <span className="text-accent">{currentPlan}</span>
                </span>
                {currentStatus === 'active' && <Badge tone="green" size="sm">ACTIVE</Badge>}
                {(currentStatus === 'expired' || currentStatus === 'cancelled' || currentStatus === 'past_due') && (
                  <Badge tone="red" size="sm">{currentStatus.toUpperCase()}</Badge>
                )}
              </div>
              {subscription?.currentPeriodEnd && isActivePaid && (
                <span className="text-muted flex items-center gap-1.5">
                  <CreditCard size={13} />
                  Active until {formatDate(subscription.currentPeriodEnd)}
                </span>
              )}
              {lastApproved && (
                <span className="text-bid flex items-center gap-1.5">
                  <Check size={13} /> Last payment approved {formatDate(lastApproved.reviewedAt)}
                </span>
              )}
              <button
                onClick={() => loadData(true)}
                className="ml-auto flex items-center space-x-1.5 px-3 py-1.5 rounded bg-panel hover:bg-panel text-white text-xs font-semibold transition cursor-pointer"
              >
                <RefreshCw size={12} />
                <span>Refresh status</span>
              </button>
            </div>

            {/* Interval toggle */}
            <div className="flex items-center space-x-2 bg-primary p-1 rounded-lg border border-divider w-fit text-xs">
              <button
                onClick={() => setInterval('monthly')}
                className={`px-3 py-1 rounded transition font-medium cursor-pointer ${
                  interval === 'monthly' ? 'bg-panel text-white shadow' : 'text-muted hover:text-white'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setInterval('yearly')}
                className={`px-3 py-1 rounded transition font-medium flex items-center space-x-1 cursor-pointer ${
                  interval === 'yearly' ? 'bg-[#168FD6] text-white font-bold shadow' : 'text-muted hover:text-white'
                }`}
              >
                <span>Annual</span>
                <span className="text-[10px] bg-white/20 text-white px-1.5 py-0.5 rounded font-mono">SAVE</span>
              </button>
            </div>

            {/* Plan cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {PLAN_ORDER.map((id) => {
                const card = PLAN_CARDS[id];
                return (
                  <PricingCard
                    key={id}
                    planId={id}
                    name={card.name}
                    description={card.description}
                    icon={card.icon}
                    priceMonthly={priceFor.monthly(id)}
                    priceYearly={priceFor.yearly(id)}
                    freeForever={id === 'FREE'}
                    features={card.features}
                    isCurrent={currentPlan === id}
                    isHighlighted={currentPlan === id || selectedPlan === id}
                    badgeLabel={card.badgeLabel}
                    interval={interval}
                    onPay={() => handlePay(id)}
                    accentColor={card.accentColor}
                    buttonTextColor={card.buttonTextColor}
                  />
                );
              })}
            </div>

            {/* QR Payment + receipt upload section */}
            {selectedPlan && panelPlan && (
              <div ref={paySectionRef} className="scroll-mt-6 bg-card border border-divider rounded-xl p-6 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-divider pb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-9 h-9 rounded-lg bg-brand/15 border border-[#24C4E8]/30 flex items-center justify-center">
                      <QrCode size={17} className="text-[#24C4E8]" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white">
                        Pay for {panelPlan.name}
                      </div>
                      <div className="text-[11px] text-muted">
                        {interval === 'yearly' ? 'Annual billing' : 'Monthly billing'} ·{' '}
                        {formatAmount(panelPrice)} {manualConfig?.currency || 'USD'}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedPlan(null)}
                    className="px-3 py-1.5 rounded bg-panel hover:bg-panel text-xs text-white font-semibold transition cursor-pointer"
                  >
                    Choose another plan
                  </button>
                </div>

                {!manualConfig?.enabled ? (
                  <MessageBanner type="error">
                    Payment details are not configured yet. Please contact support — no money should be sent.
                  </MessageBanner>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Left: QR + instructions */}
                    <div className="space-y-4">
                      <div className="flex flex-col items-center rounded-xl border border-divider bg-primary p-5 text-center">
                        <div className="text-[11px] text-muted uppercase tracking-wider font-semibold mb-3">
                          Scan to pay · {formatAmount(panelPrice)}
                        </div>
                        {qrImageSrc ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={qrImageSrc}
                            alt={`Payment QR for ${panelPlan.name}`}
                            width={240}
                            height={240}
                            className="rounded-lg bg-white p-2 select-none"
                          />
                        ) : (
                          <div className="w-60 h-60 rounded-lg bg-surface border border-divider flex flex-col items-center justify-center text-muted space-y-2">
                            <FileImage size={28} />
                            <span className="text-[11px]">QR unavailable</span>
                          </div>
                        )}

                        {manualConfig.recipientName && (
                          <div className="mt-3 text-xs text-white">
                            Beneficiary: <span className="font-bold">{manualConfig.recipientName}</span>
                          </div>
                        )}
                        {manualConfig.qrValue && (
                          <button
                            onClick={handleCopyQrValue}
                            className="mt-2 max-w-full inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-panel hover:bg-panel text-[11px] text-main font-mono transition cursor-pointer"
                          >
                            <span className="truncate max-w-[220px]">{manualConfig.qrValue}</span>
                            {copied ? <Check size={12} className="text-bid" /> : <Copy size={12} />}
                          </button>
                        )}
                      </div>

                      <ol className="space-y-2 text-xs text-[#C5D8EA]">
                        {manualConfig.instructions.map((inst, i) => (
                          <li key={i} className="flex items-start space-x-2">
                            <span className="w-5 h-5 shrink-0 rounded-full bg-brand/15 border border-[#24C4E8]/30 text-[#24C4E8] flex items-center justify-center text-[10px] font-bold">
                              {i + 1}
                            </span>
                            <span className="leading-relaxed">{inst}</span>
                          </li>
                        ))}
                      </ol>
                    </div>

                    {/* Right: receipt upload */}
                    <div className="space-y-4">
                      <div className="text-xs font-bold text-white flex items-center space-x-2">
                        <UploadCloud size={14} className="text-[#24C4E8]" />
                        <span>2 · Attach your payment proof</span>
                      </div>

                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        className="hidden"
                        onChange={handleFileChange}
                      />
                      {file ? (
                        <div className="rounded-xl border border-divider bg-primary p-4 flex items-center space-x-3">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={file.dataUrl}
                            alt="Receipt preview"
                            width={64}
                            height={64}
                            className="rounded-lg object-cover border border-divider"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs text-white font-semibold truncate">{file.name}</div>
                            <div className="text-[10px] text-muted">
                              {(file.dataUrl.length * 0.75 / 1024).toFixed(0)} KB — ready to submit
                            </div>
                          </div>
                          <button
                            onClick={() => { setFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                            className="text-[10px] text-ask hover:underline font-semibold cursor-pointer"
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="w-full rounded-xl border-2 border-dashed border-divider bg-primary hover:border-[#168FD6] hover:bg-[#0D1B2A] transition p-6 flex flex-col items-center justify-center space-y-2 cursor-pointer"
                        >
                          <UploadCloud size={22} className="text-brand" />
                          <span className="text-xs text-white font-semibold">Upload receipt screenshot</span>
                          <span className="text-[10px] text-muted">PNG / JPEG / WebP · up to 6MB</span>
                        </button>
                      )}

                      <textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        rows={2}
                        maxLength={2000}
                        placeholder="Optional note for the support team (e.g. transfer reference number)…"
                        className="w-full bg-primary border border-divider rounded-lg px-3 py-2 text-xs text-white placeholder-muted/60 focus:outline-none focus:border-[#168FD6] resize-none"
                      />

                      <button
                        onClick={handleSubmit}
                        disabled={!file || submitting}
                        className={`w-full py-2.5 rounded-lg text-xs font-bold transition flex items-center justify-center space-x-1.5 cursor-pointer ${
                          !file || submitting
                            ? 'bg-panel text-muted cursor-not-allowed'
                            : 'bg-[#168FD6] hover:bg-[#1C9AE5] text-white font-bold shadow-md shadow-[#168FD6]/20'
                        }`}
                      >
                        {submitting ? (
                          <>
                            <Loader2 size={13} className="animate-spin" />
                            <span>Submitting…</span>
                          </>
                        ) : (
                          <span>Submit for verification</span>
                        )}
                      </button>

                      <p className="text-[10px] text-muted leading-relaxed">
                        After your transfer is verified, the {panelPlan.name} plan will be activated on this account
                        automatically and you will see it here within the paid period.
                      </p>
                    </div>
                  </div>
                )}

                {activeReceipt && activeReceipt.id !== ackReceiptId && (
                  <MessageBanner type="info" onDismiss={() => setAckReceiptId(activeReceipt.id)}>
                    You have a pending receipt for {activeReceipt.plan} ({activeReceipt.interval}). Our team is verifying it.
                  </MessageBanner>
                )}
              </div>
            )}

            {/* My receipts history */}
            <div className="bg-card border border-divider rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-divider flex items-center justify-between">
                <div className="text-xs font-bold text-white flex items-center space-x-2">
                  <FileImage size={14} className="text-muted" />
                  <span>My Payment Receipts</span>
                </div>
                {receipts.length > 0 && (
                  <Badge tone="neutral" size="sm">{receipts.length} total</Badge>
                )}
              </div>
              {receipts.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted">
                  No payment receipts yet. Once you pay and upload proof, it will show up here with its status.
                </div>
              ) : (
                <div className="divide-y divide-divider">
                  {receipts.map((r) => (
                    <div key={r.id} className="px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                      <div className="font-bold text-white w-24">{r.plan}</div>
                      <div className="text-muted capitalize w-20">{r.interval}</div>
                      <div className="font-mono text-white">{formatAmount(r.amountUsd)}</div>
                      <div className="text-muted w-24">{formatDate(r.createdAt)}</div>
                      <div className="flex-1 min-w-[120px] text-muted truncate">{r.note || '—'}</div>
                      <Badge tone={STATUS_TONE[r.status] || 'neutral'} size="sm">
                        {r.status.toUpperCase()}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
