import { createContext, useContext } from 'react';
import type { User } from 'firebase/auth';
import type { UserProfile } from '../../domain/model';
import { resolveOperationalProfile } from '../../domain/permissions';

export type SessionProblem =
  'profile_missing' | 'pending' | 'inactive' | 'suspended' | 'invalid_role' | 'revoked' | null;

export interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  hasDirectReports: boolean;
  loading: boolean;
  problem: SessionProblem;
  login(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
  reauthenticate(password: string): Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth requiere AuthProvider.');
  return context;
}

export function useOperationalProfile() {
  const { profile, hasDirectReports } = useAuth();
  return profile ? resolveOperationalProfile(profile, hasDirectReports) : null;
}
