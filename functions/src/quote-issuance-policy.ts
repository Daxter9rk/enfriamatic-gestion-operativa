export interface IssueState {
  status: string;
  locked: boolean;
  folio: string | null;
  idempotencyKey: unknown;
  documentId: unknown;
}

export type IssueDecision =
  | { outcome: 'ready'; folio: string; documentId: string }
  | { outcome: 'generating'; folio: string }
  | { outcome: 'generate'; reuseFolio: string | null };

export class IssueDecisionError extends Error {
  constructor(
    readonly kind: 'already_issued' | 'other_in_progress' | 'not_editable' | 'wrong_retry_key',
    message: string,
  ) {
    super(message);
  }
}

export function decideIssueStart(state: IssueState, idempotencyKey: string): IssueDecision {
  if (state.status === 'issued') {
    if (state.idempotencyKey !== idempotencyKey) {
      throw new IssueDecisionError('already_issued', 'La cotización ya fue emitida.');
    }
    if (typeof state.folio !== 'string' || typeof state.documentId !== 'string') {
      throw new IssueDecisionError('not_editable', 'La emisión previa está incompleta.');
    }
    return { outcome: 'ready', folio: state.folio, documentId: state.documentId };
  }
  if (state.status === 'issuing') {
    if (state.idempotencyKey !== idempotencyKey || typeof state.folio !== 'string') {
      throw new IssueDecisionError('other_in_progress', 'Existe otra emisión en curso.');
    }
    return { outcome: 'generating', folio: state.folio };
  }
  if (state.status !== 'draft' || state.locked) {
    throw new IssueDecisionError('not_editable', 'La cotización no es editable.');
  }
  if (state.idempotencyKey && state.idempotencyKey !== idempotencyKey) {
    throw new IssueDecisionError(
      'wrong_retry_key',
      'Reintenta con la misma clave de la emisión fallida.',
    );
  }
  return { outcome: 'generate', reuseFolio: state.folio };
}
