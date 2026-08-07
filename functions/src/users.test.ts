import { describe, expect, it } from 'vitest';
import type { ProfileRecord } from './contracts.js';
import { canManageUserAction } from './user-policy.js';

const profile = (overrides: Partial<ProfileRecord>): ProfileRecord => ({
  uid: 'user',
  email: 'user@example.test',
  displayName: 'User',
  role: 'operator',
  status: 'active',
  supervisorId: null,
  teamId: null,
  isPrimaryAdmin: false,
  ...overrides,
});

describe('managed user authorization', () => {
  const primary = profile({ uid: 'primary', role: 'admin', isPrimaryAdmin: true });
  const promoted = profile({ uid: 'promoted', role: 'admin' });
  const anotherAdmin = profile({ uid: 'admin-2', role: 'admin' });
  const operator = profile({ uid: 'operator' });

  it('protects the primary administrator and all self mutations', () => {
    expect(canManageUserAction(promoted, primary, 'deactivate')).toBe(false);
    expect(canManageUserAction(primary, primary, 'deactivate')).toBe(false);
    expect(canManageUserAction(promoted, promoted, 'suspend')).toBe(false);
  });

  it('prevents promoted admins from escalating or demoting admins', () => {
    expect(canManageUserAction(promoted, operator, 'promote')).toBe(false);
    expect(canManageUserAction(promoted, anotherAdmin, 'demote')).toBe(false);
    expect(canManageUserAction(primary, operator, 'promote')).toBe(true);
    expect(canManageUserAction(primary, anotherAdmin, 'demote')).toBe(true);
  });

  it('allows ordinary operator administration without crossing admin protections', () => {
    expect(canManageUserAction(promoted, operator, 'suspend')).toBe(true);
    expect(canManageUserAction(promoted, operator, 'assignHierarchy')).toBe(true);
  });
});
