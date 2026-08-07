import type { ProfileRecord } from './contracts.js';

export type UserAction =
  'activate' | 'suspend' | 'deactivate' | 'promote' | 'demote' | 'assignHierarchy';

export function canManageUserAction(
  actor: ProfileRecord,
  target: ProfileRecord,
  action: UserAction,
): boolean {
  if (actor.role !== 'admin' || actor.status !== 'active') return false;
  if (target.isPrimaryAdmin || actor.uid === target.uid) return false;
  if (!actor.isPrimaryAdmin && target.role === 'admin') return false;
  if ((action === 'promote' || action === 'demote') && !actor.isPrimaryAdmin) return false;
  return true;
}
