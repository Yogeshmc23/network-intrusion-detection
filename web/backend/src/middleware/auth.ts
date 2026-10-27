import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import env from '../config/env';
import { AppError } from './errorHandler';
import User from '../models/User';

export interface TokenPayload {
  id: string;
  email: string;
  role: 'admin' | 'analyst';
  name: string;
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
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
  });
}

export function generateRefreshToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN,
  });
}

export function verifyRefreshToken(token: string): TokenPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as TokenPayload;
}

export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError('Authentication token missing or invalid format', 401));
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as TokenPayload;
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      name: decoded.name,
    };
    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      return next(new AppError('Authentication token has expired', 401));
    }
    return next(new AppError('Invalid authentication token', 401));
  }
}

export function requireRole(...allowedRoles: Array<'admin' | 'analyst'>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new AppError(
          `Forbidden: Access restricted to roles [${allowedRoles.join(', ')}]. Current role: ${req.user.role}`,
          403
        )
      );
    }

    next();
  };
}

export default authenticate;
