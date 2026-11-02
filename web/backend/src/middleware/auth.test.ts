import { describe, expect, it, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import type { Request, Response } from 'express';
import env from '../config/env';
import {
  authenticate,
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  type TokenPayload,
} from './auth';
import { AppError } from './errorHandler';

const payload: TokenPayload = {
  id: '507f1f77bcf86cd799439011',
  email: 'analyst@cybershield.io',
  role: 'analyst',
  name: 'Security Analyst',
};

function makeRequest(authorization?: string): Request {
  return { headers: authorization ? { authorization } : {} } as Request;
}

async function runAuthenticate(req: Request): Promise<AppError | undefined> {
  const next = vi.fn();
  await authenticate(req, {} as Response, next);
  return next.mock.calls[0]?.[0] as AppError | undefined;
}

describe('JWT token types', () => {
  it('issues access tokens that verify as access tokens', () => {
    const token = generateAccessToken(payload);
    expect(verifyAccessToken(token)).toMatchObject(payload);
  });

  it('issues refresh tokens that verify as refresh tokens', () => {
    const token = generateRefreshToken(payload);
    expect(verifyRefreshToken(token)).toMatchObject(payload);
  });

  it('refuses to verify a refresh token as an access token', () => {
    expect(() => verifyAccessToken(generateRefreshToken(payload))).toThrow();
  });

  it('refuses to verify an access token as a refresh token', () => {
    // This is what stops an access token from being replayed on /auth/refresh,
    // even if JWT_SECRET and JWT_REFRESH_SECRET are configured identically.
    expect(() => verifyRefreshToken(generateAccessToken(payload))).toThrow();
  });
});

describe('authenticate middleware', () => {
  it('accepts a valid access token and exposes the user', async () => {
    const req = makeRequest(`Bearer ${generateAccessToken(payload)}`);
    const next = vi.fn();

    await authenticate(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith(); // no error
    expect(req.user).toMatchObject(payload);
  });

  it('rejects a request with no Authorization header', async () => {
    const error = await runAuthenticate(makeRequest());
    expect(error).toBeInstanceOf(AppError);
    expect(error?.statusCode).toBe(401);
    expect(error?.code).toBe('AUTH_REQUIRED');
  });

  it('rejects a malformed Authorization header', async () => {
    const error = await runAuthenticate(makeRequest('Token abc'));
    expect(error?.statusCode).toBe(401);
    expect(error?.code).toBe('AUTH_REQUIRED');
  });

  it('rejects a refresh token used as an access token', async () => {
    const error = await runAuthenticate(makeRequest(`Bearer ${generateRefreshToken(payload)}`));
    expect(error?.statusCode).toBe(401);
    expect(error?.code).toBe('TOKEN_INVALID');
  });

  it('reports expired access tokens distinctly', async () => {
    const expired = jwt.sign({ ...payload, typ: 'access' }, env.JWT_SECRET, { expiresIn: -10 });
    const error = await runAuthenticate(makeRequest(`Bearer ${expired}`));

    expect(error?.statusCode).toBe(401);
    expect(error?.code).toBe('TOKEN_EXPIRED');
  });

  it('rejects a token signed with the wrong secret', async () => {
    const forged = jwt.sign({ ...payload, typ: 'access' }, 'not-the-real-secret', { expiresIn: '5m' });
    const error = await runAuthenticate(makeRequest(`Bearer ${forged}`));

    expect(error?.statusCode).toBe(401);
    expect(error?.code).toBe('TOKEN_INVALID');
  });
});
