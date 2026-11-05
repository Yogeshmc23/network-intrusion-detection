import { afterEach, describe, expect, it, vi } from 'vitest';
import { mlClient } from './mlClient';

describe('MLClient response normalization', () => {
  const originalClient = (mlClient as any).client;

  afterEach(() => {
    Object.defineProperty(mlClient, 'client', { value: originalClient, configurable: true });
  });

  it('preserves the deployed model anomaly score separately from class confidence', async () => {
    const post = vi.fn().mockResolvedValue({
      data: {
        prediction: 'normal',
        confidence: 0.91,
        anomaly_score: 0.09,
        threshold: 0.5,
        is_anomaly: false,
        model_name: 'Decision Tree',
      },
    });
    Object.defineProperty(mlClient, 'client', { value: { post }, configurable: true });

    const result = await mlClient.predict({ protocol_type: 'tcp' });

    expect(result).toMatchObject({
      prediction: 'normal',
      confidence: 0.91,
      rawScore: 0.09,
      threshold: 0.5,
      modelUsed: 'Decision Tree',
      isAnomaly: false,
    });
  });

  it('normalizes snake_case batch results without fabricating a fallback score', async () => {
    const post = vi.fn().mockResolvedValue({
      data: {
        total: 2,
        predictions: [
          { prediction: 'normal', confidence: 0.9, anomaly_score: 0.1, threshold: 0.5, is_anomaly: false, model_name: 'Decision Tree' },
          { prediction: 'anomaly', confidence: 0.8, anomaly_score: 0.8, threshold: 0.5, is_anomaly: true, model_name: 'Decision Tree' },
        ],
      },
    });
    Object.defineProperty(mlClient, 'client', { value: { post }, configurable: true });

    const result = await mlClient.predictBatch([{}, {}]);

    expect(result.anomalyCount).toBe(1);
    expect(result.normalCount).toBe(1);
    expect(result.predictions.map((item) => [item.confidence, item.rawScore, item.modelUsed])).toEqual([
      [0.9, 0.1, 'Decision Tree'],
      [0.8, 0.8, 'Decision Tree'],
    ]);
    expect(post).toHaveBeenCalledWith('/api/predict-batch', { records: [{}, {}] });

    const brokenPost = vi.fn().mockResolvedValue({ data: { predictions: [{ prediction: 'normal' }] } });
    Object.defineProperty(mlClient, 'client', { value: { post: brokenPost }, configurable: true });
    await expect(mlClient.predictBatch([{}])).rejects.toThrow('non-finite batch score');
  });
});
