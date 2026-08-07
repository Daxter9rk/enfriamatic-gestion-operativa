export interface EconomicLineInput {
  id: string;
  description: string;
  unit: string;
  quantity: number;
  originalUnitPrice: number;
  discountPercent: number;
  taxRate: number;
}

export interface EconomicAmounts {
  finalUnitPrice: number;
  grossAmount: number;
  discountAmount: number;
  netAmount: number;
  taxAmount: number;
  totalAmount: number;
}

export interface EconomicTotals {
  gross: number;
  discount: number;
  subtotal: number;
  tax: number;
  total: number;
}

const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function calculateQuoteLine<T extends EconomicLineInput>(input: T): T & EconomicAmounts {
  if (
    !Number.isFinite(input.quantity) ||
    !Number.isFinite(input.originalUnitPrice) ||
    !Number.isFinite(input.discountPercent) ||
    !Number.isFinite(input.taxRate) ||
    input.quantity <= 0 ||
    input.originalUnitPrice < 0 ||
    input.discountPercent < 0 ||
    input.discountPercent > 100 ||
    input.taxRate < 0 ||
    input.taxRate > 1
  ) {
    throw new Error('Partida inválida.');
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

export function calculateQuoteTotals(lines: EconomicAmounts[]): EconomicTotals {
  return lines.reduce<EconomicTotals>(
    (result, line) => ({
      gross: money(result.gross + line.grossAmount),
      discount: money(result.discount + line.discountAmount),
      subtotal: money(result.subtotal + line.netAmount),
      tax: money(result.tax + line.taxAmount),
      total: money(result.total + line.totalAmount),
    }),
    { gross: 0, discount: 0, subtotal: 0, tax: 0, total: 0 },
  );
}

export const calculateLine = calculateQuoteLine;
export const totals = calculateQuoteTotals;
export type LineInput = EconomicLineInput;
export type CalculatedLine = EconomicLineInput & EconomicAmounts;
