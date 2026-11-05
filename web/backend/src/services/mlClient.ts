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
      const rawValue = data.anomaly_score ?? data.score ?? data.probability;
      const rawScore = Number(rawValue);
      if (!Number.isFinite(rawScore)) throw new Error('ML service returned no finite anomaly score');
      const activeThreshold = Number(data.threshold ?? threshold);
      if (!Number.isFinite(activeThreshold)) throw new Error('ML service returned no decision threshold');

      let isAnomaly = false;
      if (typeof data.is_anomaly === 'boolean') isAnomaly = data.is_anomaly;
      else if (typeof data.isAnomaly === 'boolean') isAnomaly = data.isAnomaly;
      else if (typeof data.prediction === 'string') isAnomaly = data.prediction.toLowerCase() === 'anomaly' || data.prediction === '1';
      else if (typeof data.prediction === 'number') isAnomaly = data.prediction === 1;
      else isAnomaly = rawScore >= activeThreshold;

      const providedConfidence = Number(data.confidence);
      const confidence = Number.isFinite(providedConfidence)
        ? providedConfidence
        : (rawScore < 0 || rawScore > 1
          ? 1 / (1 + Math.exp(-Math.abs(rawScore)))
          : (isAnomaly ? rawScore : 1 - rawScore));

      return {
        prediction: isAnomaly ? 'anomaly' : 'normal',
        confidence: Number(confidence.toFixed(5)),
        threshold: activeThreshold,
        modelUsed: data.modelUsed || data.model_name || 'Unknown model',
        isAnomaly,
        rawScore,
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
      const payload: { records: Array<Record<string, any>>; threshold?: number } = { records };
      if (typeof threshold === 'number') payload.threshold = threshold;

      const response = await this.client.post('/api/predict-batch', payload);
      const data = response.data;

      // Normalize batch format
      if (Array.isArray(data)) {
        let anomalyCount = 0;
        const normalized = data.map((item: any) => {
          const rawScore = Number(item.anomaly_score ?? item.score ?? item.probability);
          if (!Number.isFinite(rawScore)) throw new Error('ML service returned a non-finite batch score');
          const itemThreshold = Number(item.threshold ?? threshold);
          if (!Number.isFinite(itemThreshold)) throw new Error('ML service returned no batch decision threshold');
          const labelIsAnomaly = item.prediction === 'anomaly' || item.prediction === 1;
          const isAnomaly = typeof item.is_anomaly === 'boolean'
            ? item.is_anomaly
            : (typeof item.isAnomaly === 'boolean' ? item.isAnomaly : (labelIsAnomaly || rawScore >= itemThreshold));
          if (isAnomaly) anomalyCount++;
          const suppliedConfidence = Number(item.confidence);
          const confidence = Number.isFinite(suppliedConfidence)
            ? suppliedConfidence
            : (rawScore < 0 || rawScore > 1
              ? 1 / (1 + Math.exp(-Math.abs(rawScore)))
              : (isAnomaly ? rawScore : 1 - rawScore));
          return {
            prediction: isAnomaly ? 'anomaly' : 'normal',
            confidence: Number(confidence.toFixed(5)),
            threshold: itemThreshold,
            modelUsed: item.modelUsed || item.model_name || 'Unknown model',
            isAnomaly,
            rawScore,
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
        const normalized = data.predictions.map((p: any) => {
          const rawScore = Number(p.anomaly_score ?? p.score ?? p.probability);
          if (!Number.isFinite(rawScore)) throw new Error('ML service returned a non-finite batch score');
          const itemThreshold = Number(p.threshold ?? threshold);
          if (!Number.isFinite(itemThreshold)) throw new Error('ML service returned no batch decision threshold');
          const isAnomaly = typeof p.is_anomaly === 'boolean'
            ? p.is_anomaly
            : (typeof p.isAnomaly === 'boolean'
              ? p.isAnomaly
              : (p.prediction === 'anomaly' || p.prediction === 1 || rawScore >= itemThreshold));
          const suppliedConfidence = Number(p.confidence);
          const confidence = Number.isFinite(suppliedConfidence)
            ? suppliedConfidence
            : (rawScore < 0 || rawScore > 1
              ? 1 / (1 + Math.exp(-Math.abs(rawScore)))
              : (isAnomaly ? rawScore : 1 - rawScore));
          return {
            prediction: isAnomaly ? 'anomaly' : 'normal',
            confidence: Number(confidence.toFixed(5)),
            threshold: itemThreshold,
            modelUsed: p.modelUsed || p.model_name || 'Unknown model',
            isAnomaly,
            rawScore,
          };
        });
        const anomalyCount = normalized.filter((item: PredictionResult) => item.isAnomaly).length;
        return {
          total: data.total ?? normalized.length,
          anomalyCount: data.anomalyCount ?? anomalyCount,
          normalCount: data.normalCount ?? normalized.length - anomalyCount,
          predictions: normalized,
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
