import { describe, expect, it } from 'vitest';
import { decideIssueStart } from './quote-issuance-policy.js';

describe('idempotent quote issuance', () => {
  it('turns a concurrent second invocation into a stable generating result', () => {
    expect(
      decideIssueStart(
        {
          status: 'issuing',
          locked: false,
          folio: 'COT-DEV-2026-00001',
          idempotencyKey: 'same',
          documentId: null,
        },
        'same',
      ),
    ).toEqual({ outcome: 'generating', folio: 'COT-DEV-2026-00001' });
  });

  it('returns the completed result when the client retries after a lost response', () => {
    expect(
      decideIssueStart(
        {
          status: 'issued',
          locked: true,
          folio: 'COT-DEV-2026-00001',
          idempotencyKey: 'same',
          documentId: 'quote-q1',
        },
        'same',
      ),
    ).toEqual({ outcome: 'ready', folio: 'COT-DEV-2026-00001', documentId: 'quote-q1' });
  });

  it('reuses the consumed folio after a PDF failure and rejects a different retry key', () => {
    const failed = {
      status: 'draft',
      locked: false,
      folio: 'COT-DEV-2026-00001',
      idempotencyKey: 'same',
      documentId: null,
    };
    expect(decideIssueStart(failed, 'same')).toEqual({
      outcome: 'generate',
      reuseFolio: failed.folio,
    });
    expect(() => decideIssueStart(failed, 'different')).toThrow('misma clave');
  });
});
