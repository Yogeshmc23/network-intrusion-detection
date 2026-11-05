import { describe, expect, it } from 'vitest';
import { LiveStreamService } from './liveStream';

describe('LiveStreamService', () => {
  it('does not start a generated feed when no real event source exists', () => {
    const service = new LiveStreamService();
    const status = service.start({ emit: () => undefined } as never);

    expect(status.sourceConfigured).toBe(false);
    expect(status.isRunning).toBe(false);
  });
});
