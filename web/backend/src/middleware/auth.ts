import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import env from '../config/env';
import { AppError } from './errorHandler';

export interface TokenPayload {
  id: string;
  email: string;
  role: 'admin' | 'analyst';
  name: string;
}

export type TokenType = 'access' | 'refresh';

interface JwtClaims extends TokenPayload {
  typ?: TokenType;
}

// Extend Express Request object to hold authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

export function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign({ ...payload, typ: 'access' as const }, env.JWT_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
  });
}

export function generateRefreshToken(payload: TokenPayload): string {
  return jwt.sign({ ...payload, typ: 'refresh' as const }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN,
  });
}

/**
 * Verifies the signature AND the token type.
 *
 * The `typ` claim prevents an access token from being replayed against
 * /auth/refresh (and vice versa), which matters when the access and refresh
 * secrets happen to be configured with the same value.
 */
function verifyToken(token: string, secret: string, expectedType: TokenType): TokenPayload {
  const decoded = jwt.verify(token, secret);

  if (typeof decoded === 'string' || decoded.typ !== expectedType) {
    throw new jwt.JsonWebTokenError(`Expected a ${expectedType} token`);
  }

  const { id, email, role, name } = decoded as JwtClaims;
  return { id, email, role, name };
}

export function verifyAccessToken(token: string): TokenPayload {
  return verifyToken(token, env.JWT_SECRET, 'access');
}

export function verifyRefreshToken(token: string): TokenPayload {
  return verifyToken(token, env.JWT_REFRESH_SECRET, 'refresh');
}

export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(
      new AppError('Authentication token missing or invalid format', 401, 'AUTH_REQUIRED')
    );
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    return next(
      new AppError('Authentication token missing or invalid format', 401, 'AUTH_REQUIRED')
    );
  }

  try {
    const decoded = verifyAccessToken(token);
    req.user = decoded;
    next();
  } catch (error: any) {
    if (error?.name === 'TokenExpiredError') {
      return next(new AppError('Authentication token has expired', 401, 'TOKEN_EXPIRED'));
    }
    return next(new AppError('Invalid authentication token', 401, 'TOKEN_INVALID'));
  }
}

export function requireRole(...allowedRoles: Array<'admin' | 'analyst'>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401, 'AUTH_REQUIRED'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new AppError(
          `Forbidden: Access restricted to roles [${allowedRoles.join(', ')}]. Current role: ${req.user.role}`,
          403,
          'FORBIDDEN'
        )
      );
    }

    next();
  };
}

export default authenticate;
