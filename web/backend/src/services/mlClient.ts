import axios, { AxiosInstance } from 'axios';
import env from '../config/env';
import logger from '../utils/logger';

export interface SinglePredictionRequest {
  features: Record<string, any>;
  threshold?: number;
}

export interface PredictionResult {
  prediction: 'anomaly' | 'normal' | string;
  confidence: number;
  threshold: number;
  modelUsed: string;
  isAnomaly: boolean;
  rawScore?: number;
  details?: Record<string, any>;
}

export interface BatchPredictionResult {
  total: number;
  anomalyCount: number;
  normalCount: number;
  predictions: PredictionResult[];
}

export class MLClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: env.ML_SERVICE_URL,
      timeout: 20000,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });
  }

  /**
   * Health check for ML Service
   */
  async checkHealth(): Promise<{ status: string; service: string; details?: any }> {
    try {
      const response = await this.client.get('/api/health');
      return response.data;
    } catch (error: any) {
      logger.warn(`ML service health check failed: ${error.message}`);
      return { status: 'down', service: 'ml-service', details: error.message };
    }
  }

  /**
   * Send single record prediction request to ML service
   */
  async predict(features: Record<string, any>, threshold?: number): Promise<PredictionResult> {
    try {
      const payload: any = { features };
      if (typeof threshold === 'number') {
        payload.threshold = threshold;
      }

      const response = await this.client.post('/api/predict', payload);
      const data = response.data;

      // Normalize response fields across possible FastAPI formats
      const rawScore = typeof data.score === 'number' ? data.score : (data.confidence ?? data.probability ?? 0.5);
      const activeThreshold = typeof data.threshold === 'number' ? data.threshold : (threshold ?? 0.5);
      
      let isAnomaly = false;
      if (typeof data.isAnomaly === 'boolean') {
        isAnomaly = data.isAnomaly;
      } else if (typeof data.prediction === 'string') {
        isAnomaly = data.prediction.toLowerCase() === 'anomaly' || data.prediction === '1';
      } else if (typeof data.prediction === 'number') {
        isAnomaly = data.prediction === 1;
      } else {
        isAnomaly = rawScore >= activeThreshold;
      }

      const predictionLabel = isAnomaly ? 'anomaly' : 'normal';

      return {
        prediction: predictionLabel,
        confidence: Number(rawScore.toFixed(5)),
        threshold: activeThreshold,
        modelUsed: data.modelUsed || data.model_name || 'LightGBM (optional)',
        isAnomaly,
        rawScore,
        details: data,
      };
    } catch (error: any) {
      logger.error('ML service predict error:', error?.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Send batch records prediction request to ML service
   */
  async predictBatch(records: Array<Record<string, any>>, threshold?: number): Promise<BatchPredictionResult> {
    try {
      const payload = {
        records,
        threshold: threshold ?? 0.5,
      };

      const response = await this.client.post('/api/predict-batch', payload);
      const data = response.data;

      // Normalize batch format
      if (Array.isArray(data)) {
        let anomalyCount = 0;
        const normalized = data.map((item: any) => {
          const score = typeof item.score === 'number' ? item.score : (item.confidence ?? 0.5);
          const itemThreshold = item.threshold ?? threshold ?? 0.5;
          const isAnomaly = item.prediction === 'anomaly' || item.isAnomaly === true || score >= itemThreshold;
          if (isAnomaly) anomalyCount++;
          return {
            prediction: isAnomaly ? 'anomaly' : 'normal',
            confidence: Number(score.toFixed(5)),
            threshold: itemThreshold,
            modelUsed: item.modelUsed || item.model_name || 'LightGBM (optional)',
            isAnomaly,
          };
        });

        return {
          total: normalized.length,
          anomalyCount,
          normalCount: normalized.length - anomalyCount,
          predictions: normalized,
        };
      }

      if (data.predictions && Array.isArray(data.predictions)) {
        return {
          total: data.total ?? data.predictions.length,
          anomalyCount: data.anomalyCount ?? data.predictions.filter((p: any) => p.isAnomaly || p.prediction === 'anomaly').length,
          normalCount: data.normalCount ?? data.predictions.filter((p: any) => !p.isAnomaly && p.prediction !== 'anomaly').length,
          predictions: data.predictions.map((p: any) => ({
            prediction: p.prediction === 'anomaly' || p.isAnomaly ? 'anomaly' : 'normal',
            confidence: typeof p.confidence === 'number' ? p.confidence : (p.score ?? 0.5),
            threshold: p.threshold ?? threshold ?? 0.5,
            modelUsed: p.modelUsed || 'LightGBM (optional)',
            isAnomaly: p.prediction === 'anomaly' || p.isAnomaly === true,
          })),
        };
      }

      throw new Error('Unexpected batch response format from ML service');
    } catch (error: any) {
      logger.error('ML service predict-batch error:', error?.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Fetch model metrics (accuracy, recall, precision, F1, ROC-AUC)
   */
  async getModelMetrics(): Promise<any> {
    try {
      const response = await this.client.get('/api/model-metrics');
      return response.data;
    } catch (error: any) {
      logger.error('ML service getModelMetrics error:', error?.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Fetch multi-model comparison data
   */
  async getModelComparison(): Promise<any> {
    try {
      const response = await this.client.get('/api/model-comparison');
      return response.data;
    } catch (error: any) {
      logger.error('ML service getModelComparison error:', error?.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Fetch feature importance rankings
   */
  async getFeatureImportance(): Promise<any> {
    try {
      const response = await this.client.get('/api/feature-importance');
      return response.data;
    } catch (error: any) {
      logger.error('ML service getFeatureImportance error:', error?.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Fetch model metadata including feature schema and categorical options
   */
  async getModelMetadata(): Promise<any> {
    try {
      const response = await this.client.get('/api/model-metadata');
      return response.data;
    } catch (error: any) {
      logger.error('ML service getModelMetadata error:', error?.response?.data || error.message);
      throw error;
    }
  }
}

export const mlClient = new MLClient();
export default mlClient;
