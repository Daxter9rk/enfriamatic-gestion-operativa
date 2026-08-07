import type { OperationalProfile, UserProfile } from './model';

export type Permission =
  | 'dashboard:admin'
  | 'dashboard:team'
  | 'dashboard:own'
  | 'users:manage'
  | 'users:view'
  | 'team:assign'
  | 'clients:write'
  | 'sites:write'
  | 'equipment:write'
  | 'requests:create'
  | 'requests:assign'
  | 'requests:work'
  | 'catalog:write'
  | 'catalog:read'
  | 'quotes:write'
  | 'activity:global'
  | 'activity:team'
  | 'activity:own'
  | 'settings:write'
  | 'manual:admin'
  | 'manual:operator';

const profilePermissions: Record<OperationalProfile, ReadonlySet<Permission>> = {
  primary_admin: new Set([
    'dashboard:admin',
    'users:manage',
    'users:view',
    'clients:write',
    'sites:write',
    'equipment:write',
    'requests:create',
    'requests:assign',
    'requests:work',
    'catalog:write',
    'catalog:read',
    'quotes:write',
    'activity:global',
    'settings:write',
    'manual:admin',
    'manual:operator',
  ]),
  promoted_admin: new Set([
    'dashboard:admin',
    'users:manage',
    'users:view',
    'clients:write',
    'sites:write',
    'equipment:write',
    'requests:create',
    'requests:assign',
    'requests:work',
    'catalog:write',
    'catalog:read',
    'quotes:write',
    'activity:global',
    'settings:write',
    'manual:admin',
    'manual:operator',
  ]),
  supervisor: new Set([
    'dashboard:team',
    'users:view',
    'team:assign',
    'requests:create',
    'requests:assign',
    'requests:work',
    'catalog:read',
    'quotes:write',
    'activity:team',
    'manual:operator',
  ]),
  operator: new Set([
    'dashboard:own',
    'requests:create',
    'requests:work',
    'catalog:read',
    'quotes:write',
    'activity:own',
    'manual:operator',
  ]),
};

export function isActiveProfile(profile: UserProfile | null): profile is UserProfile {
  return profile?.status === 'active';
}

export function resolveOperationalProfile(
  profile: UserProfile,
  hasDirectReports: boolean,
): OperationalProfile {
  if (profile.role === 'admin') {
    return profile.isPrimaryAdmin ? 'primary_admin' : 'promoted_admin';
  }
  return hasDirectReports ? 'supervisor' : 'operator';
}

export function hasPermission(
  profile: UserProfile | null,
  hasDirectReports: boolean,
  permission: Permission,
): boolean {
  if (!isActiveProfile(profile)) return false;
  return profilePermissions[resolveOperationalProfile(profile, hasDirectReports)].has(permission);
}

export function canAssignTo(actor: UserProfile, recipient: UserProfile): boolean {
  if (!isActiveProfile(actor) || !isActiveProfile(recipient) || recipient.role !== 'operator') {
    return false;
  }
  if (actor.role === 'admin') return true;
  return recipient.supervisorId === actor.uid && recipient.teamId === actor.teamId;
}

export function canMutateUser(actor: UserProfile, target: UserProfile): boolean {
  if (!isActiveProfile(actor) || actor.role !== 'admin') return false;
  return !target.isPrimaryAdmin;
}

export function canReadActivity(actor: UserProfile, owner: UserProfile): boolean {
  if (!isActiveProfile(actor)) return false;
  if (actor.role === 'admin' || actor.uid === owner.uid) return true;
  return owner.supervisorId === actor.uid && owner.teamId === actor.teamId;
}
