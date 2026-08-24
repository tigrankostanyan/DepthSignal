import React, { useState, useEffect } from 'react';
import { 
  Check, 
  X, 
  Sparkles, 
  ShieldCheck, 
  Zap, 
  ExternalLink, 
  CreditCard,
  History,
  AlertCircle,
  Clock,
  ArrowRight
} from 'lucide-react';
import { SubscriptionPlanId, UserSubscription, UsageStats, PlanDefinition } from '../../types/subscription.js';
import { fetchPlans, fetchSubscription, createCheckoutSession, createPortalSession, fetchBillingEvents } from '../../lib/api.js';

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  highlightPlan?: SubscriptionPlanId;
  reasonMessage?: string;
}

export const PricingModal: React.FC<PricingModalProps> = ({
  isOpen,
  onClose,
  highlightPlan,
  reasonMessage
}) => {
  const [plans, setPlans] = useState<PlanDefinition[]>([]);
  const [subData, setSubData] = useState<{ subscription: UserSubscription; usage: UsageStats } | null>(null);
  const [billingEvents, setBillingEvents] = useState<any[]>([]);
  const [billingConfigured, setBillingConfigured] = useState<boolean>(true);
  const [interval, setInterval] = useState<'monthly' | 'yearly'>('monthly');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'plans' | 'history'>('plans');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const loadData = async () => {
      try {
        setLoading(true);
        const [plansRes, subInfo, events] = await Promise.all([
          fetchPlans(),
          fetchSubscription(),
          fetchBillingEvents()
        ]);
        setPlans(plansRes.plans);
        setBillingConfigured(plansRes.billingConfigured);
        setSubData(subInfo);
        setBillingEvents(events);
      } catch (err: any) {
        setError(err.message || 'Failed to load subscription details');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [isOpen]);

  if (!isOpen) return null;

  const currentPlan = subData?.subscription?.plan || 'FREE';
  const usage = subData?.usage;

  const handleCheckout = async (planId: SubscriptionPlanId) => {
    if (planId === currentPlan) return;
    if (!billingConfigured) {
      setError('Billing not configured: Stripe credentials (STRIPE_SECRET_KEY) are missing in environment.');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const session = await createCheckoutSession(planId, interval);
      if (session.checkoutUrl) {
        window.location.href = session.checkoutUrl;
      }
    } catch (err: any) {
      setError(err.message || 'Billing not configured');
      setLoading(false);
    }
  };

  const handleOpenPortal = async () => {
    try {
      setLoading(true);
      setError(null);
      const portal = await createPortalSession();
      if (portal.portalUrl) {
        window.location.href = portal.portalUrl;
      }
    } catch (err: any) {
      setError(err.message || 'Failed to open customer portal');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-[#181A20] border border-[#2B2F36] rounded-xl max-w-5xl w-full shadow-2xl overflow-hidden my-8 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-[#2B2F36] bg-[#1E2329] flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-lg bg-[#F0B90B] flex items-center justify-center font-bold text-black text-base shadow-md">
                <Sparkles size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white tracking-wide">
                  Trading Screener Plans & Subscriptions
                </h2>
                <p className="text-xs text-[#848E9C]">
                  Authoritative institutional data feeds, multi-channel alert dispatch, and advanced order book analytics.
                </p>
              </div>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-[#2B2F36] hover:bg-[#34383F] text-[#848E9C] hover:text-white flex items-center justify-center transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Reason Alert (if triggered by reaching a limit) */}
        {reasonMessage && (
          <div className="bg-[#F6465D]/10 border-b border-[#F6465D]/30 px-6 py-3 flex items-center justify-between text-xs text-[#F6465D]">
            <div className="flex items-center space-x-2">
              <AlertCircle size={16} />
              <span className="font-semibold">{reasonMessage}</span>
            </div>
            <span className="text-[11px] bg-[#F6465D]/20 px-2 py-0.5 rounded border border-[#F6465D]/40 font-mono">
              UPGRADE REQUIRED
            </span>
          </div>
        )}

        {/* Sub-nav: Plans vs History */}
        <div className="px-6 pt-4 border-b border-[#2B2F36] flex items-center justify-between bg-[#181A20]">
          <div className="flex space-x-4 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('plans')}
              className={`pb-3 border-b-2 transition ${
                activeTab === 'plans' 
                  ? 'border-[#F0B90B] text-white' 
                  : 'border-transparent text-[#848E9C] hover:text-white'
              }`}
            >
              Subscription Plans & Pricing
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`pb-3 border-b-2 transition flex items-center space-x-1.5 ${
                activeTab === 'history' 
                  ? 'border-[#F0B90B] text-white' 
                  : 'border-transparent text-[#848E9C] hover:text-white'
              }`}
            >
              <History size={14} />
              <span>Billing History</span>
            </button>
          </div>

          {activeTab === 'plans' && (
            <div className="flex items-center space-x-2 bg-[#0B0E11] p-1 rounded-lg border border-[#2B2F36] mb-2 text-xs">
              <button
                onClick={() => setInterval('monthly')}
                className={`px-3 py-1 rounded transition font-medium ${
                  interval === 'monthly' ? 'bg-[#2B2F36] text-white shadow' : 'text-[#848E9C] hover:text-white'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setInterval('yearly')}
                className={`px-3 py-1 rounded transition font-medium flex items-center space-x-1 ${
                  interval === 'yearly' ? 'bg-[#F0B90B] text-black font-bold shadow' : 'text-[#848E9C] hover:text-white'
                }`}
              >
                <span>Annual</span>
                <span className="text-[10px] bg-black/20 text-black px-1.5 py-0.2 rounded font-mono">SAVE 20%</span>
              </button>
            </div>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {error && (
            <div className="p-3 bg-[#F6465D]/10 border border-[#F6465D]/40 rounded-lg text-xs text-[#F6465D] flex items-center justify-between">
              <span>{error}</span>
              <button onClick={() => setError(null)}><X size={14} /></button>
            </div>
          )}

          {!billingConfigured && (
            <div className="bg-[#1E2329] border border-[#F0B90B]/30 rounded-xl p-4 flex items-center justify-between text-xs text-[#EAECEF]">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-[#F0B90B]/10 border border-[#F0B90B]/30 flex items-center justify-center text-[#F0B90B] shrink-0">
                  <AlertCircle size={18} />
                </div>
                <div>
                  <div className="font-bold text-white">Billing not configured</div>
                  <div className="text-[#848E9C]">
                    External Stripe integration is optional and unset in this environment. Core screener and analytics remain fully usable.
                  </div>
                </div>
              </div>
              <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded bg-[#2B2F36] text-[#848E9C] border border-[#374151]">
                DISABLED
              </span>
            </div>
          )}

          {activeTab === 'plans' ? (
            <>
              {/* Current Usage Banner */}
              {usage && (
                <div className="bg-[#1E2329] border border-[#2B2F36] rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <ShieldCheck size={16} className="text-[#0ECB81]" />
                      <span className="text-xs font-bold text-white">
                        Your Current Plan: <span className="text-[#F0B90B]">{currentPlan}</span>
                      </span>
                      {subData?.subscription?.status === 'active' && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#0ECB81]/15 text-[#0ECB81] border border-[#0ECB81]/30">
                          ACTIVE
                        </span>
                      )}
                    </div>
                    {currentPlan !== 'FREE' && (
                      <button
                        onClick={handleOpenPortal}
                        className="text-xs text-[#848E9C] hover:text-white flex items-center space-x-1 hover:underline"
                      >
                        <CreditCard size={13} />
                        <span>Manage In Stripe Portal</span>
                        <ExternalLink size={11} />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                    <div className="bg-[#0B0E11] p-3 rounded-lg border border-[#2B2F36]">
                      <div className="text-[#848E9C] text-[11px] mb-1">Active Alert Rules</div>
                      <div className="flex items-baseline justify-between">
                        <span className="text-base font-bold text-white font-mono">{usage.activeAlertsCount}</span>
                        <span className="text-[11px] text-[#848E9C] font-mono">
                          Limit: {usage.maxActiveAlerts === Infinity ? 'Unlimited' : usage.maxActiveAlerts}
                        </span>
                      </div>
                      <div className="w-full bg-[#2B2F36] h-1.5 rounded-full mt-2 overflow-hidden">
                        <div 
                          className="bg-[#F0B90B] h-full rounded-full"
                          style={{
                            width: `${Math.min(100, (usage.activeAlertsCount / (usage.maxActiveAlerts || 1)) * 100)}%`
                          }}
                        />
                      </div>
                    </div>

                    <div className="bg-[#0B0E11] p-3 rounded-lg border border-[#2B2F36]">
                      <div className="text-[#848E9C] text-[11px] mb-1">Watchlist Items</div>
                      <div className="flex items-baseline justify-between">
                        <span className="text-base font-bold text-white font-mono">{usage.watchlistItemsCount}</span>
                        <span className="text-[11px] text-[#848E9C] font-mono">
                          Limit: {usage.maxWatchlistItems === Infinity ? 'Unlimited' : usage.maxWatchlistItems}
                        </span>
                      </div>
                      <div className="w-full bg-[#2B2F36] h-1.5 rounded-full mt-2 overflow-hidden">
                        <div 
                          className="bg-[#0ECB81] h-full rounded-full"
                          style={{
                            width: `${Math.min(100, (usage.watchlistItemsCount / (usage.maxWatchlistItems || 1)) * 100)}%`
                          }}
                        />
                      </div>
                    </div>

                    <div className="bg-[#0B0E11] p-3 rounded-lg border border-[#2B2F36]">
                      <div className="text-[#848E9C] text-[11px] mb-1">24h Notification Dispatches</div>
                      <div className="flex items-baseline justify-between">
                        <span className="text-base font-bold text-white font-mono">{usage.notificationDeliveries24h}</span>
                        <span className="text-[11px] text-[#848E9C] font-mono">
                          Channels: {usage.allowedChannels.join(', ')}
                        </span>
                      </div>
                      <div className="w-full bg-[#2B2F36] h-1.5 rounded-full mt-2 overflow-hidden">
                        <div 
                          className="bg-[#3B82F6] h-full rounded-full"
                          style={{ width: '35%' }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Pricing Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* 1. FREE PLAN */}
                <div className={`rounded-xl border p-6 flex flex-col justify-between transition ${
                  currentPlan === 'FREE' 
                    ? 'border-[#F0B90B] bg-[#1E2329]/90 ring-1 ring-[#F0B90B]' 
                    : 'border-[#2B2F36] bg-[#1E2329]/50 hover:border-[#374151]'
                }`}>
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="font-bold text-white text-base">FREE Starter</h3>
                      {currentPlan === 'FREE' && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#F0B90B]/20 text-[#F0B90B] border border-[#F0B90B]/40">
                          CURRENT
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#848E9C] mb-4">Essential screening for retail traders.</p>
                    
                    <div className="mb-6">
                      <span className="text-3xl font-black text-white font-mono">$0</span>
                      <span className="text-xs text-[#848E9C]"> / forever</span>
                    </div>

                    <div className="space-y-2.5 text-xs text-[#EAECEF]">
                      <div className="flex items-center space-x-2">
                        <Check size={14} className="text-[#0ECB81] shrink-0" />
                        <span>Up to <strong>5 Watchlist Items</strong></span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Check size={14} className="text-[#0ECB81] shrink-0" />
                        <span>Up to <strong>2 Active Alert Rules</strong></span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Check size={14} className="text-[#0ECB81] shrink-0" />
                        <span>In-App alert notifications</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Check size={14} className="text-[#0ECB81] shrink-0" />
                        <span>Binance Spot & Futures feeds</span>
                      </div>
                      <div className="flex items-center space-x-2 text-[#848E9C]">
                        <X size={14} className="text-[#F6465D] shrink-0" />
                        <span>Telegram & Webhook alerts</span>
                      </div>
                      <div className="flex items-center space-x-2 text-[#848E9C]">
                        <X size={14} className="text-[#F6465D] shrink-0" />
                        <span>Cross-exchange wall aggregation</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-8">
                    <button
                      disabled={currentPlan === 'FREE'}
                      className={`w-full py-2.5 rounded-lg text-xs font-bold transition ${
                        currentPlan === 'FREE'
                          ? 'bg-[#2B2F36] text-[#848E9C] cursor-not-allowed'
                          : 'bg-[#2B2F36] hover:bg-[#34383F] text-white'
                      }`}
                    >
                      {currentPlan === 'FREE' ? 'Active Plan' : 'Downgrade to Free'}
                    </button>
                  </div>
                </div>

                {/* 2. PRO PLAN */}
                <div className={`rounded-xl border p-6 flex flex-col justify-between relative transition ${
                  currentPlan === 'PRO' || highlightPlan === 'PRO'
                    ? 'border-[#F0B90B] bg-[#1E2329] ring-2 ring-[#F0B90B] shadow-xl' 
                    : 'border-[#2B2F36] bg-[#1E2329]/80 hover:border-[#F0B90B]/50'
                }`}>
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-[#F0B90B] text-black font-extrabold text-[10px] rounded-full uppercase tracking-wider shadow">
                    MOST POPULAR
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="font-bold text-white text-base flex items-center gap-1.5">
                        <Zap size={16} className="text-[#F0B90B]" />
                        PRO Trader
                      </h3>
                      {currentPlan === 'PRO' && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#F0B90B]/20 text-[#F0B90B] border border-[#F0B90B]/40">
                          CURRENT
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#848E9C] mb-4">For active breakout & momentum traders.</p>
                    
                    <div className="mb-6">
                      <span className="text-3xl font-black text-white font-mono">
                        {interval === 'yearly' ? '$39' : '$49'}
                      </span>
                      <span className="text-xs text-[#848E9C]"> / month</span>
                      {interval === 'yearly' && (
                        <div className="text-[10px] text-[#0ECB81] font-mono mt-0.5">Billed annually ($468/yr)</div>
                      )}
                    </div>

                    <div className="space-y-2.5 text-xs text-[#EAECEF]">
                      <div className="flex items-center space-x-2">
                        <Check size={14} className="text-[#0ECB81] shrink-0" />
                        <span>Up to <strong>50 Watchlist Items</strong></span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Check size={14} className="text-[#0ECB81] shrink-0" />
                        <span>Up to <strong>25 Active Alert Rules</strong></span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Check size={14} className="text-[#0ECB81] shrink-0" />
                        <span><strong>Telegram & Email</strong> direct dispatch</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Check size={14} className="text-[#0ECB81] shrink-0" />
                        <span><strong>7-Day</strong> Historical wall lookbacks</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Check size={14} className="text-[#0ECB81] shrink-0" />
                        <span>All crypto spot & futures exchanges</span>
                      </div>
                      <div className="flex items-center space-x-2 text-[#848E9C]">
                        <X size={14} className="text-[#F6465D] shrink-0" />
                        <span>Custom Trading Bot Webhooks</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-8">
                    <button
                      onClick={() => handleCheckout('PRO')}
                      disabled={loading || currentPlan === 'PRO' || !billingConfigured}
                      className={`w-full py-2.5 rounded-lg text-xs font-bold transition flex items-center justify-center space-x-1.5 ${
                        currentPlan === 'PRO'
                          ? 'bg-[#2B2F36] text-[#848E9C] cursor-not-allowed'
                          : !billingConfigured
                          ? 'bg-[#2B2F36] text-[#848E9C] cursor-not-allowed border border-[#374151]'
                          : 'bg-[#F0B90B] hover:bg-[#dfa700] text-black shadow-md'
                      }`}
                    >
                      {currentPlan === 'PRO' ? (
                        'Active Plan'
                      ) : !billingConfigured ? (
                        'Billing not configured'
                      ) : (
                        <>
                          <span>Upgrade to PRO</span>
                          <ArrowRight size={13} />
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* 3. ADVANCED PLAN */}
                <div className={`rounded-xl border p-6 flex flex-col justify-between transition ${
                  currentPlan === 'ADVANCED' || highlightPlan === 'ADVANCED'
                    ? 'border-[#3B82F6] bg-[#1E2329] ring-2 ring-[#3B82F6] shadow-xl' 
                    : 'border-[#2B2F36] bg-[#1E2329]/80 hover:border-[#3B82F6]/50'
                }`}>
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="font-bold text-white text-base flex items-center gap-1.5">
                        <Sparkles size={16} className="text-[#3B82F6]" />
                        ADVANCED Quant
                      </h3>
                      {currentPlan === 'ADVANCED' && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#3B82F6]/20 text-[#3B82F6] border border-[#3B82F6]/40">
                          CURRENT
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#848E9C] mb-4">For algorithmic funds, quants, and power users.</p>
                    
                    <div className="mb-6">
                      <span className="text-3xl font-black text-white font-mono">
                        {interval === 'yearly' ? '$119' : '$149'}
                      </span>
                      <span className="text-xs text-[#848E9C]"> / month</span>
                      {interval === 'yearly' && (
                        <div className="text-[10px] text-[#0ECB81] font-mono mt-0.5">Billed annually ($1,428/yr)</div>
                      )}
                    </div>

                    <div className="space-y-2.5 text-xs text-[#EAECEF]">
                      <div className="flex items-center space-x-2">
                        <Check size={14} className="text-[#0ECB81] shrink-0" />
                        <span><strong>Unlimited</strong> Watchlist Items</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Check size={14} className="text-[#0ECB81] shrink-0" />
                        <span><strong>Unlimited</strong> Active Alert Rules</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Check size={14} className="text-[#0ECB81] shrink-0" />
                        <span><strong>Custom Webhooks</strong> (SSRF Hardened)</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Check size={14} className="text-[#0ECB81] shrink-0" />
                        <span><strong>Cross-Exchange</strong> Wall Aggregation</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Check size={14} className="text-[#0ECB81] shrink-0" />
                        <span><strong>30-Day</strong> Full Order Book Depth History</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Check size={14} className="text-[#0ECB81] shrink-0" />
                        <span>All multi-asset exchanges & Stock L2</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-8">
                    <button
                      onClick={() => handleCheckout('ADVANCED')}
                      disabled={loading || currentPlan === 'ADVANCED' || !billingConfigured}
                      className={`w-full py-2.5 rounded-lg text-xs font-bold transition flex items-center justify-center space-x-1.5 ${
                        currentPlan === 'ADVANCED'
                          ? 'bg-[#2B2F36] text-[#848E9C] cursor-not-allowed'
                          : !billingConfigured
                          ? 'bg-[#2B2F36] text-[#848E9C] cursor-not-allowed border border-[#374151]'
                          : 'bg-[#3B82F6] hover:bg-[#2563eb] text-white shadow-md'
                      }`}
                    >
                      {currentPlan === 'ADVANCED' ? (
                        'Active Plan'
                      ) : !billingConfigured ? (
                        'Billing not configured'
                      ) : (
                        <>
                          <span>Upgrade to ADVANCED</span>
                          <ArrowRight size={13} />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* Billing History Tab */
            <div className="space-y-4">
              <div className="text-xs font-semibold text-white">Authoritative Invoices & Billing Events</div>
              {billingEvents.length === 0 ? (
                <div className="p-8 text-center bg-[#0B0E11] rounded-xl border border-[#2B2F36] text-xs text-[#848E9C]">
                  <Clock size={24} className="mx-auto mb-2 opacity-50" />
                  No previous billing events recorded for your account.
                </div>
              ) : (
                <div className="bg-[#0B0E11] rounded-xl border border-[#2B2F36] overflow-hidden divide-y divide-[#2B2F36]">
                  {billingEvents.map((evt) => (
                    <div key={evt.id} className="p-4 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-bold text-white flex items-center gap-2">
                          <span className="capitalize">{evt.eventType.replace(/_/g, ' ')}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#2B2F36] text-[#F0B90B] font-mono">
                            {evt.plan}
                          </span>
                        </div>
                        <div className="text-[11px] text-[#848E9C] font-mono mt-0.5">
                          Provider: {evt.provider} • ID: {evt.id}
                        </div>
                      </div>
                      <div className="text-right text-[11px] text-[#848E9C]">
                        {new Date(evt.createdAt).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#2B2F36] bg-[#1E2329] flex items-center justify-between text-[11px] text-[#848E9C]">
          <div className="flex items-center space-x-4">
            <span className="flex items-center gap-1.5">
              <ShieldCheck size={13} className="text-[#0ECB81]" />
              PCI-DSS Compliant 256-bit Encrypted Checkout
            </span>
          </div>
          <div>
            Need custom exchange integrations? <span className="text-[#F0B90B] hover:underline cursor-pointer">Contact Enterprise</span>
          </div>
        </div>
      </div>
    </div>
  );
};
