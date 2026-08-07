import { describe, expect, it } from 'vitest';
import { canTransitionRequest, isOperationalStageValid, isOverdue } from './requests';

describe('ciclo de solicitudes', () => {
  it('separa estado de etapa operativa', () => {
    expect(isOperationalStageValid('in_progress', 'quoting')).toBe(true);
    expect(isOperationalStageValid('completed', 'follow_up')).toBe(true);
    expect(isOperationalStageValid('pending', 'executing')).toBe(false);
  });

  it('impide reabrir una solicitud completada mediante transición directa', () => {
    expect(canTransitionRequest('pending', 'assigned')).toBe(true);
    expect(canTransitionRequest('completed', 'in_progress')).toBe(false);
  });

  it('calcula atraso sólo para solicitudes abiertas', () => {
    const now = new Date('2026-08-07T12:00:00');
    expect(isOverdue('2026-08-06', 'assigned', now)).toBe(true);
    expect(isOverdue('2026-08-06', 'completed', now)).toBe(false);
    expect(isOverdue('2026-08-08', 'in_progress', now)).toBe(false);
  });
});
