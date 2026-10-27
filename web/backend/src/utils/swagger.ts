import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import env from '../config/env';

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'CyberShield IDS API',
    version: '1.0.0',
    description:
      'Production Express.js & TypeScript API backend for the Intrusion Detection System web platform. Integrates with FastAPI ML microservice, MongoDB prediction history, Redis caching, and Socket.IO live traffic streaming.',
    contact: {
      name: 'CyberShield IDS Team',
    },
  },
  servers: [
    {
      url: `http://localhost:${env.PORT}`,
      description: 'Local development server',
    },
    {
      url: 'http://backend:5000',
      description: 'Docker internal network server',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter your JWT access token in the format: Bearer <token>',
      },
    },
    schemas: {
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', example: '6529f8a3b8e5c1234567890a' },
          email: { type: 'string', format: 'email', example: 'analyst@cybershield.local' },
          name: { type: 'string', example: 'Security Analyst' },
          role: { type: 'string', enum: ['admin', 'analyst'], example: 'analyst' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      AuthResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          user: { $ref: '#/components/schemas/User' },
          accessToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsIn...' },
          refreshToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsIn...' },
        },
      },
      Prediction: {
        type: 'object',
        properties: {
          id: { type: 'string', example: '6529f8a3b8e5c1234567890b' },
          userId: { type: 'string', example: '6529f8a3b8e5c1234567890a' },
          inputFeatures: { type: 'object', description: '41 NSL-KDD features' },
          prediction: { type: 'string', enum: ['normal', 'anomaly'], example: 'anomaly' },
          confidence: { type: 'number', example: 0.9423 },
          modelUsed: { type: 'string', example: 'LightGBM (optional)' },
          threshold: { type: 'number', example: 0.5725 },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      PredictionResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          predictionId: { type: 'string' },
          prediction: { type: 'string', example: 'anomaly' },
          confidence: { type: 'number', example: 0.895 },
          threshold: { type: 'number', example: 0.5 },
          modelUsed: { type: 'string', example: 'LightGBM (optional)' },
          isAnomaly: { type: 'boolean', example: true },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string', example: 'Error description' },
          errors: { type: 'array', items: { type: 'object' } },
        },
      },
    },
  },
};

const options: swaggerJSDoc.Options = {
  swaggerDefinition,
  apis: ['./src/routes/*.ts', './dist/routes/*.js'],
};

export const swaggerSpec = swaggerJSDoc(options);
export { swaggerUi };
export default swaggerSpec;
