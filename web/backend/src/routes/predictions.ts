import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import mongoose from 'mongoose';
import { z } from 'zod';
import authenticate from '../middleware/auth';
import mlClient from '../services/mlClient';
import Prediction from '../models/Prediction';
import { AppError } from '../middleware/errorHandler';

export const predictionsRouter = Router();
export const batchPredictionsRouter = Router();

// Configure multer for CSV/file uploads in memory
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB maximum file size
  fileFilter: (_req, file, cb) => {
    if (
      file.mimetype === 'text/csv' ||
      file.mimetype === 'application/vnd.ms-excel' ||
      file.originalname.endsWith('.csv') ||
      file.mimetype === 'application/json' ||
      file.originalname.endsWith('.json')
    ) {
      cb(null, true);
    } else {
      cb(new AppError('Only CSV or JSON files are supported for batch prediction', 400));
    }
  },
});

// Helper: parse CSV buffer to array of key-value records
function parseCsv(buffer: Buffer): Array<Record<string, any>> {
  const text = buffer.toString('utf-8');
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  const records: Array<Record<string, any>> = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
    if (values.length !== headers.length) continue;

    const row: Record<string, any> = {};
    headers.forEach((header, idx) => {
      const raw = values[idx];
      const num = Number(raw);
      row[header] = !isNaN(num) && raw !== '' ? num : raw;
    });
    records.push(row);
  }
  return records;
}

// Validation schemas
const singlePredictSchema = z.object({
  features: z.record(z.any()).refine((obj) => Object.keys(obj).length > 0, {
    message: 'At least one connection feature must be provided',
  }),
  threshold: z.number().min(0).max(1).optional(),
});

const batchPredictSchema = z.object({
  records: z.array(z.record(z.any())).min(1, 'At least one record is required in batch'),
  threshold: z.number().min(0).max(1).optional(),
});

/**
 * Controller for Single Prediction
 */
async function handleSinglePredict(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const validated = singlePredictSchema.parse(req.body);
    const userId = req.user!.id;

    // Call ML Microservice
    const mlResult = await mlClient.predict(validated.features, validated.threshold);

    // Save prediction record to MongoDB
    const record = await Prediction.create({
      userId: new mongoose.Types.ObjectId(userId),
      inputFeatures: validated.features,
      prediction: mlResult.prediction,
      confidence: mlResult.confidence,
      modelUsed: mlResult.modelUsed,
      threshold: mlResult.threshold,
      createdAt: new Date(),
    });

    res.status(200).json({
      success: true,
      predictionId: record._id.toString(),
      prediction: mlResult.prediction,
      confidence: mlResult.confidence,
      threshold: mlResult.threshold,
      modelUsed: mlResult.modelUsed,
      isAnomaly: mlResult.isAnomaly,
      createdAt: record.createdAt,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Controller for Batch Prediction
 */
async function handleBatchPredict(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    let records: Array<Record<string, any>> = [];
    let threshold: number | undefined;

    if (req.file) {
      // Uploaded CSV or JSON file
      const fileContent = req.file.buffer;
      if (req.file.originalname.endsWith('.json') || req.file.mimetype === 'application/json') {
        const parsed = JSON.parse(fileContent.toString('utf-8'));
        records = Array.isArray(parsed) ? parsed : parsed.records || [];
      } else {
        records = parseCsv(fileContent);
      }

      if (req.body.threshold) {
        const parsedThreshold = Number(req.body.threshold);
        if (!isNaN(parsedThreshold)) threshold = parsedThreshold;
      }
    } else if (req.body && req.body.records) {
      // JSON Body
      const validated = batchPredictSchema.parse(req.body);
      records = validated.records;
      threshold = validated.threshold;
    } else {
      throw new AppError('Either a CSV file or JSON records array must be provided', 400);
    }

    if (!records || records.length === 0) {
      throw new AppError('No valid connection records found in request', 400);
    }

    // Send to ML service
    const batchResult = await mlClient.predictBatch(records, threshold);

    // Bulk persist to MongoDB
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const now = new Date();

    const docsToInsert = batchResult.predictions.map((p, idx) => ({
      userId: userObjectId,
      inputFeatures: records[idx] || {},
      prediction: p.prediction,
      confidence: p.confidence,
      modelUsed: p.modelUsed,
      threshold: p.threshold,
      createdAt: now,
    }));

    await Prediction.insertMany(docsToInsert, { ordered: false });

    res.status(200).json({
      success: true,
      total: batchResult.total,
      anomalyCount: batchResult.anomalyCount,
      normalCount: batchResult.normalCount,
      predictions: batchResult.predictions,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @openapi
 * /api/predict:
 *   post:
 *     summary: Classify a single network traffic record
 *     tags: [Predictions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [features]
 *             properties:
 *               features:
 *                 type: object
 *                 description: NSL-KDD 41 network connection features
 *                 example:
 *                   duration: 0
 *                   protocol_type: tcp
 *                   service: http
 *                   flag: SF
 *                   src_bytes: 232
 *                   dst_bytes: 8153
 *               threshold:
 *                 type: number
 *                 default: 0.5
 *                 example: 0.5
 *     responses:
 *       200:
 *         description: Prediction completed and saved to history
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PredictionResponse'
 *       400:
 *         description: Invalid input features
 *       401:
 *         description: Unauthorized
 *       502:
 *         description: ML Service unavailable
 */
predictionsRouter.post('/', authenticate, handleSinglePredict);

/**
 * @openapi
 * /api/predict/batch:
 *   post:
 *     summary: Classify multiple traffic records via JSON array or CSV file upload (alias: /api/predict-batch)
 *     tags: [Predictions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: CSV file containing NSL-KDD traffic records
 *               threshold:
 *                 type: number
 *                 example: 0.5
 *         application/json:
 *           schema:
 *             type: object
 *             required: [records]
 *             properties:
 *               records:
 *                 type: array
 *                 items:
 *                   type: object
 *               threshold:
 *                 type: number
 *                 default: 0.5
 *     responses:
 *       200:
 *         description: Batch predictions completed and saved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 total: { type: number, example: 50 }
 *                 anomalyCount: { type: number, example: 12 }
 *                 normalCount: { type: number, example: 38 }
 *                 predictions: { type: array, items: { type: object } }
 *       400:
 *         description: Invalid input or empty batch
 *       401:
 *         description: Unauthorized
 */
predictionsRouter.post('/batch', authenticate, upload.single('file'), handleBatchPredict);

/**
 * @openapi
 * /api/predict-batch:
 *   post:
 *     summary: Classify multiple traffic records via JSON array or CSV file upload
 *     tags: [Predictions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               threshold:
 *                 type: number
 *         application/json:
 *           schema:
 *             type: object
 *             required: [records]
 *             properties:
 *               records:
 *                 type: array
 *                 items:
 *                   type: object
 *               threshold:
 *                 type: number
 *     responses:
 *       200:
 *         description: Batch predictions completed and saved
 */
batchPredictionsRouter.post('/', authenticate, upload.single('file'), handleBatchPredict);

export default predictionsRouter;
