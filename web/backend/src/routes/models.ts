import { Router, Request, Response, NextFunction } from 'express';
import mlClient from '../services/mlClient';
import { getCache, setCache } from '../config/redis';
import logger from '../utils/logger';

export const modelsRouter = Router();

const CACHE_TTL_SECONDS = 300; // 5 minutes TTL

// Helper to handle proxying with Redis caching
async function getCachedOrFetch<T>(
  cacheKey: string,
  fetcher: () => Promise<T>
): Promise<{ data: T; isCached: boolean }> {
  // Check Redis cache first
  try {
    const cached = await getCache(cacheKey);
    if (cached) {
      return { data: JSON.parse(cached), isCached: true };
    }
  } catch (err: any) {
    logger.warn(`Redis read error for key ${cacheKey}: ${err.message}`);
  }

  // Do not mask a failed ML-service response with stale or fabricated metrics.
  const data = await fetcher();
  setCache(cacheKey, JSON.stringify(data), CACHE_TTL_SECONDS).catch((err) => {
    logger.warn(`Redis write error for key ${cacheKey}: ${err.message}`);
  });
  return { data, isCached: false };
}

/**
 * @openapi
 * /api/models/metrics:
 *   get:
 *     summary: Get trained IDS model evaluation metrics (accuracy, recall, precision, F1, ROC-AUC)
 *     tags: [Models]
 *     responses:
 *       200:
 *         description: Model evaluation metrics
 *         headers:
 *           X-Cache:
 *             schema: { type: string, enum: [HIT, MISS] }
 *             description: Indicates whether the response came from Redis cache
 *       502:
 *         description: ML Service unavailable
 */
modelsRouter.get('/metrics', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const { data, isCached } = await getCachedOrFetch(
      'models:metrics',
      () => mlClient.getModelMetrics()
    );

    res.setHeader('X-Cache', isCached ? 'HIT' : 'MISS');
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /api/models/comparison:
 *   get:
 *     summary: Get performance comparison data across multiple IDS algorithms
 *     tags: [Models]
 *     responses:
 *       200:
 *         description: Model comparison table data
 *         headers:
 *           X-Cache:
 *             schema: { type: string, enum: [HIT, MISS] }
 *       502:
 *         description: ML Service unavailable
 */
modelsRouter.get('/comparison', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const { data, isCached } = await getCachedOrFetch(
      'models:comparison',
      () => mlClient.getModelComparison()
    );

    res.setHeader('X-Cache', isCached ? 'HIT' : 'MISS');
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /api/models/metadata:
 *   get:
 *     summary: Get model feature schema and categorical options
 *     tags: [Models]
 *     responses:
 *       200:
 *         description: Model schema metadata
 *         headers:
 *           X-Cache:
 *             schema: { type: string, enum: [HIT, MISS] }
 *       502:
 *         description: ML Service unavailable
 */
modelsRouter.get('/metadata', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const { data, isCached } = await getCachedOrFetch(
      'models:metadata',
      () => mlClient.getModelMetadata()
    );

    res.setHeader('X-Cache', isCached ? 'HIT' : 'MISS');
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /api/models/feature-importance:
 *   get:
 *     summary: Get top feature importance scores for NSL-KDD features
 *     tags: [Models]
 *     responses:
 *       200:
 *         description: Feature importance rankings
 *         headers:
 *           X-Cache:
 *             schema: { type: string, enum: [HIT, MISS] }
 *       502:
 *         description: ML Service unavailable
 */
modelsRouter.get('/feature-importance', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const { data, isCached } = await getCachedOrFetch(
      'models:feature-importance',
      () => mlClient.getFeatureImportance()
    );

    res.setHeader('X-Cache', isCached ? 'HIT' : 'MISS');
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

export default modelsRouter;
