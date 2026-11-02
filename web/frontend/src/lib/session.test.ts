import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AxiosError } from 'axios';
import type { AxiosAdapter, AxiosRequestConfig, AxiosResponse } from 'axios';
import { apiClient, authRefreshClient } from '@/lib/api';
import { bootstrapSession, resetSessionBootstrap } from '@/lib/session';
import { useAuthStore } from '@/stores/authStore';

interface StubResult {
  status: number;
  data?: unknown;
}

type StubHandler = (config: AxiosRequestConfig) => StubResult;

function toResponse(config: AxiosRequestConfig, result: StubResult): AxiosResponse {
  return {
    data: result.data ?? {},
    status: result.status,
    statusText: String(result.status),
    headers: {},
    config: config as AxiosResponse['config'],
  };
}

function installAdapter(client: typeof apiClient, handler: StubHandler): void {
  client.defaults.adapter = (async (config: AxiosRequestConfig) => {
    const result = handler(config);
    const response = toResponse(config, result);
    if (result.status >= 200 && result.status < 300) return response;
    throw new AxiosError(
      `Request failed with status code ${result.status}`,
      'ERR_BAD_RESPONSE',
      config as never,
      undefined,
      response
    );
  }) as AxiosAdapter;
}

const originalApiAdapter = apiClient.defaults.adapter;
const originalRefreshAdapter = authRefreshClient.defaults.adapter;

const restoredUser = { id: 'user-1', name: 'Analyst', email: 'analyst@cybershield.io' };

describe('bootstrapSession', () => {
  beforeEach(() => {
    resetSessionBootstrap();
    localStorage.clear();
    useAuthStore.setState({
      user: null,
      accessToken: null,
      refreshToken: 'refresh-token-1',
      isAuthenticated: true,
      isInitialized: false,
      isLoading: false,
    });
  });

  afterEach(() => {
    apiClient.defaults.adapter = originalApiAdapter;
    authRefreshClient.defaults.adapter = originalRefreshAdapter;
  });

  it('restores the user and marks the store initialized after a reload', async () => {
    installAdapter(apiClient, (config) => {
      const authorization = (config.headers as Record<string, string> | undefined)?.Authorization;
      if (config.url === '/auth/me' && authorization === 'Bearer fresh-access-token') {
        return { status: 200, data: { success: true, user: restoredUser } };
      }
      return { status: 401, data: { success: false, code: 'TOKEN_EXPIRED' } };
    });
    installAdapter(authRefreshClient, () => ({
      status: 200,
      data: { accessToken: 'fresh-access-token', refreshToken: 'refresh-token-2' },
    }));

    await bootstrapSession();

    const state = useAuthStore.getState();
    expect(state.isInitialized).toBe(true);
    expect(state.isAuthenticated).toBe(true);
    expect(state.accessToken).toBe('fresh-access-token');
    expect(state.refreshToken).toBe('refresh-token-2');
    expect(state.user).toEqual(restoredUser);
  });

  it('clears a genuinely invalid session instead of leaving a half-authenticated shell', async () => {
    installAdapter(apiClient, () => ({ status: 401, data: { code: 'TOKEN_EXPIRED' } }));
    installAdapter(authRefreshClient, () => ({
      status: 401,
      data: { success: false, code: 'REFRESH_TOKEN_EXPIRED' },
    }));

    await bootstrapSession();

    const state = useAuthStore.getState();
    expect(state.isInitialized).toBe(true);
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
  });

  it('does not touch the network when no session is stored', async () => {
    let calls = 0;
    installAdapter(apiClient, () => {
      calls += 1;
      return { status: 200, data: {} };
    });
    useAuthStore.setState({ accessToken: null, refreshToken: null, isAuthenticated: false });

    await bootstrapSession();

    expect(calls).toBe(0);
    expect(useAuthStore.getState().isInitialized).toBe(true);
  });

  it('runs the restore only once per page load', async () => {
    let meCalls = 0;
    installAdapter(apiClient, () => {
      meCalls += 1;
      return { status: 401, data: { code: 'TOKEN_EXPIRED' } };
    });
    installAdapter(authRefreshClient, () => ({ status: 401, data: {} }));

    await Promise.all([bootstrapSession(), bootstrapSession()]);
    await bootstrapSession();

    expect(meCalls).toBe(1);
  });
});
