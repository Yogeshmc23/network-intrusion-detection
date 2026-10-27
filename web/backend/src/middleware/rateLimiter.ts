import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import redisClient from '../config/redis';

// 100 requests per 1 minute for auth routes
export const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  passOnStoreError: true,
  message: {
    success: false,
    message: 'Too many authentication attempts. Please try again after 1 minute.',
  },
  store: new RedisStore({
    // @ts-expect-error - ioredis call signature compatibility
    sendCommand: (...args: string[]) => redisClient.call(...args),
  }),
});

// 300 requests per 1 minute for general API routes
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  passOnStoreError: true,
  message: {
    success: false,
    message: 'API rate limit exceeded. Please slow down your requests.',
  },
  store: new RedisStore({
    // @ts-expect-error - ioredis call signature compatibility
    sendCommand: (...args: string[]) => redisClient.call(...args),
  }),
});

export default {
  authLimiter,
  apiLimiter,
};
