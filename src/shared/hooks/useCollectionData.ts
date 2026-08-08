import { collection, onSnapshot, query, type QueryConstraint } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import type { DocumentDecoder } from '../../domain/firestore-validation';
import { getFirebaseServices } from '../services/firebase';

interface CollectionState<T> {
  data: T[];
  loading: boolean;
  error: string | null;
}

const noConstraints: QueryConstraint[] = [];

export function decodeDocuments<T>(
  path: string,
  documents: readonly { id: string; data(): unknown }[],
  decoder: DocumentDecoder<T>,
): T[] {
  return documents.flatMap((item) => {
    try {
      return [decoder(item.id, item.data())];
    } catch (error) {
      console.error(`Documento inválido omitido en ${path}/${item.id}.`, error);
      return [];
    }
  });
}

export function useCollectionData<T>(
  path: string,
  decoder: DocumentDecoder<T>,
  constraints: QueryConstraint[] = noConstraints,
): CollectionState<T> {
  const [state, setState] = useState<CollectionState<T>>({
    data: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    const { firestore } = getFirebaseServices();
    const reference = query(collection(firestore, path), ...constraints);
    return onSnapshot(
      reference,
      (snapshot) => {
        setState({
          data: decodeDocuments(path, snapshot.docs, decoder),
          loading: false,
          error: null,
        });
      },
      (error) => setState({ data: [], loading: false, error: error.message }),
    );
  }, [constraints, decoder, path]);

  return state;
}
