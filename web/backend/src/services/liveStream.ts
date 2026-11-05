import { Namespace } from 'socket.io';
import mlClient from './mlClient';

export const NSL_KDD_FEATURES = [
  'duration',
  'protocol_type',
  'service',
  'flag',
  'src_bytes',
  'dst_bytes',
  'land',
  'wrong_fragment',
  'urgent',
  'hot',
  'num_failed_logins',
  'logged_in',
  'num_compromised',
  'root_shell',
  'su_attempted',
  'num_root',
  'num_file_creations',
  'num_shells',
  'num_access_files',
  'num_outbound_cmds',
  'is_host_login',
  'is_guest_login',
  'count',
  'srv_count',
  'serror_rate',
  'srv_serror_rate',
  'rerror_rate',
  'srv_rerror_rate',
  'same_srv_rate',
  'diff_srv_rate',
  'srv_diff_host_rate',
  'dst_host_count',
  'dst_host_srv_count',
  'dst_host_same_srv_rate',
  'dst_host_diff_srv_rate',
  'dst_host_same_src_port_rate',
  'dst_host_srv_diff_host_rate',
  'dst_host_serror_rate',
  'dst_host_srv_serror_rate',
  'dst_host_rerror_rate',
  'dst_host_srv_rerror_rate',
] as const;

export const CATEGORICAL_OPTIONS = {
  protocol_type: ['tcp', 'udp', 'icmp'],
  service: [
    'http',
    'private',
    'ftp_data',
    'smtp',
    'other',
    'ecr_i',
    'domain_u',
    'eco_i',
    'auth',
    'finger',
    'telnet',
    'ftp',
    'ssh',
    'domain',
    'pop_3',
    'imap4',
    'ntp_u',
    'shell',
  ],
  flag: ['SF', 'S0', 'REJ', 'RSTR', 'RSTO', 'SH', 'S1', 'S2', 'S3', 'OTH', 'RSTOS0'],
};

export interface LiveStreamOptions {
  speed?: number; // Records per second (0.5 to 10)
  threshold?: number;
}

export interface StreamStatus {
  sourceConfigured: boolean;
  isRunning: boolean;
}

export class LiveStreamService {

  /**
   * Helper to pick a random item from array
   */
  private pickRandom<T>(items: readonly T[] | T[]): T {
    return items[Math.floor(Math.random() * items.length)];
  }

  /**
   * Helper for random float between min and max
   */
  private randomFloat(min: number, max: number, decimals = 4): number {
    const val = Math.random() * (max - min) + min;
    return Number(val.toFixed(decimals));
  }

  /**
   * Helper for random integer between min and max (inclusive)
   */
  private randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Generate an NSL-KDD-style record
   * @param forceType Optional 'normal' or 'anomaly'
   */
  public generateRecord(forceType?: 'normal' | 'anomaly'): Record<string, any> {
    const isAnomaly = forceType ? forceType === 'anomaly' : Math.random() < 0.25;

    if (!isAnomaly) {
      // Normal connection profile (e.g. web/mail traffic, successful handshake)
      const service = this.pickRandom(['http', 'smtp', 'domain_u', 'ftp_data', 'ssh']);
      const srcBytes = this.randomInt(100, 3500);
      const dstBytes = this.randomInt(200, 15000);

      return {
        duration: this.randomInt(0, 3),
        protocol_type: service === 'domain_u' ? 'udp' : 'tcp',
        service,
        flag: 'SF', // Normal SYN-FIN
        src_bytes: srcBytes,
        dst_bytes: dstBytes,
        land: 0,
        wrong_fragment: 0,
        urgent: 0,
        hot: 0,
        num_failed_logins: 0,
        logged_in: 1,
        num_compromised: 0,
        root_shell: 0,
        su_attempted: 0,
        num_root: 0,
        num_file_creations: 0,
        num_shells: 0,
        num_access_files: 0,
        num_outbound_cmds: 0,
        is_host_login: 0,
        is_guest_login: 0,
        count: this.randomInt(1, 15),
        srv_count: this.randomInt(1, 15),
        serror_rate: 0.0,
        srv_serror_rate: 0.0,
        rerror_rate: 0.0,
        srv_rerror_rate: 0.0,
        same_srv_rate: 1.0,
        diff_srv_rate: 0.0,
        srv_diff_host_rate: this.randomFloat(0.0, 0.2),
        dst_host_count: this.randomInt(20, 255),
        dst_host_srv_count: this.randomInt(100, 255),
        dst_host_same_srv_rate: this.randomFloat(0.85, 1.0),
        dst_host_diff_srv_rate: this.randomFloat(0.0, 0.05),
        dst_host_same_src_port_rate: this.randomFloat(0.0, 0.1),
        dst_host_srv_diff_host_rate: this.randomFloat(0.0, 0.05),
        dst_host_serror_rate: 0.0,
        dst_host_srv_serror_rate: 0.0,
        dst_host_rerror_rate: 0.0,
        dst_host_srv_rerror_rate: 0.0,
      };
    }

    // Anomaly traffic profile: Simulate DoS, Portsweep, or Bruteforce
    const attackType = this.pickRandom(['dos_syn_flood', 'probe_portsweep', 'r2l_bruteforce', 'u2r_privilege_escalation']);

    if (attackType === 'dos_syn_flood') {
      // Neptune / SYN Flood style
      return {
        duration: 0,
        protocol_type: 'tcp',
        service: this.pickRandom(['private', 'http', 'finger']),
        flag: 'S0', // SYN with no ACK response
        src_bytes: 0,
        dst_bytes: 0,
        land: 0,
        wrong_fragment: 0,
        urgent: 0,
        hot: 0,
        num_failed_logins: 0,
        logged_in: 0,
        num_compromised: 0,
        root_shell: 0,
        su_attempted: 0,
        num_root: 0,
        num_file_creations: 0,
        num_shells: 0,
        num_access_files: 0,
        num_outbound_cmds: 0,
        is_host_login: 0,
        is_guest_login: 0,
        count: this.randomInt(150, 511),
        srv_count: this.randomInt(1, 20),
        serror_rate: 1.0,
        srv_serror_rate: 1.0,
        rerror_rate: 0.0,
        srv_rerror_rate: 0.0,
        same_srv_rate: this.randomFloat(0.01, 0.1),
        diff_srv_rate: this.randomFloat(0.05, 0.2),
        srv_diff_host_rate: 0.0,
        dst_host_count: 255,
        dst_host_srv_count: this.randomInt(1, 15),
        dst_host_same_srv_rate: this.randomFloat(0.01, 0.05),
        dst_host_diff_srv_rate: this.randomFloat(0.05, 0.1),
        dst_host_same_src_port_rate: 0.0,
        dst_host_srv_diff_host_rate: 0.0,
        dst_host_serror_rate: 1.0,
        dst_host_srv_serror_rate: 1.0,
        dst_host_rerror_rate: 0.0,
        dst_host_srv_rerror_rate: 0.0,
      };
    }

    if (attackType === 'probe_portsweep') {
      // Port sweep / Satan scan
      return {
        duration: 0,
        protocol_type: this.pickRandom(['tcp', 'icmp']),
        service: this.pickRandom(['private', 'other', 'eco_i']),
        flag: this.pickRandom(['REJ', 'RSTR', 'S0']),
        src_bytes: 0,
        dst_bytes: 0,
        land: 0,
        wrong_fragment: 0,
        urgent: 0,
        hot: 0,
        num_failed_logins: 0,
        logged_in: 0,
        num_compromised: 0,
        root_shell: 0,
        su_attempted: 0,
        num_root: 0,
        num_file_creations: 0,
        num_shells: 0,
        num_access_files: 0,
        num_outbound_cmds: 0,
        is_host_login: 0,
        is_guest_login: 0,
        count: this.randomInt(50, 300),
        srv_count: 1,
        serror_rate: 0.0,
        srv_serror_rate: 0.0,
        rerror_rate: 0.9,
        srv_rerror_rate: 0.9,
        same_srv_rate: 0.02,
        diff_srv_rate: 0.98,
        srv_diff_host_rate: 0.0,
        dst_host_count: 255,
        dst_host_srv_count: 1,
        dst_host_same_srv_rate: 0.01,
        dst_host_diff_srv_rate: 0.95,
        dst_host_same_src_port_rate: 0.9,
        dst_host_srv_diff_host_rate: 0.0,
        dst_host_serror_rate: 0.0,
        dst_host_srv_serror_rate: 0.0,
        dst_host_rerror_rate: 0.95,
        dst_host_srv_rerror_rate: 0.95,
      };
    }

    if (attackType === 'r2l_bruteforce') {
      // Failed logins, brute force password attack
      return {
        duration: this.randomInt(1, 10),
        protocol_type: 'tcp',
        service: this.pickRandom(['telnet', 'ftp', 'ssh']),
        flag: 'SF',
        src_bytes: this.randomInt(100, 500),
        dst_bytes: this.randomInt(100, 600),
        land: 0,
        wrong_fragment: 0,
        urgent: 0,
        hot: this.randomInt(1, 4),
        num_failed_logins: this.randomInt(2, 5),
        logged_in: 0,
        num_compromised: 0,
        root_shell: 0,
        su_attempted: 0,
        num_root: 0,
        num_file_creations: 0,
        num_shells: 0,
        num_access_files: 0,
        num_outbound_cmds: 0,
        is_host_login: 0,
        is_guest_login: this.pickRandom([0, 1]),
        count: this.randomInt(1, 5),
        srv_count: this.randomInt(1, 5),
        serror_rate: 0.0,
        srv_serror_rate: 0.0,
        rerror_rate: 0.0,
        srv_rerror_rate: 0.0,
        same_srv_rate: 1.0,
        diff_srv_rate: 0.0,
        srv_diff_host_rate: 0.0,
        dst_host_count: this.randomInt(1, 50),
        dst_host_srv_count: this.randomInt(1, 50),
        dst_host_same_srv_rate: 1.0,
        dst_host_diff_srv_rate: 0.0,
        dst_host_same_src_port_rate: this.randomFloat(0.1, 0.5),
        dst_host_srv_diff_host_rate: 0.0,
        dst_host_serror_rate: 0.0,
        dst_host_srv_serror_rate: 0.0,
        dst_host_rerror_rate: 0.0,
        dst_host_srv_rerror_rate: 0.0,
      };
    }

    // Default U2R attack (privilege escalation)
    return {
      duration: this.randomInt(5, 60),
      protocol_type: 'tcp',
      service: 'telnet',
      flag: 'SF',
      src_bytes: this.randomInt(1000, 4000),
      dst_bytes: this.randomInt(2000, 8000),
      land: 0,
      wrong_fragment: 0,
      urgent: 0,
      hot: this.randomInt(2, 6),
      num_failed_logins: 0,
      logged_in: 1,
      num_compromised: this.randomInt(1, 5),
      root_shell: 1,
      su_attempted: 1,
      num_root: this.randomInt(2, 8),
      num_file_creations: this.randomInt(1, 3),
      num_shells: this.randomInt(1, 2),
      num_access_files: 0,
      num_outbound_cmds: 0,
      is_host_login: 0,
      is_guest_login: 0,
      count: this.randomInt(1, 8),
      srv_count: this.randomInt(1, 8),
      serror_rate: 0.0,
      srv_serror_rate: 0.0,
      rerror_rate: 0.0,
      srv_rerror_rate: 0.0,
      same_srv_rate: 1.0,
      diff_srv_rate: 0.0,
      srv_diff_host_rate: 0.0,
      dst_host_count: 50,
      dst_host_srv_count: 50,
      dst_host_same_srv_rate: 1.0,
      dst_host_diff_srv_rate: 0.0,
      dst_host_same_src_port_rate: 0.05,
      dst_host_srv_diff_host_rate: 0.0,
      dst_host_serror_rate: 0.0,
      dst_host_srv_serror_rate: 0.0,
      dst_host_rerror_rate: 0.0,
      dst_host_srv_rerror_rate: 0.0,
    };
  }

  /**
   * Synthetic vectors are available only through the explicit sample endpoint.
   * They are never emitted as live traffic or counted as detection activity.
   */
  public start(_ioNamespace: Namespace, _options: LiveStreamOptions = {}): StreamStatus {
    return this.getStatus();
  }

  public stop(): StreamStatus {
    return this.getStatus();
  }

  public getStatus(): StreamStatus {
    return { sourceConfigured: false, isRunning: false };
  }
}

export const liveStreamService = new LiveStreamService();
export default liveStreamService;
