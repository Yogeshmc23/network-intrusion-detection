import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore, User } from '@/stores/authStore';

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Request interceptor to attach JWT access token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = useAuthStore.getState().accessToken;
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Queue for handling multiple requests during token refresh
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: Error | null, token: string | null = null) => {
  failedQueue.forEach((promise) => {
    if (error) {
      promise.reject(error);
    } else {
      promise.resolve(token);
    }
  });
  failedQueue = [];
};

// Response interceptor to handle token refresh on 401
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (originalRequest.url?.includes('/auth/login') || originalRequest.url?.includes('/auth/signup')) {
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = useAuthStore.getState().refreshToken;

      if (!refreshToken) {
        useAuthStore.getState().logout();
        return Promise.reject(error);
      }

      try {
        const { data } = await axios.post(`${BASE_URL}/auth/refresh`, {
          refreshToken,
        });

        const newAccessToken = data.accessToken;
        const newRefreshToken = data.refreshToken || refreshToken;

        useAuthStore.getState().updateTokens(newAccessToken, newRefreshToken);

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        }

        processQueue(null, newAccessToken);
        return apiClient(originalRequest);
      } catch (refreshErr) {
        processQueue(refreshErr as Error, null);
        useAuthStore.getState().logout();
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// ─────────────────────────────────────────────────────────────
// Type Definitions
// ─────────────────────────────────────────────────────────────

export interface PredictionResult {
  id?: string;
  prediction: 'anomaly' | 'normal' | 'Dos' | 'Probe' | 'R2L' | 'U2R';
  confidence: number;
  anomaly_score?: number;
  threshold: number;
  is_anomaly: boolean;
  model_name?: string;
  timestamp?: string;
  features?: Record<string, any>;
  inference_time_ms?: number;
}

export interface ModelMetricItem {
  dataset: string;
  model: string;
  family: string;
  feature_set?: string;
  threshold_mode: string;
  threshold_note: string;
  threshold: number;
  tn: number;
  fp: number;
  fn: number;
  tp: number;
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  f2?: number;
  roc_auc: number;
  fit_seconds?: number;
  inference_seconds?: number;
  cv_seconds?: number;
  cv_accuracy_mean?: number;
  cv_accuracy_std?: number;
  cv_precision_mean?: number;
  cv_precision_std?: number;
  cv_recall_mean?: number;
  cv_recall_std?: number;
  cv_f1_mean?: number;
  cv_f1_std?: number;
  cv_roc_auc_mean?: number;
  cv_roc_auc_std?: number;
}

export interface ModelMetadata {
  model_name: string;
  artifact?: string;
  threshold: number;
  threshold_note: string;
  score_type?: string;
  feature_set?: string;
  positive_class?: string;
  feature_columns: string[];
  categorical_columns: string[];
  numeric_columns: string[];
  categorical_options: Record<string, string[]>;
}

export interface HistoryItem {
  _id: string;
  id?: string;
  timestamp: string;
  features: Record<string, any>;
  prediction: string;
  confidence: number;
  is_anomaly: boolean;
  threshold: number;
  model_name: string;
  source?: string;
}

export interface HistoryResponse {
  predictions: HistoryItem[];
  total: number;
  page: number;
  pages: number;
  limit?: number;
}

export interface HistoryStats {
  total: number;
  anomalyCount: number;
  normalCount: number;
  detectionRate?: number;
}

// ─────────────────────────────────────────────────────────────
// API Methods
// ─────────────────────────────────────────────────────────────

export const authApi = {
  login: async (credentials: { email: string; password: string }) => {
    const res = await apiClient.post<{
      accessToken: string;
      refreshToken: string;
      user: User;
    }>('/auth/login', credentials);
    return res.data;
  },

  signup: async (data: { email: string; password: string; name: string }) => {
    const res = await apiClient.post<{
      accessToken: string;
      refreshToken: string;
      user: User;
    }>('/auth/signup', data);
    return res.data;
  },

  me: async () => {
    const res = await apiClient.get<{ user: User }>('/auth/me');
    return res.data;
  },

  refresh: async (refreshToken: string) => {
    const res = await apiClient.post<{
      accessToken: string;
      refreshToken: string;
    }>('/auth/refresh', { refreshToken });
    return res.data;
  },
};

export const predictApi = {
  predictSingle: async (features: Record<string, any>, model?: string) => {
    const res = await apiClient.post<PredictionResult>('/predict', {
      features,
      model,
    });
    return res.data;
  },

  predictBatch: async (file: File, model?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    if (model) formData.append('model', model);

    const res = await apiClient.post<{
      predictions: PredictionResult[];
      summary: { total: number; normal: number; anomaly: number };
    }>('/predict-batch', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return res.data;
  },
};

export const historyApi = {
  getHistory: async (params?: {
    page?: number;
    limit?: number;
    prediction?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
  }) => {
    const res = await apiClient.get<HistoryResponse>('/history', { params });
    return res.data;
  },

  getStats: async () => {
    const res = await apiClient.get<HistoryStats>('/history/stats');
    return res.data;
  },

  exportCsv: async () => {
    const res = await apiClient.get('/history/export', {
      responseType: 'blob',
    });
    return res.data;
  },
};

export const modelsApi = {
  getMetrics: async () => {
    const res = await apiClient.get<{ models: ModelMetricItem[] }>('/models/metrics');
    return res.data;
  },

  getComparison: async () => {
    const res = await apiClient.get<{
      paper_baselines: ModelMetricItem[];
      improved_models: ModelMetricItem[];
      best_model?: string;
      reference_rf_holdout?: ModelMetricItem;
    }>('/models/comparison');
    return res.data;
  },

  getMetadata: async () => {
    const res = await apiClient.get<ModelMetadata>('/models/metadata');
    return res.data;
  },

  getFeatureImportance: async () => {
    const res = await apiClient.get<{
      importance: Record<string, number>;
      sorted?: Array<{ feature: string; importance: number; description?: string }>;
    }>('/models/feature-importance');
    return res.data;
  },
};
