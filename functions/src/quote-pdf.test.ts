import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { buildQuotePdf, type QuoteGeneration } from './quotes.js';

describe('multi-page quote PDF', () => {
  it('paginates every reasonable line set and preserves totals, notes and conditions', async () => {
    const lines = Array.from({ length: 55 }, (_, index) => ({
      id: `line-${index}`,
      description: `Partida ficticia extensa número ${index + 1} para validar paginación`,
      unit: 'pieza',
      quantity: 1,
      originalUnitPrice: 100,
      discountPercent: 0,
      taxRate: 0.16,
      finalUnitPrice: 100,
      grossAmount: 100,
      discountAmount: 0,
      netAmount: 100,
      taxAmount: 16,
      totalAmount: 116,
    }));
    const generation: QuoteGeneration = {
      quoteId: 'quote-test',
      folio: 'COT-DEV-2026-00001',
      token: 'token',
      idempotencyKey: 'key',
      lines,
      summary: { gross: 5500, discount: 0, subtotal: 5500, tax: 880, total: 6380 },
      clientName: 'Cliente ficticio DEV',
      notes: 'Nota de prueba que debe renderizarse después de todas las partidas.',
      conditions: ['Condición ficticia uno.', 'Condición ficticia dos.'],
      configurationSnapshot: { policyStatus: 'dev_provisional' },
    };
    const bytes = await buildQuotePdf(generation);
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBeGreaterThan(2);
    expect(bytes.byteLength).toBeGreaterThan(5000);
  });
});
