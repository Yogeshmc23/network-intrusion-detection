import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError } from 'axios';
import type { AxiosAdapter, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { apiClient, authApi, authRefreshClient } from '@/lib/api';
import { SessionExpiredError } from '@/lib/apiErrors';
import { useAuthStore, AUTH_STORAGE_KEYS } from '@/stores/authStore';

interface StubResult {
  status: number;
  data?: unknown;
}

type StubHandler = (config: AxiosRequestConfig) => StubResult | Promise<StubResult>;

function toResponse(config: AxiosRequestConfig, result: StubResult): AxiosResponse {
  return {
    data: result.data ?? {},
    status: result.status,
    statusText: String(result.status),
    headers: {},
    config: config as AxiosResponse['config'],
  };
}

/**
 * Custom adapter: real axios adapters use `settle()`, so non-2xx responses must
 * be thrown as AxiosErrors for the interceptors to see `error.response.status`.
 */
function installAdapter(client: typeof apiClient, handler: StubHandler): void {
  client.defaults.adapter = (async (config: AxiosRequestConfig) => {
    const result = await handler(config);
    const response = toResponse(config, result);

    if (result.status >= 200 && result.status < 300) {
      return response;
    }

    throw new AxiosError(
      `Request failed with status code ${result.status}`,
      'ERR_BAD_RESPONSE',
      config as InternalAxiosRequestConfig,
      undefined,
      response
    );
  }) as AxiosAdapter;
}

const originalApiAdapter = apiClient.defaults.adapter;
const originalRefreshAdapter = authRefreshClient.defaults.adapter;

const signedInState = {
  user: { id: 'user-1', name: 'Analyst', email: 'analyst@cybershield.io' },
  accessToken: 'expired-access-token',
  refreshToken: 'refresh-token-1',
  isAuthenticated: true,
  isInitialized: true,
  isLoading: false,
};

function authorizationOf(config: AxiosRequestConfig): string | undefined {
  const headers = config.headers as Record<string, string> | undefined;
  return headers?.Authorization ?? headers?.authorization;
}

describe('api auth interceptors', () => {
  beforeEach(() => {
    useAuthStore.setState(signedInState);
    localStorage.clear();
    localStorage.setItem(AUTH_STORAGE_KEYS.accessToken, 'expired-access-token');
    localStorage.setItem(AUTH_STORAGE_KEYS.refreshToken, 'refresh-token-1');
  });

  afterEach(() => {
    apiClient.defaults.adapter = originalApiAdapter;
    authRefreshClient.defaults.adapter = originalRefreshAdapter;
  });

  it('performs a single refresh for concurrent 401s and replays every request', async () => {
    let refreshCalls = 0;
    const seenUrls: string[] = [];
    let releaseRefresh: (result: StubResult) => void = () => undefined;
    // Hold the refresh response open so both 401s are guaranteed to overlap.
    const refreshGate = new Promise<StubResult>((resolve) => {
      releaseRefresh = resolve;
    });

    installAdapter(apiClient, (config) => {
      const url = config.url ?? '';
      seenUrls.push(url);
      if (authorizationOf(config) === 'Bearer fresh-access-token') {
        return { status: 200, data: { ok: true, url } };
      }
      return { status: 401, data: { success: false, message: 'expired', code: 'TOKEN_EXPIRED' } };
    });

    installAdapter(authRefreshClient, async () => {
      refreshCalls += 1;
      return refreshGate;
    });

    const historyPromise = apiClient.get('/history');
    const mePromise = apiClient.get('/auth/me');

    // Let both original requests fail with 401 before the refresh resolves.
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(refreshCalls).toBe(1);

    releaseRefresh({
      status: 200,
      data: { accessToken: 'fresh-access-token', refreshToken: 'refresh-token-2' },
    });

    const [history, me] = await Promise.all([historyPromise, mePromise]);

    expect(refreshCalls).toBe(1);
    expect(history.status).toBe(200);
    expect(me.status).toBe(200);
    // Each request was attempted twice: original 401 + one retry.
    expect(seenUrls.filter((url) => url === '/history')).toHaveLength(2);
    expect(seenUrls.filter((url) => url === '/auth/me')).toHaveLength(2);

    const state = useAuthStore.getState();
    expect(state.accessToken).toBe('fresh-access-token');
    expect(state.refreshToken).toBe('refresh-token-2');
    expect(state.isAuthenticated).toBe(true);
    // Rotated tokens are persisted, so a reload keeps working.
    expect(localStorage.getItem(AUTH_STORAGE_KEYS.refreshToken)).toBe('refresh-token-2');
  });

  it('clears the session once when the refresh token is rejected by the backend', async () => {
    let refreshCalls = 0;

    installAdapter(apiClient, () => ({ status: 401, data: { code: 'TOKEN_EXPIRED' } }));
    installAdapter(authRefreshClient, () => {
      refreshCalls += 1;
      return {
        status: 401,
        data: { success: false, message: 'Invalid or expired refresh token', code: 'REFRESH_TOKEN_INVALID' },
      };
    });

    const results = await Promise.allSettled([
      apiClient.get('/history'),
      apiClient.get('/models/metrics'),
    ]);

    expect(refreshCalls).toBe(1);
    expect(results.every((result) => result.status === 'rejected')).toBe(true);
    expect((results[0] as PromiseRejectedResult).reason).toBeInstanceOf(SessionExpiredError);

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.accessToken).toBeNull();
    expect(state.refreshToken).toBeNull();
    expect(localStorage.getItem(AUTH_STORAGE_KEYS.accessToken)).toBeNull();
    expect(localStorage.getItem(AUTH_STORAGE_KEYS.refreshToken)).toBeNull();
  });

  it('keeps the session when the refresh call fails transiently (network/5xx)', async () => {
    let refreshCalls = 0;

    installAdapter(apiClient, () => ({ status: 401, data: { code: 'TOKEN_EXPIRED' } }));
    installAdapter(authRefreshClient, () => {
      refreshCalls += 1;
      return { status: 503, data: { success: false, message: 'Service unavailable' } };
    });

    await expect(apiClient.get('/history')).rejects.toMatchObject({
      response: { status: 401 },
    });

    expect(refreshCalls).toBe(1);
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.refreshToken).toBe('refresh-token-1');
    expect(localStorage.getItem(AUTH_STORAGE_KEYS.refreshToken)).toBe('refresh-token-1');
  });

  it('never refreshes or retries credentials endpoints', async () => {
    let refreshCalls = 0;
    let loginCalls = 0;

    installAdapter(apiClient, (config) => {
      if (config.url === '/auth/login') loginCalls += 1;
      return {
        status: 401,
        data: { success: false, message: 'Invalid email or password', code: 'INVALID_CREDENTIALS' },
      };
    });
    installAdapter(authRefreshClient, () => {
      refreshCalls += 1;
      return { status: 200, data: { accessToken: 'fresh-access-token' } };
    });

    await expect(
      authApi.login({ email: 'analyst@cybershield.io', password: 'wrong-password' })
    ).rejects.toMatchObject({ response: { status: 401 } });

    expect(loginCalls).toBe(1);
    expect(refreshCalls).toBe(0);
    expect(useAuthStore.getState().refreshToken).toBe('refresh-token-1');
  });

  it('retries a failed request only once, even if the retry also returns 401', async () => {
    let refreshCalls = 0;
    let historyCalls = 0;

    installAdapter(apiClient, (config) => {
      if (config.url === '/history') historyCalls += 1;
      return { status: 401, data: { code: 'TOKEN_EXPIRED' } };
    });
    installAdapter(authRefreshClient, () => {
      refreshCalls += 1;
      return { status: 200, data: { accessToken: 'fresh-access-token' } };
    });

    await expect(apiClient.get('/history')).rejects.toMatchObject({ response: { status: 401 } });

    expect(historyCalls).toBe(2);
    expect(refreshCalls).toBe(1);
  });

  it('clears an unusable session when no refresh token exists', async () => {
    let refreshCalls = 0;
    useAuthStore.setState({ refreshToken: null, accessToken: 'expired-access-token' });

    installAdapter(apiClient, () => ({ status: 401, data: { code: 'TOKEN_EXPIRED' } }));
    installAdapter(authRefreshClient, () => {
      refreshCalls += 1;
      return { status: 200, data: { accessToken: 'fresh-access-token' } };
    });

    await expect(apiClient.get('/history')).rejects.toMatchObject({ response: { status: 401 } });

    expect(refreshCalls).toBe(0);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('sends the current access token on authenticated requests', async () => {
    let received: string | undefined;

    installAdapter(apiClient, (config) => {
      received = authorizationOf(config);
      return { status: 200, data: {} };
    });

    await apiClient.get('/models/metrics');
    expect(received).toBe('Bearer expired-access-token');
  });
});
