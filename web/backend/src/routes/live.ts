import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import liveStreamService from '../services/liveStream';
import { getLiveNamespace } from '../socket';
import { AppError } from '../middleware/errorHandler';

export const liveRouter = Router();

const streamStartSchema = z.object({
  speed: z.number().min(0.5).max(10).optional(),
  threshold: z.number().min(0).max(1).optional(),
});

/**
 * @openapi
 * /api/live/status:
 *   get:
 *     summary: Get status of live event-source availability
 *     tags: [Live Monitoring]
 *     responses:
 *       200:
 *         description: Event-source availability; no stream counters are produced without a configured source
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 status:
 *                   type: object
 *                   properties:
 *                     sourceConfigured: { type: boolean, example: false }
 *                     isRunning: { type: boolean, example: false }
 *                     connectedClients: { type: number }
 */
liveRouter.get('/status', (_req: Request, res: Response) => {
  const status = liveStreamService.getStatus();
  const liveNamespace = getLiveNamespace();
  const connectedClients = liveNamespace?.sockets.size || 0;

  res.status(200).json({
    success: true,
    status: {
      ...status,
      connectedClients,
    },
  });
});

/**
 * @openapi
 * /api/live/start:
 *   post:
 *     summary: Request live network monitoring
 *     tags: [Live Monitoring]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               speed:
 *                 type: number
 *                 description: Records per second (0.5 to 10)
 *                 default: 1
 *                 example: 2
 *               threshold:
 *                 type: number
 *                 default: 0.5
 *                 example: 0.5
 *     responses:
 *       503:
 *         description: No packet-capture or event source is configured
 */
liveRouter.post('/start', (req: Request, res: Response, next: NextFunction) => {
  try {
    streamStartSchema.parse(req.body);
    throw new AppError('No live packet-capture or event source is configured', 503, 'LIVE_SOURCE_UNAVAILABLE');
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /api/live/stop:
 *   post:
 *     summary: Stop live monitoring
 *     tags: [Live Monitoring]
 *     responses:
 *       200:
 *         description: Stream stopped successfully
 */
liveRouter.post('/stop', (_req: Request, res: Response) => {
  const status = liveStreamService.stop();
  const liveNamespace = getLiveNamespace();
  if (liveNamespace) {
    liveNamespace.emit('status', status);
  }

  res.status(200).json({
    success: true,
    message: 'Live monitoring is inactive; no source is configured',
    status,
  });
});

/**
 * @openapi
 * /api/live/sample:
 *   get:
 *     summary: Generate a sample NSL-KDD record for testing or form population
 *     tags: [Live Monitoring]
 *     parameters:
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [normal, anomaly] }
 *         description: Force connection type
 *     responses:
 *       200:
 *         description: Generated sample NSL-KDD record
 */
liveRouter.get('/sample', (req: Request, res: Response) => {
  const forceType = req.query.type as 'normal' | 'anomaly' | undefined;
  const sample = liveStreamService.generateRecord(forceType);

  res.status(200).json({
    success: true,
    sample,
  });
});

export default liveRouter;
