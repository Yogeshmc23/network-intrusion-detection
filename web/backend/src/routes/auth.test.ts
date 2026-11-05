import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';

vi.mock('../models/User', () => ({
  default: {
    findOne: vi.fn(),
    findById: vi.fn(),
  },
}));

vi.mock('../models/RevokedRefreshToken', () => ({
  default: { exists: vi.fn(), updateOne: vi.fn() },
}));

import User from '../models/User';
import RevokedRefreshToken from '../models/RevokedRefreshToken';
import env from '../config/env';
import { authRouter } from './auth';
import { errorHandler } from '../middleware/errorHandler';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  type TokenPayload,
} from '../middleware/auth';

const payload: TokenPayload = {
  id: '507f1f77bcf86cd799439011',
  email: 'analyst@cybershield.io',
  role: 'analyst',
  name: 'Security Analyst',
};

const findById = vi.mocked(User.findById);

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
app.use(errorHandler);

function userDocument() {
  return {
    _id: { toString: () => payload.id },
    email: payload.email,
    role: payload.role,
    name: payload.name,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe('POST /api/auth/refresh', () => {
  beforeEach(() => {
    findById.mockReset();
    vi.mocked(RevokedRefreshToken.exists).mockReset().mockResolvedValue(null);
    vi.mocked(RevokedRefreshToken.updateOne).mockReset().mockResolvedValue({ upsertedCount: 1 } as never);
  });

  it('exchanges a valid refresh token for a new access/refresh pair', async () => {
    findById.mockResolvedValue(userDocument() as never);

    const response = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: generateRefreshToken(payload) });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(typeof response.body.accessToken).toBe('string');
    expect(typeof response.body.refreshToken).toBe('string');
    expect(verifyAccessToken(response.body.accessToken)).toMatchObject({ id: payload.id });
    expect(verifyRefreshToken(response.body.refreshToken)).toMatchObject({ id: payload.id });
  });

  it('rejects an access token replayed against the refresh endpoint', async () => {
    const response = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: generateAccessToken(payload) });

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.code).toBe('REFRESH_TOKEN_INVALID');
    expect(findById).not.toHaveBeenCalled();
  });

  it('rejects replay of a refresh token that was already rotated', async () => {
    const refreshToken = generateRefreshToken(payload);
    findById.mockResolvedValue(userDocument() as never);

    const first = await request(app).post('/api/auth/refresh').send({ refreshToken });
    expect(first.status).toBe(200);
    expect(RevokedRefreshToken.updateOne).toHaveBeenCalledOnce();

    vi.mocked(RevokedRefreshToken.exists).mockResolvedValue({ _id: 'revoked' } as never);
    const replay = await request(app).post('/api/auth/refresh').send({ refreshToken });
    expect(replay.status).toBe(401);
    expect(replay.body.code).toBe('REFRESH_TOKEN_REVOKED');
  });

  it('rejects a malformed refresh token', async () => {
    const response = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: 'not-a-jwt' });

    expect(response.status).toBe(401);
    expect(response.body.code).toBe('REFRESH_TOKEN_INVALID');
  });

  it('reports an expired refresh token distinctly', async () => {
    const expired = jwt.sign({ ...payload, typ: 'refresh' }, env.JWT_REFRESH_SECRET, {
      expiresIn: -10,
    });

    const response = await request(app).post('/api/auth/refresh').send({ refreshToken: expired });

    expect(response.status).toBe(401);
    expect(response.body.code).toBe('REFRESH_TOKEN_EXPIRED');
  });

  it('rejects a refresh token whose user no longer exists', async () => {
    findById.mockResolvedValue(null);

    const response = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: generateRefreshToken(payload) });

    expect(response.status).toBe(401);
    expect(response.body.code).toBe('SESSION_REVOKED');
  });

  it('validates the request body', async () => {
    const response = await request(app).post('/api/auth/refresh').send({});

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });
});

describe('POST /api/auth/logout', () => {
  beforeEach(() => {
    vi.mocked(RevokedRefreshToken.updateOne).mockReset().mockResolvedValue({ upsertedCount: 1 } as never);
  });

  it('revokes a valid refresh token and returns an idempotent success response', async () => {
    const refreshToken = generateRefreshToken(payload);
    const response = await request(app).post('/api/auth/logout').send({ refreshToken });
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(RevokedRefreshToken.updateOne).toHaveBeenCalledOnce();
  });

  it('accepts logout for an expired token without attempting to persist it', async () => {
    const expiredToken = jwt.sign({ ...payload, typ: 'refresh' }, env.JWT_REFRESH_SECRET, { expiresIn: -10 });
    const response = await request(app).post('/api/auth/logout').send({ refreshToken: expiredToken });
    expect(response.status).toBe(200);
    expect(RevokedRefreshToken.updateOne).not.toHaveBeenCalled();
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    findById.mockReset();
  });

  it('returns a 401 with a stable code for bad credentials', async () => {
    vi.mocked(User.findOne).mockResolvedValue(null);

    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@cybershield.io', password: 'wrong-password' });

    expect(response.status).toBe(401);
    expect(response.body.code).toBe('INVALID_CREDENTIALS');
    expect(response.body.accessToken).toBeUndefined();
  });
});
