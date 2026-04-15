// Central API config — reads from env vars set in .env.local
// NEXT_PUBLIC_BACKEND_URL  e.g. https://abc123-8000.proxy.runpod.net
// NEXT_PUBLIC_API_KEY      the secret you set on the backend

export const BACKEND_URL =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_BACKEND_URL) ||
  'http://localhost:8000';

export const API_KEY =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_KEY) || '';

/** Headers to attach to every fetch/XHR request */
export function apiHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    ...(API_KEY ? { 'X-API-Key': API_KEY } : {}),
    ...extra,
  };
}

/** Append ?api_key=... to URLs used in <video src>, <img src>, <a href> */
export function withKey(url: string): string {
  if (!API_KEY) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}api_key=${encodeURIComponent(API_KEY)}`;
}

/** Build a full backend URL (for direct calls that bypass the Next.js proxy) */
export function backendUrl(path: string): string {
  return `${BACKEND_URL}${path}`;
}

/** Build a WebSocket URL (ws/wss) for the backend */
export function wsUrl(path: string): string {
  const base = BACKEND_URL.replace(/^http/, 'ws');
  const url = `${base}${path}`;
  return withKey(url);
}
