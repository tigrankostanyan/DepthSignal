import { 
  AlertRule, 
  AlertTrigger, 
  BlacklistEntry, 
  ConnectorStatus, 
  DailyWallAggregate, 
  DetectedWall, 
  HistoricalWallRecord, 
  MarketTicker, 
  MarketType, 
  SavedFilterPreset, 
  ScreenerFilters, 
  UserProfile, 
  UserSettings, 
  Watchlist 
} from '../types/index.js';

const TOKEN_KEY = 'trading_screener_auth_token';
const USER_KEY = 'trading_screener_user_profile';

// Default session fallback token
const DEFAULT_BOOTSTRAP_TOKEN = 'tok_default_trader_session_v1';

export function getAuthToken(): string {
  if (typeof window === 'undefined') return DEFAULT_BOOTSTRAP_TOKEN;
  const token = localStorage.getItem(TOKEN_KEY);
  return token || DEFAULT_BOOTSTRAP_TOKEN;
}

export function setAuthToken(token: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(TOKEN_KEY, token);
  }
}

export function clearAuthSession(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }
}

export function getCachedUser(): UserProfile | null {
  if (typeof window === 'undefined') return null;
  const userJson = localStorage.getItem(USER_KEY);
  if (!userJson) return null;
  try {
    return JSON.parse(userJson);
  } catch {
    return null;
  }
}

export function setCachedUser(user: UserProfile): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
}

export async function authFetch<T = any>(input: string | URL, init: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers = new Headers(init.headers || {});
  
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(input, {
    ...init,
    headers
  });

  if (!res.ok) {
    let errorData: any;
    try {
      errorData = await res.json();
    } catch {
      errorData = { message: res.statusText };
    }

    if (res.status === 401) {
      console.warn('[API] Authentication expired or invalid credentials');
    }

    const err: any = new Error(errorData.message || `Request failed with status ${res.status}`);
    err.statusCode = res.status;
    err.errorCode = errorData.error;
    err.details = errorData.details;
    err.requestId = errorData.requestId;
    throw err;
  }

  return res.json();
}

// ------------------------------------------------
// AUTHENTICATION CLIENT
// ------------------------------------------------
export async function login(email: string, password: string): Promise<{ user: UserProfile; token: string }> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message || 'Login failed');
  }

  const data = await res.json();
  setAuthToken(data.token);
  setCachedUser(data.user);
  return data;
}

export async function register(email: string, password: string, name: string): Promise<{ user: UserProfile; token: string }> {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name })
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message || 'Registration failed');
  }

  const data = await res.json();
  setAuthToken(data.token);
  setCachedUser(data.user);
  return data;
}

export async function fetchCurrentUser(): Promise<UserProfile> {
  const data = await authFetch<{ user: UserProfile }>('/api/auth/me');
  setCachedUser(data.user);
  return data.user;
}

export async function logout(): Promise<void> {
  try {
    await authFetch('/api/auth/logout', { method: 'POST' });
  } finally {
    clearAuthSession();
  }
}

// ------------------------------------------------
// MARKET DATA CLIENT
// ------------------------------------------------
export async function fetchTickers(filters?: Partial<ScreenerFilters>): Promise<MarketTicker[]> {
  const params = new URLSearchParams();
  if (filters) {
    if (filters.searchQuery) params.set('searchQuery', filters.searchQuery);
    if (filters.category && filters.category !== 'ALL') params.set('category', filters.category);
    if (filters.marketType && filters.marketType !== 'ALL') params.set('marketType', filters.marketType);
    if (filters.exchanges && filters.exchanges.length > 0) params.set('exchanges', filters.exchanges.join(','));
    if (filters.timeframe) params.set('timeframe', filters.timeframe);
    if (filters.priceMin !== undefined) params.set('priceMin', String(filters.priceMin));
    if (filters.priceMax !== undefined) params.set('priceMax', String(filters.priceMax));
    if (filters.changeMin !== undefined) params.set('changeMin', String(filters.changeMin));
    if (filters.changeMax !== undefined) params.set('changeMax', String(filters.changeMax));
    if (filters.volumeMinUsd !== undefined) params.set('volumeMinUsd', String(filters.volumeMinUsd));
    if (filters.volumeMaxUsd !== undefined) params.set('volumeMaxUsd', String(filters.volumeMaxUsd));
    if (filters.rsiMin !== undefined) params.set('rsiMin', String(filters.rsiMin));
    if (filters.rsiMax !== undefined) params.set('rsiMax', String(filters.rsiMax));
    if (filters.onlyWithWalls) params.set('onlyWithWalls', 'true');
    if (filters.onlyWatchlist) params.set('onlyWatchlist', 'true');
    if (filters.hideBlacklisted !== undefined) params.set('hideBlacklisted', String(filters.hideBlacklisted));
    if (filters.sortBy) params.set('sortBy', String(filters.sortBy));
    if (filters.sortOrder) params.set('sortOrder', filters.sortOrder);
  }
  const json = await authFetch<{ count: number; data: MarketTicker[] }>(`/api/market/tickers?${params.toString()}`);
  return json.data || [];
}

export async function fetchSymbolDetail(symbol: string, exchange = 'BINANCE', marketType: MarketType = 'SPOT') {
  return authFetch(`/api/market/symbol/${symbol}?exchange=${exchange}&marketType=${marketType}`);
}

export async function fetchActiveWalls(symbol?: string, marketType?: MarketType): Promise<DetectedWall[]> {
  const params = new URLSearchParams();
  if (symbol) params.set('symbol', symbol);
  if (marketType) params.set('marketType', marketType);
  const json = await authFetch<{ count: number; data: DetectedWall[] }>(`/api/walls/active?${params.toString()}`);
  return json.data || [];
}

export async function fetchWallHistory(symbol?: string, exchange?: string): Promise<HistoricalWallRecord[]> {
  const params = new URLSearchParams();
  if (symbol) params.set('symbol', symbol);
  if (exchange) params.set('exchange', exchange);
  const json = await authFetch<{ count: number; data: HistoricalWallRecord[] }>(`/api/walls/history?${params.toString()}`);
  return json.data || [];
}

export async function fetchDailyAggregates(days = 30): Promise<DailyWallAggregate[]> {
  const json = await authFetch<{ count: number; data: DailyWallAggregate[] }>(`/api/walls/daily-aggregates?days=${days}`);
  return json.data || [];
}

export async function updateWallConfig(config: { minVolumeUsd?: number; crossExchangeAggregation?: boolean; minDurationSeconds?: number }) {
  return authFetch('/api/walls/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config)
  });
}

// ------------------------------------------------
// ALERTS CLIENT (USER SCOPED)
// ------------------------------------------------
export async function fetchAlertRules(): Promise<AlertRule[]> {
  return authFetch<AlertRule[]>('/api/alerts/rules');
}

export async function saveAlertRule(rule: Partial<AlertRule>): Promise<AlertRule> {
  return authFetch<AlertRule>('/api/alerts/rules', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(rule)
  });
}

export async function deleteAlertRule(id: string): Promise<void> {
  await authFetch(`/api/alerts/rules/${id}`, { method: 'DELETE' });
}

export async function fetchAlertTriggers(limit = 100): Promise<AlertTrigger[]> {
  return authFetch<AlertTrigger[]>(`/api/alerts/triggers?limit=${limit}`);
}

export async function markAlertRead(id?: string): Promise<void> {
  await authFetch('/api/alerts/triggers/read', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id })
  });
}

export async function clearAlertTriggers(): Promise<void> {
  await authFetch('/api/alerts/triggers', { method: 'DELETE' });
}

export async function testTriggerAlert(): Promise<AlertTrigger> {
  return authFetch<AlertTrigger>('/api/alerts/test-trigger', { method: 'POST' });
}

// ------------------------------------------------
// WATCHLISTS CLIENT (USER SCOPED)
// ------------------------------------------------
export async function fetchWatchlists(): Promise<Watchlist[]> {
  return authFetch<Watchlist[]>('/api/watchlists');
}

export async function createWatchlist(name: string): Promise<Watchlist> {
  return authFetch<Watchlist>('/api/watchlists', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  });
}

export async function deleteWatchlist(id: string): Promise<void> {
  await authFetch(`/api/watchlists/${id}`, { method: 'DELETE' });
}

export async function addWatchlistItem(watchlistId: string, item: { symbol: string; exchange: string; marketType: string; notes?: string }) {
  return authFetch(`/api/watchlists/${watchlistId}/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(item)
  });
}

export async function removeWatchlistItem(watchlistId: string, item: { symbol: string; exchange: string; marketType: string }) {
  return authFetch(`/api/watchlists/${watchlistId}/items`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(item)
  });
}

// ------------------------------------------------
// BLACKLIST CLIENT (AUDITED)
// ------------------------------------------------
export async function fetchBlacklist(): Promise<BlacklistEntry[]> {
  return authFetch<BlacklistEntry[]>('/api/blacklist');
}

export async function addBlacklistEntry(entry: Partial<BlacklistEntry>): Promise<BlacklistEntry> {
  return authFetch<BlacklistEntry>('/api/blacklist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entry)
  });
}

export async function removeBlacklistEntry(id: string): Promise<void> {
  await authFetch(`/api/blacklist/${id}`, { method: 'DELETE' });
}

// ------------------------------------------------
// PRESETS CLIENT (USER SCOPED)
// ------------------------------------------------
export async function fetchPresets(): Promise<SavedFilterPreset[]> {
  return authFetch<SavedFilterPreset[]>('/api/presets');
}

export async function savePreset(preset: Partial<SavedFilterPreset>): Promise<SavedFilterPreset> {
  return authFetch<SavedFilterPreset>('/api/presets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(preset)
  });
}

export async function deletePreset(id: string): Promise<void> {
  await authFetch(`/api/presets/${id}`, { method: 'DELETE' });
}

// ------------------------------------------------
// SETTINGS CLIENT (USER SCOPED & AUDITED)
// ------------------------------------------------
export async function fetchSettings(): Promise<UserSettings> {
  return authFetch<UserSettings>('/api/settings');
}

export async function updateSettings(settings: Partial<UserSettings>): Promise<{ status: string; settings: UserSettings }> {
  return authFetch('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings)
  });
}

// ------------------------------------------------
// BILLING & SUBSCRIPTION CLIENT
// ------------------------------------------------
export async function fetchPlans(): Promise<{ plans: any[]; billingConfigured: boolean }> {
  const res = await fetch('/api/billing/plans');
  const data = await res.json();
  if (Array.isArray(data)) {
    return { plans: data, billingConfigured: false };
  }
  return { plans: data.plans || [], billingConfigured: Boolean(data.billingConfigured) };
}

export async function fetchIntegrationsStatus(): Promise<{
  billing: boolean;
  telegram: boolean;
  email: boolean;
  webhook: boolean;
}> {
  const res = await fetch('/api/integrations/status');
  return res.json();
}

export async function fetchSubscription(): Promise<{ subscription: any; usage: any; billingConfigured?: boolean }> {
  return authFetch('/api/billing/subscription');
}

export async function createCheckoutSession(plan: string, interval: 'monthly' | 'yearly' = 'monthly'): Promise<{ checkoutUrl: string; sessionId: string; provider: string }> {
  return authFetch('/api/billing/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan, interval })
  });
}

export async function createPortalSession(): Promise<{ portalUrl: string }> {
  return authFetch('/api/billing/portal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
}

export async function fetchBillingEvents(): Promise<any[]> {
  return authFetch('/api/billing/events');
}

// ------------------------------------------------
// ADMIN API CLIENT (ADMIN ONLY)
// ------------------------------------------------
export async function fetchAdminUsers(): Promise<any[]> {
  return authFetch('/api/admin/users');
}

export async function updateAdminUserPlan(userId: string, plan: string, status: string = 'active'): Promise<any> {
  return authFetch(`/api/admin/users/${userId}/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan, status })
  });
}

export async function updateAdminUserRole(userId: string, role: 'TRADER' | 'ADMIN'): Promise<any> {
  return authFetch(`/api/admin/users/${userId}/role`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role })
  });
}

export async function fetchAdminNotificationDeliveries(status?: string): Promise<{ count: number; data: any[] }> {
  const params = status ? `?status=${status}` : '';
  return authFetch(`/api/admin/notifications/deliveries${params}`);
}

export async function retryNotificationDelivery(deliveryId: string): Promise<any> {
  return authFetch(`/api/admin/notifications/${deliveryId}/retry`, {
    method: 'POST'
  });
}

export async function fetchAdminStats(): Promise<any> {
  return authFetch('/api/admin/stats');
}

// ------------------------------------------------
// SYSTEM HEALTH & TEST SUITE
// ------------------------------------------------
export async function fetchConnectorHealth(): Promise<ConnectorStatus[]> {
  const res = await fetch('/api/connectors/health');
  return res.json();
}

export async function runDomainTests() {
  const res = await fetch('/api/run-tests');
  return res.json();
}
