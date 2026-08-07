export interface HealthStatus {
  status: 'ok';
  environment: 'dev';
  service: 'enfriamatic-gestion-operativa';
}

export function buildHealthStatus(): HealthStatus {
  return {
    status: 'ok',
    environment: 'dev',
    service: 'enfriamatic-gestion-operativa',
  };
}
