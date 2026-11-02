import { create } from 'zustand';
import { isTokenExpired } from '@/lib/tokens';

export interface User {
  id: string;
  name: string;
  email: string;
  role?: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  /** False until the persisted session has been validated against the backend. */
  isInitialized: boolean;
  isLoading: boolean;
  setAuth: (user: User, accessToken: string, refreshToken?: string) => void;
  updateTokens: (accessToken: string, refreshToken?: string) => void;
  setUser: (user: User) => void;
  setInitialized: (isInitialized?: boolean) => void;
  logout: () => void;
  setLoading: (isLoading: boolean) => void;
}

// Keep the original storage keys so existing sessions keep working.
const STORAGE_KEY_ACCESS = 'cybershield_access_token';
const STORAGE_KEY_REFRESH = 'cybershield_refresh_token';
const STORAGE_KEY_USER = 'cybershield_user';

export const AUTH_STORAGE_KEYS = {
  accessToken: STORAGE_KEY_ACCESS,
  refreshToken: STORAGE_KEY_REFRESH,
  user: STORAGE_KEY_USER,
} as const;

/**
 * localStorage access is wrapped because it throws in private/incognito modes
 * and during SSR, and a storage failure must never crash the auth flow.
 */
function getStorage(): Storage | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

function readItem(key: string): string | null {
  try {
    return getStorage()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function writeItem(key: string, value: string): void {
  try {
    getStorage()?.setItem(key, value);
  } catch {
    /* storage unavailable — in-memory session still works for this tab */
  }
}

function removeItem(key: string): void {
  try {
    getStorage()?.removeItem(key);
  } catch {
    /* ignore */
  }
}

export interface StoredSession {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
}

export function readStoredSession(): StoredSession {
  const accessToken = readItem(STORAGE_KEY_ACCESS);
  const refreshToken = readItem(STORAGE_KEY_REFRESH);

  let user: User | null = null;
  const rawUser = readItem(STORAGE_KEY_USER);
  if (rawUser) {
    try {
      const parsed = JSON.parse(rawUser) as User;
      if (parsed && typeof parsed === 'object') user = parsed;
    } catch {
      user = null;
    }
  }

  return { user, accessToken, refreshToken };
}

export function clearStoredSession(): void {
  removeItem(STORAGE_KEY_ACCESS);
  removeItem(STORAGE_KEY_REFRESH);
  removeItem(STORAGE_KEY_USER);
}

function persistTokens(accessToken: string, refreshToken?: string): void {
  writeItem(STORAGE_KEY_ACCESS, accessToken);
  if (refreshToken) writeItem(STORAGE_KEY_REFRESH, refreshToken);
}

export function persistUser(user: User): void {
  writeItem(STORAGE_KEY_USER, JSON.stringify(user));
}

function createInitialState(): Pick<
  AuthState,
  'user' | 'accessToken' | 'refreshToken' | 'isAuthenticated' | 'isInitialized' | 'isLoading'
> {
  const stored = readStoredSession();

  // A stored access token is only usable while it is still valid. Refresh tokens
  // are opaque here — their validity is confirmed by /auth/refresh on first use.
  const accessTokenIsUsable = Boolean(stored.accessToken) && !isTokenExpired(stored.accessToken);
  const hasRefreshToken = Boolean(stored.refreshToken);
  const canRestoreSession = accessTokenIsUsable || hasRefreshToken;

  if (!canRestoreSession) {
    // Genuinely dead session (e.g. expired access token with no refresh token):
    // drop it instead of showing a logged-in shell that 401s on every call.
    clearStoredSession();
    return {
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isInitialized: false,
      isLoading: false,
    };
  }

  // Don't send a stale access token; the refresh token is enough to restore.
  if (!accessTokenIsUsable) removeItem(STORAGE_KEY_ACCESS);

  return {
    user: stored.user,
    accessToken: accessTokenIsUsable ? stored.accessToken : null,
    refreshToken: stored.refreshToken,
    isAuthenticated: true,
    isInitialized: false,
    isLoading: false,
  };
}

export const useAuthStore = create<AuthState>((set) => ({
  ...createInitialState(),

  setAuth: (user: User, accessToken: string, refreshToken?: string) => {
    persistTokens(accessToken, refreshToken);
    persistUser(user);

    set((state) => ({
      user,
      accessToken,
      refreshToken: refreshToken ?? state.refreshToken,
      isAuthenticated: true,
      isInitialized: true,
    }));
  },

  updateTokens: (accessToken: string, refreshToken?: string) => {
    const nextRefreshToken = refreshToken ?? useAuthStore.getState().refreshToken;
    // Persist the effective refresh token so a rotation survives a reload even
    // when the backend only returns a new access token.
    persistTokens(accessToken, nextRefreshToken ?? undefined);

    set({
      accessToken,
      refreshToken: nextRefreshToken,
      isAuthenticated: true,
    });
  },

  setUser: (user: User) => {
    persistUser(user);
    set({ user, isAuthenticated: true });
  },

  setInitialized: (isInitialized = true) => set({ isInitialized }),

  logout: () => {
    clearStoredSession();
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isInitialized: true,
    });
  },

  setLoading: (isLoading: boolean) => set({ isLoading }),
}));
