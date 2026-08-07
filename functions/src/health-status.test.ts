import { describe, expect, it } from 'vitest';
import { buildHealthStatus } from './health-status.js';

describe('healthCheck', () => {
  it('expone exclusivamente estado técnico seguro', () => {
    expect(buildHealthStatus()).toStrictEqual({
      status: 'ok',
      environment: 'dev',
      service: 'enfriamatic-gestion-operativa',
    });
  });
});
