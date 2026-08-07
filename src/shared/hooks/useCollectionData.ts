import {
  collection,
  onSnapshot,
  query,
  type DocumentData,
  type QueryConstraint,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { getFirebaseServices } from '../services/firebase';

interface CollectionState<T> {
  data: T[];
  loading: boolean;
  error: string | null;
}

const noConstraints: QueryConstraint[] = [];

export function useCollectionData<T>(
  path: string,
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
          data: snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as T),
          loading: false,
          error: null,
        });
      },
      (error) => setState({ data: [], loading: false, error: error.message }),
    );
  }, [constraints, path]);

  return state;
}

export function documentData<T>(value: DocumentData | undefined): T | null {
  return value ? (value as T) : null;
}
