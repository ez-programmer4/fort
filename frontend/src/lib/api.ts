const TOKENS_KEY = 'fort_tokens';

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

export function getTokens(): Tokens | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(TOKENS_KEY);
    return raw ? (JSON.parse(raw) as Tokens) : null;
  } catch {
    return null;
  }
}

export function setTokens(tokens: Tokens) {
  localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens));
}

export function clearTokens() {
  localStorage.removeItem(TOKENS_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function rawFetch(path: string, options: RequestInit, accessToken?: string) {
  const headers: Record<string, string> = {
    // FormData bodies set their own multipart boundary — don't override
    ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers as Record<string, string>),
  };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  return fetch(path, { ...options, headers });
}

async function tryRefresh(): Promise<string | null> {
  const tokens = getTokens();
  if (!tokens) return null;
  const res = await fetch('/api/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: tokens.refreshToken }),
  });
  if (!res.ok) {
    clearTokens();
    return null;
  }
  const next = (await res.json()) as Tokens;
  setTokens(next);
  return next.accessToken;
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  let accessToken = getTokens()?.accessToken;
  let res = await rawFetch(path, options, accessToken);

  if (res.status === 401 && accessToken) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      res = await rawFetch(path, options, refreshed);
    }
  }

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      message = body?.error?.message || message;
    } catch {
      /* keep default */
    }
    throw new ApiError(res.status, message);
  }
  return (await res.json()) as T;
}

/** Authenticated file download — saves the response as a file via a temporary link. */
export async function apiDownload(path: string, fallbackName: string) {
  let accessToken = getTokens()?.accessToken;
  let res = await rawFetch(path, {}, accessToken);
  if (res.status === 401 && accessToken) {
    const refreshed = await tryRefresh();
    if (refreshed) res = await rawFetch(path, {}, refreshed);
  }
  if (!res.ok) throw new ApiError(res.status, `Download failed (${res.status})`);

  const disposition = res.headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename="?([^";]+)"?/);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = match?.[1] || fallbackName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
