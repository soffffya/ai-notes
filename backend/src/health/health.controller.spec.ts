import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('returns status ok with an ISO timestamp', () => {
    const controller = new HealthController();

    const result = controller.getHealth();

    expect(result.status).toBe('ok');
    expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
  });
});
