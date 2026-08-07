import { describe, expect, it } from 'vitest';
import {
  assertQuoteEditable,
  calculateQuoteLine,
  calculateQuoteTotals,
  canTransitionQuote,
  validateDiscountLimit,
} from './quotes';

const base = {
  id: 'line-1',
  catalogItemId: null,
  code: 'DEV-SERVICE',
  description: 'Servicio ficticio',
  unit: 'servicio',
  quantity: 2,
  originalUnitPrice: 100,
  discountPercent: 10,
  taxRate: 0.16,
};

describe('cálculos de cotización', () => {
  it('conserva precio original y calcula descuento, IVA y total', () => {
    expect(calculateQuoteLine(base)).toMatchObject({
      finalUnitPrice: 90,
      grossAmount: 200,
      discountAmount: 20,
      netAmount: 180,
      taxAmount: 28.8,
      totalAmount: 208.8,
    });
  });

  it('acumula totales con redondeo monetario', () => {
    const line = calculateQuoteLine(base);
    expect(calculateQuoteTotals([line, line])).toEqual({
      gross: 400,
      discount: 40,
      subtotal: 360,
      tax: 57.6,
      total: 417.6,
    });
  });

  it('rechaza entradas y descuentos fuera de política', () => {
    expect(() => calculateQuoteLine({ ...base, quantity: 0 })).toThrow();
    expect(() => calculateQuoteLine({ ...base, discountPercent: 101 })).toThrow();
    expect(() => validateDiscountLimit([calculateQuoteLine(base)], 5)).toThrow();
  });
});

describe('inmutabilidad', () => {
  it('permite editar sólo borradores no bloqueados', () => {
    expect(() => assertQuoteEditable('draft', false)).not.toThrow();
    expect(() => assertQuoteEditable('issued', true)).toThrow(/no puede modificarse/);
  });

  it('sólo permite transiciones explícitas', () => {
    expect(canTransitionQuote('draft', 'issued')).toBe(true);
    expect(canTransitionQuote('issued', 'draft')).toBe(false);
    expect(canTransitionQuote('accepted', 'cancelled')).toBe(false);
  });
});
