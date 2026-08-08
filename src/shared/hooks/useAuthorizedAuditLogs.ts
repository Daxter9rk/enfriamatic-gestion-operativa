import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { useAuth } from '../../app/auth/AuthContext';
import type { AuditLog } from '../../domain/model';
import { decodeAuditLog } from '../../domain/firestore-validation';
import { getFirebaseServices } from '../services/firebase';
import { decodeDocuments } from './useCollectionData';

export function useAuthorizedAuditLogs() {
  const { profile } = useAuth();
  const [state, setState] = useState<{ data: AuditLog[]; loading: boolean; error: string | null }>({
    data: [],
    loading: true,
    error: null,
  });
  useEffect(() => {
    if (!profile) return;
    const base = collection(getFirebaseServices().firestore, 'auditLogs');
    const scopes =
      profile.role === 'admin'
        ? [query(base)]
        : [
            query(base, where('actorId', '==', profile.uid)),
            query(base, where('actorSupervisorId', '==', profile.uid)),
          ];
    const values = new Map<number, AuditLog[]>();
    let loaded = 0;
    const publish = () => {
      const merged = new Map<string, AuditLog>();
      for (const logs of values.values()) for (const log of logs) merged.set(log.id, log);
      setState({ data: [...merged.values()], loading: loaded < scopes.length, error: null });
    };
    const unsubscribes = scopes.map((scope, index) =>
      onSnapshot(
        scope,
        (snapshot) => {
          if (!values.has(index)) loaded += 1;
          values.set(index, decodeDocuments('auditLogs', snapshot.docs, decodeAuditLog));
          publish();
        },
        (error) => setState({ data: [], loading: false, error: error.message }),
      ),
    );
    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, [profile]);
  return state;
}
