import { describe, expect, it } from 'vitest';
import { calculateLine, totals } from '../../src/domain/quote-calculations.js';

describe('revalidación backend de cotizaciones', () => {
  it('recalcula los importes y no confía en totales del navegador', () => {
    const line = calculateLine({
      id: 'line-dev',
      description: 'Servicio ficticio',
      unit: 'servicio',
      quantity: 3,
      originalUnitPrice: 725.5,
      discountPercent: 12,
      taxRate: 0.16,
    });
    expect(line).toMatchObject({
      grossAmount: 2176.5,
      discountAmount: 261.18,
      netAmount: 1915.32,
      taxAmount: 306.45,
      totalAmount: 2221.77,
    });
    expect(totals([line]).total).toBe(2221.77);
  });

  it('rechaza partidas manipuladas', () => {
    expect(() =>
      calculateLine({
        id: 'bad',
        description: 'Inválida',
        unit: 'pieza',
        quantity: -1,
        originalUnitPrice: 1,
        discountPercent: 0,
        taxRate: 0.16,
      }),
    ).toThrow('Partida inválida');
  });
});
