import type { QuoteLine, QuoteLineInput, QuoteStatus, QuoteTotals } from './model';

const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function calculateQuoteLine(input: QuoteLineInput): QuoteLine {
  if (input.quantity <= 0 || input.originalUnitPrice < 0) {
    throw new Error('Cantidad y precio deben ser válidos.');
  }
  if (input.discountPercent < 0 || input.discountPercent > 100) {
    throw new Error('El descuento debe estar entre 0 y 100.');
  }
  if (input.taxRate < 0 || input.taxRate > 1) {
    throw new Error('La tasa de impuesto debe estar entre 0 y 1.');
  }
  const grossAmount = money(input.quantity * input.originalUnitPrice);
  const discountAmount = money(grossAmount * (input.discountPercent / 100));
  const netAmount = money(grossAmount - discountAmount);
  const taxAmount = money(netAmount * input.taxRate);
  return {
    ...input,
    finalUnitPrice: money(input.originalUnitPrice * (1 - input.discountPercent / 100)),
    grossAmount,
    discountAmount,
    netAmount,
    taxAmount,
    totalAmount: money(netAmount + taxAmount),
  };
}

export function calculateQuoteTotals(lines: QuoteLine[]): QuoteTotals {
  return lines.reduce<QuoteTotals>(
    (totals, line) => ({
      gross: money(totals.gross + line.grossAmount),
      discount: money(totals.discount + line.discountAmount),
      subtotal: money(totals.subtotal + line.netAmount),
      tax: money(totals.tax + line.taxAmount),
      total: money(totals.total + line.totalAmount),
    }),
    { gross: 0, discount: 0, subtotal: 0, tax: 0, total: 0 },
  );
}

const transitions: Record<QuoteStatus, readonly QuoteStatus[]> = {
  draft: ['issued', 'cancelled'],
  issued: ['sent', 'cancelled'],
  sent: ['accepted', 'rejected', 'expired', 'cancelled'],
  accepted: [],
  rejected: [],
  cancelled: [],
  expired: [],
};

export function canTransitionQuote(from: QuoteStatus, to: QuoteStatus): boolean {
  return transitions[from].includes(to);
}

export function assertQuoteEditable(status: QuoteStatus, locked: boolean): void {
  if (status !== 'draft' || locked) {
    throw new Error('Una cotización emitida o bloqueada no puede modificarse.');
  }
}

export function validateDiscountLimit(lines: QuoteLine[], maximumPercent: number): void {
  if (maximumPercent < 0 || maximumPercent > 100) {
    throw new Error('La política de descuento configurada es inválida.');
  }
  if (lines.some((line) => line.discountPercent > maximumPercent)) {
    throw new Error('Una partida excede el descuento máximo configurado.');
  }
}
