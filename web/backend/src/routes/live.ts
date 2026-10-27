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
 *     summary: Get status of real-time traffic streaming
 *     tags: [Live Monitoring]
 *     responses:
 *       200:
 *         description: Live stream operational metrics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 status:
 *                   type: object
 *                   properties:
 *                     isRunning: { type: boolean, example: false }
 *                     speed: { type: number, example: 1 }
 *                     threshold: { type: number, example: 0.5 }
 *                     recordsEmitted: { type: number, example: 142 }
 *                     alertsEmitted: { type: number, example: 18 }
 *                     connectedClients: { type: number, example: 2 }
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
 *     summary: Start the simulated network traffic stream
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
 *       200:
 *         description: Stream initiated successfully
 *       400:
 *         description: Socket namespace not initialized
 */
liveRouter.post('/start', (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = streamStartSchema.parse(req.body);
    const liveNamespace = getLiveNamespace();

    if (!liveNamespace) {
      throw new AppError('Socket.IO /live namespace is not ready', 500);
    }

    const status = liveStreamService.start(liveNamespace, validated);
    liveNamespace.emit('status', status);

    res.status(200).json({
      success: true,
      message: 'Live traffic simulation started',
      status,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /api/live/stop:
 *   post:
 *     summary: Stop the simulated network traffic stream
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
    message: 'Live traffic simulation stopped',
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
