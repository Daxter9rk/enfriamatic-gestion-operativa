export interface LineInput {
  id: string;
  description: string;
  unit: string;
  quantity: number;
  originalUnitPrice: number;
  discountPercent: number;
  taxRate: number;
}

export interface CalculatedLine extends LineInput {
  finalUnitPrice: number;
  grossAmount: number;
  discountAmount: number;
  netAmount: number;
  taxAmount: number;
  totalAmount: number;
}

const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function calculateLine(line: LineInput): CalculatedLine {
  if (
    !Number.isFinite(line.quantity) ||
    !Number.isFinite(line.originalUnitPrice) ||
    !Number.isFinite(line.discountPercent) ||
    !Number.isFinite(line.taxRate) ||
    line.quantity <= 0 ||
    line.originalUnitPrice < 0 ||
    line.discountPercent < 0 ||
    line.discountPercent > 100 ||
    line.taxRate < 0 ||
    line.taxRate > 1
  ) {
    throw new Error('Partida inválida.');
  }
  const grossAmount = money(line.quantity * line.originalUnitPrice);
  const discountAmount = money(grossAmount * (line.discountPercent / 100));
  const netAmount = money(grossAmount - discountAmount);
  const taxAmount = money(netAmount * line.taxRate);
  return {
    ...line,
    finalUnitPrice: money(line.originalUnitPrice * (1 - line.discountPercent / 100)),
    grossAmount,
    discountAmount,
    netAmount,
    taxAmount,
    totalAmount: money(netAmount + taxAmount),
  };
}

export function totals(lines: CalculatedLine[]) {
  return lines.reduce(
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
