import mongoose from 'mongoose';
import env from './env';
import logger from '../utils/logger';

export async function connectDB(): Promise<typeof mongoose> {
  try {
    const conn = await mongoose.connect(env.MONGO_URI, {
      autoIndex: true,
      serverSelectionTimeoutMS: 5000,
    });
    logger.info(`MongoDB connected successfully to: ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (error) {
    logger.error('Error connecting to MongoDB:', error);
    // Don't crash immediately in dev, but log error
    if (env.isProd) {
      process.exit(1);
    }
    throw error;
  }
}

mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB disconnected');
});

mongoose.connection.on('reconnected', () => {
  logger.info('MongoDB reconnected');
});

mongoose.connection.on('error', (err) => {
  logger.error('MongoDB connection error:', err);
});

export async function disconnectDB(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    logger.info('MongoDB disconnected cleanly');
  }
}

export default connectDB;
