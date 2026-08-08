import { collection, onSnapshot, query, where, type QueryConstraint } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { useAuth } from '../../app/auth/AuthContext';
import type { Quote } from '../../domain/model';
import { decodeQuote } from '../../domain/firestore-validation';
import { getFirebaseServices } from '../services/firebase';
import { decodeDocuments } from './useCollectionData';

const none: QueryConstraint[] = [];

export function useAuthorizedQuotes(extraConstraints: QueryConstraint[] = none) {
  const { profile } = useAuth();
  const [state, setState] = useState<{ data: Quote[]; loading: boolean; error: string | null }>({
    data: [],
    loading: true,
    error: null,
  });
  useEffect(() => {
    if (!profile) return;
    const base = collection(getFirebaseServices().firestore, 'quotes');
    const scopes =
      profile.role === 'admin'
        ? [query(base, ...extraConstraints)]
        : [
            query(base, where('createdBy', '==', profile.uid), ...extraConstraints),
            query(base, where('supervisorId', '==', profile.uid), ...extraConstraints),
          ];
    const values = new Map<number, Quote[]>();
    let loaded = 0;
    const publish = () => {
      const merged = new Map<string, Quote>();
      for (const quotes of values.values()) for (const quote of quotes) merged.set(quote.id, quote);
      setState({ data: [...merged.values()], loading: loaded < scopes.length, error: null });
    };
    const unsubscribes = scopes.map((scope, index) =>
      onSnapshot(
        scope,
        (snapshot) => {
          if (!values.has(index)) loaded += 1;
          values.set(index, decodeDocuments('quotes', snapshot.docs, decodeQuote));
          publish();
        },
        (error) => setState({ data: [], loading: false, error: error.message }),
      ),
    );
    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, [extraConstraints, profile]);
  return state;
}
