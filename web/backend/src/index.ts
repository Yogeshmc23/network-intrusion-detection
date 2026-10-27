import http from 'http';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import mongoose from 'mongoose';

import env from './config/env';
import { connectDB, disconnectDB } from './config/db';
import { initRedis, disconnectRedis, isRedisConnected } from './config/redis';
import logger, { morganStream } from './utils/logger';
import { initSocket } from './socket';
import { swaggerUi, swaggerSpec } from './utils/swagger';
import { errorHandler, AppError } from './middleware/errorHandler';
import { authLimiter, apiLimiter } from './middleware/rateLimiter';
import mlClient from './services/mlClient';

// Route imports
import authRouter from './routes/auth';
import predictionsRouter, { batchPredictionsRouter } from './routes/predictions';
import historyRouter from './routes/history';
import modelsRouter from './routes/models';
import liveRouter from './routes/live';

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO on the HTTP server
initSocket(server);

// ─── Core Security & Utility Middleware ────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: false, // Allows Swagger UI to load inline scripts & styles
    crossOriginEmbedderPolicy: false,
  })
);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, postman) or matching origins
      if (!origin || origin === env.CORS_ORIGIN || origin.includes('localhost') || origin.includes('127.0.0.1')) {
        callback(null, true);
      } else {
        callback(null, true); // Permissive in dev, can restrict in prod
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);

// HTTP Access Logging via Winston
app.use(
  morgan(env.isProd ? 'combined' : 'dev', {
    stream: morganStream,
    skip: (req) => req.url === '/api/health', // Don't spam logs with automated health checks
  })
);

// Body Parsing
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// ─── Swagger Documentation ────────────────────────────────────
app.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customSiteTitle: 'CyberShield IDS API Documentation',
    customCss: '.swagger-ui .topbar { display: none }',
  })
);

// Serve raw swagger JSON spec
app.get('/api-docs.json', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// ─── Health Check Endpoint ───────────────────────────────────
app.get('/api/health', async (_req: Request, res: Response) => {
  const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  const redisStatus = isRedisConnected() ? 'connected' : 'disconnected';
  const mlHealth = await mlClient.checkHealth();

  const isHealthy = mongoStatus === 'connected';

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'healthy' : 'degraded',
    service: 'ids-backend',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    dependencies: {
      mongodb: mongoStatus,
      redis: redisStatus,
      mlService: mlHealth.status,
    },
  });
});

// ─── Rate Limiting ───────────────────────────────────────────
app.use('/api/auth', authLimiter);
app.use('/api', apiLimiter);

// ─── API Routes ──────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/predict', predictionsRouter);
app.use('/api/predict-batch', batchPredictionsRouter);
app.use('/api/history', historyRouter);
app.use('/api/models', modelsRouter);
app.use('/api/live', liveRouter);

// ─── 404 Handler ─────────────────────────────────────────────
app.use((req: Request, _res: Response, next: NextFunction) => {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
});

// ─── Global Error Handler ─────────────────────────────────────
app.use(errorHandler);

// ─── Server Startup ──────────────────────────────────────────
async function bootstrap(): Promise<void> {
  try {
    logger.info('Initializing CyberShield IDS Backend...');

    // 1. Connect to MongoDB
    await connectDB();

    // 2. Connect to Redis (graceful degradation if offline)
    await initRedis();

    // 3. Start HTTP + WebSocket Server
    server.listen(env.PORT, () => {
      logger.info(`=======================================================`);
      logger.info(` CyberShield IDS Backend is running!`);
      logger.info(` Port:        http://localhost:${env.PORT}`);
      logger.info(` Environment: ${env.NODE_ENV}`);
      logger.info(` Swagger Docs:http://localhost:${env.PORT}/api-docs`);
      logger.info(` Socket.IO:   /live namespace active`);
      logger.info(` ML Service:  ${env.ML_SERVICE_URL}`);
      logger.info(`=======================================================`);
    });
  } catch (err: any) {
    logger.error('Failed to bootstrap backend application:', err);
    process.exit(1);
  }
}

// ─── Graceful Shutdown ───────────────────────────────────────
async function gracefulShutdown(signal: string): Promise<void> {
  logger.info(`${signal} signal received: closing HTTP server and connections...`);

  server.close(async () => {
    logger.info('HTTP and WebSocket server closed');
    try {
      await disconnectDB();
      await disconnectRedis();
      logger.info('All connections closed cleanly. Exiting.');
      process.exit(0);
    } catch (err) {
      logger.error('Error during graceful shutdown:', err);
      process.exit(1);
    }
  });

  // Force exit after 10 seconds if graceful shutdown hangs
  setTimeout(() => {
    logger.error('Graceful shutdown timed out, forcing termination.');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason: any) => {
  logger.error('Unhandled Rejection at:', reason);
});

process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception thrown:', error);
  process.exit(1);
});

// Run application
bootstrap();

export default app;
