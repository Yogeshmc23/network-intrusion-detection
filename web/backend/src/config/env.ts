import dotenv from 'dotenv';
import path from 'path';

// Load .env from current directory or parent directory if present
dotenv.config();

export const env = {
  PORT: parseInt(process.env.PORT || '5000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  MONGO_URI: process.env.MONGO_URI || 'mongodb://localhost:27017/ids',
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  JWT_SECRET: process.env.JWT_SECRET || 'cybershield-dev-secret-change-in-production',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'cybershield-refresh-secret-change-in-production',
  JWT_ACCESS_EXPIRES_IN: '15m',
  JWT_REFRESH_EXPIRES_IN: '7d',
  ML_SERVICE_URL: (process.env.ML_SERVICE_URL || 'http://localhost:8000').replace(/\/$/, ''),
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:3000',
  isDev: (process.env.NODE_ENV || 'development') === 'development',
  isProd: process.env.NODE_ENV === 'production',
} as const;

export default env;
