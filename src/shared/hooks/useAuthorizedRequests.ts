import { collection, onSnapshot, query, where, type QueryConstraint } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { useAuth } from '../../app/auth/AuthContext';
import type { ServiceRequest } from '../../domain/model';
import { decodeServiceRequest } from '../../domain/firestore-validation';
import { getFirebaseServices } from '../services/firebase';
import { decodeDocuments } from './useCollectionData';

interface State {
  data: ServiceRequest[];
  loading: boolean;
  error: string | null;
}

const none: QueryConstraint[] = [];

export function useAuthorizedRequests(extraConstraints: QueryConstraint[] = none): State {
  const { profile } = useAuth();
  const [state, setState] = useState<State>({ data: [], loading: true, error: null });

  useEffect(() => {
    if (!profile) {
      setState({ data: [], loading: false, error: null });
      return;
    }
    const { firestore } = getFirebaseServices();
    const base = collection(firestore, 'requests');
    const scopes =
      profile.role === 'admin'
        ? [query(base, ...extraConstraints)]
        : [
            query(base, where('createdBy', '==', profile.uid), ...extraConstraints),
            query(base, where('assigneeId', '==', profile.uid), ...extraConstraints),
            query(base, where('supervisorId', '==', profile.uid), ...extraConstraints),
          ];
    const results = new Map<number, ServiceRequest[]>();
    let loaded = 0;
    let stopped = false;
    const publish = () => {
      const merged = new Map<string, ServiceRequest>();
      for (const requests of results.values()) {
        for (const item of requests) merged.set(item.id, item);
      }
      setState({ data: [...merged.values()], loading: loaded < scopes.length, error: null });
    };
    const unsubscribes = scopes.map((scope, index) =>
      onSnapshot(
        scope,
        (snapshot) => {
          if (stopped) return;
          if (!results.has(index)) loaded += 1;
          results.set(index, decodeDocuments('requests', snapshot.docs, decodeServiceRequest));
          publish();
        },
        (error) => {
          if (!stopped) setState({ data: [], loading: false, error: error.message });
        },
      ),
    );
    return () => {
      stopped = true;
      unsubscribes.forEach((unsubscribe) => unsubscribe());
    };
  }, [extraConstraints, profile]);

  return state;
}
