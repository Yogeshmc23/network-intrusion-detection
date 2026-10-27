import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore, User } from '@/stores/authStore';
import { SessionExpiredError } from '@/lib/apiErrors';

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

/**
 * Dedicated client for refresh calls. It deliberately has NO interceptors, so a
 * failing refresh can never trigger another refresh (no infinite retry loops).
 */
export const authRefreshClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

const AUTH_ENDPOINTS = ['/auth/login', '/auth/signup', '/auth/refresh', '/auth/logout'];

function isAuthEndpoint(url?: string): boolean {
  if (!url) return false;
  return AUTH_ENDPOINTS.some((endpoint) => url.includes(endpoint));
}

function applyBearerToken(config: InternalAxiosRequestConfig, token: string): void {
  config.headers.set('Authorization', `Bearer ${token}`);
}

// Request interceptor to attach JWT access token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = useAuthStore.getState().accessToken;
    // Credentials endpoints never need (and should never receive) a stale token.
    if (token && !isAuthEndpoint(config.url)) {
      applyBearerToken(config, token);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ─── Single-flight token refresh ─────────────────────────────
// Every 401 that arrives while a refresh is already running awaits this same
// promise, so a burst of parallel requests performs exactly ONE refresh call.
let refreshPromise: Promise<string> | null = null;

async function requestNewAccessToken(): Promise<string> {
  const { refreshToken } = useAuthStore.getState();

  if (!refreshToken) {
    useAuthStore.getState().logout();
    throw new SessionExpiredError();
  }

  let data: { accessToken?: string; refreshToken?: string };
  try {
    const response = await authRefreshClient.post('/auth/refresh', { refreshToken });
    data = response.data ?? {};
  } catch (error) {
    const status = axios.isAxiosError(error) ? error.response?.status : undefined;

    // ONLY an explicit rejection of the refresh token ends the session.
    // Network failures, timeouts, 5xx and 429 responses must not log the user
    // out — they are transient and the request can be retried later.
    if (status === 401 || status === 403) {
      useAuthStore.getState().logout();
      throw new SessionExpiredError();
    }

    throw error;
  }

  if (!data.accessToken) {
    throw new Error('The authentication service returned an invalid refresh response.');
  }

  // Persist rotated tokens (the backend rotates the refresh token too).
  useAuthStore.getState().updateTokens(data.accessToken, data.refreshToken);
  return data.accessToken;
}

/** Shared refresh entry point (single-flight). */
export function refreshAccessToken(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = requestNewAccessToken().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

// Response interceptor: refresh an expired access token ONCE, then replay the
// original request with the new token.
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig | undefined;
    const status = error.response?.status;

    if (status !== 401 || !originalRequest) {
      return Promise.reject(error);
    }

    // Never refresh for credentials endpoints, and never retry a request twice.
    // `_retry` is set before the refresh starts, so concurrent retries and a
    // second 401 for the same request cannot start another refresh cycle.
    if (
      isAuthEndpoint(originalRequest.url) ||
      originalRequest._retry ||
      originalRequest.skipAuthRefresh
    ) {
      return Promise.reject(error);
    }

    if (!useAuthStore.getState().refreshToken) {
      // There is no way to obtain a new access token: the session is unusable.
      useAuthStore.getState().logout();
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      const newAccessToken = await refreshAccessToken();
      applyBearerToken(originalRequest, newAccessToken);
      return apiClient(originalRequest);
    } catch (refreshError) {
      if (refreshError instanceof SessionExpiredError) {
        return Promise.reject(refreshError);
      }
      // Transient refresh failure: keep the session and surface the original
      // 401 so the caller can show an error / retry later.
      return Promise.reject(error);
    }
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
    }>('/auth/login', credentials, { skipAuthRefresh: true });
    return res.data;
  },

  signup: async (data: { email: string; password: string; name: string }) => {
    const res = await apiClient.post<{
      accessToken: string;
      refreshToken: string;
      user: User;
    }>('/auth/signup', data, { skipAuthRefresh: true });
    return res.data;
  },

  me: async () => {
    const res = await apiClient.get<{ user: User }>('/auth/me');
    return res.data;
  },

  refresh: async (refreshToken: string) => {
    const res = await authRefreshClient.post<{
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
