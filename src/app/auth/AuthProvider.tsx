import {
  browserLocalPersistence,
  EmailAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  setPersistence,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { doc, getDoc, getDocs, limit, query, collection, where } from 'firebase/firestore';
import { useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import type { UserProfile } from '../../domain/model';
import { decodeUserProfile } from '../../domain/firestore-validation';
import { getFirebaseServices } from '../../shared/services/firebase';
import { AuthContext, type AuthContextValue, type SessionProblem } from './AuthContext';

export function AuthProvider({ children }: PropsWithChildren) {
  const { auth, firestore } = getFirebaseServices();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [hasDirectReports, setHasDirectReports] = useState(false);
  const [loading, setLoading] = useState(true);
  const [problem, setProblem] = useState<SessionProblem>(null);

  useEffect(() => {
    void setPersistence(auth, browserLocalPersistence);
    return onAuthStateChanged(
      auth,
      (currentUser) => {
        void (async () => {
          setLoading(true);
          setUser(currentUser);
          setProfile(null);
          setHasDirectReports(false);
          setProblem(null);
          if (!currentUser) {
            setLoading(false);
            return;
          }
          try {
            const snapshot = await getDoc(doc(firestore, 'users', currentUser.uid));
            if (!snapshot.exists()) {
              setProblem('profile_missing');
              return;
            }
            let normalized: UserProfile;
            try {
              normalized = decodeUserProfile(currentUser.uid, snapshot.data());
            } catch {
              setProblem('invalid_role');
              return;
            }
            setProfile(normalized);
            if (normalized.status !== 'active') {
              setProblem(normalized.status);
              return;
            }
            if (normalized.role === 'operator') {
              const reports = await getDocs(
                query(
                  collection(firestore, 'users'),
                  where('supervisorId', '==', normalized.uid),
                  where('status', '==', 'active'),
                  limit(1),
                ),
              );
              setHasDirectReports(!reports.empty);
            }
          } catch {
            setProblem('revoked');
          } finally {
            setLoading(false);
          }
        })();
      },
      () => {
        setProblem('revoked');
        setLoading(false);
      },
    );
  }, [auth, firestore]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      hasDirectReports,
      loading,
      problem,
      async login(email, password) {
        await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
      },
      async logout() {
        await firebaseSignOut(auth);
      },
      async reauthenticate(password) {
        if (!auth.currentUser?.email) throw new Error('No existe una sesión con correo.');
        await reauthenticateWithCredential(
          auth.currentUser,
          EmailAuthProvider.credential(auth.currentUser.email, password),
        );
      },
    }),
    [auth, hasDirectReports, loading, problem, profile, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
