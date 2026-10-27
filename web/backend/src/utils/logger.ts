import winston from 'winston';
import env from '../config/env';

const { combine, timestamp, printf, colorize, json, errors } = winston.format;

// Custom console log format for human-friendly output
const consoleFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  const errorStack = stack ? `\n${stack}` : '';
  return `[${timestamp}] [${level}]: ${message}${metaStr}${errorStack}`;
});

export const logger = winston.createLogger({
  level: env.isDev ? 'debug' : 'info',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }),
    env.isProd ? json() : combine(colorize(), consoleFormat)
  ),
  defaultMeta: { service: 'ids-backend' },
  transports: [
    new winston.transports.Console()
  ]
});

// Stream for Morgan HTTP logger integration
export const morganStream = {
  write: (message: string) => {
    logger.info(message.trim());
  }
};

export default logger;
