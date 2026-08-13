'use client';

import { API_URL } from './config';

/**
 * Auth client.
 *
 * `ub_token` holds a short-lived access JWT and `ub_refresh` an opaque refresh
 * token. getToken() is the only thing callers need: it returns a valid bearer
 * token, refreshing transparently when the current one is close to expiry.
 */

const ACCESS_KEY = 'ub_token';
const REFRESH_KEY = 'ub_refresh';
const EXPIRY_KEY = 'ub_token_exp';

// Refresh this long before actual expiry, so an in-flight request never races
// the boundary.
const REFRESH_SKEW_MS = 60_000;

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  profilePhoto: string | null;
  plan: string;
  creditBalance: number;
  isVerified: boolean;
  emailVerified: boolean;
  bio: string | null;
}

interface TokenBundle {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

// ─── Storage ────────────────────────────────────────────────────────────────

const isBrowser = () => typeof window !== 'undefined';

export function getStoredToken(): string | null {
  if (!isBrowser()) return null;
  return localStorage.getItem(ACCESS_KEY);
}

function storeTokens(bundle: TokenBundle) {
  if (!isBrowser()) return;
  localStorage.setItem(ACCESS_KEY, bundle.accessToken);
  localStorage.setItem(REFRESH_KEY, bundle.refreshToken);
  localStorage.setItem(EXPIRY_KEY, String(Date.now() + bundle.expiresIn * 1000));
  notify();
}

function clearTokens() {
  if (!isBrowser()) return;
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(EXPIRY_KEY);
  notify();
}

// ─── Auth-state subscription ────────────────────────────────────────────────

type Listener = () => void;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* a broken listener must not stop the others */
    }
  });
}

export function onAuthChange(fn: Listener): () => void {
  listeners.add(fn);
  // Another tab signing in or out writes to localStorage; mirror that here.
  const onStorage = (e: StorageEvent) => {
    if (e.key === ACCESS_KEY) fn();
  };
  if (isBrowser()) window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(fn);
    if (isBrowser()) window.removeEventListener('storage', onStorage);
  };
}

// ─── Token acquisition ──────────────────────────────────────────────────────

let refreshInFlight: Promise<string | null> | null = null;

async function doRefresh(): Promise<string | null> {
  const refreshToken = isBrowser() ? localStorage.getItem(REFRESH_KEY) : null;
  if (!refreshToken) {
    clearTokens();
    return null;
  }

  try {
    const res = await fetch(`${API_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) {
      clearTokens();
      return null;
    }
    const bundle: TokenBundle = await res.json();
    storeTokens(bundle);
    return bundle.accessToken;
  } catch {
    // Network blip — keep the existing token rather than signing the user out.
    return getStoredToken();
  }
}

/**
 * Returns a valid bearer token, refreshing first if it is expired or close to
 * it. Concurrent callers share a single refresh request.
 */
export async function getToken(): Promise<string | null> {
  if (!isBrowser()) return null;

  const token = localStorage.getItem(ACCESS_KEY);
  if (!token) return null;

  const expiresAt = Number(localStorage.getItem(EXPIRY_KEY) || 0);
  if (expiresAt && Date.now() < expiresAt - REFRESH_SKEW_MS) return token;

  if (!refreshInFlight) {
    refreshInFlight = doRefresh().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

/** Authorization header, or `{}` when signed out. */
export async function authHeader(): Promise<Record<string, string>> {
  const token = await getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ─── Session lifecycle ──────────────────────────────────────────────────────

async function parseError(res: Response, fallback: string): Promise<never> {
  let message = fallback;
  try {
    const body = await res.json();
    // Nest's ValidationPipe returns `message` as an array of field errors.
    message = Array.isArray(body?.message) ? body.message[0] : body?.message || fallback;
  } catch {
    /* non-JSON error body */
  }
  throw new Error(message);
}

export async function register(email: string, password: string, name: string): Promise<AuthUser> {
  const res = await fetch(`${API_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name }),
  });
  if (!res.ok) await parseError(res, 'Could not create your account.');
  const data = await res.json();
  storeTokens(data);
  return data.user;
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) await parseError(res, 'Incorrect email or password.');
  const data = await res.json();
  storeTokens(data);
  return data.user;
}

export async function logout(): Promise<void> {
  const refreshToken = isBrowser() ? localStorage.getItem(REFRESH_KEY) : null;
  if (refreshToken) {
    try {
      await fetch(`${API_URL}/api/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
    } catch {
      /* sign out locally regardless */
    }
  }
  clearTokens();
}

export async function requestPasswordReset(email: string): Promise<string> {
  const res = await fetch(`${API_URL}/api/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) await parseError(res, 'Could not send the reset email.');
  const data = await res.json();
  return data.message;
}

export async function resetPassword(token: string, password: string): Promise<string> {
  const res = await fetch(`${API_URL}/api/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, password }),
  });
  if (!res.ok) await parseError(res, 'Could not reset your password.');
  const data = await res.json();
  return data.message;
}

/** Current user from the server, or null when the session is invalid. */
export async function fetchMe(): Promise<AuthUser | null> {
  const headers = await authHeader();
  if (!headers.Authorization) return null;
  try {
    const res = await fetch(`${API_URL}/api/auth/me`, { headers });
    if (!res.ok) {
      if (res.status === 401) clearTokens();
      return null;
    }
    return await res.json();
  } catch {
    return null;
  }
}
