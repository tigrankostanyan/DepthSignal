export class ApiError extends Error {
  statusCode?: number;
  code?: string;
  planLimit?: { resource: string };
  constructor(message: string, statusCode?: number, code?: string, planLimit?: { resource: string }) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.planLimit = planLimit;
  }
}

// Dedupes concurrent silent refreshes
let refreshPromise: Promise<boolean> | null = null;

// Attempt a silent refresh using the httpOnly refresh cookie
async function refreshSession(): Promise<boolean> {
  try {
    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    return res.ok;
  } catch {
    return false;
  }
}

function isAuthEndpoint(url: string): boolean {
  return /\/api\/auth\/(login|register|google|refresh|config|logout|me)(\?|$)/.test(url);
}

function redirectToLogin(): void {
  if (typeof window === 'undefined') return;
  if (window.location.pathname === '/login') return;
  window.location.replace('/login');
}

async function parseBody(response: Response): Promise<any> {
  const text = await response.text();
  if (!text) return undefined;
  try { return JSON.parse(text); } catch { return text; }
}

export async function authFetch<T>(url: string, options?: RequestInit, retry = true): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
    credentials: 'include',
  });

  if (response.ok) {
    return (await parseBody(response)) as T;
  }

  const statusCode = response.status;
  let code = 'API_ERROR';
  let message = `API error ${statusCode}`;
  try {
    const body = await parseBody(response);
    if (body && typeof body === 'object') {
      code = body.error || body.code || code;
      message = body.message || message;
    } else if (body) {
      message = String(body);
    }
  } catch {
    // ignore parse failures
  }

  // On 401, try a silent refresh once, then retry the original request
  if (statusCode === 401 && retry && !isAuthEndpoint(url)) {
    if (!refreshPromise) {
      refreshPromise = refreshSession().finally(() => { refreshPromise = null; });
    }
    const refreshed = await refreshPromise;
    if (refreshed) {
      return authFetch<T>(url, options, false);
    }
  }

  // Auth failure: redirect cleanly instead of leaving unhandled 401/403 rejections.
  const isAuthFailure = statusCode === 401 || (statusCode === 403 && code === 'UNAUTHORIZED');
  if (isAuthFailure && !isAuthEndpoint(url)) {
    redirectToLogin();
  }

  throw new ApiError(message, statusCode, code);
}

// Graceful, non-throwing fetch wrapper. Used by read/list endpoints so a transient
// failure (or an expected unauthenticated state) returns a safe fallback value instead
// of crashing the component tree or surfacing an unhandled rejection.
export async function safeFetch<T>(
  url: string,
  options?: RequestInit,
  fallback?: T
): Promise<T> {
  try {
    return await authFetch<T>(url, options);
  } catch {
    return fallback as T;
  }
}
