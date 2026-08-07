import {
  browserLocalPersistence,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { doc, getDoc, getDocs, limit, query, collection, where } from 'firebase/firestore';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import type { UserProfile } from '../../domain/model';
import { resolveOperationalProfile } from '../../domain/permissions';
import { getFirebaseServices } from '../../shared/services/firebase';

type SessionProblem =
  'profile_missing' | 'pending' | 'inactive' | 'suspended' | 'invalid_role' | 'revoked' | null;

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  hasDirectReports: boolean;
  loading: boolean;
  problem: SessionProblem;
  login(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
function stringValue(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function normalizeProfile(uid: string, data: Record<string, unknown>): UserProfile | null {
  if (data.role !== 'admin' && data.role !== 'operator') return null;
  if (!['active', 'inactive', 'pending', 'suspended'].includes(String(data.status))) return null;
  return {
    uid,
    email: stringValue(data.email, ''),
    displayName: stringValue(data.displayName, 'Usuario DEV'),
    role: data.role,
    status: data.status as UserProfile['status'],
    supervisorId: typeof data.supervisorId === 'string' ? data.supervisorId : null,
    teamId: typeof data.teamId === 'string' ? data.teamId : null,
    isPrimaryAdmin: data.isPrimaryAdmin === true,
  };
}

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
            const normalized = normalizeProfile(currentUser.uid, snapshot.data());
            if (!normalized) {
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
    }),
    [auth, hasDirectReports, loading, problem, profile, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth requiere AuthProvider.');
  return context;
}

export function useOperationalProfile() {
  const { profile, hasDirectReports } = useAuth();
  return profile ? resolveOperationalProfile(profile, hasDirectReports) : null;
}
