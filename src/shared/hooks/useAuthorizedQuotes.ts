import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { useAuth } from '../../app/auth/AuthContext';
import type { Quote } from '../../domain/model';
import { decodeQuote } from '../../domain/firestore-validation';
import { getFirebaseServices } from '../services/firebase';

export function useAuthorizedQuotes() {
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
        ? [query(base)]
        : [
            query(base, where('createdBy', '==', profile.uid)),
            query(base, where('supervisorId', '==', profile.uid)),
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
          values.set(
            index,
            snapshot.docs.map((item) => decodeQuote(item.id, item.data())),
          );
          publish();
        },
        (error) => setState({ data: [], loading: false, error: error.message }),
      ),
    );
    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, [profile]);
  return state;
}
