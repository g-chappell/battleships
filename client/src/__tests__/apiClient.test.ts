import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiError, apiFetch, apiFetchSafe } from '../services/apiClient';

// Mock the global fetch
const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
  mockFetch.mockReset();
});

/** Build a minimal mock Response with the given status and JSON body. */
function makeResponse(status: number, data: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
  } as Response;
}

// ---------------------------------------------------------------------------
// ApiError
// ---------------------------------------------------------------------------

describe('ApiError', () => {
  it('stores message, status, and data', () => {
    const err = new ApiError('not found', 404, { error: 'not found' });
    expect(err.message).toBe('not found');
    expect(err.status).toBe(404);
    expect(err.data).toEqual({ error: 'not found' });
  });

  it('is an instance of Error', () => {
    const err = new ApiError('boom', 500, null);
    expect(err instanceof Error).toBe(true);
  });

  it('has name "ApiError"', () => {
    const err = new ApiError('test', 400, undefined);
    expect(err.name).toBe('ApiError');
  });

  it('can be caught as instanceof ApiError', () => {
    const err = new ApiError('validation failed', 422, { fields: ['email'] });
    expect(err instanceof ApiError).toBe(true);
  });

  it('accepts null as data', () => {
    const err = new ApiError('gone', 410, null);
    expect(err.data).toBeNull();
  });

  it('accepts an object as data', () => {
    const payload = { code: 'INSUFFICIENT_GOLD', balance: 50 };
    const err = new ApiError('not enough gold', 400, payload);
    expect(err.data).toEqual(payload);
  });
});

// ---------------------------------------------------------------------------
// apiFetch
// ---------------------------------------------------------------------------

describe('apiFetch', () => {
  it('returns parsed JSON body on a 200 response', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(200, { ok: true }));
    const result = await apiFetch('/test');
    expect(result).toEqual({ ok: true });
  });

  it('attaches Authorization header when token is provided', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(200, {}));
    await apiFetch('/test', { token: 'abc123' });
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer abc123' }),
      }),
    );
  });

  it('does not attach Authorization header when token is absent', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(200, {}));
    await apiFetch('/test');
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['Authorization']).toBeUndefined();
  });

  it('does not attach Authorization header when token is null', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(200, {}));
    await apiFetch('/test', { token: null });
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['Authorization']).toBeUndefined();
  });

  it('throws ApiError on a 400 response', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(400, { error: 'bad request' }));
    await expect(apiFetch('/test')).rejects.toBeInstanceOf(ApiError);
  });

  it('throws ApiError with correct status on 401', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(401, { error: 'unauthorized' }));
    await expect(apiFetch('/test')).rejects.toMatchObject({ status: 401 });
  });

  it('throws ApiError with correct status on 404', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(404, { error: 'not found' }));
    await expect(apiFetch('/test')).rejects.toMatchObject({ status: 404 });
  });

  it('throws ApiError with correct status on 500', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(500, { error: 'server fault' }));
    await expect(apiFetch('/test')).rejects.toMatchObject({ status: 500 });
  });

  it('uses the server-provided error message from the response body', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(422, { error: 'email already taken' }));
    await expect(apiFetch('/test')).rejects.toMatchObject({
      message: 'email already taken',
    });
  });

  it('falls back to "HTTP {status}" when response body has no error field', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(500, {}));
    await expect(apiFetch('/test')).rejects.toMatchObject({ message: 'HTTP 500' });
  });

  it('falls back to "HTTP {status}" when response body is null', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(503, null));
    await expect(apiFetch('/test')).rejects.toMatchObject({ message: 'HTTP 503' });
  });

  it('includes the response body data in the thrown ApiError', async () => {
    const body = { error: 'bad', code: 'INVALID' };
    mockFetch.mockResolvedValueOnce(makeResponse(400, body));
    await expect(apiFetch('/test')).rejects.toMatchObject({ data: body });
  });

  it('sets Content-Type: application/json when json option is provided', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(200, {}));
    await apiFetch('/test', { json: { key: 'value' } });
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('stringifies the json option as the request body', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(200, {}));
    await apiFetch('/test', { json: { foo: 'bar' } });
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(init.body).toBe('{"foo":"bar"}');
  });

  it('does not set Content-Type when no json option', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(200, {}));
    await apiFetch('/test');
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['Content-Type']).toBeUndefined();
  });

  it('prepends the API_URL to a path starting with /', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(200, {}));
    await apiFetch('/users/me');
    const [calledUrl] = mockFetch.mock.calls[0] as [string];
    expect(calledUrl).toMatch(/\/users\/me$/);
    expect(calledUrl).toContain('/api');
  });

  it('prepends the API_URL with a slash to a path without a leading /', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(200, {}));
    await apiFetch('users/me');
    const [calledUrl] = mockFetch.mock.calls[0] as [string];
    expect(calledUrl).toMatch(/\/users\/me$/);
  });

  it('passes through extra RequestInit options to fetch', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(200, {}));
    await apiFetch('/test', { method: 'DELETE' });
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});

// ---------------------------------------------------------------------------
// apiFetchSafe
// ---------------------------------------------------------------------------

describe('apiFetchSafe', () => {
  it('returns parsed data on a successful response', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(200, { seasons: [] }));
    const result = await apiFetchSafe<{ seasons: unknown[] }>('/seasons');
    expect(result).toEqual({ seasons: [] });
  });

  it('returns null when the server returns a 4xx status', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(404, { error: 'not found' }));
    const result = await apiFetchSafe('/test');
    expect(result).toBeNull();
  });

  it('returns null when the server returns a 5xx status', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(500, { error: 'server error' }));
    const result = await apiFetchSafe('/test');
    expect(result).toBeNull();
  });

  it('returns null when fetch throws a network error', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const result = await apiFetchSafe('/test');
    expect(result).toBeNull();
  });

  it('does not throw on any failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network gone'));
    await expect(apiFetchSafe('/test')).resolves.toBeNull();
  });

  it('forwards the token option to the underlying fetch call', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(200, {}));
    await apiFetchSafe('/test', { token: 'tok123' });
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer tok123' }),
      }),
    );
  });

  it('forwards the json option to the underlying fetch call', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(200, {}));
    await apiFetchSafe('/test', { json: { q: 1 } });
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(init.body).toBe('{"q":1}');
  });
});
