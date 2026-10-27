import { Router, Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import authenticate from '../middleware/auth';
import Prediction from '../models/Prediction';
import { AppError } from '../middleware/errorHandler';

export const historyRouter = Router();

// Helper to construct query filters based on user role and query parameters
function buildHistoryFilter(req: Request): Record<string, any> {
  const user = req.user!;
  const filter: Record<string, any> = {};

  // Role check: Analyst can ONLY view their own records; Admin can view all or filter by specific userId
  if (user.role === 'analyst') {
    filter.userId = new mongoose.Types.ObjectId(user.id);
  } else if (user.role === 'admin' && req.query.userId) {
    if (mongoose.Types.ObjectId.isValid(req.query.userId as string)) {
      filter.userId = new mongoose.Types.ObjectId(req.query.userId as string);
    }
  }

  // Prediction filter ('anomaly' or 'normal')
  if (req.query.prediction) {
    filter.prediction = req.query.prediction as string;
  }

  // Date range filters
  if (req.query.dateFrom || req.query.dateTo) {
    filter.createdAt = {};
    if (req.query.dateFrom) {
      filter.createdAt.$gte = new Date(req.query.dateFrom as string);
    }
    if (req.query.dateTo) {
      filter.createdAt.$lte = new Date(req.query.dateTo as string);
    }
  }

  return filter;
}

/**
 * @openapi
 * /api/history:
 *   get:
 *     summary: Retrieve paginated prediction history
 *     tags: [History]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *         description: Records per page (max 100)
 *       - in: query
 *         name: prediction
 *         schema: { type: string, enum: [normal, anomaly] }
 *         description: Filter by prediction outcome
 *       - in: query
 *         name: dateFrom
 *         schema: { type: string, format: date-time }
 *         description: Start date filter (ISO format)
 *       - in: query
 *         name: dateTo
 *         schema: { type: string, format: date-time }
 *         description: End date filter (ISO format)
 *       - in: query
 *         name: sortBy
 *         schema: { type: string, default: "createdAt:desc" }
 *         description: Sort field and direction (e.g., createdAt:desc, confidence:asc)
 *     responses:
 *       200:
 *         description: List of predictions with pagination details
 *       401:
 *         description: Unauthorized
 */
historyRouter.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || '10', 10)));
    const skip = (page - 1) * limit;

    const filter = buildHistoryFilter(req);

    // Sorting logic
    const sortBy = (req.query.sortBy as string) || 'createdAt:desc';
    const [field, direction] = sortBy.split(':');
    const sortOrder: any = {};
    sortOrder[field || 'createdAt'] = direction === 'asc' ? 1 : -1;

    const [total, predictions] = await Promise.all([
      Prediction.countDocuments(filter),
      Prediction.find(filter)
        .sort(sortOrder)
        .skip(skip)
        .limit(limit)
        .populate('userId', 'name email role')
        .lean(),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    res.status(200).json({
      success: true,
      data: predictions.map((doc: any) => ({
        id: doc._id.toString(),
        userId: doc.userId?._id?.toString() || doc.userId?.toString(),
        userName: doc.userId?.name || 'Unknown',
        userEmail: doc.userId?.email,
        inputFeatures: doc.inputFeatures,
        prediction: doc.prediction,
        confidence: doc.confidence,
        modelUsed: doc.modelUsed,
        threshold: doc.threshold,
        createdAt: doc.createdAt,
      })),
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /api/history/stats:
 *   get:
 *     summary: Retrieve aggregate statistics of predictions
 *     tags: [History]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Aggregated statistics summary
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 stats:
 *                   type: object
 *                   properties:
 *                     total: { type: number, example: 120 }
 *                     anomalyCount: { type: number, example: 25 }
 *                     normalCount: { type: number, example: 95 }
 *                     anomalyRate: { type: number, example: 0.2083 }
 *                     averageConfidence: { type: number, example: 0.812 }
 *       401:
 *         description: Unauthorized
 */
historyRouter.get('/stats', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filter = buildHistoryFilter(req);

    const [total, anomalyCount, confidenceAgg] = await Promise.all([
      Prediction.countDocuments(filter),
      Prediction.countDocuments({ ...filter, prediction: 'anomaly' }),
      Prediction.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            avgConfidence: { $avg: '$confidence' },
          },
        },
      ]),
    ]);

    const normalCount = total - anomalyCount;
    const anomalyRate = total > 0 ? Number((anomalyCount / total).toFixed(4)) : 0;
    const avgConfidence =
      confidenceAgg.length > 0 && confidenceAgg[0].avgConfidence
        ? Number(confidenceAgg[0].avgConfidence.toFixed(4))
        : 0;

    res.status(200).json({
      success: true,
      stats: {
        total,
        anomalyCount,
        normalCount,
        anomalyRate,
        averageConfidence: avgConfidence,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /api/history/export:
 *   get:
 *     summary: Export prediction history as downloadable CSV
 *     tags: [History]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: CSV file download
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *       401:
 *         description: Unauthorized
 */
historyRouter.get('/export', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filter = buildHistoryFilter(req);

    // Fetch up to 10,000 recent records for export
    const records = await Prediction.find(filter)
      .sort({ createdAt: -1 })
      .limit(10000)
      .lean();

    if (records.length === 0) {
      throw new AppError('No prediction records found to export', 404);
    }

    // Identify all unique input feature keys from the records
    const featureKeySet = new Set<string>();
    records.forEach((r: any) => {
      if (r.inputFeatures && typeof r.inputFeatures === 'object') {
        Object.keys(r.inputFeatures).forEach((k) => featureKeySet.add(k));
      }
    });
    const featureKeys = Array.from(featureKeySet);

    // Build CSV Headers
    const baseHeaders = ['predictionId', 'userId', 'prediction', 'confidence', 'threshold', 'modelUsed', 'createdAt'];
    const allHeaders = [...baseHeaders, ...featureKeys];

    // Escape CSV cell helper
    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const csvRows: string[] = [];
    csvRows.push(allHeaders.map(escapeCsv).join(','));

    for (const r of records as any[]) {
      const rowValues = [
        r._id.toString(),
        r.userId?.toString() || '',
        r.prediction,
        r.confidence,
        r.threshold,
        r.modelUsed,
        r.createdAt ? new Date(r.createdAt).toISOString() : '',
        ...featureKeys.map((k) => (r.inputFeatures ? r.inputFeatures[k] ?? '' : '')),
      ];
      csvRows.push(rowValues.map(escapeCsv).join(','));
    }

    const csvContent = csvRows.join('\r\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="predictions_history_${Date.now()}.csv"`);
    res.status(200).send(csvContent);
  } catch (error) {
    next(error);
  }
});

export default historyRouter;
