import { describe, expect, it, vi } from 'vitest';
import { decodeDocuments } from './useCollectionData';

describe('decodeDocuments', () => {
  it('conserva documentos válidos y omite sólo el documento corrupto', () => {
    const report = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const result = decodeDocuments(
      'users',
      [
        { id: 'valid', data: () => ({ name: 'Válido' }) },
        { id: 'invalid', data: () => ({ name: 42 }) },
      ],
      (id, value) => {
        const name = (value as { name: unknown }).name;
        if (typeof name !== 'string') throw new Error('name inválido');
        return { id, name };
      },
    );

    expect(result).toEqual([{ id: 'valid', name: 'Válido' }]);
    expect(report).toHaveBeenCalledWith(
      'Documento inválido omitido en users/invalid.',
      expect.any(Error),
    );
    report.mockRestore();
  });
});
