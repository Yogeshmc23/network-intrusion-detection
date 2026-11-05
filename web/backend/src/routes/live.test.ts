import { describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { liveRouter } from './live';
import { errorHandler } from '../middleware/errorHandler';

const app = express();
app.use(express.json());
app.use('/api/live', liveRouter);
app.use(errorHandler);

describe('live event-source routes', () => {
  it('reports that no live source is configured', async () => {
    const response = await request(app).get('/api/live/status');
    expect(response.status).toBe(200);
    expect(response.body.status).toMatchObject({ sourceConfigured: false, isRunning: false });
    expect(response.body.status.recordsEmitted).toBeUndefined();
  });

  it('refuses to start a simulated feed as if it were live monitoring', async () => {
    const response = await request(app).post('/api/live/start').send({ speed: 1 });
    expect(response.status).toBe(503);
    expect(response.body.code).toBe('LIVE_SOURCE_UNAVAILABLE');
  });
});
