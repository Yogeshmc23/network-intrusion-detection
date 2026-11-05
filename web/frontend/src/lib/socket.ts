import { io, Socket } from 'socket.io-client';
import { PredictionResult } from './api';

export interface LiveRecord {
  id: string;
  timestamp: string;
  protocol_type: string;
  service: string;
  src_bytes: number;
  dst_bytes: number;
  count?: number;
  dst_host_srv_count?: number;
  prediction: 'anomaly' | 'normal' | 'Dos' | 'Probe' | 'R2L' | 'U2R';
  confidence: number;
  is_anomaly: boolean;
  score: number;
  threshold: number;
  model: string;
  flag?: string;
  duration?: number;
}

export interface LiveStats {
  total: number;
  normal: number;
  anomaly: number;
  anomalyRate: number;
  recordsPerSec: number;
}

class LiveSocketManager {
  private socket: Socket | null = null;
  private isStreaming: boolean = false;
  private recordListeners: Set<(record: LiveRecord) => void> = new Set();
  private alertListeners: Set<(record: LiveRecord) => void> = new Set();
  private statsListeners: Set<(stats: LiveStats) => void> = new Set();
  private connectionListeners: Set<(connected: boolean) => void> = new Set();

  private stats: LiveStats = {
    total: 0,
    normal: 0,
    anomaly: 0,
    anomalyRate: 0,
    recordsPerSec: 0,
  };

private recentRecordsCount: number = 0;
private speedTimer: ReturnType<typeof setInterval> | null = null;
  connect() {
    if (this.socket && this.socket.connected) return;

    const socketUrl = import.meta.env.VITE_WS_URL || window.location.origin;

    try {
      this.socket = io(`${socketUrl}/live`, {
        transports: ['websocket', 'polling'],
        reconnectionAttempts: 5,
        reconnectionDelay: 2000,
        autoConnect: true,
      });

      this.socket.on('connect', () => {
        this.notifyConnection(true);
      });

      this.socket.on('disconnect', () => {
        this.notifyConnection(false);
      });

      this.socket.on('connect_error', () => {
        this.notifyConnection(false);
      });

      this.socket.on('prediction', (data: any) => {
        const record = this.normalizeRecord(data);
        if (!record) return;
        this.updateStats(record);
        this.recordListeners.forEach((fn) => fn(record));
      });

      this.socket.on('alert', (data: any) => {
        const record = this.normalizeRecord(data);
        if (record) this.alertListeners.forEach((fn) => fn(record));
      });
    } catch (e) {
      // Keep the interface quiet; connection state is visible in the monitor.
      this.notifyConnection(false);
    }

    // Rate calculation every 1 second
    if (!this.speedTimer) {
      this.speedTimer = setInterval(() => {
        this.stats.recordsPerSec = this.recentRecordsCount;
        this.recentRecordsCount = 0;
        this.notifyStats();
      }, 1000);
    }
  }

  private normalizeRecord(data: any): LiveRecord | null {
    const features = data?.features ?? {};
    const id = data?.id;
    const timestamp = data?.timestamp;
    const prediction = data?.prediction;
    const rawScore = Number(data?.rawScore ?? data?.anomaly_score ?? data?.score);
    const confidence = Number(data?.confidence);
    const threshold = Number(data?.threshold);
    const srcBytes = Number(data?.src_bytes ?? features.src_bytes);
    const dstBytes = Number(data?.dst_bytes ?? features.dst_bytes);
    if (
      typeof id !== 'string' || !id || typeof timestamp !== 'string' || !Number.isFinite(Date.parse(timestamp)) ||
      !['anomaly', 'normal', 'Dos', 'Probe', 'R2L', 'U2R'].includes(prediction) ||
      !Number.isFinite(rawScore) || !Number.isFinite(confidence) || !Number.isFinite(threshold) ||
      !Number.isFinite(srcBytes) || !Number.isFinite(dstBytes)
    ) return null;

    const predictedAnomaly = prediction !== 'normal';
    const isAnomaly = typeof data.is_anomaly === 'boolean'
      ? data.is_anomaly
      : (typeof data.isAnomaly === 'boolean' ? data.isAnomaly : predictedAnomaly);
    const count = Number(data.count ?? features.count);
    const hostCount = Number(data.dst_host_srv_count ?? features.dst_host_srv_count);
    return {
      id,
      timestamp,
      protocol_type: String(data.protocol_type ?? features.protocol_type ?? 'unknown'),
      service: String(data.service ?? features.service ?? 'unknown'),
      src_bytes: srcBytes,
      dst_bytes: dstBytes,
      count: Number.isFinite(count) ? count : undefined,
      dst_host_srv_count: Number.isFinite(hostCount) ? hostCount : undefined,
      prediction,
      confidence,
      is_anomaly: isAnomaly,
      score: rawScore,
      threshold,
      model: String(data.model ?? data.modelUsed ?? data.model_name ?? 'Unknown model'),
      flag: data.flag ?? features.flag,
      duration: Number.isFinite(Number(data.duration ?? features.duration)) ? Number(data.duration ?? features.duration) : undefined,
    };
  }

  private updateStats(record: LiveRecord) {
    this.stats.total += 1;
    this.recentRecordsCount += 1;
    if (record.is_anomaly) {
      this.stats.anomaly += 1;
    } else {
      this.stats.normal += 1;
    }
    this.stats.anomalyRate = (this.stats.anomaly / this.stats.total) * 100;
    this.notifyStats();
  }

  startStream(recordsPerSec: number = 2) {
    if (!this.socket?.connected) return;
    this.isStreaming = true;
    this.socket.emit('start-stream', { speed: recordsPerSec });
  }

  stopStream() {
    this.isStreaming = false;
    if (this.socket && this.socket.connected) {
      this.socket.emit('stop-stream');
    }
  }

  setSpeed(recordsPerSec: number) {
    if (this.isStreaming) {
      this.startStream(recordsPerSec);
    }
  }

  resetStats() {
    this.stats = {
      total: 0,
      normal: 0,
      anomaly: 0,
      anomalyRate: 0,
      recordsPerSec: 0,
    };
    this.recentRecordsCount = 0;
    this.notifyStats();
  }

  onRecord(callback: (record: LiveRecord) => void) {
    this.recordListeners.add(callback);
    return () => this.recordListeners.delete(callback);
  }

  onAlert(callback: (record: LiveRecord) => void) {
    this.alertListeners.add(callback);
    return () => this.alertListeners.delete(callback);
  }

  onStats(callback: (stats: LiveStats) => void) {
    this.statsListeners.add(callback);
    callback({ ...this.stats });
    return () => this.statsListeners.delete(callback);
  }

  onConnectionChange(callback: (connected: boolean) => void) {
    this.connectionListeners.add(callback);
    callback(!!this.socket?.connected);
    return () => this.connectionListeners.delete(callback);
  }

  private notifyStats() {
    this.statsListeners.forEach((fn) => fn({ ...this.stats }));
  }

  private notifyConnection(connected: boolean) {
    this.connectionListeners.forEach((fn) => fn(connected));
  }

  disconnect() {
    this.stopStream();
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    if (this.speedTimer) {
      clearInterval(this.speedTimer);
      this.speedTimer = null;
    }
  }
}

export const liveSocket = new LiveSocketManager();
