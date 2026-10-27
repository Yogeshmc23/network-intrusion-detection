import { Server as HttpServer } from 'http';
import { Server, Socket, Namespace } from 'socket.io';
import env from '../config/env';
import logger from '../utils/logger';
import liveStreamService from '../services/liveStream';

let ioInstance: Server | null = null;
let liveNamespace: Namespace | null = null;

export function initSocket(server: HttpServer): Server {
  const socketOrigins = env.CORS_ORIGINS.includes('*')
    ? true
    : env.isProd
      ? env.CORS_ORIGINS
      : [...env.CORS_ORIGINS, 'http://localhost:3000', 'http://127.0.0.1:3000'];

  ioInstance = new Server(server, {
    cors: {
      origin: socketOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingInterval: 10000,
    pingTimeout: 5000,
  });

  // Dedicated namespace for real-time intrusion detection monitoring
  liveNamespace = ioInstance.of('/live');

  liveNamespace.on('connection', (socket: Socket) => {
    logger.info(`Live monitor client connected: ${socket.id} (Total in /live: ${liveNamespace?.sockets.size})`);

    // Send current status immediately upon connection
    socket.emit('status', liveStreamService.getStatus());

    // Handle "start-stream" event
    socket.on('start-stream', (options?: { speed?: number; threshold?: number }) => {
      logger.info(`Client ${socket.id} requested start-stream with options:`, options);
      if (liveNamespace) {
        const status = liveStreamService.start(liveNamespace, options);
        liveNamespace.emit('status', status);
      }
    });

    // Handle "stop-stream" event
    socket.on('stop-stream', () => {
      logger.info(`Client ${socket.id} requested stop-stream`);
      const status = liveStreamService.stop();
      if (liveNamespace) {
        liveNamespace.emit('status', status);
      }
    });

    // Client disconnection
    socket.on('disconnect', (reason) => {
      const remaining = liveNamespace?.sockets.size || 0;
      logger.info(`Live monitor client disconnected: ${socket.id} (reason: ${reason}, remaining: ${remaining})`);

      // If no clients left in /live, automatically stop stream to conserve resources
      if (remaining === 0 && liveStreamService.getStatus().isRunning) {
        logger.info('No active clients left in /live namespace. Auto-pausing live stream.');
        liveStreamService.stop();
      }
    });
  });

  return ioInstance;
}

export function getLiveNamespace(): Namespace | null {
  return liveNamespace;
}

export function getIO(): Server | null {
  return ioInstance;
}

export default initSocket;
