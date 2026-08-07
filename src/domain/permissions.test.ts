import { describe, expect, it } from 'vitest';
import type { UserProfile } from './model';
import {
  canAssignTo,
  canMutateUser,
  hasPermission,
  resolveOperationalProfile,
} from './permissions';

const profile = (overrides: Partial<UserProfile> = {}): UserProfile => ({
  uid: 'operator-1',
  email: 'operator1@example.test',
  displayName: 'Operador Uno',
  role: 'operator',
  status: 'active',
  supervisorId: null,
  teamId: 'team-1',
  isPrimaryAdmin: false,
  ...overrides,
});

describe('perfiles operativos', () => {
  it('deriva supervisor por subordinados sin crear un tercer rol', () => {
    expect(resolveOperationalProfile(profile(), true)).toBe('supervisor');
    expect(resolveOperationalProfile(profile(), false)).toBe('operator');
  });

  it('bloquea perfiles no activos', () => {
    expect(hasPermission(profile({ status: 'suspended' }), false, 'quotes:write')).toBe(false);
  });
});

describe('jerarquía', () => {
  it('permite al supervisor asignar sólo subordinados activos de su equipo', () => {
    const supervisor = profile({ uid: 'supervisor-1' });
    const subordinate = profile({ uid: 'operator-2', supervisorId: supervisor.uid });
    expect(canAssignTo(supervisor, subordinate)).toBe(true);
    expect(canAssignTo(supervisor, { ...subordinate, teamId: 'team-2' })).toBe(false);
    expect(canAssignTo(supervisor, { ...subordinate, status: 'inactive' })).toBe(false);
  });

  it('impide modificar destructivamente al administrador principal', () => {
    const admin = profile({ uid: 'admin-2', role: 'admin' });
    const primary = profile({ uid: 'admin-1', role: 'admin', isPrimaryAdmin: true });
    expect(canMutateUser(admin, primary)).toBe(false);
    expect(canMutateUser(primary, primary)).toBe(false);
  });
});
