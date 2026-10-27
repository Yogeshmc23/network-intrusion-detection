import axios from 'axios';
import { authApi } from '@/lib/api';
import { isSessionExpiredError } from '@/lib/apiErrors';
import { useAuthStore } from '@/stores/authStore';

/**
 * Restores a persisted session after a page reload.
 *
 * The stored tokens are never trusted blindly: `/auth/me` is called once, and the
 * API layer transparently refreshes an expired access token first. Only a
 * definitive authentication failure clears the session — a network hiccup keeps
 * the optimistic state so a flaky connection does not log the analyst out.
 */
async function restoreSession(): Promise<void> {
  const { accessToken, refreshToken, setInitialized } = useAuthStore.getState();

  if (!accessToken && !refreshToken) {
    setInitialized();
    return;
  }

  try {
    const { user } = await authApi.me();
    useAuthStore.getState().setUser(user);
  } catch (error) {
    if (isSessionExpiredError(error)) {
      // The API layer already cleared the session (refresh token rejected).
    } else if (axios.isAxiosError(error) && error.response?.status === 401) {
      // No refresh token available and the access token was rejected.
      useAuthStore.getState().logout();
    }
    // 5xx / network errors: keep the optimistic session; requests will retry.
  } finally {
    useAuthStore.getState().setInitialized();
  }
}

let bootstrapPromise: Promise<void> | null = null;

/** Runs the session restore exactly once per page load (safe under StrictMode). */
export function bootstrapSession(): Promise<void> {
  if (!bootstrapPromise) {
    bootstrapPromise = restoreSession();
  }
  return bootstrapPromise;
}

/** Test helper: allows the bootstrap to run again. */
export function resetSessionBootstrap(): void {
  bootstrapPromise = null;
}
