/**
 * Centralized API + Socket URLs and fetch helpers.
 *
 * All network calls in the client should go through apiFetch / apiFetchSafe
 * so that the API host is read from the Vite environment variables:
 *   VITE_API_URL    — base URL including /api path (default: http://localhost:3001/api)
 *   VITE_SOCKET_URL — Socket.IO origin (default: http://localhost:3001)
 *
 * In development, these defaults are fine. In production, the Docker image
 * is built with VITE_API_URL=/api so the client uses relative URLs that
 * the nginx reverse proxy forwards to the server container.
 */

const RAW_API =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  'http://localhost:3001/api';

/** Base URL including the /api path. No trailing slash. */
export const API_URL = RAW_API.replace(/\/$/, '');

/** Socket.IO origin (without the /api path). */
export const SOCKET_URL =
  (import.meta.env.VITE_SOCKET_URL as string | undefined) ??
  API_URL.replace(/\/api$/, '');

export interface ApiFetchOptions extends Omit<RequestInit, 'body'> {
  /** JWT bearer token. If provided, sent as Authorization header. */
  token?: string | null;
  /** JSON body. Automatically stringified and Content-Type set. */
  json?: unknown;
  /** Raw body (for non-JSON payloads). */
  body?: BodyInit | null;
}

export class ApiError extends Error {
  status: number;
  data: unknown;
  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

/**
 * Fetch with automatic JSON + auth handling. Throws ApiError on non-2xx.
 */
export async function apiFetch<T = unknown>(
  path: string,
  opts: ApiFetchOptions = {},
): Promise<T> {
  const { token, json, headers, body, ...rest } = opts;

  const finalHeaders: Record<string, string> = {
    ...(headers as Record<string, string> | undefined),
  };
  if (json !== undefined) {
    finalHeaders['Content-Type'] = 'application/json';
  }
  if (token) {
    finalHeaders['Authorization'] = `Bearer ${token}`;
  }

  const finalBody: BodyInit | null | undefined =
    json !== undefined ? JSON.stringify(json) : body;

  const url = `${API_URL}${path.startsWith('/') ? path : `/${path}`}`;
  const res = await fetch(url, {
    ...rest,
    headers: finalHeaders,
    body: finalBody,
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const msg =
      (data && typeof data === 'object' && 'error' in data && typeof data.error === 'string' && data.error) ||
      `HTTP ${res.status}`;
    throw new ApiError(msg, res.status, data);
  }
  return data as T;
}

/**
 * Fetch that returns null on any failure. Use for graceful DB-fallback
 * stores where a failed request should silently fall back to localStorage
 * or cached state rather than surface an error.
 */
export async function apiFetchSafe<T = unknown>(
  path: string,
  opts: ApiFetchOptions = {},
): Promise<T | null> {
  try {
    return await apiFetch<T>(path, opts);
  } catch {
    return null;
  }
}
