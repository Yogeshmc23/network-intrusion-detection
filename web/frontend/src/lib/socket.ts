import { io, Socket } from 'socket.io-client';
import { PredictionResult } from './api';

export interface LiveRecord {
  id: string;
  timestamp: string;
  protocol_type: string;
  service: string;
  src_bytes: number;
  dst_bytes: number;
  count: number;
  dst_host_srv_count: number;
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

  private simInterval: NodeJS.Timeout | null = null;
  private simSpeedMs: number = 1000;
  private recentRecordsCount: number = 0;
  private speedTimer: NodeJS.Timeout | null = null;

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
        this.updateStats(record);
        this.recordListeners.forEach((fn) => fn(record));
      });

      this.socket.on('alert', (data: any) => {
        const record = this.normalizeRecord(data);
        this.alertListeners.forEach((fn) => fn(record));
      });
    } catch (e) {
      console.warn('Socket connection error, simulation ready', e);
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

  private normalizeRecord(data: any): LiveRecord {
    const isAnomaly =
      data.is_anomaly ??
      (data.prediction === 'anomaly' ||
        ['Dos', 'Probe', 'R2L', 'U2R'].includes(data.prediction));

    return {
      id: data.id || `live-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: data.timestamp || new Date().toISOString(),
      protocol_type: data.protocol_type || data.features?.protocol_type || 'tcp',
      service: data.service || data.features?.service || 'http',
      src_bytes: Number(data.src_bytes ?? data.features?.src_bytes ?? 215),
      dst_bytes: Number(data.dst_bytes ?? data.features?.dst_bytes ?? 450),
      count: Number(data.count ?? data.features?.count ?? 8),
      dst_host_srv_count: Number(data.dst_host_srv_count ?? data.features?.dst_host_srv_count ?? 255),
      prediction: data.prediction || (isAnomaly ? 'anomaly' : 'normal'),
      confidence: Number(data.confidence ?? (isAnomaly ? 0.94 : 0.98)),
      is_anomaly: isAnomaly,
      score: Number(data.score ?? data.anomaly_score ?? (isAnomaly ? 0.89 : 0.04)),
      threshold: Number(data.threshold ?? 0.572553),
      model: data.model || 'LightGBM (operational)',
      flag: data.flag || data.features?.flag || 'SF',
      duration: Number(data.duration ?? data.features?.duration ?? 0),
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
    this.isStreaming = true;
    this.simSpeedMs = Math.max(100, Math.floor(1000 / recordsPerSec));

    if (this.socket && this.socket.connected) {
      this.socket.emit('start-stream', { speed: recordsPerSec });
    } else {
      // Offline/fallback synthetic stream
      this.startSimulation();
    }
  }

  stopStream() {
    this.isStreaming = false;
    if (this.socket && this.socket.connected) {
      this.socket.emit('stop-stream');
    }
    if (this.simInterval) {
      clearInterval(this.simInterval);
      this.simInterval = null;
    }
  }

  setSpeed(recordsPerSec: number) {
    this.simSpeedMs = Math.max(100, Math.floor(1000 / recordsPerSec));
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

  private startSimulation() {
    if (this.simInterval) clearInterval(this.simInterval);

    const protocols = ['tcp', 'udp', 'icmp'];
    const services = ['http', 'smtp', 'ftp', 'private', 'domain_u', 'eco_i', 'telnet'];
    const anomalyTypes: ('anomaly' | 'Dos' | 'Probe' | 'R2L')[] = ['anomaly', 'Dos', 'Probe', 'R2L'];

    this.simInterval = setInterval(() => {
      if (!this.isStreaming) return;

      const isAnomaly = Math.random() < 0.22; // ~22% anomaly distribution
      const proto = protocols[Math.floor(Math.random() * protocols.length)];
      const svc = services[Math.floor(Math.random() * services.length)];

      const record: LiveRecord = {
        id: `rec-${Date.now()}-${Math.floor(Math.random() * 9999)}`,
        timestamp: new Date().toISOString(),
        protocol_type: proto,
        service: svc,
        src_bytes: isAnomaly ? Math.floor(Math.random() * 50000 + 1000) : Math.floor(Math.random() * 800 + 40),
        dst_bytes: isAnomaly ? Math.floor(Math.random() * 200) : Math.floor(Math.random() * 15000 + 500),
        count: isAnomaly ? Math.floor(Math.random() * 450 + 50) : Math.floor(Math.random() * 20 + 1),
        dst_host_srv_count: isAnomaly ? Math.floor(Math.random() * 30 + 1) : Math.floor(Math.random() * 200 + 55),
        prediction: isAnomaly ? anomalyTypes[Math.floor(Math.random() * anomalyTypes.length)] : 'normal',
        confidence: Number((0.85 + Math.random() * 0.14).toFixed(4)),
        is_anomaly: isAnomaly,
        score: Number((isAnomaly ? 0.65 + Math.random() * 0.34 : Math.random() * 0.25).toFixed(4)),
        threshold: 0.572553,
        model: 'LightGBM (operational)',
        flag: isAnomaly ? 'S0' : 'SF',
        duration: Math.floor(Math.random() * 4),
      };

      this.updateStats(record);
      this.recordListeners.forEach((fn) => fn(record));
      if (isAnomaly) {
        this.alertListeners.forEach((fn) => fn(record));
      }
    }, this.simSpeedMs);
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
