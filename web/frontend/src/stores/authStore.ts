import { create } from 'zustand';

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
  isLoading: boolean;
  setAuth: (user: User, accessToken: string, refreshToken?: string) => void;
  updateTokens: (accessToken: string, refreshToken?: string) => void;
  logout: () => void;
  setLoading: (isLoading: boolean) => void;
}

const STORAGE_KEY_ACCESS = 'cybershield_access_token';
const STORAGE_KEY_REFRESH = 'cybershield_refresh_token';
const STORAGE_KEY_USER = 'cybershield_user';

export const useAuthStore = create<AuthState>((set) => {
  // Initialize from localStorage if present
  const initialAccessToken = localStorage.getItem(STORAGE_KEY_ACCESS);
  const initialRefreshToken = localStorage.getItem(STORAGE_KEY_REFRESH);
  let initialUser: User | null = null;
  try {
    const rawUser = localStorage.getItem(STORAGE_KEY_USER);
    if (rawUser) initialUser = JSON.parse(rawUser);
  } catch (e) {
    initialUser = null;
  }

  return {
    user: initialUser,
    accessToken: initialAccessToken,
    refreshToken: initialRefreshToken,
    isAuthenticated: !!initialAccessToken,
    isLoading: false,

    setAuth: (user: User, accessToken: string, refreshToken?: string) => {
      localStorage.setItem(STORAGE_KEY_ACCESS, accessToken);
      if (refreshToken) {
        localStorage.setItem(STORAGE_KEY_REFRESH, refreshToken);
      }
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));

      set({
        user,
        accessToken,
        refreshToken: refreshToken || null,
        isAuthenticated: true,
      });
    },

    updateTokens: (accessToken: string, refreshToken?: string) => {
      localStorage.setItem(STORAGE_KEY_ACCESS, accessToken);
      if (refreshToken) {
        localStorage.setItem(STORAGE_KEY_REFRESH, refreshToken);
      }
      set((state) => ({
        accessToken,
        refreshToken: refreshToken || state.refreshToken,
      }));
    },

    logout: () => {
      localStorage.removeItem(STORAGE_KEY_ACCESS);
      localStorage.removeItem(STORAGE_KEY_REFRESH);
      localStorage.removeItem(STORAGE_KEY_USER);

      set({
        user: null,
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
      });
    },

    setLoading: (isLoading: boolean) => set({ isLoading }),
  };
});
