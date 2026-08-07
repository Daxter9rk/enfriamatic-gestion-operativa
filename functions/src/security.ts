import type { CallableRequest } from 'firebase-functions/v2/https';
import { HttpsError } from 'firebase-functions/v2/https';
import { db } from './admin.js';

export type Role = 'admin' | 'operator';
export interface Actor {
  uid: string;
  role: Role;
  status: 'active' | 'inactive' | 'pending' | 'suspended';
  supervisorId: string | null;
  teamId: string | null;
  isPrimaryAdmin: boolean;
  email: string;
}

export function text(value: unknown, field: string, maximum = 250): string {
  if (typeof value !== 'string') throw new HttpsError('invalid-argument', `${field} es requerido.`);
  const normalized = value.trim();
  if (!normalized || normalized.length > maximum) {
    throw new HttpsError('invalid-argument', `${field} no es válido.`);
  }
  return normalized;
}

export function optionalText(value: unknown, field: string, maximum = 250): string | null {
  if (value === null || value === undefined || value === '') return null;
  return text(value, field, maximum);
}

export function objectData(data: unknown): Record<string, unknown> {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new HttpsError('invalid-argument', 'El cuerpo de la solicitud no es válido.');
  }
  return data as Record<string, unknown>;
}

export async function requireActor(request: CallableRequest<unknown>): Promise<Actor> {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Inicia sesión para continuar.');
  const snapshot = await db.collection('users').doc(request.auth.uid).get();
  if (!snapshot.exists) throw new HttpsError('permission-denied', 'El perfil no existe.');
  const data = snapshot.data() as Partial<Actor>;
  if (data.status !== 'active') {
    throw new HttpsError('permission-denied', `El perfil está ${data.status ?? 'incompleto'}.`);
  }
  if (data.role !== 'admin' && data.role !== 'operator') {
    throw new HttpsError('permission-denied', 'El rol no es válido.');
  }
  return {
    uid: request.auth.uid,
    role: data.role,
    status: data.status,
    supervisorId: data.supervisorId ?? null,
    teamId: data.teamId ?? null,
    isPrimaryAdmin: data.isPrimaryAdmin === true,
    email: request.auth.token.email ?? '',
  };
}

export function requireAdmin(actor: Actor): void {
  if (actor.role !== 'admin')
    throw new HttpsError('permission-denied', 'Se requiere administrador.');
}

export function requireRecentAuth(
  request: CallableRequest<unknown>,
  maximumAgeSeconds = 600,
): void {
  const authTime = Number(request.auth?.token.auth_time ?? 0);
  const age = Math.floor(Date.now() / 1000) - authTime;
  if (!authTime || age > maximumAgeSeconds) {
    throw new HttpsError(
      'failed-precondition',
      'Vuelve a autenticarte para esta operación crítica.',
    );
  }
}

export function auditRecord(
  actor: Actor,
  action: string,
  resource: string,
  resourceId: string,
  before: unknown,
  after: unknown,
): Record<string, unknown> {
  return {
    actorId: actor.uid,
    actorRole: actor.role,
    actorSupervisorId: actor.supervisorId,
    actorTeamId: actor.teamId,
    action,
    resource,
    resourceId,
    before: before ?? null,
    after: after ?? null,
    metadata: {},
    createdAt: new Date().toISOString(),
    schemaVersion: 1,
  };
}
