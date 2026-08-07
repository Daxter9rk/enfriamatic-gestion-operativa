import { describe, expect, it } from 'vitest';
import { classifyDueDate } from './notifications.js';

describe('notificaciones por vencimiento', () => {
  it('clasifica vencidas, próximas y futuras sin depender de la hora local', () => {
    expect(classifyDueDate('2026-08-06', '2026-08-07')).toBe('overdue');
    expect(classifyDueDate('2026-08-07', '2026-08-07')).toBe('due_soon');
    expect(classifyDueDate('2026-08-10', '2026-08-07')).toBe('due_soon');
    expect(classifyDueDate('2026-08-11', '2026-08-07')).toBeNull();
    expect(classifyDueDate('incorrecta', '2026-08-07')).toBeNull();
  });
});
