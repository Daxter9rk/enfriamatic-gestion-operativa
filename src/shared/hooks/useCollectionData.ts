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
          data: snapshot.docs.map((item) => decoder(item.id, item.data())),
          loading: false,
          error: null,
        });
      },
      (error) => setState({ data: [], loading: false, error: error.message }),
    );
  }, [constraints, decoder, path]);

  return state;
}
