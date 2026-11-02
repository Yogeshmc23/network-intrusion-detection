import { beforeEach, describe, expect, it, vi } from 'vitest';

const ACCESS_KEY = 'cybershield_access_token';
const REFRESH_KEY = 'cybershield_refresh_token';
const USER_KEY = 'cybershield_user';

function encodeSegment(value: unknown): string {
  return btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Builds an unsigned JWT-shaped string with the given lifetime offset. */
function makeToken(expiresInSeconds: number): string {
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  return `${encodeSegment({ alg: 'HS256', typ: 'JWT' })}.${encodeSegment({
    sub: 'user-1',
    exp,
  })}.signature`;
}

async function loadFreshStore() {
  vi.resetModules();
  return import('@/stores/authStore');
}

describe('authStore persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('restores a valid persisted session on load', async () => {
    const accessToken = makeToken(60 * 10);
    localStorage.setItem(ACCESS_KEY, accessToken);
    localStorage.setItem(REFRESH_KEY, 'refresh-token-1');
    localStorage.setItem(USER_KEY, JSON.stringify({ id: 'user-1', name: 'Analyst', email: 'a@b.c' }));

    const { useAuthStore } = await loadFreshStore();
    const state = useAuthStore.getState();

    expect(state.isAuthenticated).toBe(true);
    expect(state.accessToken).toBe(accessToken);
    expect(state.refreshToken).toBe('refresh-token-1');
    expect(state.user?.email).toBe('a@b.c');
    // Not validated against the backend yet.
    expect(state.isInitialized).toBe(false);
  });

  it('keeps the session when only the access token expired but a refresh token exists', async () => {
    localStorage.setItem(ACCESS_KEY, makeToken(-60));
    localStorage.setItem(REFRESH_KEY, 'refresh-token-1');

    const { useAuthStore } = await loadFreshStore();
    const state = useAuthStore.getState();

    expect(state.isAuthenticated).toBe(true);
    expect(state.refreshToken).toBe('refresh-token-1');
    // The stale access token is dropped so it is never sent to the API.
    expect(state.accessToken).toBeNull();
    expect(localStorage.getItem(ACCESS_KEY)).toBeNull();
  });

  it('drops an unusable session (expired access token, no refresh token)', async () => {
    localStorage.setItem(ACCESS_KEY, makeToken(-60));
    localStorage.setItem(USER_KEY, JSON.stringify({ id: 'user-1', name: 'Analyst', email: 'a@b.c' }));

    const { useAuthStore } = await loadFreshStore();
    const state = useAuthStore.getState();

    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(state.accessToken).toBeNull();
    expect(localStorage.getItem(ACCESS_KEY)).toBeNull();
    expect(localStorage.getItem(USER_KEY)).toBeNull();
  });

  it('persists tokens and the user on setAuth, and clears everything on logout', async () => {
    const { useAuthStore } = await loadFreshStore();
    const user = { id: 'user-1', name: 'Analyst', email: 'a@b.c' };

    useAuthStore.getState().setAuth(user, 'access-1', 'refresh-1');

    expect(localStorage.getItem(ACCESS_KEY)).toBe('access-1');
    expect(localStorage.getItem(REFRESH_KEY)).toBe('refresh-1');
    expect(JSON.parse(localStorage.getItem(USER_KEY) as string)).toEqual(user);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().isInitialized).toBe(true);

    useAuthStore.getState().updateTokens('access-2', 'refresh-2');
    expect(useAuthStore.getState().accessToken).toBe('access-2');
    expect(localStorage.getItem(REFRESH_KEY)).toBe('refresh-2');

    useAuthStore.getState().logout();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().user).toBeNull();
    expect(localStorage.getItem(ACCESS_KEY)).toBeNull();
    expect(localStorage.getItem(REFRESH_KEY)).toBeNull();
    expect(localStorage.getItem(USER_KEY)).toBeNull();
  });

  it('keeps the existing refresh token when updateTokens receives only an access token', async () => {
    const { useAuthStore } = await loadFreshStore();
    useAuthStore.setState({ refreshToken: 'refresh-1', isAuthenticated: true });

    useAuthStore.getState().updateTokens('access-2');

    expect(useAuthStore.getState().refreshToken).toBe('refresh-1');
    expect(localStorage.getItem(REFRESH_KEY)).toBe('refresh-1');
  });
});
