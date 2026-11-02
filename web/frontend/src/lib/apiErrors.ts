import axios from 'axios';

/**
 * Thrown when the backend has definitively rejected the stored refresh token,
 * i.e. the session really is over (expired, revoked, user deleted, ...).
 *
 * Transient failures (network down, 5xx, 429) must NOT use this error type,
 * because they are not proof that the session is invalid.
 */
export class SessionExpiredError extends Error {
  constructor(message = 'Your session has expired. Please sign in again.') {
    super(message);
    this.name = 'SessionExpiredError';
  }
}

export function isSessionExpiredError(error: unknown): error is SessionExpiredError {
  return error instanceof SessionExpiredError;
}

/** True when the error represents an authentication/authorization failure. */
export function isAuthError(error: unknown): boolean {
  if (isSessionExpiredError(error)) return true;
  if (!axios.isAxiosError(error)) return false;
  const status = error.response?.status;
  return status === 401 || status === 403;
}

/**
 * Turns an unknown API error into a message that is safe to show in the UI.
 * Server-provided messages are used when available (they are already
 * user-facing), otherwise a generic fallback is returned.
 */
export function getApiErrorMessage(
  error: unknown,
  fallback = 'Something went wrong. Please try again.'
): string {
  if (isSessionExpiredError(error)) return error.message;

  if (axios.isAxiosError(error)) {
    if (!error.response) {
      return 'Cannot reach the CyberShield API. Check your connection and try again.';
    }

    const data = error.response.data as unknown;
    if (data && typeof data === 'object') {
      const payload = data as { message?: unknown; errors?: unknown };
      if (typeof payload.message === 'string' && payload.message.trim().length > 0) {
        return payload.message;
      }
      if (Array.isArray(payload.errors) && payload.errors.length > 0) {
        const first = payload.errors[0] as { message?: unknown };
        if (typeof first?.message === 'string') return first.message;
      }
    }

    if (error.response.status === 429) {
      return 'Too many authentication attempts. Please wait a minute and try again.';
    }

    return fallback;
  }

  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
