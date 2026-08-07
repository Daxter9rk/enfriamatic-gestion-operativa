import type { QuoteLine, QuoteLineInput, QuoteStatus, QuoteTotals } from './model';
import {
  calculateQuoteLine as calculateLine,
  calculateQuoteTotals as calculateTotals,
} from './quote-calculations';

export function calculateQuoteLine(input: QuoteLineInput): QuoteLine {
  return calculateLine(input);
}

export function calculateQuoteTotals(lines: QuoteLine[]): QuoteTotals {
  return calculateTotals(lines);
}

const transitions: Record<QuoteStatus, readonly QuoteStatus[]> = {
  draft: ['issuing', 'cancelled'],
  issuing: ['draft', 'issued'],
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
