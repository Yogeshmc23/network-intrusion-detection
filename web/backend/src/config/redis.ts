import Redis from 'ioredis';
import env from './env';
import logger from '../utils/logger';

let isConnected = false;

export const redisClient = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 1,
  retryStrategy(times) {
    if (times > 5) {
      logger.warn('Redis reconnection limit reached. Operating in disconnected fallback mode.');
      return null; // Stop retrying after 5 attempts
    }
    const delay = Math.min(times * 1000, 3000);
    return delay;
  },
  lazyConnect: true,
  enableOfflineQueue: false,
});

redisClient.on('connect', () => {
  isConnected = true;
  logger.info(`Redis connected successfully to: ${env.REDIS_URL}`);
});

redisClient.on('ready', () => {
  isConnected = true;
  logger.info('Redis client ready');
});

redisClient.on('error', (err) => {
  isConnected = false;
  logger.warn(`Redis connection error: ${err.message}`);
});

redisClient.on('close', () => {
  isConnected = false;
  logger.warn('Redis connection closed');
});

export async function initRedis(): Promise<void> {
  try {
    await redisClient.connect();
  } catch (error: any) {
    logger.warn(`Redis initial connection failed (${error?.message || error}). Fallback cache will be used.`);
  }
}

export function isRedisConnected(): boolean {
  return isConnected && redisClient.status === 'ready';
}

export async function getCache(key: string): Promise<string | null> {
  if (!isRedisConnected()) {
    return null;
  }
  try {
    return await redisClient.get(key);
  } catch (err: any) {
    logger.warn(`Redis getCache error for key ${key}: ${err?.message || err}`);
    return null;
  }
}

export async function setCache(key: string, value: string, ttlSeconds: number): Promise<void> {
  if (!isRedisConnected()) {
    return;
  }
  try {
    await redisClient.set(key, value, 'EX', ttlSeconds);
  } catch (err: any) {
    logger.warn(`Redis setCache error for key ${key}: ${err?.message || err}`);
  }
}

export async function disconnectRedis(): Promise<void> {
  if (isRedisConnected()) {
    await redisClient.quit();
    logger.info('Redis disconnected cleanly');
  }
}

export default redisClient;
