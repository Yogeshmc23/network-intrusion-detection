/**
 * Minimal, dependency-free JWT helpers.
 *
 * The frontend never trusts these claims for authorization (the backend always
 * verifies signatures). They are only used to avoid sending an access token we
 * already know has expired and to decide whether a stored session is worth
 * restoring after a page reload.
 */

export interface JwtPayload {
  exp?: number;
  iat?: number;
  [claim: string]: unknown;
}

/** Treat tokens as expired slightly early to avoid clock-skew races. */
export const DEFAULT_CLOCK_SKEW_SECONDS = 30;

function base64UrlDecode(segment: string): string {
  const normalised = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalised.padEnd(Math.ceil(normalised.length / 4) * 4, '=');
  return atob(padded);
}

export function decodeJwt(token?: string | null): JwtPayload | null {
  if (!token) return null;

  const segments = token.split('.');
  if (segments.length !== 3) return null;

  try {
    const payload: unknown = JSON.parse(base64UrlDecode(segments[1]));
    if (!payload || typeof payload !== 'object') return null;
    return payload as JwtPayload;
  } catch {
    return null;
  }
}

/**
 * Returns true when the token is missing, malformed or past its `exp` claim.
 * Unknown/opaque tokens are treated as expired so they are re-validated against
 * the backend instead of being trusted on the client.
 */
export function isTokenExpired(
  token?: string | null,
  clockSkewSeconds: number = DEFAULT_CLOCK_SKEW_SECONDS
): boolean {
  const payload = decodeJwt(token);
  if (!payload || typeof payload.exp !== 'number') return true;
  return payload.exp * 1000 <= Date.now() + clockSkewSeconds * 1000;
}
